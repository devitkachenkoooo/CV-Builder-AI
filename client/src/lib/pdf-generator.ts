import jsPDF from 'jspdf';

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
  container.style.left = '-100000px';
  container.style.top = '0';
  container.style.width = '800px';
  container.style.background = '#fff';
  container.style.color = '#000';
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

  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`Failed to fetch HTML for PDF: ${res.status}`);
  }

  const html = await res.text();
  const parsed = new DOMParser().parseFromString(html, 'text/html');

  const container = createOffscreenContainer();

  // Copy styles from the template into the container
  const styleEls = parsed.querySelectorAll('style, link[rel="stylesheet"]');
  styleEls.forEach((node) => {
    container.appendChild(node.cloneNode(true));
  });

  // Body content
  const bodyWrapper = document.createElement('div');
  bodyWrapper.innerHTML = parsed.body?.innerHTML || html;
  container.appendChild(bodyWrapper);

  document.body.appendChild(container);
  try {
    await renderElementToPdf({
      element: container,
      filename,
      windowWidth,
      contentWidthMm,
    });
  } finally {
    container.remove();
  }
}
