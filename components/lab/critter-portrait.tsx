import Image from 'next/image';

/** Saved seat IDs retain their visual identity when enabled seats are a subset. */
export function critterSeatIndex(id: string, fallback: number) {
  const match = /^seat-([0-3])$/.exec(id);
  return match ? Number(match[1]) : fallback;
}

/** Decorative seat markers. The adjacent controls and text identify the seats. */
export function CritterPortrait({
  index,
  paused = false,
  className = '',
}: {
  index: number;
  paused?: boolean;
  className?: string;
}) {
  const seat = ((index % 4) + 4) % 4;
  return (
    <span className={`cq-critter ${className}`} aria-hidden="true">
      <Image
        src={`/illustrations/seats/seat-${seat}-${paused ? 'paused' : 'ready'}.png`}
        width={200}
        height={245}
        alt=""
        unoptimized
      />
    </span>
  );
}
