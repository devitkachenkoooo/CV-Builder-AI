# PDF Generator — Technical Documentation

> **Source file:** `client/src/lib/pdf-generator.ts`

This document explains the architecture of the custom PDF pagination engine, why each design decision was made, and how to customise its behaviour.

---

## Why a Custom Engine?

`html2pdf.js` can render HTML to PDF, but it has one critical problem: it **crops the canvas every N pixels** at fixed A4 boundaries. If a content block happens to straddle that boundary, it gets **sliced in half**.

The default `page-break-*` CSS approach is unreliable in practice with `html2canvas` (the underlying renderer), especially for multi-column layouts and coloured backgrounds.

This engine solves that by **physically inserting spacers** into the DOM before measurement, so that every block starts at an exact multiple of the A4 page height. html2pdf then crops at those boundaries and every page looks perfect.

---

## How It Works — Step by Step

### 1. Render in an off-screen iframe

The template HTML is loaded into an invisible `<iframe>` positioned off the left edge of the screen. This is necessary to get accurate DOM layout measurements without affecting the visible page.

**Why `left: -(width+200)px` instead of `top: -9999px`?**  
`getBoundingClientRect()` would return garbage with `top: -9999px` because coordinates are viewport-relative. By keeping the iframe at `left: -Xpx` it stays in the layout flow vertically, so `element.offsetTop` measurements are accurate.

### 2. Lock the container width

Before any measurements, the container is forced to `210mm` (A4 width) with all decorative styles (`box-shadow`, `margin`, `border`) removed. A reflow is triggered via `void container.offsetHeight`.

### 3. Find break candidates — `main > * > *`

```typescript
// In: getBreakCandidates(container)
const main = container.querySelector('main');
// For every direct child of <main>:
for (const parent of main.children) {
  // ...collect every direct child of that parent:
  for (const child of parent.children) {
    candidates.push(child);
  }
}
```

Only **direct grandchildren of `<main>`** are considered for page breaks. This matches the template structure where `<main>` contains column wrappers, and each column contains section blocks.

### 4. Measure each candidate with `offsetTop` — NOT `getBoundingClientRect()`

```typescript
function getOffsetTopFromContainer(element, container): number {
  let top = 0, el = element;
  while (el && el !== container) {
    top += el.offsetTop;      // ← container-relative, always correct
    el = el.offsetParent;
  }
  return top;
}
```

`getBoundingClientRect()` is viewport-relative and breaks when the iframe is off-screen. `offsetTop` walks the layout tree and is always accurate.

### 5. Decide whether to break

```typescript
const pageIndex      = Math.floor(blockTop / A4_HEIGHT_PX);
const currentPageEnd = (pageIndex + 1) * A4_HEIGHT_PX;
const safeEnd        = currentPageEnd - PAGE_BOTTOM_SAFE_PX;   // 80px safe zone
const relTop         = blockTop - pageIndex * A4_HEIGHT_PX;
const isAlreadyAtTop = relTop < (PAGE_TOP_PADDING_PX + 10);    // freshly moved block

if (blockBottom > safeEnd && !isAlreadyAtTop) → BREAK
```

- **`safeEnd`** — if a block's bottom edge is within `PAGE_BOTTOM_SAFE_PX` pixels of the page bottom, it's moved to the next page.
- **`isAlreadyAtTop`** — prevents double-breaking a block that was JUST moved and now sits at the top of a new page (its `relTop` is `~PAGE_TOP_PADDING_PX`).

### 6. Insert spacers (the key insight)

Instead of an invisible `height: 0` marker, the engine inserts **real spacers** that fill the rest of the current page:

```
Before break:
  ├── Block A  (y=0 → 200)
  ├── Block B  (y=200 → 900)
  └── Block C  (y=900 → 1150)  ← crosses safeEnd (1123-80=1043) → BREAK!

After break:
  ├── Block A  (y=0 → 200)
  ├── Block B  (y=200 → 900)
  ├── [BOTTOM SPACER]  height = 1123 - 900 = 223px, bgColor  ← fills page 1
  ├── [TOP SPACER]     height = 60px, bgColor                ← top of page 2
  └── Block C  (y=1183 → 1433)  ← now at exact position on page 2 ✓
```

This guarantees that all block positions are **exact multiples of 1123px + offset**, so html2pdf's automatic A4 slicing crops in exactly the right places — on every page, not just the first.

### 7. Fill the last page

```typescript
const targetHeight = pageCount * A4_HEIGHT_PX + 2;  // +2px for subpixel safety
container.style.setProperty('min-height', `${targetHeight}px`, 'important');
```

The `+2px` buffer prevents a hairline white strip at the very bottom of the last page caused by subpixel rounding in html2canvas.

The background colour is also applied to `html` and `body` within the iframe so html2canvas captures no white edges.

### 8. Render with html2pdf.js

```typescript
{
  pagebreak: { mode: [] },   // NO explicit CSS breaks — spacers handle everything
  html2canvas: { scale: 2, useCORS: true, backgroundColor: bgColor, ... },
  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
}
```

`mode: []` disables html2pdf's own page-break detection. We rely entirely on the spacers.

---

## Constants — Where to Change Behaviour

All tunable values are constants at the top of `client/src/lib/pdf-generator.ts`:

```typescript
// ─── Line 26 ──────────────────────────────────────────────────────────────────
const A4_HEIGHT_PX = 1123;
// A4 page height in pixels at 794px container width (210mm ≈ 794px at 96 dpi).
// Change if you use a different windowWidth:
//   new_height = (newWindowWidth / 210) * 297
// Do NOT change this unless you also change windowWidth.

// ─── Line 32 ──────────────────────────────────────────────────────────────────
const PAGE_BOTTOM_SAFE_PX = 80;
// Safe zone from the bottom of each page.
// If a block's bottom edge is within this many pixels of the page end,
// the block is moved to the next page.
//
//  ↑ Increase → more aggressive breaking (fewer clipped blocks, more whitespace)
//  ↓ Decrease → less aggressive (tighter pages, possible clipping at boundary)

// ─── Line 37 ──────────────────────────────────────────────────────────────────
const PAGE_TOP_PADDING_PX = 60;
// Gap (in px) added at the top of each new page via a coloured spacer.
// This is the visual "margin" between the page edge and the first block.
//
//  ↑ Increase → wider top margin on new pages
//  ↓ Decrease → tighter top margin (min recommended: 20px)
```

---

## How to Change Which Blocks Are Broken

The selector logic lives in `getBreakCandidates()` (around **line 63**):

```typescript
function getBreakCandidates(container: HTMLElement): HTMLElement[] {
  // ── CHANGE THIS to target different elements ──────────────────────────────
  const main = container.querySelector('main'); // ← target element (default: <main>)

  for (const parent of Array.from(main.children)) {
    // parent = direct child of <main>  (e.g. a column wrapper <div class="left-col">)
    for (const child of Array.from(parent.children)) {
      // child = direct grandchild of <main>  (e.g. a section block)
      candidates.push(child as HTMLElement);    // ← these are the break candidates
    }
  }
}
```

### Examples

**Break by CSS class instead of selector:**
```typescript
// Replace the nested loop with:
const candidates = Array.from(
  container.querySelectorAll('.my-break-class')
) as HTMLElement[];
return candidates;
```

**Break only single-column templates (direct children of main):**
```typescript
// Replace with:
for (const child of Array.from(main.children)) {
  candidates.push(child as HTMLElement);  // main > *  instead of  main > * > *
}
```

**Break at a specific depth (e.g. main > section > article):**
```typescript
for (const section of Array.from(main.querySelectorAll(':scope > section'))) {
  for (const article of Array.from(section.querySelectorAll(':scope > article'))) {
    candidates.push(article as HTMLElement);
  }
}
```

---

## Public API

### `generatePdfFromUrl(options)`

Fetches an HTML template by URL (or accepts raw `htmlContent`) and generates a PDF.

```typescript
await generatePdfFromUrl({
  url: '/templates/template-1.html',   // OR use htmlContent
  htmlContent: '<html>...</html>',
  filename: 'my-resume.pdf',
  onLoadingChange: (isLoading) => setLoading(isLoading),
  windowWidth: 794,                    // optional, default: 794px
});
```

### `generatePdfFromElement(options)`

Generates a PDF from an already-mounted DOM element (useful for testing or server-side-rendered content).

```typescript
await generatePdfFromElement({
  element: document.querySelector('.container') as HTMLElement,
  filename: 'my-resume.pdf',
  onLoadingChange: (isLoading) => setLoading(isLoading),
});
```

---

## Debugging

All pagination decisions are logged to the browser console with the `[PDF]` prefix:

```
[PDF] Container ready. height=2340px  bg=rgb(245, 245, 245)
[PDF] Break candidates (main > * > *): 12
[PDF] checking block { tag: 'DIV', blockTop: 987, blockBottom: 1150, safeEnd: 1043, action: '→ BREAK' }
[PDF] → BREAK inserted. bottomSpacer=136px, topSpacer=60px
[PDF] checking block { tag: 'DIV', blockTop: 1183, blockBottom: 1380, safeEnd: 2166, action: '→ stay' }
...
[PDF] fillLastPageBackground { totalHeight: 2400, pageCount: 3, targetHeight: 3371 }
[PDF] Calling html2pdf…
```

Open DevTools → Console and filter by `[PDF]` to trace the entire pagination process.
