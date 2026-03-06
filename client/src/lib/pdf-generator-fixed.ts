interface PdfFromUrlOptions {
  url?: string;
  htmlContent?: string;
  filename?: string;
  onLoadingChange?: (loading: boolean) => void;
  windowWidth?: number;
  contentWidthMm?: number;
  autoPrint?: boolean;
}

interface PdfFromElementOptions {
  element: HTMLElement;
  filename?: string;
  onLoadingChange?: (loading: boolean) => void;
  autoPrint?: boolean;
}

const A4_HEIGHT_PX = 1123;
const PAGE_BOTTOM_SAFE_PX = 80;
const PAGE_TOP_PADDING_PX = 90;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeTitle(filename: string): string {
  return filename.replace(/[\\/:*?"<>|]/g, "").trim() || "document.pdf";
}

function getOffsetTopFromContainer(element: HTMLElement, container: HTMLElement): number {
  let top = 0;
  let current: HTMLElement | null = element;
  while (current && current !== container) {
    top += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }
  return top;
}

function getBreakCandidates(container: HTMLElement): HTMLElement[] {
  const main = container.querySelector("main") as HTMLElement | null;
  if (!main) return [];

  const skipTags = new Set(["script", "style", "link", "meta", "noscript"]);
  const candidates: HTMLElement[] = [];

  for (const parent of Array.from(main.children)) {
    if (skipTags.has(parent.tagName.toLowerCase())) continue;
    for (const child of Array.from(parent.children)) {
      if (skipTags.has(child.tagName.toLowerCase())) continue;
      candidates.push(child as HTMLElement);
    }
  }

  return candidates;
}

function clearPageMarkers(doc: Document): void {
  const markers = doc.querySelectorAll(".cv-print-bottom-spacer, .cv-print-top-spacer");
  markers.forEach((marker) => marker.remove());
}

function applyPrintPagination(win: Window): void {
  const doc = win.document;
  const container =
    (doc.querySelector(".container") as HTMLElement | null) ?? (doc.body as HTMLElement | null);
  if (!container) return;

  clearPageMarkers(doc);
  void container.offsetHeight;

  const bgColor = win.getComputedStyle(container).backgroundColor || "#ffffff";
  const candidates = getBreakCandidates(container);

  for (const block of candidates) {
    const blockTop = getOffsetTopFromContainer(block, container);
    const blockBottom = blockTop + block.offsetHeight;
    const pageIndex = Math.floor(blockTop / A4_HEIGHT_PX);
    const currentPageEnd = (pageIndex + 1) * A4_HEIGHT_PX;
    const safeEnd = currentPageEnd - PAGE_BOTTOM_SAFE_PX;
    const relTop = blockTop - pageIndex * A4_HEIGHT_PX;
    const isAlreadyAtTop = relTop < PAGE_TOP_PADDING_PX + 10;

    if (blockBottom <= safeEnd || isAlreadyAtTop) continue;

    const bottomSpacerHeight = Math.max(0, currentPageEnd - blockTop);

    const bottomSpacer = doc.createElement("div");
    bottomSpacer.className = "cv-print-bottom-spacer";
    bottomSpacer.style.cssText =
      `height:${bottomSpacerHeight}px !important;` +
      `min-height:${bottomSpacerHeight}px !important;` +
      `background:${bgColor} !important;` +
      "display:block !important;width:100% !important;margin:0 !important;padding:0 !important;";

    const topSpacer = doc.createElement("div");
    topSpacer.className = "cv-print-top-spacer";
    topSpacer.style.cssText =
      `height:${PAGE_TOP_PADDING_PX}px !important;` +
      `min-height:${PAGE_TOP_PADDING_PX}px !important;` +
      `background:${bgColor} !important;` +
      "display:block !important;width:100% !important;margin:0 !important;padding:0 !important;" +
      "box-sizing:border-box !important;overflow:hidden !important;line-height:0 !important;font-size:0 !important;";
    topSpacer.innerHTML = "&nbsp;";

    block.parentNode?.insertBefore(bottomSpacer, block);
    block.parentNode?.insertBefore(topSpacer, block);
    void container.offsetHeight;
  }
}

function injectPrintStyle(doc: Document): void {
  const style = doc.createElement("style");
  style.textContent = `
    @page {
      margin: 0;
      size: A4;
    }

    html, body {
      margin: 0 !important;
      padding: 0 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .no-print {
      display: none !important;
    }
  `;
  doc.head.appendChild(style);
}

function copyStylesFromCurrentDocument(targetDoc: Document): void {
  const styleNodes = document.querySelectorAll('style, link[rel="stylesheet"]');
  for (const node of Array.from(styleNodes)) {
    targetDoc.head.appendChild(node.cloneNode(true));
  }
}

async function waitForImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images);
  const waits = images.map((img) => {
    if (img.complete) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const cleanup = () => {
        img.removeEventListener("load", onDone);
        img.removeEventListener("error", onDone);
      };
      const onDone = () => {
        cleanup();
        resolve();
      };
      img.addEventListener("load", onDone, { once: true });
      img.addEventListener("error", onDone, { once: true });
    });
  });

  await Promise.all(waits);
}

async function waitForResources(win: Window): Promise<void> {
  const doc = win.document;
  if (doc.fonts?.ready) {
    try {
      await doc.fonts.ready;
    } catch {
      // Ignore font loading errors for print flow
    }
  }
  await waitForImages(doc);
  await delay(120);
}

function triggerPrint(win: Window): void {
  window.setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch (error) {
      console.error("Print trigger failed:", error);
    }
  }, 40);
}

function createPrintWindow(): Window {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Failed to open print window");
  }
  return printWindow;
}

async function printElement(element: HTMLElement, filename: string, autoPrint: boolean): Promise<void> {
  const printWindow = createPrintWindow();
  const printDoc = printWindow.document;

  printDoc.open();
  printDoc.write("<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head><body></body></html>");
  printDoc.close();

  copyStylesFromCurrentDocument(printDoc);
  injectPrintStyle(printDoc);
  printDoc.title = sanitizeTitle(filename);
  printDoc.body.appendChild(element.cloneNode(true));
  void waitForResources(printWindow).then(() => {
    applyPrintPagination(printWindow);
    if (autoPrint) {
      triggerPrint(printWindow);
    }
  });
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Failed to fetch printable content: ${response.status}`);
  }
  return response.text();
}

function mountHtmlIntoPrintDocument(
  doc: Document,
  html: string,
  filename: string,
  baseUrl?: string,
): void {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, "text/html");

  doc.open();
  doc.write("<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head><body></body></html>");
  doc.close();

  doc.title = sanitizeTitle(filename);

  if (baseUrl) {
    const base = doc.createElement("base");
    base.href = baseUrl;
    doc.head.appendChild(base);
  }

  for (const node of Array.from(parsed.head.childNodes)) {
    doc.head.appendChild(node.cloneNode(true));
  }

  injectPrintStyle(doc);

  while (doc.body.firstChild) {
    doc.body.removeChild(doc.body.firstChild);
  }

  for (const node of Array.from(parsed.body.childNodes)) {
    doc.body.appendChild(node.cloneNode(true));
  }
}

export class FixedPdfGenerator {
  static async generatePdfFromElement(
    element: HTMLElement,
    filename: string = "document.pdf",
  ): Promise<void> {
    await printElement(element, filename, false);
  }

  static async generatePdfFromElementIframe(
    element: HTMLElement,
    filename: string = "document.pdf",
  ): Promise<void> {
    await printElement(element, filename, false);
  }
}

export async function generatePdfFromUrl(options: PdfFromUrlOptions): Promise<void> {
  const {
    url,
    htmlContent,
    filename = "document.pdf",
    onLoadingChange,
    autoPrint = false,
  } = options;

  if (!url && !htmlContent) {
    throw new Error("Either url or htmlContent must be provided");
  }

  onLoadingChange?.(true);
  try {
    const html = htmlContent ?? (await fetchHtml(url!));
    const printWindow = createPrintWindow();
    mountHtmlIntoPrintDocument(printWindow.document, html, filename, url);
    void waitForResources(printWindow).then(() => {
      applyPrintPagination(printWindow);
      if (autoPrint) {
        triggerPrint(printWindow);
      }
    });
  } finally {
    onLoadingChange?.(false);
  }
}

export async function generatePdfFromElement(
  options: PdfFromElementOptions,
): Promise<void> {
  const { element, filename = "document.pdf", onLoadingChange, autoPrint = false } = options;

  onLoadingChange?.(true);
  try {
    await printElement(element, filename, autoPrint);
  } finally {
    onLoadingChange?.(false);
  }
}

export const generatePdfFromElementFixed =
  FixedPdfGenerator.generatePdfFromElement.bind(FixedPdfGenerator);
export const generatePdfFromElementIframeFixed =
  FixedPdfGenerator.generatePdfFromElementIframe.bind(FixedPdfGenerator);
