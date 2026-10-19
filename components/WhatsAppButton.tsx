'use client';

import React from 'react';
import { WHATSAPP_URL } from '@/src/config/vendor';

interface WhatsAppButtonProps {
  className?: string;
  variant?: 'primary' | 'secondary' | 'floating' | 'outline';
  customText?: string;
}

export const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({ className = '', variant = 'primary', customText }) => {
  const floating = variant === 'floating';
  const style = floating
    ? 'group fixed bottom-6 right-6 z-40 inline-flex items-center rounded-full bg-emerald-700 p-4 text-white shadow-lg hover:bg-emerald-800'
    : variant === 'outline'
      ? 'inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-700 px-4 py-3 font-semibold text-emerald-800 hover:bg-emerald-50'
      : 'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800';
  return (
    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" title={floating ? 'WhatsApp' : undefined} aria-label="Contact AgreementPrint on WhatsApp (WhatsApp only)" className={`${style} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 ${className}`}>
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 shrink-0" aria-hidden="true">
        <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.47 0 .11 5.36.1 11.95c0 2.1.55 4.15 1.6 5.96L0 24l6.25-1.64a11.96 11.96 0 0 0 5.8 1.48h.01C18.65 23.84 24 18.48 24 11.89a11.86 11.86 0 0 0-3.48-8.41ZM12.06 21.82a9.9 9.9 0 0 1-5.05-1.38l-.36-.21-3.71.97.99-3.62-.24-.37a9.88 9.88 0 0 1-1.52-5.26c0-5.48 4.45-9.93 9.94-9.93a9.87 9.87 0 0 1 7.02 2.91 9.86 9.86 0 0 1 2.9 7.02c0 5.48-4.45 9.87-9.97 9.87Zm5.45-7.43c-.3-.15-1.77-.87-2.04-.97-.28-.1-.48-.15-.68.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.18-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.08 4.49.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z" />
      </svg>
      {floating && <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold opacity-0 transition-all duration-200 group-hover:ml-2 group-hover:max-w-28 group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-28 group-focus-visible:opacity-100 motion-reduce:transition-none">WhatsApp</span>}
      {!floating && <span>{customText || 'Chat on WhatsApp (WhatsApp only)'}</span>}
    </a>
  );
};

