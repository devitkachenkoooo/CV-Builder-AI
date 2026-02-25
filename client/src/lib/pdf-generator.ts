import html2pdf from 'html2pdf.js';

interface PdfFromUrlOptions {
  url: string;
  filename?: string;
  windowWidth?: number;
  contentWidthMm?: number;
  onLoadingChange?: (loading: boolean) => void; // Callback для кнопки
}

interface PdfFromElementOptions {
  element: HTMLElement;
  filename?: string;
  windowWidth?: number;
  contentWidthMm?: number;
  onLoadingChange?: (loading: boolean) => void; // Callback для кнопки
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

async function renderElementToPdf(options: Omit<PdfFromElementOptions, 'onLoadingChange'>): Promise<void> {
  const {
    element,
    filename = 'resume.pdf',
    windowWidth = 800,
    contentWidthMm = 190,
  } = options;

  // Налаштування html2pdf.js для можливості виділення тексту
  const pdfOptions = {
    margin: 10,
    filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true, 
      letterRendering: true,
      windowWidth,
      backgroundColor: '#ffffff',
      logging: false,
    },
    jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
  };

  // Генерація PDF з можливістю виділення тексту
  await html2pdf().set(pdfOptions).from(element).save();
}

async function renderHtmlToPdf(html: string, filename?: string, windowWidth?: number, contentWidthMm?: number): Promise<void> {
  const defaultFilename = filename || 'resume.pdf';
  const defaultWindowWidth = windowWidth || 800;
  const defaultContentWidthMm = contentWidthMm || 190;

  // Створюємо тимчасовий div, «видимий» для браузера, але не для юзера
  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'fixed';
  tempDiv.style.left = '-9999px';
  tempDiv.style.width = '800px';
  tempDiv.style.height = 'auto';
  tempDiv.style.background = 'white';
  tempDiv.style.color = 'black';
  tempDiv.style.overflow = 'visible';
  tempDiv.style.visibility = 'visible';
  tempDiv.style.opacity = '1';
  tempDiv.innerHTML = html;

  document.body.appendChild(tempDiv);

  // Чекаємо 500мс, щоб стилі підвантажилися
  await new Promise<void>(resolve => setTimeout(resolve, 500));

  // Налаштування html2pdf.js для можливості виділення тексту
  const options = {
    margin: 10,
    filename: defaultFilename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true, 
      letterRendering: true,
      windowWidth: defaultWindowWidth,
      backgroundColor: '#ffffff',
      logging: false,
      height: tempDiv.scrollHeight,
      width: tempDiv.scrollWidth,
      scrollX: 0,
      scrollY: 0,
    },
    jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
  };

  try {
    // Генерація PDF з можливістю виділення тексту
    await html2pdf().set(options).from(tempDiv).save();
  } finally {
    // Cleanup: видаляємо tempDiv після збереження
    tempDiv.remove();
  }
}

export async function generatePdfFromElement(options: PdfFromElementOptions): Promise<void> {
  const { onLoadingChange, ...pdfOptions } = options;
  
  // Показуємо лоадер тільки на кнопці через callback
  if (onLoadingChange) {
    onLoadingChange(true);
  }

  try {
    await renderElementToPdf(pdfOptions);
  } catch (error) {
    console.error('Error generating PDF from element:', error);
    throw error;
  } finally {
    // Прибираємо лоадер з кнопки
    if (onLoadingChange) {
      onLoadingChange(false);
    }
  }
}

export async function generatePdfFromUrl(options: PdfFromUrlOptions): Promise<void> {
  const {
    url,
    filename = 'resume.pdf',
    windowWidth = 800,
    contentWidthMm = 190,
    onLoadingChange,
  } = options;

  // Показуємо лоадер тільки на кнопці через callback
  if (onLoadingChange) {
    onLoadingChange(true);
  }

  try {
    // Fetch HTML content from URL
    const response = await fetch(url);
    const html = await response.text();
    
    await renderHtmlToPdf(html, filename, windowWidth, contentWidthMm);
  } catch (error) {
    console.error('Error generating PDF from URL:', error);
    throw error;
  } finally {
    // Прибираємо лоадер з кнопки
    if (onLoadingChange) {
      onLoadingChange(false);
    }
  }
}
