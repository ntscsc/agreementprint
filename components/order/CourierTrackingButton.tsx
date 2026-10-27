'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';

export function CourierTrackingButton({ href, courierName, trackingNumber, className = '' }: {
  href: string; courierName: string; trackingNumber: string; className?: string;
}) {
  const [notice, setNotice] = useState('');
  return <span className={`inline-flex shrink-0 flex-col items-end gap-1 ${className}`}>
    <a href={href} target="_blank" rel="noopener noreferrer"
      title="Copy consignment number and open courier tracking"
      onClick={() => {
        setNotice('');
        if (!navigator.clipboard) { setNotice(`Copy this number manually: ${trackingNumber}`); return; }
        // Start copying during the user gesture; the normal link opens the new tab.
        void navigator.clipboard.writeText(trackingNumber).then(() => setNotice('Number copied. Paste it into the courier search.')).catch(() => setNotice(`Copy this number manually: ${trackingNumber}`));
      }}
      className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-3 text-xs font-semibold text-sky-800 transition-colors hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
      Track on {courierName}<ExternalLink aria-hidden="true" className="h-3 w-3" /><span className="sr-only"> — copies the consignment number and opens in a new tab</span>
    </a>
    {notice && <span role="status" className="max-w-60 break-words text-right text-[11px] text-sky-800">{notice}</span>}
  </span>;
}
