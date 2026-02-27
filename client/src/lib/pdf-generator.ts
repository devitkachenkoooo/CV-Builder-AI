import html2pdf from 'html2pdf.js';

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
const A4_HEIGHT_PX = 1123;
const PAGE_BOTTOM_SAFE_PX = 80;  // safe zone: 80px from bottom before forcing break
const PAGE_TOP_PADDING_PX = 60;  // padding added at the top of content on a new page

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get an element's top offset relative to a given ancestor container.
 * Uses offsetTop chain — works correctly regardless of iframe position on screen,
 * unlike getBoundingClientRect() which is viewport-relative.
 */
function getOffsetTopFromContainer(element: HTMLElement, container: HTMLElement): number {
  let top = 0;
  let el: HTMLElement | null = element;
  while (el && el !== container) {
    top += el.offsetTop;
    el = el.offsetParent as HTMLElement | null;
  }
  return top;
}

/**
 * Get all direct grandchildren of main inside the container (main > * > *).
 * These are the only elements that are candidates for page breaks.
 */
function getBreakCandidates(container: HTMLElement): HTMLElement[] {
  const main = container.querySelector('main') as HTMLElement | null;
  if (!main) {
    console.warn('[PDF] No <main> element found inside container. Falling back to container children.');
    return [];
  }

  const candidates: HTMLElement[] = [];
  const skipTags = new Set(['script', 'style', 'link', 'meta']);

  for (const parent of Array.from(main.children)) {
    if (skipTags.has(parent.tagName.toLowerCase())) continue;
    for (const child of Array.from(parent.children)) {
      if (skipTags.has(child.tagName.toLowerCase())) continue;
      candidates.push(child as HTMLElement);
    }
  }

  console.log(`[PDF] Break candidates (main > * > *): ${candidates.length}`);
  return candidates;
}

/**
 * Insert page-break markers before blocks that overflow the safe zone and
 * add top padding to those blocks so content starts properly on the new page.
 *
 * Uses offsetTop so calculation is independent of iframe's screen position.
 */
function insertPageBreaks(doc: Document, container: HTMLElement): void {
  // Force layout to stabilize before measuring
  container.offsetHeight; // eslint-disable-line @typescript-eslint/no-unused-expressions

  const candidates = getBreakCandidates(container);

  for (const block of candidates) {
    // Measure position relative to container
    const blockTop = getOffsetTopFromContainer(block, container);
    const blockBottom = blockTop + block.offsetHeight;

    // Which A4 page does the top of this block land on?
    const pageIndex = Math.floor(blockTop / A4_HEIGHT_PX);
    const pageStart = pageIndex * A4_HEIGHT_PX;
    const pageEnd = (pageIndex + 1) * A4_HEIGHT_PX;
    const safeEnd = pageEnd - PAGE_BOTTOM_SAFE_PX;

    const isAtTopOfPage = (blockTop - pageStart) < PAGE_TOP_PADDING_PX + 10;
    const crossesSafeZone = blockBottom > safeEnd;

    console.log(`[PDF] block`, {
      tag: block.tagName,
      class: block.className.split(' ').find(c => c),
      blockTop: Math.round(blockTop),
      blockBottom: Math.round(blockBottom),
      pageEnd,
      safeEnd,
      isAtTopOfPage,
      crossesSafeZone,
      decision: crossesSafeZone && !isAtTopOfPage ? '→ BREAK' : '→ stay'
    });

    if (crossesSafeZone && !isAtTopOfPage) {
      // Insert an invisible page-break marker before the block
      const marker = doc.createElement('div');
      marker.className = 'pdf-page-break';
      marker.style.cssText = [
        'display: block !important',
        'height: 0 !important',
        'min-height: 0 !important',
        'overflow: hidden !important',
        'line-height: 0 !important',
        'font-size: 0 !important',
        'margin: 0 !important',
        'padding: 0 !important',
        'page-break-before: always !important',
        'break-before: page !important',
      ].join('; ');

      block.parentNode!.insertBefore(marker, block);

      // Add top padding to the block so it doesn't slam into the top of the new page
      block.style.setProperty('padding-top', `${PAGE_TOP_PADDING_PX}px`, 'important');
      block.style.setProperty('margin-top', '0', 'important');
    }
  }
}

/**
 * Ensure the container's min-height is an exact multiple of A4_HEIGHT_PX
 * so the last (possibly short) page gets a full-color background.
 * Also paints html, body, and container with the background color.
 */
function fillLastPageBackground(doc: Document, container: HTMLElement, bgColor: string): void {
  const totalHeight = container.scrollHeight;
  const pageCount = Math.ceil(totalHeight / A4_HEIGHT_PX);
  const targetHeight = pageCount * A4_HEIGHT_PX;

  console.log(`[PDF] Background fill`, { totalHeight, pageCount, targetHeight, bgColor });

  // Always paint globally
  container.style.setProperty('background-color', bgColor, 'important');
  doc.documentElement.style.setProperty('background-color', bgColor, 'important');
  doc.body.style.setProperty('background-color', bgColor, 'important');

  // Stretch to fill the last page
  if (targetHeight > totalHeight) {
    container.style.setProperty('min-height', `${targetHeight}px`, 'important');
  }
}

// ─── Common PDF options ───────────────────────────────────────────────────────
function buildPdfOptions(filename: string, bgColor: string, windowWidth: number) {
  return {
    margin: 0,
    filename,
    pagebreak: {
      // Only use CSS-driven breaks via our .pdf-page-break markers
      mode: ['css'] as any,
      before: ['.pdf-page-break'],
    },
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: bgColor,
      width: windowWidth,
      windowWidth,
      logging: false,
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const, compress: true },
  };
}

// ─── Overlay / spinner UI ────────────────────────────────────────────────────

function createLoadingOverlay() {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed !important;
    top: 0 !important; left: 0 !important;
    width: 100% !important; height: 100% !important;
    background: rgba(0,0,0,0.8) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    z-index: 999999 !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    backdrop-filter: blur(4px) !important;
  `;

  const box = document.createElement('div');
  box.style.cssText = `
    background: white !important;
    padding: 32px !important;
    border-radius: 16px !important;
    text-align: center !important;
    max-width: 400px !important;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,.1) !important;
  `;

  const spinStyle = document.createElement('style');
  spinStyle.textContent = `@keyframes _pdf_spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`;
  document.head.appendChild(spinStyle);

  const spinner = document.createElement('div');
  spinner.style.cssText = `
    width:40px !important; height:40px !important;
    margin: 0 auto 20px auto !important;
    border: 3px solid #f3f4f6 !important;
    border-top: 3px solid #3b82f6 !important;
    border-radius: 50% !important;
    animation: _pdf_spin 1s linear infinite !important;
  `;

  const statusText = document.createElement('div');
  statusText.textContent = 'Generating PDF...';
  statusText.style.cssText = `font-size:18px !important; font-weight:600 !important; margin-bottom:8px !important; color:#1f2937 !important;`;

  const subText = document.createElement('div');
  subText.textContent = 'Please wait while we create your document';
  subText.style.cssText = `font-size:14px !important; color:#6b7280 !important;`;

  box.appendChild(spinner);
  box.appendChild(statusText);
  box.appendChild(subText);
  overlay.appendChild(box);

  return { overlay, statusText, spinStyle };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generatePdfFromUrl(options: PdfFromUrlOptions): Promise<void> {
  const { url, htmlContent, filename = 'document.pdf', onLoadingChange, windowWidth = 794 } = options;

  if (!url && !htmlContent) throw new Error('Either url or htmlContent must be provided');

  onLoadingChange?.(true);

  // Fetch HTML
  let html: string;
  if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
    html = await res.text();
  } else {
    html = htmlContent!;
  }

  const { overlay, statusText, spinStyle } = createLoadingOverlay();
  document.body.appendChild(overlay);

  // Create offscreen iframe — give it a large height so layout is correct
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: -${windowWidth + 100}px !important;
    width: ${windowWidth}px !important;
    height: ${A4_HEIGHT_PX * 20}px !important;
    border: none !important;
    visibility: hidden !important;
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
    // Wait for fonts / images to settle
    setTimeout(() => {
      try {
        const iframeWindow = iframe.contentWindow!;

        // Find the container
        const container = iframeDoc.querySelector('.container') as HTMLElement | null;
        if (!container) throw new Error('No .container element found in template');

        // Lock width before measuring  
        container.style.setProperty('width', '210mm', 'important');
        container.style.setProperty('max-width', '210mm', 'important');
        container.style.setProperty('margin', '0', 'important');
        container.style.setProperty('box-shadow', 'none', 'important');
        container.style.setProperty('border', 'none', 'important');

        // Force a layout reflow
        void container.offsetHeight;

        // Get background color before we mutate anything
        const bgColor = iframeWindow.getComputedStyle(container).backgroundColor || '#ffffff';

        console.log(`[PDF] Container found. Height=${container.scrollHeight}px  bgColor=${bgColor}`);

        // Add CSS guardrails
        const css = iframeDoc.createElement('style');
        css.textContent = `
          /* Elements that received a page-top gap */
          .pdf-page-break + * {
            /* padding already applied inline */
          }
        `;
        iframeDoc.head.appendChild(css);

        // ── Core logic ──
        insertPageBreaks(iframeDoc, container);
        fillLastPageBackground(iframeDoc, container, bgColor);

        // Also make sure body/html are the same color so html2canvas doesn't bleed white
        iframeDoc.body.style.backgroundColor = bgColor;
        iframeDoc.documentElement.style.backgroundColor = bgColor;

        const pdfOptions = buildPdfOptions(filename, bgColor, windowWidth);

        console.log('[PDF] Starting html2pdf generation...');

        (iframeWindow as any).html2pdf()
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
            console.error('[PDF] html2pdf error:', err);
            statusText.textContent = 'PDF generation failed';
            setTimeout(() => {
              overlay.remove();
              iframe.remove();
              spinStyle.remove();
              onLoadingChange?.(false);
            }, 2000);
          });

      } catch (err) {
        console.error('[PDF] Processing error:', err);
        overlay.remove();
        iframe.remove();
        spinStyle.remove();
        onLoadingChange?.(false);
      }
    }, 1500);
  };
}

export async function generatePdfFromElement(options: PdfFromElementOptions): Promise<void> {
  const { element, filename = 'document.pdf', onLoadingChange } = options;

  onLoadingChange?.(true);

  try {
    const container = element.querySelector('.container') as HTMLElement ?? element;
    const bgColor = window.getComputedStyle(container).backgroundColor || '#ffffff';
    const windowWidth = container.offsetWidth || 794;

    container.style.setProperty('width', '210mm', 'important');
    container.style.setProperty('max-width', '210mm', 'important');
    container.style.setProperty('margin', '0', 'important');
    container.style.setProperty('box-shadow', 'none', 'important');
    container.style.setProperty('border', 'none', 'important');

    void container.offsetHeight;

    insertPageBreaks(document, container);
    fillLastPageBackground(document, container, bgColor);

    document.body.style.backgroundColor = bgColor;
    document.documentElement.style.backgroundColor = bgColor;

    const pdfOptions = buildPdfOptions(filename, bgColor, windowWidth);

    await html2pdf().from(container).set(pdfOptions).save();

    onLoadingChange?.(false);
  } catch (err) {
    console.error('[PDF] Element generation error:', err);
    onLoadingChange?.(false);
    throw err;
  }
}
