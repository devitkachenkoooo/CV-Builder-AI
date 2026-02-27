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

const PDF_TRACE_VERSION = 'v-debug-2';
const BREAK_CANDIDATE_CLASS = 'pdf-flow-break';
const DEBUG_MODE = true; // Enable debug logging and visual debugging

function makeTraceId(): string {
  return `pdf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function shortHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

function pdfLog(traceId: string, step: string, details?: Record<string, unknown>) {
  if (details) {
    console.log(`[PDF][${PDF_TRACE_VERSION}][${traceId}] ${step}`, details);
    return;
  }
  console.log(`[PDF][${PDF_TRACE_VERSION}][${traceId}] ${step}`);
}

// Debug visual functions
function debugHighlightBlock(node: HTMLElement, color: string, opacity: number = 0.3) {
  if (!DEBUG_MODE) return;
  node.style.backgroundColor = color;
  node.style.opacity = opacity.toString();
  node.style.border = `2px solid ${color}`;
  node.style.transition = 'all 0.3s ease';
}

function debugHighlightBoundary(doc: Document, y: number, width: number, color: string) {
  if (!DEBUG_MODE) return;
  const boundary = doc.createElement('div');
  boundary.style.cssText = `
    position: absolute;
    top: ${y}px;
    left: 0;
    width: ${width}px;
    height: 2px;
    background-color: ${color};
    z-index: 9999;
    pointer-events: none;
  `;
  doc.body.appendChild(boundary);
}

function debugLogBlockInfo(traceId: string, block: HTMLElement, metrics: any, action: string) {
  if (!DEBUG_MODE) return;
  pdfLog(traceId, `debug:${action}`, {
    tagName: block.tagName,
    className: block.className,
    textContent: block.textContent?.substring(0, 50) + '...',
    nodeTop: metrics.nodeTop,
    nodeBottom: metrics.nodeBottom,
    nodeHeight: metrics.nodeHeight,
    pageTop: metrics.pageTop,
    pageBottom: metrics.pageBottom,
    crossesBottomSafeBoundary: metrics.nodeTop < (metrics.pageBottom - 60) && metrics.nodeBottom > (metrics.pageBottom - 60)
  });
}

// Auto-add pdf-flow-break classes to eligible blocks
function autoAddPdfFlowBreakClasses(doc: Document, target: HTMLElement, traceId: string) {
  pdfLog(traceId, 'debug:auto-add-classes-start');
  
  const main = target.querySelector('main') || target;
  const sections = Array.from(main.querySelectorAll('section'));
  
  let totalAdded = 0;
  
  sections.forEach((section, sectionIndex) => {
    pdfLog(traceId, `debug:processing-section-${sectionIndex}`, {
      sectionId: section.id,
      sectionClass: section.className,
      childrenCount: section.children.length
    });
    
    // Get direct children of section (excluding text nodes)
    const directChildren = Array.from(section.children).filter(child => 
      child.nodeType === 1 && // Element node
      !['script', 'style'].includes(child.tagName.toLowerCase())
    ) as HTMLElement[];
    
    directChildren.forEach((child, childIndex) => {
      // Skip if already has pdf-flow-break class
      if (child.classList.contains('pdf-flow-break')) {
        pdfLog(traceId, `debug:child-already-has-class-${childIndex}`, {
          tagName: child.tagName,
          className: child.className
        });
        return;
      }
      
      // Add pdf-flow-break class
      child.classList.add('pdf-flow-break');
      totalAdded++;
      
      pdfLog(traceId, `debug:added-class-to-child-${childIndex}`, {
        tagName: child.tagName,
        className: child.className,
        textContent: child.textContent?.substring(0, 30) + '...',
        newClasses: 'pdf-flow-break'
      });
    });
  });
  
  pdfLog(traceId, 'debug:auto-add-classes-complete', {
    sectionsProcessed: sections.length,
    totalClassesAdded: totalAdded
  });
  
  return totalAdded;
}

function isHtmlElementNode(node: unknown): node is HTMLElement {
  return Boolean(
    node &&
    typeof node === 'object' &&
    (node as { nodeType?: number }).nodeType === 1 &&
    typeof (node as { tagName?: unknown }).tagName === 'string'
  );
}

/**
 * Creates a dedicated, fixed-size environment for PDF generation.
 * Uses visual scaling to fit any screen while maintaining internal A4 dimensions.
 */
function createPdfModal(
  html: string,
  filename: string = 'resume.pdf',
  traceId: string = makeTraceId(),
  source: 'url' | 'htmlContent' | 'element' = 'htmlContent',
): void {
  pdfLog(traceId, 'createPdfModal:start', {
    source,
    filename,
    htmlLength: html.length,
    htmlHash: shortHash(html),
  });

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
  pdfLog(traceId, 'ui:overlay-and-iframe-created', { targetWidth, visualScale });

  document.body.appendChild(overlay);
  document.body.appendChild(iframe);

  iframe.onload = () => {
    pdfLog(traceId, 'iframe:onload');
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) throw new Error('Iframe access denied');

      // Inject content
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          pdfLog(traceId, 'analysis:start');
          statusText.textContent = 'Preparing content...';

          // Find the actual content container more robustly
          let captureElement = doc.querySelector('.container') ||
            doc.querySelector('.cv-container') ||
            doc.querySelector('.resume') ||
            doc.querySelector('main') ||
            doc.body;

          // If we got body, try to find the first meaningful content element
          if (captureElement === doc.body) {
            const firstChild = Array.from(doc.body.children).find(child => 
              child.nodeType === 1 && 
              !['script', 'style', 'meta', 'link'].includes(child.tagName.toLowerCase())
            ) as HTMLElement;
            if (firstChild) {
              captureElement = firstChild;
            }
          }

          if (!captureElement || (captureElement as any).nodeType !== 1) {
            throw new Error('Could not find a valid content element to capture');
          }

          const target = captureElement as HTMLElement;
          pdfLog(traceId, 'analysis:capture-element', {
            tag: target.tagName,
            className: target.className || 'body',
          });

          const contentHeight = target.scrollHeight;
          const a4HeightPx = 1123;
          const pageTopGapPx = 60;
          const pageBottomSafePx = 60;
          const numPages = Math.max(1, Math.ceil(contentHeight / a4HeightPx));
          pdfLog(traceId, 'analysis:dimensions', {
            contentHeight,
            a4HeightPx,
            pageTopGapPx,
            pageBottomSafePx,
            estimatedPages: numPages,
          });

          // Enhanced background detection and page styling
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
          
          // Use container background if available, otherwise fallback to body or default white
          let bgColor = captureBg || bodyBg || htmlBg || '#ffffff';
          
          // Ensure we have a valid background color
          if (!bgColor || isWhiteLike(bgColor)) {
            bgColor = '#ffffff';
          }

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
            // Enhanced page break styling to ensure proper background on all pages
            .pdf-page-break-marker {
              break-before: page !important;
              page-break-before: always !important;
              display: block !important;
              width: 100% !important;
              height: ${pageTopGapPx}px !important;
              min-height: ${pageTopGapPx}px !important;
              margin: 0 !important;
              padding: 0 !important;
              box-sizing: border-box !important;
              background-color: ${bgColor} !important;
              position: relative !important;
            }
            .pdf-page-break-marker::after {
              content: '' !important;
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              right: 0 !important;
              bottom: 0 !important;
              background-color: ${bgColor} !important;
              z-index: -1 !important;
            }
            .pdf-break-before {
              padding-top: ${pageTopGapPx}px !important;
              margin-top: 0 !important;
              box-sizing: border-box !important;
            }
            .pdf-keep-block {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            ${DEBUG_MODE ? `
            /* Debug styles */
            .pdf-debug-boundary-safe {
              position: absolute;
              background: rgba(0, 255, 0, 0.2) !important;
              z-index: 9998 !important;
              pointer-events: none !important;
            }
            .pdf-debug-boundary-unsafe {
              position: absolute;
              background: rgba(255, 0, 0, 0.2) !important;
              z-index: 9998 !important;
              pointer-events: none !important;
            }
            .pdf-debug-candidate {
              background: rgba(255, 0, 0, 0.3) !important;
              border: 2px solid red !important;
            }
            .pdf-debug-moved {
              background: rgba(0, 255, 0, 0.3) !important;
              border: 2px solid green !important;
            }
            ` : ''}
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

          // Apply background to all elements for consistent page coloring
          doc.body.style.backgroundColor = bgColor;
          doc.documentElement.style.backgroundColor = bgColor;
          target.style.backgroundColor = bgColor;
          
          pdfLog(traceId, 'analysis:background', {
            captureBg,
            bodyBg,
            htmlBg,
            chosen: bgColor,
          });

          // Auto-add pdf-flow-break classes to eligible blocks
          const autoAddedClasses = autoAddPdfFlowBreakClasses(doc, target, traceId);
          pdfLog(traceId, 'debug:auto-classes-added', { autoAddedClasses });

          // 3. Load Library
          const win = iframe.contentWindow as any;
          const script = doc.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';

          script.onerror = () => {
            console.error(`[PDF][${PDF_TRACE_VERSION}][${traceId}] library:load-error`);
            statusText.textContent = 'Library load failed. Check your internet.';
            setTimeout(() => { overlay.remove(); iframe.remove(); }, 3000);
          };

          script.onload = () => {
            pdfLog(traceId, 'library:loaded');
            if (win.html2pdf) {
              statusText.textContent = `Rendering ${numPages} page(s)...`;

              target.style.backgroundColor = bgColor;
              doc.body.style.backgroundColor = bgColor;
              const mainFlow = (target.querySelector(':scope > main') || target.querySelector('main')) as HTMLElement | null;
              const flowRoot = mainFlow || target;
              pdfLog(traceId, 'flow:root-selected', {
                hasMain: Boolean(mainFlow),
                flowRootTag: flowRoot.tagName,
                flowRootClass: flowRoot.className || null,
                flowChildren: flowRoot.children.length,
              });
              Array.from(flowRoot.querySelectorAll('.pdf-page-break-marker')).forEach((node) => node.remove());
              Array.from(flowRoot.querySelectorAll('.pdf-break-before, .pdf-page-start, .pdf-keep-block, .pdf-page-break-marker')).forEach((node) => {
                if (!isHtmlElementNode(node)) return;
                node.classList.remove('pdf-break-before');
                node.classList.remove('pdf-page-start');
                node.classList.remove('pdf-keep-block');
                node.style.breakBefore = '';
                node.style.pageBreakBefore = '';
                node.style.breakInside = '';
                node.style.pageBreakInside = '';
              });

              const flowBlocks = Array.from(flowRoot.children) as HTMLElement[];
              flowBlocks.forEach((child) => {
                if (!isHtmlElementNode(child)) return;
                // Parent wrappers are allowed to split; fine-grained blocks control breaks.
                child.style.breakInside = 'auto';
                child.style.pageBreakInside = 'auto';
              });

              const getLayoutMetrics = (node: HTMLElement) => {
                const rect = node.getBoundingClientRect();
                if (rect.height < 4) return null;
                const containerRect = target.getBoundingClientRect();
                const nodeTop = rect.top - containerRect.top;
                const nodeBottom = rect.bottom - containerRect.top;
                const pageIndex = Math.floor(nodeTop / a4HeightPx);
                const pageTop = pageIndex * a4HeightPx;
                const pageBottom = (Math.floor(nodeTop / a4HeightPx) + 1) * a4HeightPx;
                return {
                  nodeTop,
                  nodeBottom,
                  nodeHeight: rect.height,
                  pageTop,
                  pageBottom,
                };
              };

              const shouldMoveNodeToNextPage = (node: HTMLElement) => {
                const metrics = getLayoutMetrics(node);
                if (!metrics) {
                  pdfLog(traceId, 'debug:shouldMove-no-metrics', { tagName: node.tagName });
                  return false;
                }
                
                const maxChunkHeight = a4HeightPx - pageTopGapPx - pageBottomSafePx;
                if (metrics.nodeHeight > maxChunkHeight) {
                  pdfLog(traceId, 'debug:shouldMove-too-tall', { 
                    tagName: node.tagName,
                    nodeHeight: metrics.nodeHeight,
                    maxChunkHeight 
                  });
                  return false;
                }
                
                const bottomSafeBoundary = metrics.pageBottom - pageBottomSafePx;
                const crossesBottomSafeBoundary =
                  metrics.nodeTop < bottomSafeBoundary &&
                  metrics.nodeBottom > bottomSafeBoundary;
                
                const shouldMove = crossesBottomSafeBoundary &&
                  metrics.nodeTop > metrics.pageTop + 6 &&
                  metrics.nodeTop < metrics.pageBottom - pageTopGapPx;
                
                // Debug logging
                debugLogBlockInfo(traceId, node, metrics, shouldMove ? 'WILL_MOVE' : 'WILL_STAY');
                
                // Visual debugging
                if (DEBUG_MODE) {
                  // Highlight the block
                  debugHighlightBlock(node, shouldMove ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)');
                  
                  // Draw boundary line
                  debugHighlightBoundary(doc, bottomSafeBoundary, targetWidth, 'rgba(0, 255, 0, 0.5)');
                  
                  // Add debug class
                  if (shouldMove) {
                    node.classList.add('pdf-debug-moved');
                  } else {
                    node.classList.add('pdf-debug-candidate');
                  }
                }
                
                pdfLog(traceId, 'debug:shouldMove-decision', {
                  tagName: node.tagName,
                  crossesBottomSafeBoundary,
                  nodeTop: metrics.nodeTop,
                  pageTop: metrics.pageTop,
                  pageBottom: metrics.pageBottom,
                  bottomSafeBoundary,
                  shouldMove
                });
                
                return shouldMove;
              };

              const markBreakBefore = (node: HTMLElement) => {
                const parent = node.parentElement;
                if (!parent) return false;
                const prev = node.previousElementSibling;
                if (prev && prev.classList.contains('pdf-page-break-marker')) return false;
                
                const marker = doc.createElement('div');
                marker.className = 'pdf-page-break-marker';
                marker.innerHTML = '&nbsp;';
                
                // Set explicit styles for the marker
                marker.style.cssText = `
                  background-color: ${bgColor} !important;
                  height: ${pageTopGapPx}px !important;
                  min-height: ${pageTopGapPx}px !important;
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
                
                parent.insertBefore(marker, node);
                
                // Add break class to the node itself
                node.classList.add('pdf-break-before');
                node.style.cssText += `
                  padding-top: ${pageTopGapPx}px !important;
                  margin-top: 0 !important;
                  box-sizing: border-box !important;
                `;
                return true;
              };

              const getBreakCandidates = (): HTMLElement[] => {
                const allBlocks = Array.from(flowRoot.querySelectorAll(`.${BREAK_CANDIDATE_CLASS}`))
                  .filter((el): el is HTMLElement => isHtmlElementNode(el));
                
                pdfLog(traceId, 'debug:getBreakCandidates-start', {
                  totalFound: allBlocks.length,
                  className: BREAK_CANDIDATE_CLASS
                });
                
                const blocks = allBlocks
                  .filter((el) => !el.classList.contains('pdf-break-before'))
                  .filter((el) => !el.classList.contains('pdf-page-break-marker'))
                  .filter((el) => el.offsetHeight > 8);
                
                pdfLog(traceId, 'debug:getBreakCandidates-filtered', {
                  afterFiltering: blocks.length,
                  removed: allBlocks.length - blocks.length
                });
                
                blocks.forEach((block, index) => {
                  block.classList.add('pdf-keep-block');
                  block.style.breakInside = 'avoid';
                  block.style.pageBreakInside = 'avoid';
                  
                  // Debug logging for each candidate
                  if (DEBUG_MODE) {
                    const metrics = getLayoutMetrics(block);
                    pdfLog(traceId, `debug:candidate-${index}`, {
                      tagName: block.tagName,
                      className: block.className,
                      textContent: block.textContent?.substring(0, 30) + '...',
                      offsetHeight: block.offsetHeight,
                      metrics: metrics ? {
                        nodeTop: metrics.nodeTop,
                        nodeBottom: metrics.nodeBottom,
                        nodeHeight: metrics.nodeHeight
                      } : null
                    });
                  }
                });
                
                return blocks;
              };

              const maxPasses = 6;
              let directBreaks = 0;
              
              pdfLog(traceId, 'debug:flow-analysis-start', {
                maxPasses,
                a4HeightPx,
                pageTopGapPx,
                pageBottomSafePx,
                targetHeight: target.scrollHeight
              });
              
              // Draw page boundaries for debugging
              if (DEBUG_MODE) {
                const pagesNow = Math.max(1, Math.ceil(target.scrollHeight / a4HeightPx));
                pdfLog(traceId, 'debug:drawing-page-boundaries', { pagesNow });
                
                for (let page = 0; page < pagesNow; page++) {
                  const pageTop = page * a4HeightPx;
                  const pageBottom = (page + 1) * a4HeightPx;
                  const bottomSafeBoundary = pageBottom - pageBottomSafePx;
                  
                  // Draw page boundaries
                  debugHighlightBoundary(doc, pageTop, targetWidth, 'rgba(0, 0, 255, 0.3)');
                  debugHighlightBoundary(doc, pageBottom, targetWidth, 'rgba(0, 0, 255, 0.3)');
                  debugHighlightBoundary(doc, bottomSafeBoundary, targetWidth, 'rgba(0, 255, 0, 0.5)');
                }
              }
              
              for (let pass = 0; pass < maxPasses; pass++) {
                let changed = false;
                const candidates = getBreakCandidates();
                pdfLog(traceId, 'flow:break-candidates', {
                  pass: pass + 1,
                  className: BREAK_CANDIDATE_CLASS,
                  count: candidates.length,
                });
                
                for (const block of candidates) {
                  if (shouldMoveNodeToNextPage(block) && markBreakBefore(block)) {
                    directBreaks++;
                    changed = true;
                    pdfLog(traceId, 'debug:block-moved', {
                      tagName: block.tagName,
                      textContent: block.textContent?.substring(0, 30) + '...',
                      pass: pass + 1,
                      totalBreaks: directBreaks
                    });
                  }
                }
                
                pdfLog(traceId, 'flow:pass-complete', { 
                  pass: pass + 1, 
                  changed, 
                  directBreaks,
                  candidatesProcessed: candidates.length
                });
                
                if (!changed) {
                  pdfLog(traceId, 'debug:no-more-changes', { finalPass: pass + 1 });
                  break;
                }
              }

              // Enforce page transitions for every page after the first.
              const maxChunkHeight = a4HeightPx - pageTopGapPx - pageBottomSafePx;
              const findBoundarySplitCandidate = (
                blocks: HTMLElement[],
                boundaryY: number,
                pageTop: number,
                pageBottom: number,
              ): HTMLElement | null => {
                for (const child of blocks) {
                  const metrics = getLayoutMetrics(child);
                  if (!metrics) continue;
                  const crossesBoundary = metrics.nodeTop < boundaryY && metrics.nodeBottom > boundaryY;
                  if (!crossesBoundary) continue;

                  const canMoveWhole =
                    metrics.nodeHeight <= maxChunkHeight &&
                    metrics.nodeTop > pageTop + 6 &&
                    metrics.nodeTop < pageBottom - pageTopGapPx;
                  if (canMoveWhole) return child;
                }
                return null;
              };

              let boundaryBreaks = 0;
              const boundaryPasses = 2;
              for (let pass = 0; pass < boundaryPasses; pass++) {
                let passInserted = 0;
                const pagesNow = Math.max(1, Math.ceil((target.scrollHeight + pageBottomSafePx) / a4HeightPx));
                const candidates = getBreakCandidates();
                for (let page = 1; page < pagesNow; page++) {
                  const pageTop = (page - 1) * a4HeightPx;
                  const pageBottom = page * a4HeightPx;
                  const boundaryY = pageBottom - pageBottomSafePx;
                  const candidate = findBoundarySplitCandidate(candidates, boundaryY, pageTop, pageBottom);
                  if (candidate && markBreakBefore(candidate)) {
                    passInserted++;
                    boundaryBreaks++;
                  }
                }
                pdfLog(traceId, 'flow:boundary-pass', { pass: pass + 1, inserted: passInserted, totalBoundaryBreaks: boundaryBreaks });
                if (passInserted === 0) break;
              }
              // Final summary and cleanup
              const totalBreaks = flowRoot.querySelectorAll('.pdf-page-break-marker').length;
              const totalKeepBlocks = flowRoot.querySelectorAll('.pdf-keep-block').length;
              
              pdfLog(traceId, 'flow:summary', {
                totalBreaks,
                totalKeepBlocks,
                directBreaks,
                boundaryBreaks,
                breakCandidateClass: BREAK_CANDIDATE_CLASS,
                targetScrollHeight: target.scrollHeight,
                estimatedPages: Math.ceil(target.scrollHeight / a4HeightPx)
              });
              
              // Debug summary
              if (DEBUG_MODE) {
                const markerNodes = Array.from(flowRoot.querySelectorAll('.pdf-page-break-marker'))
                  .filter((el): el is HTMLElement => isHtmlElementNode(el));
                
                pdfLog(traceId, 'debug:final-summary', {
                  markersCreated: markerNodes.length,
                  finalTargetHeight: target.scrollHeight,
                  pagesRequired: Math.ceil(target.scrollHeight / a4HeightPx),
                  debugMode: 'ENABLED'
                });
                
                // Log all markers with their positions
                markerNodes.forEach((marker, index) => {
                  const metrics = getLayoutMetrics(marker);
                  pdfLog(traceId, `debug:marker-${index}`, {
                    markerHeight: marker.offsetHeight,
                    position: metrics ? {
                      nodeTop: metrics.nodeTop,
                      pageTop: metrics.pageTop,
                      pageBottom: metrics.pageBottom
                    } : null
                  });
                });
              }
              const markerNodes = Array.from(flowRoot.querySelectorAll('.pdf-page-break-marker'))
                .filter((el): el is HTMLElement => isHtmlElementNode(el));
              const markerMetrics = markerNodes.slice(0, 5).map((marker, idx) => {
                const style = win.getComputedStyle(marker);
                const parent = marker.parentElement;
                const parentStyle = parent ? win.getComputedStyle(parent) : null;
                return {
                  idx,
                  offsetHeight: marker.offsetHeight,
                  cssHeight: style.height,
                  breakBefore: style.breakBefore || style.pageBreakBefore || null,
                  parentTag: parent?.tagName || null,
                  parentClass: parent?.className || null,
                  parentDisplay: parentStyle?.display || null,
                };
              });
              pdfLog(traceId, 'flow:markers-metrics', {
                markerCount: markerNodes.length,
                sample: markerMetrics,
              });

              // Ensure proper content height and page breaks
              target.style.boxSizing = 'border-box';
              target.style.backgroundColor = bgColor;
              
              // Calculate final page count and set minimum height
              const fullPageCount = Math.max(1, Math.ceil(target.scrollHeight / a4HeightPx));
              const totalMinHeight = fullPageCount * a4HeightPx;
              
              target.style.minHeight = `${totalMinHeight}px`;
              doc.body.style.minHeight = `${totalMinHeight}px`;
              doc.documentElement.style.minHeight = `${totalMinHeight}px`;
              
              // Ensure all page break markers have proper background
              const allMarkers = Array.from(doc.querySelectorAll('.pdf-page-break-marker')) as HTMLElement[];
              allMarkers.forEach(marker => {
                marker.style.backgroundColor = bgColor;
                marker.style.setProperty('background-color', bgColor, 'important');
              });
              
              pdfLog(traceId, 'layout:final-height', {
                targetScrollHeight: target.scrollHeight,
                fullPageCount,
                minHeight: target.style.minHeight,
                markersCount: allMarkers.length,
              });
              
              // Final background application
              doc.body.style.backgroundColor = bgColor;
              doc.documentElement.style.backgroundColor = bgColor;

              const pdfOptions = {
                margin: 0,
                filename: filename,
                pagebreak: {
                  mode: ['css', 'legacy'],
                  before: ['.pdf-page-break-marker'],
                  avoid: ['.pdf-keep-block', 'h1', 'h2', 'h3', '.section-title', 'img', 'tr', 'thead', 'tbody']
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
              };
              pdfLog(traceId, 'render:html2pdf-set', {
                margin: pdfOptions.margin,
                pagebreakMode: pdfOptions.pagebreak.mode,
                beforeSelectors: pdfOptions.pagebreak.before,
                avoidCount: pdfOptions.pagebreak.avoid.length,
                html2canvas: {
                  scale: pdfOptions.html2canvas.scale,
                  width: pdfOptions.html2canvas.width,
                  windowWidth: pdfOptions.html2canvas.windowWidth,
                },
              });

              win.html2pdf().from(captureElement).set(pdfOptions).save().then(() => {
                pdfLog(traceId, 'render:success');
                statusText.textContent = 'Success!';
                setTimeout(() => {
                  pdfLog(traceId, 'cleanup:success');
                  overlay.remove();
                  iframe.remove();
                  style.remove();
                }, 800);
              }).catch((err: any) => {
                console.error(`[PDF][${PDF_TRACE_VERSION}][${traceId}] render:error`, err);
                statusText.textContent = 'Generation failed';
                setTimeout(() => { overlay.remove(); iframe.remove(); }, 2000);
              });
            } else {
              console.error(`[PDF][${PDF_TRACE_VERSION}][${traceId}] library:not-found`);
              statusText.textContent = 'Plugin Error';
              setTimeout(() => { overlay.remove(); iframe.remove(); }, 2000);
            }
          };
          doc.head.appendChild(script);
        } catch (innerErr: any) {
          console.error(`[PDF][${PDF_TRACE_VERSION}][${traceId}] analysis:error`, innerErr);
          statusText.textContent = 'Analysis failed';
          setTimeout(() => { overlay.remove(); iframe.remove(); }, 2000);
        }
      }, 1500);

    } catch (err) {
      console.error(`[PDF][${PDF_TRACE_VERSION}][${traceId}] setup:error`, err);
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
  const traceId = makeTraceId();
  pdfLog(traceId, 'entry:generatePdfFromElement', {
    filename: filename || 'resume.pdf',
    elementTag: element.tagName,
    elementClass: element.className || null,
    outerHtmlLength: element.outerHTML.length,
    outerHtmlHash: shortHash(element.outerHTML),
  });
  if (onLoadingChange) onLoadingChange(true);
  try {
    createPdfModal(element.outerHTML, filename, traceId, 'element');
    // Modal cleans itself up
    await new Promise(r => setTimeout(r, 2000));
  } finally {
    if (onLoadingChange) onLoadingChange(false);
  }
}

export async function generatePdfFromUrl(options: PdfFromUrlOptions): Promise<void> {
  const { url, htmlContent, onLoadingChange, filename } = options;
  const traceId = makeTraceId();
  pdfLog(traceId, 'entry:generatePdfFromUrl', {
    hasUrl: Boolean(url),
    hasHtmlContent: Boolean(htmlContent),
    filename: filename || 'resume.pdf',
    url: url || null,
  });
  if (onLoadingChange) onLoadingChange(true);
  try {
    let html = htmlContent;

    if (!html) {
      if (!url) {
        pdfLog(traceId, 'input:error-no-url-no-html');
        throw new Error('Either url or htmlContent must be provided');
      }

      const res = await fetch(url, { credentials: 'include' });
      pdfLog(traceId, 'source:fetch-url', { url, status: res.status, ok: res.ok });
      if (!res.ok) {
        throw new Error(`Failed to fetch HTML for PDF generation: ${res.status}`);
      }
      html = await res.text();
      pdfLog(traceId, 'source:html-from-url', {
        htmlLength: html.length,
        htmlHash: shortHash(html),
      });
    } else {
      pdfLog(traceId, 'source:html-from-db', {
        htmlLength: html.length,
        htmlHash: shortHash(html),
      });
    }

    createPdfModal(html, filename, traceId, htmlContent ? 'htmlContent' : 'url');
    await new Promise(r => setTimeout(r, 2000));
  } finally {
    if (onLoadingChange) onLoadingChange(false);
  }
}
