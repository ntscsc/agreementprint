import { PolicyNavigation } from '@/components/PolicyNavigation';
import policies from '@/src/content/policies.json';
import { SupportEmailLink } from '@/components/SupportEmailLink';
import { GRIEVANCE_PHONE } from '@/src/config/vendor';

type PolicyName = keyof typeof policies;
type ListItem = { number: number; title?: string; text: string; children?: ListItem[] };
type Block = { kind: string; text?: string; items?: ListItem[] };

function PolicyText({ text }: { text: string }) {
  const paragraphs: string[] = [];
  for (const sentence of text.split(/(?<=[.!?])\s+(?=[A-Z])/)) {
    const last = paragraphs.length - 1;
    if (last >= 0 && paragraphs[last].length + sentence.length < 550) paragraphs[last] += ` ${sentence}`;
    else paragraphs.push(sentence);
  }
  return <div className="space-y-4">{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>;
}

function PolicyList({ items, prefix }: { items: ListItem[]; prefix: string }) {
  return (
    <ol className="list-decimal space-y-5 pl-6 marker:font-semibold marker:text-stone-600">
      {items.map((item) => (
        <li key={item.number} value={item.number} className="pl-2">
          {item.title && <h3 id={`${prefix}-${item.number}`} className="mb-2 scroll-mt-24 text-lg font-bold text-stone-900">{item.title}</h3>}
          <PolicyText text={item.text} />
          {item.children && <div className="mt-5"><PolicyList items={item.children} prefix={`${prefix}-${item.number}`} /></div>}
        </li>
      ))}
    </ol>
  );
}

export function SuppliedPolicyPage({ policy }: { policy: PolicyName }) {
  const document = policies[policy];
  const blocks = document.blocks as Block[];
  const sections = blocks.flatMap((block, index) => block.kind === 'heading'
    ? [{ id: `section-${index}`, title: block.text! }]
    : block.kind === 'list' ? (block.items ?? []).filter(item => item.title).map(item => ({ id: `section-${index}-${item.number}`, title: item.title! })) : []);
  const timelines: Partial<Record<PolicyName, string>> = {
    'refund-policy': 'Refund processing: 3–5 working days after initiation. Bank credit: a further 5–7 working days after processing. Approval and eligibility follow the full policy below.',
    'return-policy': 'The stated return or exchange request window is 1 day from purchase, subject to the eligibility and inspection conditions below.',
    'shipping-policy': 'Dispatch is within 2 days of order/payment, or on the date agreed at confirmation. Delivery follows courier or postal timelines.',
  };
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <article className="rounded-2xl border border-stone-200 bg-white p-5 text-base leading-8 text-stone-700 shadow-sm sm:p-9 [overflow-wrap:anywhere]">
        <header className="mb-8 border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-bold leading-tight text-stone-900 sm:text-3xl">{document.title}</h1>
        </header>
        {timelines[policy] && <aside aria-label="Key timelines" className="mb-6 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm leading-6 text-brand-900"><h2 className="mb-1 font-bold">Key timelines</h2><p>{timelines[policy]}</p></aside>}
        {sections.length > 0 && <nav aria-label="On this page" className="mb-8 rounded-xl bg-stone-50 p-4"><h2 className="mb-3 text-sm font-bold text-stone-900">On this page</h2><ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm leading-6 text-brand-800">{sections.map(section => <li key={section.id}><a href={`#${section.id}`} className="underline underline-offset-4">{section.title}</a></li>)}</ul></nav>}
        <div className="space-y-6">
          {blocks.map((block, index) => {
            if (block.kind === 'grievance-phone') return <p key={index}>{block.text}{' '}<a href={`tel:+91${GRIEVANCE_PHONE}`} className="text-amber-800 underline">+91 {GRIEVANCE_PHONE}</a></p>;
            if (block.kind === 'contact-email') return <p key={index}>{block.text}{' '}<SupportEmailLink className="text-amber-800 underline break-all" /></p>;
            if (block.kind === 'list') return <PolicyList key={index} items={block.items!} prefix={`section-${index}`} />;
            if (block.kind === 'heading') return <h2 key={index} id={`section-${index}`} className="scroll-mt-24 pt-3 text-xl font-bold text-stone-900">{block.text}</h2>;
            return <PolicyText key={index} text={block.text ?? ''} />;
          })}
        </div>
      </article>
      <PolicyNavigation current={`/${policy}`} />
    </div>
  );
}
