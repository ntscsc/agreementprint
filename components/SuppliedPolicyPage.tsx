import Link from 'next/link';
import policies from '@/src/content/policies.json';
import { SupportEmailLink } from '@/components/SupportEmailLink';
import { GRIEVANCE_PHONE } from '@/src/config/vendor';

type PolicyName = keyof typeof policies;
type ListItem = { number: number; text: string; children?: ListItem[] };
type Block = { kind: string; text?: string; items?: ListItem[] };

function PolicyList({ items }: { items: ListItem[] }) {
  return (
    <ol className="list-decimal space-y-5 pl-6 marker:font-semibold marker:text-stone-600">
      {items.map((item) => (
        <li key={item.number} value={item.number} className="pl-2">
          <p>{item.text}</p>
          {item.children && <div className="mt-5"><PolicyList items={item.children} /></div>}
        </li>
      ))}
    </ol>
  );
}

export function SuppliedPolicyPage({ policy }: { policy: PolicyName }) {
  const document = policies[policy];
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <article className="rounded-2xl border border-stone-200 bg-white p-5 text-sm leading-7 text-stone-700 shadow-sm sm:p-9 [overflow-wrap:anywhere]">
        <header className="mb-8 border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-bold leading-tight text-stone-900 sm:text-3xl">{document.title}</h1>
        </header>
        <div className="space-y-6">
          {(document.blocks as Block[]).map((block, index) => {
            if (block.kind === 'grievance-phone') return <p key={index}>{block.text}{' '}<a href={`tel:+91${GRIEVANCE_PHONE}`} className="text-amber-800 underline">+91 {GRIEVANCE_PHONE}</a></p>;
            if (block.kind === 'contact-email') return <p key={index}>{block.text}{' '}<SupportEmailLink className="text-amber-800 underline break-all" /></p>;
            if (block.kind === 'list') return <PolicyList key={index} items={block.items!} />;
            if (block.kind === 'heading') return <h2 key={index} className="pt-3 text-lg font-bold text-stone-900">{block.text}</h2>;
            return <p key={index}>{block.text}</p>;
          })}
        </div>
      </article>
      <nav aria-label="Policies" className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm text-amber-800 underline underline-offset-4">
        {Object.entries(policies).map(([route, entry]) => <Link key={route} href={`/${route}`} aria-current={route === policy ? 'page' : undefined}>{entry.title}</Link>)}
      </nav>
    </div>
  );
}
