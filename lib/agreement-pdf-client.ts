'use client';

import { AGREEMENT_LAYOUT_CSS } from '@/lib/agreement-layout';

const A4_HEIGHT_PX = 297 * 96 / 25.4;

/** Off-screen measurement must not wait on lazy images or unrelated page fonts. */
export async function prepareAgreementAssets(source: HTMLElement) {
  const doc = source.ownerDocument;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all([
        doc.fonts.load('14px "Agreement English"'),
        doc.fonts.load('14px "Agreement Tamil"'),
        ...Array.from(source.querySelectorAll('img')).map(img => {
          // Next/Image defaults to lazy loading. This clone is deliberately off
          // screen, so the browser would otherwise never start its request.
          img.loading = 'eager';
          return img.decode();
        }),
      ]),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('The preview could not load its fonts or stamp image. Please retry.')), 15000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function prepareAgreementLayout(doc: Document) {
  // Do not depend on a global stylesheet import being refreshed by HMR. The
  // live preview and export must have these rules before any measurement.
  let layout = doc.querySelector<HTMLStyleElement>('style[data-agreement-layout]');
  if (!layout) {
    layout = doc.createElement('style');
    layout.setAttribute('data-agreement-layout', '');
    doc.head.append(layout);
  }
  if (layout.textContent !== AGREEMENT_LAYOUT_CSS) layout.textContent = AGREEMENT_LAYOUT_CSS;
}

/** Paginate DOM text at its natural size; Chromium/WebKit handle Tamil shaping. */
export function paginateAgreement(source: HTMLElement) {
  const doc = source.ownerDocument;
  prepareAgreementLayout(doc);
  const originals = Array.from(source.querySelectorAll<HTMLElement>('.agreement-page'));
  if (!originals.length) throw new Error('No agreement pages were found.');
  const stamps = Array.from(source.querySelectorAll<HTMLElement>('.stamp-paper-allowance'));
  const signature = originals.at(-1)!.querySelector<HTMLElement>(':scope > .agreement-signatures');
  const footer = originals[0].querySelector<HTMLElement>(':scope > .agreement-page-number');
  if (!signature || !footer) throw new Error('Agreement signing area is missing.');
  const units: HTMLElement[] = [];
  const collect = (element: HTMLElement) => {
    if (element.matches('.agreement-signatures, .agreement-page-number, .stamp-paper-allowance, .pointer-events-none')) return;
    if (element.tagName === 'DIV' && !element.matches('[data-agreement-introductions], [data-agreement-closing]')) {
      Array.from(element.children).forEach(child => collect(child as HTMLElement));
    } else units.push(element.cloneNode(true) as HTMLElement);
  };
  originals.forEach(original => Array.from(original.children).forEach(child => collect(child as HTMLElement)));
  const introductionIndex = units.findIndex(unit => unit.hasAttribute('data-agreement-introductions'));
  const termsStart = units[introductionIndex + 1];
  if (introductionIndex >= 0 && termsStart) termsStart.setAttribute('data-agreement-terms-start', '');
  // Move the final clauses with the conclusion and witnesses, avoiding a sparse
  // extra sheet containing only witnesses. Preserve their order and natural size.
  const closingIndex = units.findIndex(unit => unit.hasAttribute('data-agreement-closing'));
  if (closingIndex >= 0) {
    const tailStart = Math.max(0, closingIndex - 2);
    const tail = doc.createElement('div');
    tail.setAttribute('data-agreement-final-section', '');
    tail.append(...units.splice(tailStart, closingIndex - tailStart + 1));
    units.splice(tailStart, 0, tail);
  }
  // Content flows continuously; template section boundaries never determine stamp sheets.
  originals.forEach(original => original.remove());
  let page: HTMLElement, body: HTMLElement, signing: HTMLElement;
  let pageCount = 0;
  const nextPage = () => {
    page = originals[0].cloneNode(false) as HTMLElement;
    page.classList.add('agreement-export-page');
    body = doc.createElement('div');
    body.className = 'agreement-export-body';
    signing = signature.cloneNode(true) as HTMLElement;
    // Assign headroom before measuring content on the actual physical page.
    const stamp = stamps[pageCount++];
    if (stamp) body.append(stamp.cloneNode(true));
    const watermark = originals[0].querySelector(':scope > .pointer-events-none');
    if (watermark) page.append(watermark.cloneNode(true));
    page.append(body, signing, footer.cloneNode(true));
    source.append(page);
    if (Math.abs(page.getBoundingClientRect().height - A4_HEIGHT_PX) > 1) {
      throw new Error('The agreement page layout could not be set to A4.');
    }
  };
  const contentLimit = (sheet: HTMLElement) => {
    const rect = sheet.getBoundingClientRect();
    const padding = parseFloat(doc.defaultView!.getComputedStyle(sheet).paddingBottom);
    const signingTop = sheet.querySelector('.agreement-signatures')!.getBoundingClientRect().top;
    const footerTop = sheet.querySelector('.agreement-page-number')!.getBoundingClientRect().top;
    // All reservations already exist on this physical page when measured.
    // Stamp headroom is included in the body's top, not deducted a second time.
    const signingHeight = sheet.querySelector('.agreement-signatures')!.getBoundingClientRect().height;
    const fixedLimit = rect.top + A4_HEIGHT_PX - padding - signingHeight - 16;
    return Math.min(fixedLimit, signingTop - 16, footerTop - 16);
  };
  nextPage();
  for (const unit of units) {
    if (unit.hasAttribute('data-agreement-terms-start') && pageCount === 1) nextPage();
    // Preserve the agreement's three-page structure; a fourth sheet carries
    // the whole final section when page three has insufficient signing room.
    if (unit.hasAttribute('data-agreement-final-section')) {
      while (pageCount < 3) nextPage();
    }
    body!.append(unit);
    const fits = () => body!.getBoundingClientRect().bottom <= contentLimit(page!);
    if (!fits()) {
      unit.remove();
      if (unit.hasAttribute('data-agreement-introductions')) {
        throw new Error('The introductions exceed page 1’s available A4 space. Shorten the party details and try again.');
      }
      const hasContent = Array.from(body!.children).some(child => !child.classList.contains('stamp-paper-allowance'));
      if (!hasContent) throw new Error('A document block is too long to fit. Shorten the field and try again.');
      nextPage();
      body!.append(unit);
      if (!fits()) throw new Error('A document block is too long to fit. Shorten the field and try again.');
    }
  }
  const pages = Array.from(source.querySelectorAll<HTMLElement>('.agreement-export-page'));
  // Share the remaining clauses between pages three and four instead of
  // leaving page four with only the mandatory closing group.
  if (pages.length === 4) {
    const previous = pages[2].querySelector<HTMLElement>('.agreement-export-body')!;
    const last = pages[3].querySelector<HTMLElement>('.agreement-export-body')!;
    const imbalance = () => Math.abs(previous.getBoundingClientRect().height - last.getBoundingClientRect().height);
    while (previous.children.length > 1) {
      const candidate = previous.lastElementChild as HTMLElement;
      if (!candidate.matches('p')) break;
      const before = imbalance();
      last.prepend(candidate);
      if (last.getBoundingClientRect().bottom > contentLimit(pages[3]) || imbalance() >= before) {
        previous.append(candidate);
        break;
      }
    }
  }
  pages.forEach((page, i) => {
    page.querySelector('.agreement-page-number')!.textContent = `Page ${i + 1} of ${pages.length}`;
    const body = page.querySelector<HTMLElement>('.agreement-export-body')!;
    const available = contentLimit(page) - body.getBoundingClientRect().top;
    page.setAttribute('data-available-content-height', available.toFixed(2));
    if (body.getBoundingClientRect().height > available + 0.5) {
      throw new Error(`Agreement page ${i + 1} exceeds its available A4 space.`);
    }
  });
}

/** Native Save as PDF preserves selectable text and embeds the loaded fonts. */
export async function downloadAgreementPdf(source: HTMLElement, reference: string) {
  const frame = document.createElement('iframe');
  frame.title = 'Save agreement as PDF';
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;left:-20000px;top:0;width:1000px;height:1200px;border:0;pointer-events:none';
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) throw new Error('Could not prepare the agreement.');
    doc.body.style.margin = '0';
    doc.title = `Agreement-${reference.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const base = doc.createElement('base');
    base.href = document.baseURI;
    doc.head.appendChild(base);
    const css = doc.createElement('style');
    css.textContent = Array.from(document.styleSheets).map(sheet => {
      try { return Array.from(sheet.cssRules).filter(rule => rule.type !== CSSRule.IMPORT_RULE).map(rule => rule.cssText).join('\n'); }
      catch { return ''; }
    }).join('\n').replace(/@media\s+print\b/g, '@media all');
    doc.head.appendChild(css);
    const clone = source.cloneNode(true) as HTMLElement;
    clone.id = 'printable-agreement-doc';
    clone.removeAttribute('hidden');
    clone.classList.remove('customer-agreement-document');
    doc.body.appendChild(clone);
    prepareAgreementLayout(doc);
    await prepareAgreementAssets(clone);
    paginateAgreement(clone);
    // Keep the frame alive until the dialog closes; Safari can return early from print().
    win.addEventListener('afterprint', () => frame.remove(), { once: true });
    win.focus();
    win.print();
  } catch (error) {
    frame.remove();
    throw error;
  }
}
