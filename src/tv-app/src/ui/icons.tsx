// Ícones próprios em SVG (sem assets de terceiros). Traço em currentColor.
import type { JSX } from 'preact';

const base = { width: 88, height: 88, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;

export const IconSources = (): JSX.Element => (
  <svg {...base}>
    <rect x="2.5" y="4" width="19" height="13" rx="2" />
    <path d="M8 21h8M12 17v4" />
    <path d="M9 10.5h6M12.5 8l2.5 2.5-2.5 2.5" />
  </svg>
);

export const IconSettings = (): JSX.Element => (
  <svg {...base}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

export const IconArrange = (): JSX.Element => (
  <svg {...base}>
    <rect x="3" y="4" width="7" height="7" rx="1.5" />
    <rect x="14" y="4" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <path d="M14.5 17.5h6M17.5 14.5v6" />
  </svg>
);

/** Barras de sinal Wi-Fi, 0..5 → 0..4 barras acesas. */
export function WifiBars({ level }: { level: number | null }): JSX.Element {
  const lit = level === null ? 4 : Math.round((Math.max(0, Math.min(5, level)) / 5) * 4);
  return (
    <svg width="34" height="26" viewBox="0 0 34 26" class="wifi-bars">
      {[0, 1, 2, 3].map((i) => (
        <rect x={i * 9} y={20 - i * 6} width="6" height={6 + i * 6} rx="1.5" class={i < lit ? 'on' : 'off'} />
      ))}
    </svg>
  );
}

/** Cor estável por app (hash do id) para o monograma. */
export function monogramHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}
