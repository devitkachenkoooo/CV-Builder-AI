import html2pdf from 'html2pdf.js';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface PdfFromUrlOptions {
  url?: string;
  htmlContent?: string;
  filename?: string;
  onLoadingChange?: (loading: boolean) => void;
  windowWidth?: number;
  contentWidthMm?: number;
}

interface PdfFromElementOptions {
  element: HTMLElement;
  filename?: string;
  onLoadingChange?: (loading: boolean) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * A4 page height in CSS pixels at 794px width (210mm at ~96dpi).
 * 794px / 210mm * 297mm = 1123px
 */
const A4_HEIGHT_PX = 1123;

/**
 * Safe zone: if a block's bottom edge is within this many pixels of the
 * page bottom, move it to the next page.
 */
const PAGE_BOTTOM_SAFE_PX = 80;

/**
 * Gap inserted at the top of every new page before the first block.
 */
const PAGE_TOP_PADDING_PX = 60;

// ─── Core layout helpers ──────────────────────────────────────────────────────

/**
 * Walk the offsetParent chain to compute an element's top position
 * relative to a known ancestor container.
 *
 * WHY: getBoundingClientRect() is viewport-relative and returns garbage
 * when the iframe is off-screen. offsetTop is layout-relative and always
 * correct regardless of where the iframe is positioned.
 */
function getOffsetTopFromContainer(
  element: HTMLElement,
  container: HTMLElement,
): number {
  let top = 0;
  let el: HTMLElement | null = element;
  while (el && el !== container) {
    top += el.offsetTop;
    el = el.offsetParent as HTMLElement | null;
  }
  return top;
}

/**
 * Collect all direct grandchildren of <main> inside the container.
 * These are the ONLY elements considered for page-break decisions.
 * Selector equivalent: main > * > *
 */
function getBreakCandidates(container: HTMLElement): HTMLElement[] {
  const main = container.querySelector('main') as HTMLElement | null;
  if (!main) {
    return [];
  }

  const skipTags = new Set(['script', 'style', 'link', 'meta', 'noscript']);
  const candidates: HTMLElement[] = [];

  for (const parent of Array.from(main.children)) {
    if (skipTags.has(parent.tagName.toLowerCase())) continue;
    for (const child of Array.from(parent.children)) {
      if (skipTags.has(child.tagName.toLowerCase())) continue;
      candidates.push(child as HTMLElement);
    }
  }

  return candidates;
}

// ─── Page break insertion ─────────────────────────────────────────────────────

/**
 * THE KEY INSIGHT:
 *
 * Instead of inserting a 0-height marker + padding-top on the block,
 * we insert a SOLID SPACER that fills the remaining space on the current
 * page (with bgColor), followed by a TOP-PADDING spacer for the new page.
 *
 * This means:
 *   - The block's new offsetTop = currentPageEnd + PAGE_TOP_PADDING_PX
 *   - All subsequent blocks' positions are exact multiples of A4_HEIGHT_PX + some offset
 *   - html2pdf crops the canvas every 1123px and gets exactly the right content
 *     on every page — NO mismatch between our math and html2pdf's math.
 *
 * Without this, 0-height markers at y=900 would cause html2pdf to still split
 * at y=1123 (its natural A4 boundary), making the second page start wrong.
 */
function insertPageBreaks(
  doc: Document,
  container: HTMLElement,
  bgColor: string,
): void {
  // Trigger layout stabilisation before measuring
  void container.offsetHeight;

  const candidates = getBreakCandidates(container);

  for (const block of candidates) {
    // Re-measure every iteration because previous insertions shift things
    const blockTop = getOffsetTopFromContainer(block, container);
    const blockBottom = blockTop + block.offsetHeight;

    // Which full A4 page does this block's top land on?
    const pageIndex = Math.floor(blockTop / A4_HEIGHT_PX);
    const currentPageEnd = (pageIndex + 1) * A4_HEIGHT_PX;  // bottom of that page
    const safeEnd = currentPageEnd - PAGE_BOTTOM_SAFE_PX;

    // Position of blockTop within the current page (0 = very top)
    const relTop = blockTop - pageIndex * A4_HEIGHT_PX;

    // Avoid double-breaking a block that was JUST moved to the top of a page
    const isAlreadyAtTop = relTop < (PAGE_TOP_PADDING_PX + 10);
    const crossesSafeZone = blockBottom > safeEnd;

    if (!crossesSafeZone || isAlreadyAtTop) continue;

    // ── Insert spacer that fills the rest of the current page ──────────────
    // Height = how much of the current page is still "empty" after blockTop
    const spacerHeight = currentPageEnd - blockTop;

    const bottomSpacer = doc.createElement('div');
    bottomSpacer.className = 'pdf-page-bottom-spacer';
    bottomSpacer.style.cssText =
      `height:${spacerHeight}px !important;` +
      `min-height:${spacerHeight}px !important;` +
      `background-color:${bgColor} !important;` +
      `display:block !important;` +
      `width:100% !important;` +
      `margin:0 !important;` +
      `padding:0 !important;` +
      `box-sizing:border-box !important;`;

    // ── Insert top-padding spacer at the top of the new page ───────────────
    const topSpacer = doc.createElement('div');
    topSpacer.className = 'pdf-page-top-spacer';
    topSpacer.style.cssText =
      `height:${PAGE_TOP_PADDING_PX}px !important;` +
      `min-height:${PAGE_TOP_PADDING_PX}px !important;` +
      `background-color:${bgColor} !important;` +
      `display:block !important;` +
      `width:100% !important;` +
      `margin:0 !important;` +
      `padding:0 !important;` +
      `box-sizing:border-box !important;`;

    block.parentNode!.insertBefore(bottomSpacer, block);
    block.parentNode!.insertBefore(topSpacer, block);

    // Force reflow so next iteration reads accurate offsetTops
    void container.offsetHeight;
  }
}

// ─── Background fill ──────────────────────────────────────────────────────────

/**
 * After all breaks are inserted, round the container height UP to the next
 * full A4 page so the last (often short) page is filled with bgColor.
 * Also paints html and body so html2canvas captures no white edges.
 */
function fillLastPageBackground(
  doc: Document,
  container: HTMLElement,
  bgColor: string,
): number {
  // Measure AFTER page breaks are inserted — this is the true content height
  const totalHeight = container.scrollHeight;
  const pageCount = Math.ceil(totalHeight / A4_HEIGHT_PX);
  // This is the canvas height we WANT — an exact multiple of the A4 page pixel height
  const targetHeight = pageCount * A4_HEIGHT_PX;

  console.log('[PDF] fillLastPageBackground', { totalHeight, pageCount, targetHeight, bgColor });

  // Always paint html / body so html2canvas captures no white edges
  container.style.setProperty('background-color', bgColor, 'important');
  doc.documentElement.style.setProperty('background-color', bgColor, 'important');
  doc.body.style.setProperty('background-color', bgColor, 'important');

  // Return targetHeight so the caller can pass it to html2canvas as `height`.
  // html2canvas will render exactly this many pixels and fill any gap at the
  // bottom with `backgroundColor` — this is more reliable than DOM padding tricks.
  return targetHeight;
}

// ─── PDF options ──────────────────────────────────────────────────────────────

function buildPdfOptions(
  filename: string,
  bgColor: string,
  windowWidth: number,
  canvasHeight: number,
) {
  return {
    margin: 0,
    filename,
    // NO explicit pagebreak mode — we rely on the spacers pushing content
    // to exact A4 boundaries, so html2pdf's natural 1123px slicing is correct.
    pagebreak: { mode: [] as any },
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: bgColor,
      width: windowWidth,
      windowWidth,
      // Force the canvas to exactly pageCount*A4_HEIGHT_PX pixels tall.
      // html2canvas fills any unfilled area at the bottom with backgroundColor,
      // which eliminates the white strip regardless of DOM subpixel rounding.
      height: canvasHeight,
      logging: false,
    },
    jsPDF: {
      unit: 'mm' as const,
      format: 'a4',
      orientation: 'portrait' as const,
      compress: true,
    },
  };
}

// ─── Loading overlay ──────────────────────────────────────────────────────────

function createLoadingOverlay() {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed !important;top:0 !important;left:0 !important;
    width:100% !important;height:100% !important;
    background:rgba(0,0,0,.8) !important;
    display:flex !important;align-items:center !important;justify-content:center !important;
    z-index:999999 !important;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif !important;
    backdrop-filter:blur(4px) !important;
  `;

  const box = document.createElement('div');
  box.style.cssText = `
    background:white !important;padding:32px !important;border-radius:16px !important;
    text-align:center !important;max-width:400px !important;
    box-shadow:0 20px 25px -5px rgba(0,0,0,.1) !important;
  `;

  const spinStyle = document.createElement('style');
  spinStyle.textContent =
    '@keyframes _pdf_spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}';
  document.head.appendChild(spinStyle);

  const spinner = document.createElement('div');
  spinner.style.cssText = `
    width:40px !important;height:40px !important;margin:0 auto 20px !important;
    border:3px solid #f3f4f6 !important;border-top:3px solid #3b82f6 !important;
    border-radius:50% !important;animation:_pdf_spin 1s linear infinite !important;
  `;

  const statusText = document.createElement('div');
  statusText.textContent = 'Generating PDF...';
  statusText.style.cssText =
    'font-size:18px !important;font-weight:600 !important;margin-bottom:8px !important;color:#1f2937 !important;';

  const subText = document.createElement('div');
  subText.textContent = 'Please wait while we create your document';
  subText.style.cssText = 'font-size:14px !important;color:#6b7280 !important;';

  box.appendChild(spinner);
  box.appendChild(statusText);
  box.appendChild(subText);
  overlay.appendChild(box);

  return { overlay, statusText, spinStyle };
}

// ─── Public: generate from URL ────────────────────────────────────────────────

export async function generatePdfFromUrl(options: PdfFromUrlOptions): Promise<void> {
  const {
    url,
    htmlContent,
    filename = 'document.pdf',
    onLoadingChange,
    windowWidth = 794,
  } = options;

  if (!url && !htmlContent) throw new Error('Either url or htmlContent must be provided');

  onLoadingChange?.(true);

  // Fetch HTML source
  let html: string;
  if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch template: ${res.status}`);
    html = await res.text();
  } else {
    html = htmlContent!;
  }

  const { overlay, statusText, spinStyle } = createLoadingOverlay();
  document.body.appendChild(overlay);

  // Off-screen iframe — fixed position keeps it in the layout flow but invisible.
  // We use a large height so the entire multi-page document can render at once.
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `
    position:fixed !important;
    top:0 !important;
    left:-${windowWidth + 200}px !important;
    width:${windowWidth}px !important;
    height:${A4_HEIGHT_PX * 25}px !important;
    border:none !important;
    visibility:hidden !important;
    pointer-events:none !important;
  `;
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument!;
  iframeDoc.open();
  iframeDoc.write(`<!DOCTYPE html><html><head>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <style>html,body{margin:0;padding:0;}</style>
  </head><body>${html}</body></html>`);
  iframeDoc.close();

  iframe.onload = () => {
    // 1.5 s gives fonts & images time to finish loading
    setTimeout(() => {
      try {
        const iframeWindow = iframe.contentWindow!;

        const container = iframeDoc.querySelector('.container') as HTMLElement | null;
        if (!container) throw new Error('No .container element found in the template HTML');

        // Lock width first so layout is stable before any measurement
        container.style.setProperty('width', '210mm', 'important');
        container.style.setProperty('max-width', '210mm', 'important');
        container.style.setProperty('margin', '0', 'important');
        container.style.setProperty('box-shadow', 'none', 'important');
        container.style.setProperty('border', 'none', 'important');
        void container.offsetHeight; // force reflow

        const bgColor =
          iframeWindow.getComputedStyle(container).backgroundColor || '#ffffff';

        // ── Main logic ──────────────────────────────────────────────────────
        insertPageBreaks(iframeDoc, container, bgColor);
        const canvasHeight = fillLastPageBackground(iframeDoc, container, bgColor);

        // Redundant safety — ensure body/html share the background
        iframeDoc.body.style.backgroundColor = bgColor;
        iframeDoc.documentElement.style.backgroundColor = bgColor;

        const pdfOptions = buildPdfOptions(filename, bgColor, windowWidth, canvasHeight);

        (iframeWindow as any)
          .html2pdf()
          .from(container)
          .set(pdfOptions)
          .save()
          .then(() => {
            statusText.textContent = 'PDF generated successfully!';
            setTimeout(() => {
              overlay.remove();
              iframe.remove();
              spinStyle.remove();
              onLoadingChange?.(false);
            }, 1000);
          })
          .catch((err: unknown) => {
            statusText.textContent = 'PDF generation failed';
            setTimeout(() => {
              overlay.remove();
              iframe.remove();
              spinStyle.remove();
              onLoadingChange?.(false);
            }, 2000);
          });
      } catch (err) {
        overlay.remove();
        iframe.remove();
        spinStyle.remove();
        onLoadingChange?.(false);
      }
    }, 1500);
  };
}

// ─── Public: generate from element ───────────────────────────────────────────

export async function generatePdfFromElement(
  options: PdfFromElementOptions,
): Promise<void> {
  const { element, filename = 'document.pdf', onLoadingChange } = options;

  onLoadingChange?.(true);

  try {
    const container =
      (element.querySelector('.container') as HTMLElement | null) ?? element;

    const bgColor =
      window.getComputedStyle(container).backgroundColor || '#ffffff';
    const windowWidth = container.offsetWidth || 794;

    container.style.setProperty('width', '210mm', 'important');
    container.style.setProperty('max-width', '210mm', 'important');
    container.style.setProperty('margin', '0', 'important');
    container.style.setProperty('box-shadow', 'none', 'important');
    container.style.setProperty('border', 'none', 'important');
    void container.offsetHeight;

    insertPageBreaks(document, container, bgColor);
    const canvasHeight = fillLastPageBackground(document, container, bgColor);

    document.body.style.backgroundColor = bgColor;
    document.documentElement.style.backgroundColor = bgColor;

    const pdfOptions = buildPdfOptions(filename, bgColor, windowWidth, canvasHeight);
    await html2pdf().from(container).set(pdfOptions).save();

    onLoadingChange?.(false);
  } catch (err) {
    onLoadingChange?.(false);
    throw err;
  }
}
