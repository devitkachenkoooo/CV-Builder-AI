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

// Функція для відкриття сторінки генерації PDF в новій вкладці
function openPdfGenerationPage(html: string): void {
  // Кодуємо HTML для передачі в URL
  const encodedHtml = encodeURIComponent(html);
  const url = `/pdf-generation/${encodedHtml}`;
  
  // Відкриваємо нову вкладку з розмірами, оптимізованими для PDF
  const newWindow = window.open(
    url, 
    'pdf-generation', 
    'width=900,height=700,scrollbars=yes,resizable=yes'
  );
  
  // Фокус на нову вкладку
  if (newWindow) {
    newWindow.focus();
  }
}

export async function generatePdfFromElement(options: PdfFromElementOptions): Promise<void> {
  const { element, onLoadingChange } = options;
  
  // Показуємо лоадер на кнопці
  if (onLoadingChange) {
    onLoadingChange(true);
  }

  try {
    // Отримуємо HTML з елемента
    const html = element.outerHTML;
    
    // Відкриваємо сторінку генерації в новій вкладці
    openPdfGenerationPage(html);
    
    // Даємо час для відкриття вкладки перед прибиранням лоадера
    await new Promise<void>(resolve => setTimeout(resolve, 1000));
    
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
  const { url, onLoadingChange } = options;

  // Показуємо лоадер на кнопці
  if (onLoadingChange) {
    onLoadingChange(true);
  }

  try {
    // Fetch HTML content from URL
    const response = await fetch(url);
    const html = await response.text();
    
    // Відкриваємо сторінку генерації в новій вкладці
    openPdfGenerationPage(html);
    
    // Даємо час для відкриття вкладки перед прибиранням лоадера
    await new Promise<void>(resolve => setTimeout(resolve, 1000));
    
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
