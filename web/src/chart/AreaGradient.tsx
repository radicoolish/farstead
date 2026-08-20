/** Shared "fade to transparent" gradient defs for area charts — one
 * <linearGradient> per {id, color} pair, referenced from an <Area>'s
 * `fill` as `url(#id)`. IDs must be unique per rendered <svg>; callers
 * derive them from useId() so multiple chart instances on the same page
 * (e.g. one BalanceChart per person) never collide. */
export function AreaGradientDefs({ defs }: { defs: Array<{ id: string; color: string }> }) {
  return (
    <defs>
      {defs.map(({ id, color }) => (
        <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity={0.35} />
          <stop offset="95%" stopColor={color} stopOpacity={0.03} />
        </linearGradient>
      ))}
    </defs>
  );
}

/** Sanitizes an arbitrary label (scenario name, expense type, etc.) into
 * a valid SVG id fragment. */
export function gradientId(root: string, label: string): string {
  return `${root}-${label.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}
