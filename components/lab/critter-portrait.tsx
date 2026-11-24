'use client';

import Image from 'next/image';
import { useSyncExternalStore } from 'react';
import {
  readPortrait,
  resolvePortrait,
  seatTone,
  subscribePortraits,
} from '@/lib/client/seat-portraits';

export function useSeatPortrait(seatId: string) {
  return useSyncExternalStore(
    subscribePortraits,
    () => readPortrait(seatId),
    () => 'geometric' as const,
  );
}

interface PortraitProps {
  index: number;
  portrait?: string;
  paused?: boolean;
  className?: string;
}

/** Decorative. The adjacent controls and text identify the seat and its state. */
export function CritterPortrait({
  index,
  portrait,
  paused = false,
  className = '',
}: PortraitProps) {
  const choice = resolvePortrait(portrait);
  const state = paused ? 'paused' : 'ready';
  const src =
    choice === 'geometric'
      ? `/illustrations/seats/seat-${index}-${state}.png`
      : `/illustrations/animal-preview/${choice}-${state}.svg`;
  return (
    <span
      className={`cq-critter ${className}`}
      data-paused={paused}
      data-portrait={choice}
      aria-hidden="true"
    >
      <Image src={src} width={200} height={245} alt="" unoptimized />
    </span>
  );
}

/** Setup follows the browser preference. Games render their recorded choice. */
export function PreferredCritterPortrait({
  seatId,
  ...props
}: Omit<PortraitProps, 'index' | 'portrait'> & { seatId: string }) {
  const portrait = useSeatPortrait(seatId);
  return (
    <CritterPortrait {...props} index={seatTone(seatId)} portrait={portrait} />
  );
}
