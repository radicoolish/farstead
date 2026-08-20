import { useEffect, useState, type InputHTMLAttributes } from "react";

type NumberFieldProps = {
  value: number;
  onChange: (value: number) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">;

/** A number input that behaves the way people actually expect: the field
 * can go empty while you're editing it — to clear a "0" before typing a
 * real value, for instance — instead of snapping back to "0" after every
 * keystroke. A plain `<input type="number" value={n} onChange={...}>`
 * does exactly that, because `Number("")` is `0`, not `NaN`, so the
 * moment you delete the last character the controlled value bounces
 * straight back to "0" and fights you from ever getting the field empty.
 *
 * Selects all text on focus (so clicking in and typing replaces "0"
 * outright), stays empty while typing something new, and only falls back
 * to 0 on blur if left empty or unparseable. */
export function NumberField({ value, onChange, onFocus, onBlur, ...rest }: NumberFieldProps) {
  const [text, setText] = useState(() => String(value));

  // Resync from the external value only when it changed for a reason
  // other than our own typing (Reset buttons, Load Scenario, imports,
  // etc.) — otherwise this would stomp a trailing "." or a leading zero
  // the user is still in the middle of typing.
  useEffect(() => {
    const parsed = text === "" || text === "-" ? NaN : Number(text);
    if (parsed !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      {...rest}
      type="number"
      value={text}
      onFocus={(e) => {
        e.target.select();
        onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw === "" || raw === "-") return;
        const parsed = Number(raw);
        if (!Number.isNaN(parsed)) onChange(parsed);
      }}
      onBlur={(e) => {
        if (text === "" || text === "-" || Number.isNaN(Number(text))) {
          setText("0");
          onChange(0);
        }
        onBlur?.(e);
      }}
    />
  );
}
