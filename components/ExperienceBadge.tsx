import Image from 'next/image';

export function ExperienceBadge() {
  return (
    <div className="relative h-[101px] w-[76px] shrink-0 overflow-hidden sm:h-[191px] sm:w-36">
      <Image
        src="/images/experience-25-years-hanging.png"
        alt="25 years of experience in customer service and digital government services"
        width={677}
        height={369}
        unoptimized
        className="absolute top-0 h-auto max-w-none"
        style={{ left: '-103.59%', width: '303.59%' }}
      />
    </div>
  );
}
