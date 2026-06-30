/** Lightweight inline icon set (Lucide-style, 24x24 viewBox, currentColor). */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function WalletIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v0H5a2 2 0 0 0-2 2Z" />
      <path d="M3 8v9a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-2" />
      <path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z" />
    </svg>
  );
}

export function PieIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3a9 9 0 1 0 9 9h-9Z" />
      <path d="M12 3v9h9a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" />
      <circle cx="9" cy="7" r="3" />
      <path d="M22 19v-1a4 4 0 0 0-3-3.87" />
      <path d="M16 4.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function ActivityIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12h4l3 8 4-16 3 8h4" />
    </svg>
  );
}

export function CardIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

export function CoinsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="8" cy="8" r="5" />
      <path d="M18.09 10.37A5 5 0 1 1 15 19" />
      <path d="M7 6h1v4" />
      <path d="M16.71 13.88l.7.71-2.82 2.82" />
    </svg>
  );
}

export function ExchangeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M16 3l4 4-4 4" />
      <path d="M20 7H4" />
      <path d="M8 21l-4-4 4-4" />
      <path d="M4 17h16" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </svg>
  );
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 17 17 7M7 7h10v10" />
    </svg>
  );
}

export function ArrowDownLeftIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M17 7 7 17M17 17H7V7" />
    </svg>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c0-1 0-1 .5-2 1.5 2 1.5 3.5 1.5 5a6 6 0 1 1-12 0c0-3 2-4 3-6 .8 1 1 2 2 2 0-3 1-4 1-6Z" />
    </svg>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

export function AlertTriangleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

/** Tokeville mark — a gold token coin engraved with the Ŧ glyph. */
export function TokevilleMark(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden {...props}>
      <defs>
        <linearGradient id="tv-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6cf76" />
          <stop offset="100%" stopColor="#c79a45" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#tv-gold)" />
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="9"
        fill="none"
        stroke="#fbe6b0"
        strokeOpacity="0.6"
      />
      <text
        x="16"
        y="22"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="19"
        fontWeight="700"
        fill="#0a0a0b"
      >
        Ŧ
      </text>
    </svg>
  );
}
