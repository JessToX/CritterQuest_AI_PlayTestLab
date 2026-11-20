import {
  Bone,
  Fish,
  Leaf,
  PawPrint,
  Sandwich,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { GameRecord } from '@/lib/playtest/types';
import { foodNames } from '@/lib/game/labels';
import { CritterPortrait } from './critter-portrait';

export function SeatAvatar({
  index,
  small = false,
}: {
  index: number;
  small?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`cq-avatar${small ? ' cq-avatar-sm' : ''}`}
      data-tone={index % 4}
    >
      <CritterPortrait index={index} />
    </span>
  );
}

export function FoodGlyph({
  food,
  size = 20,
}: {
  food: keyof typeof foodNames;
  size?: number;
}) {
  const Icon = { seed: Leaf, fish: Fish, bone: Bone, cheese: Sandwich }[food];
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />;
}

export function DeckIllustration() {
  return (
    <div className="cq-deck-art" aria-hidden="true">
      <div className="cq-art-card cq-art-leaf">
        <Leaf />
        <span />
        <span />
      </div>
      <div className="cq-art-card cq-art-fish">
        <Fish />
        <span />
        <span />
      </div>
      <div className="cq-art-card cq-art-paw">
        <PawPrint />
        <span />
        <span />
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="cq-empty">
      <span className="cq-empty-icon">
        <Icon size={30} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {children && <div className="cq-empty-actions">{children}</div>}
    </div>
  );
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  detail: string;
}) {
  return (
    <div className="cq-metric-card">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
      <span className="cq-metric-icon">
        <Icon size={21} strokeWidth={1.6} aria-hidden="true" />
      </span>
    </div>
  );
}

export function GameStatus({ status }: { status: GameRecord['status'] }) {
  return (
    <span className="cq-badge" data-status={status}>
      <span className="cq-dot" />
      {
        {
          running: '进行中',
          paused: '已暂停',
          complete: '已完成',
          terminated: '已终止',
        }[status]
      }
    </span>
  );
}

export function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
}
