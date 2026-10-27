'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { paginateAgreement, prepareAgreementAssets, prepareAgreementLayout } from '@/lib/agreement-pdf-client';

/** Render the same measured pages on screen that we send to native PDF printing. */
export function PaginatedAgreement({ children, customerPreview }: { children: ReactNode; customerPreview: boolean }) {
  const template = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ input: children, pages: '', error: '' });
  const pages = result.input === children ? result.pages : '';
  const error = result.input === children ? result.error : '';

  useEffect(() => {
    const container = viewport.current;
    if (!container) return;
    const resize = () => {
      const width = container.clientWidth;
      if (width > 0) setScale(Math.min(1, width / (210 * 96 / 25.4)));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let measuring: HTMLElement | undefined;
    const prepare = async () => {
      try {
        const source = template.current;
        if (!source) return;
        prepareAgreementLayout(document);
        measuring = source.cloneNode(true) as HTMLElement;
        measuring.removeAttribute('id');
        measuring.removeAttribute('hidden');
        measuring.style.cssText = 'position:absolute;left:-20000px;top:0;width:210mm;visibility:hidden;pointer-events:none';
        document.body.appendChild(measuring);
        await prepareAgreementAssets(measuring);
        if (cancelled) return;
        paginateAgreement(measuring);
        setResult({ input: children, pages: measuring.innerHTML, error: '' });
      } catch (cause) {
        if (!cancelled) setResult({ input: children, pages: '', error: cause instanceof Error ? cause.message : 'Unable to paginate the agreement.' });
      } finally {
        measuring?.remove();
      }
    };
    void prepare();
    return () => { cancelled = true; measuring?.remove(); };
  }, [children, attempt]);

  return <>
    <div id="agreement-template-source" ref={template} hidden>{children}</div>
    {error && <div role="alert" className="no-print rounded-xl bg-rose-50 p-3 text-rose-900"><p>{error}</p><button type="button" className="mt-2 min-h-10 rounded-lg border border-rose-200 bg-white px-3 text-sm font-semibold" onClick={() => { setResult({ input: children, pages: '', error: '' }); setAttempt(value => value + 1); }}>Retry preview</button></div>}
    {!pages && !error && <p role="status" className="no-print text-stone-600">Preparing A4 pages...</p>}
    <div ref={viewport} className="agreement-preview-viewport" style={{ '--agreement-preview-scale': scale } as CSSProperties}>
      <div id="printable-agreement-doc" aria-busy={!pages && !error} className={`agreement-document-wrapper space-y-8 print:space-y-0 ${customerPreview ? 'customer-agreement-document' : ''}`} dangerouslySetInnerHTML={{ __html: pages }} />
    </div>
  </>;
}
