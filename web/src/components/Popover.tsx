import type { ReactNode, Ref } from "react";
import "./Popover.css";

/** A small floating disclosure, e.g. "Estimate my rate" — the React
 * equivalent of Streamlit's st.popover. Built on native <details>/<summary>
 * rather than a positioning library: no JS needed to open/close, keyboard-
 * and screen-reader-accessible for free, and the one thing it doesn't do
 * (auto-flip near a viewport edge) doesn't matter at this app's scale.
 *
 * Accepts a `ref` to the underlying <details> so a caller can close it
 * itself (e.g. right after its "Estimate" button runs) — left open, the
 * absolutely-positioned panel would otherwise sit on top of whatever
 * follows it in the form, since position:absolute doesn't reserve layout
 * space the way an open <details> block normally would. */
export function Popover({
  label,
  children,
  ref,
}: {
  label: string;
  children: ReactNode;
  ref?: Ref<HTMLDetailsElement>;
}) {
  return (
    <details className="popover" ref={ref}>
      <summary className="popover-trigger">{label}</summary>
      <div className="popover-panel">{children}</div>
    </details>
  );
}
