import html2pdf from 'html2pdf.js';

interface PdfFromUrlOptions {
  url: string;
  filename?: string;
  onLoadingChange?: (loading: boolean) => void;
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
    top: 45%;
    left: 50%;
    transform: translate(-50%, -50%) scale(${visualScale});
    width: ${targetWidth}px;
    height: 1123px; /* Full A4 height */
    border: none;
    background: white;
    box-shadow: 0 0 60px rgba(0,0,0,0.5);
    z-index: 999991; /* Behind the loader but on top of everything else */
    border-radius: 2px;
    pointer-events: none;
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

      // Ensure consistent internal styling
      const bodyStyle = doc.createElement('style');
      bodyStyle.textContent = `
        body { margin: 0; padding: 0; width: ${targetWidth}px; overflow: hidden; background: white; }
        .container, .cv-container, .resume { box-shadow: none !important; margin: 0 !important; border: none !important; }
      `;
      doc.head.appendChild(bodyStyle);

      // Give it a moment to render everything
      setTimeout(() => {
        statusText.textContent = 'Downloading PDF...';

        const win = iframe.contentWindow as any;
        const script = doc.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';

        script.onload = () => {
          if (win.html2pdf) {
            const captureElement = doc.querySelector('.container') ||
              doc.querySelector('.cv-container') ||
              doc.querySelector('.resume') ||
              doc.body;

            win.html2pdf().from(captureElement).set({
              margin: 0,
              filename: filename,
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                width: targetWidth,
                windowWidth: targetWidth
              },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            }).save().then(() => {
              statusText.textContent = 'Success!';
              setTimeout(() => {
                overlay.remove();
                iframe.remove();
                style.remove();
              }, 800);
            }).catch((err: any) => {
              console.error('PDF Generation failed:', err);
              overlay.remove();
              iframe.remove();
            });
          }
        };
        doc.head.appendChild(script);
      }, 1500);

    } catch (err) {
      console.error('PDF Setup Error:', err);
      overlay.remove();
      iframe.remove();
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
  const { url, onLoadingChange, filename } = options;
  if (onLoadingChange) onLoadingChange(true);
  try {
    const res = await fetch(url);
    const html = await res.text();
    createPdfModal(html, filename);
    await new Promise(r => setTimeout(r, 2000));
  } finally {
    if (onLoadingChange) onLoadingChange(false);
  }
}
