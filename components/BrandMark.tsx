/** A folded stamp-paper silhouette with an assurance check. */
export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={className}>
      <rect width="48" height="48" rx="12" fill="#ffb15c" />
      <path d="M14 9h14l8 8v22H12V11a2 2 0 0 1 2-2Z" fill="white" stroke="#0b4f86" strokeWidth="2" strokeLinejoin="round" />
      <path d="M28 9v8h8M17 22h10M17 27h5" stroke="#0b4f86" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="33" r="9" fill="#0b5e9e" stroke="white" strokeWidth="2" />
      <path d="m28 33 3 3 5-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
