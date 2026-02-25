import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PdfFromUrlOptions {
  url: string;
  filename?: string;
  windowWidth?: number;
  contentWidthMm?: number;
}

interface PdfFromElementOptions {
  element: HTMLElement;
  filename?: string;
  windowWidth?: number;
  contentWidthMm?: number;
}

function createOffscreenContainer(): HTMLDivElement {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px';
  container.style.height = 'auto';
  container.style.background = 'white';
  container.style.color = 'black';
  container.style.overflow = 'visible';
  container.style.visibility = 'visible';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '9999';
  container.style.opacity = '1';
  return container;
}

async function renderElementToPdf(options: PdfFromElementOptions): Promise<void> {
  const {
    element,
    filename = 'resume.pdf',
    windowWidth = 800,
    contentWidthMm = 190,
  } = options;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  await new Promise<void>((resolve, reject) => {
    try {
      doc.html(element, {
        x: 10,
        y: 10,
        width: contentWidthMm,
        windowWidth,
        autoPaging: 'text',
        callback: () => {
          doc.save(filename);
          resolve();
        },
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function renderHtmlToPdf(html: string, filename?: string, windowWidth?: number, contentWidthMm?: number): Promise<void> {
  const defaultFilename = filename || 'resume.pdf';
  const defaultWindowWidth = windowWidth || 800;
  const defaultContentWidthMm = contentWidthMm || 190;

  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'fixed';
  tempDiv.style.left = '-9999px';
  tempDiv.style.top = '0';
  tempDiv.style.width = '800px';
  tempDiv.style.height = 'auto';
  tempDiv.style.background = 'white';
  tempDiv.style.color = 'black';
  tempDiv.style.overflow = 'visible';
  tempDiv.style.visibility = 'visible';
  tempDiv.style.pointerEvents = 'none';
  tempDiv.style.zIndex = '9999';
  tempDiv.style.opacity = '1';
  tempDiv.innerHTML = html;

  document.body.appendChild(tempDiv);

  await new Promise<void>(resolve => setTimeout(resolve, 500));

  const canvas = await html2canvas(tempDiv, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    windowWidth: defaultWindowWidth,
    backgroundColor: '#ffffff',
    logging: false,
    height: tempDiv.scrollHeight,
    width: tempDiv.scrollWidth,
    scrollX: 0,
    scrollY: 0,
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const img = canvas.toDataURL('image/png');
  doc.addImage(img, 'PNG', 0, 0, defaultContentWidthMm, (defaultContentWidthMm / canvas.width) * canvas.height);
  doc.save(defaultFilename);

  tempDiv.remove();
}

export async function generatePdfFromElement(options: PdfFromElementOptions): Promise<void> {
  await renderElementToPdf(options);
}

export async function generatePdfFromUrl(options: PdfFromUrlOptions): Promise<void> {
  const {
    url,
    filename = 'resume.pdf',
    windowWidth = 800,
    contentWidthMm = 190,
  } = options;

  // Show loading indicator
  const loadingToast = document.createElement('div');
  loadingToast.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2';
  loadingToast.innerHTML = `
    <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
    <span>Generating PDF...</span>
  `;
  document.body.appendChild(loadingToast);

  try {
    // Fetch HTML content from URL
    const response = await fetch(url);
    const html = await response.text();
    
    await renderHtmlToPdf(html, filename, windowWidth, contentWidthMm);
  } catch (error) {
    console.error('Error generating PDF from URL:', error);
    throw error;
  } finally {
    loadingToast.remove();
  }
}
