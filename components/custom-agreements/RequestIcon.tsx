type RequestIconName = 'refresh' | 'copy' | 'eye' | 'download' | 'phone' | 'mail' | 'brand-whatsapp' | 'x' | 'plus' | 'file-text' | 'check';

/** Locally hosted Tabler SVGs; decorative icons inherit their action's colour. */
export function RequestIcon({ name, small = false }: { name: RequestIconName; small?: boolean }) {
  const source = `url("/icons/tabler/${name}.svg")`;
  return <span aria-hidden="true" className={`inline-block shrink-0 align-middle ${small ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} style={{ backgroundColor: 'currentColor', maskImage: source, WebkitMaskImage: source, maskSize: 'contain', WebkitMaskSize: 'contain', maskPosition: 'center', WebkitMaskPosition: 'center', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' }} />;
}
