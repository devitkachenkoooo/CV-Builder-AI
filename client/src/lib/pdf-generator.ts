import html2pdf from 'html2pdf.js';

interface PdfFromUrlOptions {
  url: string;
  filename?: string;
  windowWidth?: number;
  contentWidthMm?: number;
  onLoadingChange?: (loading: boolean) => void;
}

interface PdfFromElementOptions {
  element: HTMLElement;
  filename?: string;
  windowWidth?: number;
  contentWidthMm?: number;
  onLoadingChange?: (loading: boolean) => void;
}

// Функція для створення модального вікна генерації PDF
function createPdfModal(html: string): void {
  // Створюємо модальне вікно (Progress Popup)
  const modal = document.createElement('div');
  modal.id = 'pdf-generation-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.85);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    padding: 40px;
    border-radius: 16px;
    text-align: center;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  `;

  const spinner = document.createElement('div');
  spinner.style.cssText = `
    width: 50px;
    height: 50px;
    border: 4px solid #f3f4f6;
    border-top: 4px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
  `;

  const title = document.createElement('h2');
  title.textContent = 'Generating PDF';
  title.style.cssText = `
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 8px;
    color: #111827;
  `;

  const progress = document.createElement('p');
  progress.textContent = 'Preparing document...';
  progress.style.cssText = `
    font-size: 15px;
    color: #3b82f6;
    font-weight: 500;
  `;

  modalContent.appendChild(spinner);
  modalContent.appendChild(title);
  modalContent.appendChild(progress);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);

  // Створюємо Fullscreen Iframe (Render Target)
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    border: none;
    z-index: 999998;
    background: #f3f4f6;
    opacity: 1;
    visibility: visible;
  `;

  document.body.appendChild(iframe);

  iframe.onload = () => {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error('Cannot access iframe document');

      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      setTimeout(() => {
        progress.textContent = 'Generating...';

        const iframeBody = iframeDoc.body;
        if (iframeBody) {
          // Center content visually during generation
          iframeBody.style.margin = '0';
          iframeBody.style.padding = '50px 0';
          iframeBody.style.display = 'flex';
          iframeBody.style.justifyContent = 'center';
          iframeBody.style.backgroundColor = '#f3f4f6';
          iframeBody.style.minHeight = '100vh';
        }

        const script = iframeDoc.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';

        script.onload = () => {
          const win = iframe.contentWindow as any;
          if (win && win.html2pdf) {
            const container = iframeDoc.querySelector('.cv-container') ||
              iframeDoc.querySelector('.container') ||
              iframeDoc.querySelector('.resume') ||
              iframeDoc.body;

            const target = container as HTMLElement;
            target.style.width = '210mm';
            target.style.margin = '0';
            target.style.padding = '0';
            target.style.boxShadow = 'none';

            win.html2pdf().from(target).set({
              margin: 0,
              filename: 'resume.pdf',
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                width: 794,
                windowWidth: 794
              },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            }).save().then(() => {
              progress.textContent = 'Success!';
              setTimeout(() => {
                iframe.remove();
                modal.remove();
                style.remove();
              }, 1000);
            }).catch((err: any) => {
              console.error('PDF generation error:', err);
              progress.textContent = 'Error during save';
              setTimeout(() => {
                iframe.remove();
                modal.remove();
                style.remove();
              }, 2000);
            });
          }
        };

        iframeDoc.head.appendChild(script);
      }, 1500);
    } catch (error) {
      console.error('Iframe setup error:', error);
      progress.textContent = 'Setup failed';
      setTimeout(() => {
        iframe.remove();
        modal.remove();
        style.remove();
      }, 2000);
    }
  };
}

export async function generatePdfFromElement(options: PdfFromElementOptions): Promise<void> {
  const { element, onLoadingChange } = options;
  if (onLoadingChange) onLoadingChange(true);

  try {
    const html = element.outerHTML;
    await new Promise<void>((resolve, reject) => {
      createPdfModal(html);
      const checkModal = setInterval(() => {
        if (!document.getElementById('pdf-generation-modal')) {
          clearInterval(checkModal);
          resolve();
        }
      }, 500);
      setTimeout(() => { clearInterval(checkModal); reject(new Error('Timeout')); }, 30000);
    });
  } catch (error) {
    console.error('Error in generatePdfFromElement:', error);
    throw error;
  } finally {
    if (onLoadingChange) onLoadingChange(false);
  }
}

export async function generatePdfFromUrl(options: PdfFromUrlOptions): Promise<void> {
  const { url, onLoadingChange } = options;
  if (onLoadingChange) onLoadingChange(true);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Fetch failed');
    const html = await response.text();

    await new Promise<void>((resolve, reject) => {
      createPdfModal(html);
      const checkModal = setInterval(() => {
        if (!document.getElementById('pdf-generation-modal')) {
          clearInterval(checkModal);
          resolve();
        }
      }, 500);
      setTimeout(() => { clearInterval(checkModal); reject(new Error('Timeout')); }, 30000);
    });
  } catch (error) {
    console.error('Error in generatePdfFromUrl:', error);
    throw error;
  } finally {
    if (onLoadingChange) onLoadingChange(false);
  }
}
