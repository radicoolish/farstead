// Minimal hand-authored line icons (stroke = currentColor) so nav tabs and
// section headers share one small, consistent icon language without pulling
// in an icon library dependency.

interface IconProps {
  className?: string;
}

const base = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconIncome({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <rect x="2.25" y="5" width="15.5" height="11" rx="2" />
      <path d="M2.25 8.25h15.5" />
      <circle cx="14" cy="12.25" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconGrowth({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M2.5 14.5l4.2-4.4 3 2.8L16.5 5" />
      <path d="M12 5h4.5v4.5" />
    </svg>
  );
}

export function IconExpenses({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M5 2.25h10v15.5l-2-1.3-1.5 1.3-1.5-1.3-1.5 1.3-1.5-1.3-2 1.3V2.25z" />
      <path d="M7.25 6.5h5.5M7.25 9.5h5.5M7.25 12.5h3.5" />
    </svg>
  );
}

export function IconSimulator({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M4.5 3v5.2M4.5 11.4V17M10 3v2.6M10 8.8V17M15.5 3v9.4M15.5 15.6V17" />
      <circle cx="4.5" cy="9.8" r="1.55" fill="currentColor" stroke="none" />
      <circle cx="10" cy="7" r="1.55" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="14" r="1.55" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconData({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <ellipse cx="10" cy="4.75" rx="6.75" ry="2.35" />
      <path d="M3.25 4.75v10.5c0 1.3 3 2.35 6.75 2.35s6.75-1.05 6.75-2.35V4.75" />
      <path d="M3.25 10c0 1.3 3 2.35 6.75 2.35S16.75 11.3 16.75 10" />
    </svg>
  );
}

export function IconSummary({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <rect x="2.25" y="2.25" width="6.5" height="6.5" rx="1.25" />
      <rect x="11.25" y="2.25" width="6.5" height="6.5" rx="1.25" />
      <rect x="2.25" y="11.25" width="6.5" height="6.5" rx="1.25" />
      <path d="M13.2 14.7l1.3 1.3 2.5-2.7" />
    </svg>
  );
}

export function IconFlag({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M5.25 2.25v15.5" />
      <path d="M5.25 3.5c2.4-1.3 4.1-1.3 6.5 0s4.1 1.3 6.5 0v8c-2.4 1.3-4.1 1.3-6.5 0s-4.1-1.3-6.5 0z" />
    </svg>
  );
}

export function IconClose({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
    </svg>
  );
}

export function IconSun({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="10" cy="10" r="3.4" />
      <path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1L4.7 4.7" />
    </svg>
  );
}

export function IconMoon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M16.5 12.3A6.75 6.75 0 0 1 7.7 3.5a6.75 6.75 0 1 0 8.8 8.8z" />
    </svg>
  );
}

export function IconSystem({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <rect x="2.5" y="4" width="15" height="10" rx="1.5" />
      <path d="M7 17.5h6M10 14v3.5" />
    </svg>
  );
}
