import Image from 'next/image';

export function BrandMark({ className = '' }: { className?: string }) {
  return <Image src="/nts-logo.jpeg" alt="Net Time Systems logo" width={315} height={166} unoptimized className={`object-contain ${className}`} />;
}
