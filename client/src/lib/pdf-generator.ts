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
const PAGE_BOTTOM_SAFE_PX = 60;

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

// Auto-add pdf-flow-break classes to main > section > direct children
function autoAddPdfFlowBreakClasses(doc: Document, target: HTMLElement, traceId: string) {
  pdfLog(traceId, 'auto-add:start');
  
  const main = target.querySelector('main') || target;
  const sections = Array.from(main.querySelectorAll('section'));
  let totalAdded = 0;
  
  sections.forEach((section, sectionIndex) => {
    const directChildren = Array.from(section.children).filter(child => 
      child.nodeType === 1 && !['script', 'style'].includes(child.tagName.toLowerCase())
    ) as HTMLElement[];
    
    directChildren.forEach((child, childIndex) => {
      if (!child.classList.contains('pdf-flow-break')) {
        child.classList.add('pdf-flow-break');
        totalAdded++;
        pdfLog(traceId, `auto-add:added-${sectionIndex}-${childIndex}`, {
          tagName: child.tagName,
          className: child.className
        });
      }
    });
  });
  
  pdfLog(traceId, 'auto-add:complete', { sectionsProcessed: sections.length, totalClassesAdded: totalAdded });
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
  
  const bottomSafeBoundary = metrics.pageBottom - PAGE_BOTTOM_SAFE_PX;
  const crossesBoundary = metrics.nodeTop < bottomSafeBoundary && metrics.nodeBottom > bottomSafeBoundary;
  
  // More lenient condition - move if element is close to bottom or crosses boundary
  const isCloseToBottom = metrics.nodeTop >= bottomSafeBoundary - 20; // 20px buffer
  const shouldMove = (crossesBoundary || isCloseToBottom) && metrics.nodeTop > metrics.pageTop + 6;
  
  if (DEBUG_MODE) {
    pdfLog(traceId, 'move-check', {
      tagName: element.tagName,
      nodeTop: metrics.nodeTop,
      nodeBottom: metrics.nodeBottom,
      pageTop: metrics.pageTop,
      pageBottom: metrics.pageBottom,
      bottomSafeBoundary,
      crossesBoundary,
      isCloseToBottom,
      shouldMove
    });
  }
  
  return shouldMove;
}

// Add page break marker before element
function addPageBreakMarker(doc: Document, element: HTMLElement, bgColor: string, traceId: string): boolean {
  const parent = element.parentNode;
  if (!parent || parent.nodeType !== 1) return false;
  
  // Check if this is the very first marker in the entire document
  const existingMarkers = doc.querySelectorAll('.pdf-page-break-marker');
  const isFirstPage = existingMarkers.length === 0;
  
  const marker = doc.createElement('div');
  marker.className = 'pdf-page-break-marker';
  marker.innerHTML = '&nbsp;';
  
  // Always add 60px marker except for first page
  marker.style.cssText = `
    background-color: ${bgColor} !important;
    height: ${isFirstPage ? '0px' : `${PAGE_TOP_GAP_PX}px`} !important;
    min-height: ${isFirstPage ? '0px' : `${PAGE_TOP_GAP_PX}px`} !important;
    display: block !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
    line-height: 0 !important;
    font-size: 0 !important;
    break-before: page !important;
    page-break-before: always !important;
  `;
  
  parent.insertBefore(marker, element);
  
  // Add padding to the element after the marker (only for non-first pages)
  if (!isFirstPage) {
    element.classList.add('pdf-break-after-marker');
    element.style.setProperty('padding-top', `${PAGE_TOP_GAP_PX}px`, 'important');
    element.style.setProperty('margin-top', '0px', 'important');
  }
  
  pdfLog(traceId, 'marker-added', {
    tagName: element.tagName,
    isFirstPage,
    existingMarkersCount: existingMarkers.length,
    markerHeight: isFirstPage ? 0 : PAGE_TOP_GAP_PX,
    paddingTop: isFirstPage ? 0 : PAGE_TOP_GAP_PX
  });
  
  return true;
}

// Ensure last page has full background
function ensureLastPageBackground(doc: Document, target: HTMLElement, bgColor: string, traceId: string) {
  const totalHeight = target.scrollHeight;
  const fullPages = Math.floor(totalHeight / A4_HEIGHT_PX);
  const lastPageTop = fullPages * A4_HEIGHT_PX;
  const lastPageHeight = totalHeight - lastPageTop;
  
  pdfLog(traceId, 'last-page-check', {
    totalHeight,
    fullPages,
    lastPageTop,
    lastPageHeight,
    needsSpacer: lastPageHeight > 0 && lastPageHeight < A4_HEIGHT_PX
  });
  
  // Add spacer if last page is not full
  if (lastPageHeight > 0 && lastPageHeight < A4_HEIGHT_PX) {
    const spacer = doc.createElement('div');
    spacer.className = 'pdf-last-page-spacer';
    const spacerHeight = A4_HEIGHT_PX - lastPageHeight;
    
    spacer.style.cssText = `
      height: ${spacerHeight}px !important;
      width: 100% !important;
      background-color: ${bgColor} !important;
      display: block !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      ${DEBUG_MODE ? `border: 2px dashed rgba(255, 255, 255, 0.5) !important; position: relative !important;` : ''}
    `;
    
    if (DEBUG_MODE) {
      spacer.innerHTML = `<div style="position: absolute; top: 10px; left: 10px; color: white; font-size: 12px; background: rgba(0, 0, 0, 0.7); padding: 2px; border: 1px solid rgba(255, 255, 255, 0.5);">SPACER: ${spacerHeight}px</div>`;
    }
    
    target.appendChild(spacer);
    
    pdfLog(traceId, 'spacer-added', {
      spacerHeight,
      totalHeightAfter: target.scrollHeight
    });
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
    
    // Create iframe for rendering
    const iframe = document.createElement('iframe');
    iframe.style.cssText = `
      position: absolute !important;
      top: -9999px !important;
      left: -9999px !important;
      width: ${windowWidth}px !important;
      height: 1000px !important;
      border: none !important;
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
          
          // Get background color
          const computedStyle = iframeWindow.getComputedStyle(target);
          const bgColor = computedStyle.backgroundColor || 'rgb(255, 255, 255)';
          
          pdfLog(traceId, 'target-found', {
            tagName: target.tagName,
            contentHeight: target.scrollHeight,
            bgColor
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
              background-color: ${bgColor} !important;
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
          
          let breaksAdded = 0;
          candidates.forEach(element => {
            if (shouldMoveToNextPage(element, traceId)) {
              if (addPageBreakMarker(iframeDoc, element, bgColor, traceId)) {
                breaksAdded++;
              }
            }
          });
          
          pdfLog(traceId, 'breaks-complete', { breaksAdded });
          
          // Ensure last page background
          ensureLastPageBackground(iframeDoc, target, bgColor, traceId);
          
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
        background-color: ${bgColor} !important;
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
    
    // Ensure last page background
    ensureLastPageBackground(document, element, bgColor, traceId);
    
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
