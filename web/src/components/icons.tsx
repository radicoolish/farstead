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

export function IconClose({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
    </svg>
  );
}
