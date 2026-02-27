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

const PDF_TRACE_VERSION = 'v-clean';
const BREAK_CANDIDATE_CLASS = 'pdf-flow-break';
const DEBUG_MODE = true;

// Constants for PDF generation
const A4_HEIGHT_PX = 1123;
const PAGE_TOP_GAP_PX = 60;
const PAGE_BOTTOM_SAFE_PX = 80;

function makeTraceId(): string {
  return `pdf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function pdfLog(traceId: string, step: string, details?: Record<string, unknown>) {
  if (details) {
    console.log(`[PDF][${PDF_TRACE_VERSION}][${traceId}] ${step}`, details);
    return;
  }
  console.log(`[PDF][${PDF_TRACE_VERSION}][${traceId}] ${step}`);
}

// Auto-add pdf-flow-break classes to main > * > * (direct grandchildren of main)
function autoAddPdfFlowBreakClasses(doc: Document, target: HTMLElement, traceId: string) {
  pdfLog(traceId, 'auto-add:start');

  const main = target.querySelector('main') || target;
  // Get direct children of main (e.g., sections or columns)
  const mainChildren = Array.from(main.children).filter(child =>
    child.nodeType === 1 && !['script', 'style'].includes(child.tagName.toLowerCase())
  ) as HTMLElement[];

  let totalAdded = 0;

  mainChildren.forEach((parentBlock, parentIndex) => {
    // Get direct children of each parent block (grandchildren of main)
    const blocks = Array.from(parentBlock.children).filter(child =>
      child.nodeType === 1 && !['script', 'style'].includes(child.tagName.toLowerCase())
    ) as HTMLElement[];

    blocks.forEach((block, blockIndex) => {
      if (!block.classList.contains('pdf-flow-break')) {
        block.classList.add('pdf-flow-break');
        totalAdded++;
        pdfLog(traceId, `auto-add:added-${parentIndex}-${blockIndex}`, {
          tagName: block.tagName,
          className: block.className
        });
      }
    });
  });

  pdfLog(traceId, 'auto-add:complete', { parentBlocksProcessed: mainChildren.length, totalClassesAdded: totalAdded });
  return totalAdded;
}

// Get layout metrics for an element
function getLayoutMetrics(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

  return {
    nodeTop: rect.top + scrollTop,
    nodeBottom: rect.bottom + scrollTop,
    nodeHeight: rect.height,
    pageTop: Math.floor((rect.top + scrollTop) / A4_HEIGHT_PX) * A4_HEIGHT_PX,
    pageBottom: Math.ceil((rect.top + scrollTop) / A4_HEIGHT_PX) * A4_HEIGHT_PX
  };
}

// Check if element should be moved to next page
function shouldMoveToNextPage(element: HTMLElement, traceId: string): boolean {
  const metrics = getLayoutMetrics(element);
  if (!metrics) return false;

  // Refined math as per task requirements
  const pageBottom = Math.ceil((metrics.nodeTop + 1) / A4_HEIGHT_PX) * A4_HEIGHT_PX;
  const pageTop = pageBottom - A4_HEIGHT_PX;
  const bottomSafeBoundary = pageBottom - PAGE_BOTTOM_SAFE_PX;

  // Move element to the next page if it crosses the safe boundary 
  // and is not already at the top of a page (to avoid double breaks)
  const shouldMove = metrics.nodeBottom > bottomSafeBoundary && metrics.nodeTop > pageTop + 50;

  if (DEBUG_MODE) {
    pdfLog(traceId, 'move-check', {
      tagName: element.tagName,
      nodeTop: metrics.nodeTop,
      nodeBottom: metrics.nodeBottom,
      pageBottom,
      bottomSafeBoundary,
      shouldMove
    });
  }

  return shouldMove;
}

// Add page break marker before element
function addPageBreakMarker(doc: Document, element: HTMLElement, bgColor: string, traceId: string): boolean {
  const parent = element.parentNode;
  if (!parent || parent.nodeType !== 1) return false;

  const marker = doc.createElement('div');
  marker.className = 'pdf-page-break-marker';
  marker.innerHTML = '&nbsp;';

  // Refined marker style: 1px height, transparent, forced break
  marker.style.cssText = `
    background-color: transparent !important;
    height: 1px !important;
    min-height: 1px !important;
    display: block !important;
    width: 100% !important;
    margin: -1px 0 0 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
    line-height: 0 !important;
    font-size: 0 !important;
    break-before: page !important;
    page-break-before: always !important;
  `;

  parent.insertBefore(marker, element);

  // Add padding to the element after the marker to ensure top gap on the new page
  element.classList.add('pdf-break-after-marker');
  element.style.setProperty('padding-top', `${PAGE_TOP_GAP_PX}px`, 'important');
  element.style.setProperty('margin-top', '0px', 'important');

  pdfLog(traceId, 'marker-added', {
    tagName: element.tagName,
    markerHeight: PAGE_TOP_GAP_PX,
    paddingTop: PAGE_TOP_GAP_PX
  });

  return true;
}

// Ensure the container fills integer number of A4 pages with background color
function ensureFullPageBackgrounds(doc: Document, target: HTMLElement, bgColor: string, traceId: string) {
  const totalHeight = target.scrollHeight;
  // Use a small epsilon (5px) to avoid adding an entire page for a tiny overflow
  const pageCount = Math.ceil((totalHeight - 5) / A4_HEIGHT_PX);
  const targetHeight = pageCount * A4_HEIGHT_PX;

  pdfLog(traceId, 'background-fill-check', {
    totalHeight,
    pageCount,
    targetHeight,
    diff: targetHeight - totalHeight
  });

  if (targetHeight > totalHeight) {
    // Fill background for html, body and target container
    doc.documentElement.style.setProperty('background-color', bgColor, 'important');
    doc.body.style.setProperty('background-color', bgColor, 'important');
    target.style.setProperty('min-height', `${targetHeight}px`, 'important');
    target.style.setProperty('background-color', bgColor, 'important');
    pdfLog(traceId, 'min-height-applied', { minHeight: targetHeight, bgColor });
  }
}

// Main PDF generation from URL
export async function generatePdfFromUrl(options: PdfFromUrlOptions): Promise<void> {
  const { url, htmlContent, filename = 'document.pdf', onLoadingChange, windowWidth = 794 } = options;

  if (!url && !htmlContent) {
    throw new Error('Either url or htmlContent must be provided');
  }

  const traceId = makeTraceId();
  pdfLog(traceId, 'start', { url: !!url, htmlContent: !!htmlContent, filename });

  try {
    onLoadingChange?.(true);

    // Fetch HTML content
    let html: string;
    if (url) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
      html = await response.text();
    } else {
      html = htmlContent!;
    }

    pdfLog(traceId, 'content-loaded', { htmlLength: html.length });

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      background: rgba(0, 0, 0, 0.8) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      z-index: 999999 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      backdrop-filter: blur(4px) !important;
    `;

    const statusContainer = document.createElement('div');
    statusContainer.style.cssText = `
      background: white !important;
      padding: 32px !important;
      border-radius: 16px !important;
      text-align: center !important;
      max-width: 400px !important;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
    `;

    // Add spinner
    const spinner = document.createElement('div');
    spinner.style.cssText = `
      width: 40px !important;
      height: 40px !important;
      margin: 0 auto 20px auto !important;
      border: 3px solid #f3f4f6 !important;
      border-top: 3px solid #3b82f6 !important;
      border-radius: 50% !important;
      animation: spin 1s linear infinite !important;
    `;

    // Add spinner keyframes
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    const statusText = document.createElement('div');
    statusText.textContent = 'Generating PDF...';
    statusText.style.cssText = `
      font-size: 18px !important;
      font-weight: 600 !important;
      margin-bottom: 8px !important;
      color: #1f2937 !important;
    `;

    const subText = document.createElement('div');
    subText.textContent = 'Please wait while we create your document';
    subText.style.cssText = `
      font-size: 14px !important;
      color: #6b7280 !important;
      margin-bottom: 0 !important;
    `;

    statusContainer.appendChild(spinner);
    statusContainer.appendChild(statusText);
    statusContainer.appendChild(subText);
    overlay.appendChild(statusContainer);
    document.body.appendChild(overlay);

    // Create iframe for rendering with large height to avoid clipping during measurement
    const iframe = document.createElement('iframe');
    iframe.style.cssText = `
      position: absolute !important;
      top: -9999px !important;
      left: -9999px !important;
      width: ${windowWidth}px !important;
      height: 8000px !important;
      border: none !important;
      overflow: hidden !important;
    `;

    document.body.appendChild(iframe);

    // Setup iframe content with html2pdf library
    const iframeDoc = iframe.contentDocument!;
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
          <style>
            body { margin: 0; padding: 0; }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `);
    iframeDoc.close();

    // Wait for iframe to load
    iframe.onload = () => {
      setTimeout(() => {
        try {
          const iframeWindow = iframe.contentWindow!;
          const iframeDoc = iframe.contentDocument!;

          // Get target element
          const target = iframeDoc.querySelector('.container') as HTMLElement;
          if (!target) throw new Error('Target element not found');

          // Set final width immediately to ensure stable layout before metrics
          target.style.width = '210mm';
          target.style.maxWidth = '210mm';
          target.style.margin = '0 auto';
          target.style.boxSizing = 'border-box';

          // Get background color
          const computedStyle = iframeWindow.getComputedStyle(target);
          const bgColor = computedStyle.backgroundColor || 'rgb(255, 255, 255)';

          pdfLog(traceId, 'target-found', {
            tagName: target.tagName,
            contentHeight: target.scrollHeight,
            bgColor,
            windowWidth
          });

          // Auto-add pdf-flow-break classes
          autoAddPdfFlowBreakClasses(iframeDoc, target, traceId);

          // Add CSS for PDF generation
          const style = iframeDoc.createElement('style');
          style.textContent = `
            .pdf-break-after-marker {
              padding-top: ${PAGE_TOP_GAP_PX}px !important;
              margin-top: 0 !important;
              box-sizing: border-box !important;
            }
            .pdf-page-break-marker {
              background-color: transparent !important;
              height: 1px !important;
              page-break-before: always !important;
            }
            /* Prevent breaking inside flow-break elements */
            .pdf-flow-break {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            /* Allow breaking between flow-break elements */
            .pdf-flow-break + .pdf-flow-break {
              break-before: auto !important;
              page-break-before: auto !important;
            }
          `;
          iframeDoc.head.appendChild(style);

          // Process page breaks
          const candidates = Array.from(target.querySelectorAll('.pdf-flow-break')) as HTMLElement[];
          pdfLog(traceId, 'processing-breaks', { candidatesCount: candidates.length });

          // Debug: show all candidates before processing
          candidates.forEach((candidate, index) => {
            const metrics = getLayoutMetrics(candidate);
            pdfLog(traceId, `candidate-before-${index}`, {
              tagName: candidate.tagName,
              nodeTop: metrics?.nodeTop,
              nodeBottom: metrics?.nodeBottom,
              className: candidate.className,
              textContent: candidate.textContent?.substring(0, 30) + '...'
            });
          });

          let breaksAdded = 0;
          candidates.forEach((element, index) => {
            if (shouldMoveToNextPage(element, traceId)) {
              pdfLog(traceId, `processing-candidate-${index}`, {
                tagName: element.tagName,
                willMove: true
              });

              if (addPageBreakMarker(iframeDoc, element, bgColor, traceId)) {
                breaksAdded++;
                pdfLog(traceId, `marker-success-${index}`, {
                  tagName: element.tagName,
                  totalBreaks: breaksAdded
                });
              }
            } else {
              pdfLog(traceId, `candidate-will-stay-${index}`, {
                tagName: element.tagName,
                nodeTop: getLayoutMetrics(element)?.nodeTop
              });
            }
          });

          pdfLog(traceId, 'breaks-complete', { breaksAdded });

          // Debug: check all markers after processing
          const allMarkers = Array.from(iframeDoc.querySelectorAll('.pdf-page-break-marker')) as HTMLElement[];
          pdfLog(traceId, 'markers-after-processing', {
            totalMarkers: allMarkers.length,
            markerDetails: allMarkers.map((marker, index) => ({
              index,
              height: marker.offsetHeight,
              backgroundColor: marker.style.backgroundColor,
              parentTag: marker.parentElement?.tagName,
              nextElementTag: marker.nextElementSibling?.tagName
            }))
          });

          // Debug: check elements with padding
          const elementsWithPadding = Array.from(iframeDoc.querySelectorAll('.pdf-break-after-marker')) as HTMLElement[];
          pdfLog(traceId, 'elements-with-padding', {
            totalElements: elementsWithPadding.length,
            elementDetails: elementsWithPadding.map((element, index) => ({
              index,
              tagName: element.tagName,
              paddingTop: element.style.paddingTop,
              marginTop: element.style.marginTop,
              textContent: element.textContent?.substring(0, 30) + '...'
            }))
          });

          // Ensure background for all pages
          ensureFullPageBackgrounds(iframeDoc, target, bgColor, traceId);

          // Set final dimensions
          target.style.width = '210mm';
          target.style.maxWidth = '210mm';
          target.style.margin = '0';
          target.style.boxShadow = 'none';
          target.style.border = 'none';

          iframeDoc.body.style.backgroundColor = bgColor;
          iframeDoc.documentElement.style.backgroundColor = bgColor;

          // Generate PDF
          const pdfOptions = {
            margin: 0,
            filename,
            pagebreak: {
              mode: ['css', 'legacy'],
              before: ['.pdf-page-break-marker'],
              avoid: ['h1', 'h2', 'h3', 'img', 'tr', 'thead', 'tbody']
            },
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: {
              scale: 2,
              useCORS: true,
              backgroundColor: bgColor,
              width: windowWidth,
              windowWidth: windowWidth
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
          };

          pdfLog(traceId, 'generating-pdf');

          (iframeWindow as any).html2pdf().from(target).set(pdfOptions).save().then(() => {
            pdfLog(traceId, 'pdf-generated');
            statusText.textContent = 'PDF generated successfully!';
            setTimeout(() => {
              overlay.remove();
              iframe.remove();
              onLoadingChange?.(false);
            }, 1000);
          }).catch((error: any) => {
            console.error('PDF generation error:', error);
            statusText.textContent = 'PDF generation failed';
            setTimeout(() => {
              overlay.remove();
              iframe.remove();
              onLoadingChange?.(false);
            }, 2000);
          });

        } catch (error) {
          console.error('PDF processing error:', error);
          statusText.textContent = 'Processing failed';
          setTimeout(() => {
            overlay.remove();
            iframe.remove();
            onLoadingChange?.(false);
          }, 2000);
        }
      }, 1500);
    };

  } catch (error) {
    console.error('PDF generation error:', error);
    onLoadingChange?.(false);
    throw error;
  }
}

// Main PDF generation from element
export async function generatePdfFromElement(options: PdfFromElementOptions): Promise<void> {
  const { element, filename = 'document.pdf', onLoadingChange } = options;

  const traceId = makeTraceId();
  pdfLog(traceId, 'start-from-element', { tagName: element.tagName, filename });

  try {
    onLoadingChange?.(true);

    // Get background color
    const computedStyle = window.getComputedStyle(element);
    const bgColor = computedStyle.backgroundColor || 'rgb(255, 255, 255)';

    // Auto-add pdf-flow-break classes
    autoAddPdfFlowBreakClasses(document, element, traceId);

    // Add CSS for PDF generation
    const style = document.createElement('style');
    style.textContent = `
      .pdf-break-after-marker {
        padding-top: ${PAGE_TOP_GAP_PX}px !important;
        margin-top: 0 !important;
        box-sizing: border-box !important;
      }
      .pdf-page-break-marker {
        background-color: transparent !important;
        height: 1px !important;
        page-break-before: always !important;
      }
      /* Prevent breaking inside flow-break elements */
      .pdf-flow-break {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      /* Allow breaking between flow-break elements */
      .pdf-flow-break + .pdf-flow-break {
        break-before: auto !important;
        page-break-before: auto !important;
      }
    `;
    document.head.appendChild(style);

    // Process page breaks
    const candidates = Array.from(element.querySelectorAll('.pdf-flow-break')) as HTMLElement[];
    pdfLog(traceId, 'processing-breaks', { candidatesCount: candidates.length });

    let breaksAdded = 0;
    candidates.forEach(candidate => {
      if (shouldMoveToNextPage(candidate, traceId)) {
        if (addPageBreakMarker(document, candidate, bgColor, traceId)) {
          breaksAdded++;
        }
      }
    });

    pdfLog(traceId, 'breaks-complete', { breaksAdded });

    // Ensure background for all pages
    ensureFullPageBackgrounds(document, element, bgColor, traceId);

    // Set final dimensions
    element.style.width = '210mm';
    element.style.maxWidth = '210mm';
    element.style.margin = '0';
    element.style.boxShadow = 'none';
    element.style.border = 'none';

    document.body.style.backgroundColor = bgColor;
    document.documentElement.style.backgroundColor = bgColor;

    // Generate PDF
    const pdfOptions = {
      margin: 0,
      filename,
      pagebreak: {
        mode: ['css', 'legacy'],
        before: ['.pdf-page-break-marker'],
        avoid: ['h1', 'h2', 'h3', 'img', 'tr', 'thead', 'tbody']
      },
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: bgColor
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    };

    pdfLog(traceId, 'generating-pdf');

    await html2pdf().from(element).set(pdfOptions).save();

    pdfLog(traceId, 'pdf-generated');
    onLoadingChange?.(false);

  } catch (error) {
    console.error('PDF generation error:', error);
    onLoadingChange?.(false);
    throw error;
  }
}
