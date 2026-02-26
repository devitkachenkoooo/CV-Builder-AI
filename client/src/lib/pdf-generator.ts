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

/**
 * Creates a dedicated, fixed-size environment for PDF generation.
 * Uses visual scaling to fit any screen while maintaining internal A4 dimensions.
 */
function createPdfModal(html: string, filename: string = 'resume.pdf'): void {
  // 1. Dark Overlay
  const overlay = document.createElement('div');
  overlay.id = 'pdf-generation-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    z-index: 999990;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  // 2. Progress Indicator (Always on top)
  const loader = document.createElement('div');
  loader.style.cssText = `
    background: white;
    padding: 16px 32px;
    border-radius: 100px;
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 20px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    z-index: 1000000;
  `;

  const spinner = document.createElement('div');
  spinner.style.cssText = `
    width: 20px;
    height: 20px;
    border: 3px solid #f3f4f6;
    border-top: 3px solid #3b82f6;
    border-radius: 50%;
    animation: pdf-spin 0.8s linear infinite;
  `;

  const statusText = document.createElement('span');
  statusText.textContent = 'Preparing PDF Document...';
  statusText.style.cssText = `color: #111827; font-weight: 600; font-size: 15px;`;

  loader.appendChild(spinner);
  loader.appendChild(statusText);
  overlay.appendChild(loader);

  // 3. The A4 "Photo Studio" Iframe
  const targetWidth = 794; // A4 at 96 DPI
  const screenWidth = window.innerWidth;
  const padding = 40;
  const visualScale = screenWidth < (targetWidth + padding)
    ? (screenWidth - padding) / targetWidth
    : 1;

  const iframe = document.createElement('iframe');
  iframe.id = 'pdf-render-frame';
  iframe.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(${visualScale});
    width: ${targetWidth}px;
    height: auto; /* Dynamic height */
    min-height: 1123px; /* At least one A4 page */
    max-height: 85vh;
    border: none;
    background: transparent;
    box-shadow: 0 0 60px rgba(0,0,0,0.5);
    z-index: 999980;
    border-radius: 2px;
    pointer-events: none;
    visibility: visible;
  `;

  // Animation styles
  const style = document.createElement('style');
  style.textContent = `@keyframes pdf-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
  document.head.appendChild(style);

  document.body.appendChild(overlay);
  document.body.appendChild(iframe);

  iframe.onload = () => {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) throw new Error('Iframe access denied');

      // Inject content
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          console.log('[PDF] Starting analysis phase');
          statusText.textContent = 'Preparing content...';

          const captureElement = doc.querySelector('.container') ||
            doc.querySelector('.cv-container') ||
            doc.querySelector('.resume') ||
            doc.body;

          if (!captureElement || (captureElement as any).nodeType !== 1) {
            throw new Error('Could not find a valid content element to capture');
          }

          const target = captureElement as HTMLElement;
          console.log('[PDF] Found capture element:', target.className || 'body');

          const contentHeight = target.scrollHeight;
          const a4HeightPx = 1123;
          const pageTopGapPx = 70;
          const pageBottomSafePx = 62;
          const moveThresholdPx = 420;
          const numPages = Math.max(1, Math.ceil(contentHeight / a4HeightPx));
          console.log(`[PDF] Content height: ${contentHeight}px, estimated pages: ${numPages}`);

          // Keep a deterministic A4 rendering world for every template.
          const normalizeStyle = doc.createElement('style');
          normalizeStyle.textContent = `
            html, body {
              width: ${targetWidth}px !important;
              max-width: ${targetWidth}px !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
            }
            body {
              display: block !important;
            }
            .container, .cv-container, .resume, main {
              overflow: visible !important;
            }
            .pdf-page-start {
              break-before: page !important;
              page-break-before: always !important;
              padding-top: ${pageTopGapPx}px !important;
              margin-top: 0 !important;
              box-sizing: border-box !important;
            }
            .pdf-page-break-marker {
              break-before: page !important;
              page-break-before: always !important;
              display: block !important;
              width: 100% !important;
              height: ${pageTopGapPx}px !important;
              margin: 0 !important;
              padding: 0 !important;
              background: transparent !important;
            }
          `;
          doc.head.appendChild(normalizeStyle);

          target.style.width = '210mm';
          target.style.maxWidth = '210mm';
          target.style.margin = '0';
          target.style.minHeight = '0';
          target.style.boxShadow = 'none';
          target.style.border = 'none';
          target.style.position = 'relative';
          target.style.top = '0';
          target.style.left = '0';
          target.style.transform = 'none';
          // Keep breathing space on the first page too (not only on forced page starts).
          target.style.paddingTop = `${pageTopGapPx}px`;
          target.style.breakInside = 'auto';
          target.style.pageBreakInside = 'auto';
          target.style.display = 'flow-root'; // prevent margin-collapsing side effects in PDF layout

          // Prevent awkward splits for common semantic blocks across all templates.
          const avoidSplitSelectors = [
            'h1', 'h2', 'h3', '.section-title', 'img'
          ];
          const avoidSplitBlocks = Array.from(target.querySelectorAll(avoidSplitSelectors.join(', '))) as HTMLElement[];
          avoidSplitBlocks.forEach((block) => {
            block.style.breakInside = 'avoid';
            block.style.pageBreakInside = 'avoid';
          });

          const parseBackground = (el: Element | null): string | null => {
            if (!el || !iframe.contentWindow) return null;
            const color = iframe.contentWindow.getComputedStyle(el).backgroundColor;
            if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return null;
            return color;
          };
          const isWhiteLike = (color: string | null) =>
            color === 'rgb(255, 255, 255)' || color === 'rgba(255, 255, 255, 1)';
          const captureBg = parseBackground(captureElement);
          const bodyBg = parseBackground(doc.body);
          const htmlBg = parseBackground(doc.documentElement);
          const bgColor =
            (!isWhiteLike(captureBg || null) ? captureBg : null) ||
            bodyBg ||
            htmlBg ||
            captureBg ||
            '#ffffff';
          doc.body.style.backgroundColor = bgColor;
          doc.documentElement.style.backgroundColor = bgColor;

          console.log('[PDF] Background color detected:', bgColor);

          // 3. Load Library
          const win = iframe.contentWindow as any;
          const script = doc.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';

          script.onerror = () => {
            console.error('[PDF] Failed to load html2pdf library');
            statusText.textContent = 'Library load failed. Check your internet.';
            setTimeout(() => { overlay.remove(); iframe.remove(); }, 3000);
          };

          script.onload = () => {
            console.log('[PDF] Library loaded, starting generation');
            if (win.html2pdf) {
              statusText.textContent = `Rendering ${numPages} page(s)...`;

              target.style.backgroundColor = bgColor;
              doc.body.style.backgroundColor = bgColor;
              const mainFlow = (target.querySelector(':scope > main') || target.querySelector('main')) as HTMLElement | null;
              const flowRoot = mainFlow || target;
              const flowBlocks = Array.from(flowRoot.children) as HTMLElement[];
              Array.from(flowRoot.querySelectorAll('.pdf-page-break-marker')).forEach((node) => node.remove());
              flowBlocks.forEach((child) => {
                if (!(child instanceof HTMLElement)) return;
                child.classList.remove('pdf-page-start');
                child.style.breakBefore = '';
                child.style.pageBreakBefore = '';
                child.style.breakInside = 'avoid';
                child.style.pageBreakInside = 'avoid';
              });

              flowBlocks.forEach((block, index) => {
                if (index === 0) return;
                const rect = block.getBoundingClientRect();
                const containerRect = target.getBoundingClientRect();
                const blockTop = rect.top - containerRect.top;
                const blockBottom = rect.bottom - containerRect.top;
                const pageBottom = (Math.floor(blockTop / a4HeightPx) + 1) * a4HeightPx;
                const remainingOnPage = pageBottom - blockTop;
                const shouldMoveToNextPage =
                  blockBottom > pageBottom - pageBottomSafePx &&
                  remainingOnPage <= moveThresholdPx;

                if (shouldMoveToNextPage) {
                  const prev = block.previousElementSibling as HTMLElement | null;
                  if (!prev || !prev.classList.contains('pdf-page-break-marker')) {
                    const marker = doc.createElement('div');
                    marker.className = 'pdf-page-break-marker';
                    flowRoot.insertBefore(marker, block);
                  }
                }
              });

              target.style.boxSizing = 'border-box';
              target.style.backgroundColor = bgColor;
              doc.body.style.backgroundColor = bgColor;
              doc.documentElement.style.backgroundColor = bgColor;

              win.html2pdf().from(captureElement).set({
                margin: 0,
                filename: filename,
                pagebreak: {
                  mode: ['css', 'legacy'],
                  avoid: ['h1', 'h2', 'h3', '.section-title', 'img']
                },
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                  scale: 2,
                  useCORS: true,
                  backgroundColor: bgColor,
                  width: targetWidth,
                  windowWidth: targetWidth,
                  scrollY: 0,
                  x: 0,
                  y: 0,
                  removeContainer: true
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true }
              }).save().then(() => {
                console.log('[PDF] Generation successful');
                statusText.textContent = 'Success!';
                setTimeout(() => {
                  overlay.remove();
                  iframe.remove();
                  style.remove();
                }, 800);
              }).catch((err: any) => {
                console.error('[PDF] Final Error:', err);
                statusText.textContent = 'Generation failed';
                setTimeout(() => { overlay.remove(); iframe.remove(); }, 2000);
              });
            } else {
              console.error('[PDF] html2pdf not found on window');
              statusText.textContent = 'Plugin Error';
              setTimeout(() => { overlay.remove(); iframe.remove(); }, 2000);
            }
          };
          doc.head.appendChild(script);
        } catch (innerErr: any) {
          console.error('[PDF] Analysis Error:', innerErr);
          statusText.textContent = 'Analysis failed';
          setTimeout(() => { overlay.remove(); iframe.remove(); }, 2000);
        }
      }, 1500);

    } catch (err) {
      console.error('PDF Setup Error:', err);
      // NOTE: Here overlay and iframe might not be initialized if error happens before they are created,
      // but if the error threw from doc operations, they exist. Best effort cleanup:
      try {
        const o = document.body.querySelector('div[style*="z-index: 9999"]');
        if (o) o.remove();
      } catch (e) { }
    }
  };
}

export async function generatePdfFromElement(options: PdfFromElementOptions): Promise<void> {
  const { element, onLoadingChange, filename } = options;
  if (onLoadingChange) onLoadingChange(true);
  try {
    createPdfModal(element.outerHTML, filename);
    // Modal cleans itself up
    await new Promise(r => setTimeout(r, 2000));
  } finally {
    if (onLoadingChange) onLoadingChange(false);
  }
}

export async function generatePdfFromUrl(options: PdfFromUrlOptions): Promise<void> {
  const { url, htmlContent, onLoadingChange, filename } = options;
  if (onLoadingChange) onLoadingChange(true);
  try {
    let html = htmlContent;

    if (!html) {
      if (!url) {
        throw new Error('Either url or htmlContent must be provided');
      }

      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        throw new Error(`Failed to fetch HTML for PDF generation: ${res.status}`);
      }
      html = await res.text();
    }

    createPdfModal(html, filename);
    await new Promise(r => setTimeout(r, 2000));
  } finally {
    if (onLoadingChange) onLoadingChange(false);
  }
}
