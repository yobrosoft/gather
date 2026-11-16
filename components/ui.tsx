import type { ButtonHTMLAttributes, ReactNode } from "react";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const tones = {
  primary: "btn-primary",
  plain: "btn-plain",
  danger: "btn-danger",
};

export function Button({
  tone = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: keyof typeof tones }) {
  return (
    <button
      {...props}
      className={cn(
        "btn",
        tones[tone],
        className,
      )}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      <span className="text-sm font-medium text-[var(--muted)]">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

export const inputClass = "field-input";

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="link text-sm">
      Back
    </button>
  );
}

export function FillBar({ taken, capacity }: { taken: number; capacity: number }) {
  const pct = capacity > 0 ? Math.min(100, Math.round((taken / capacity) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>
          {taken} of {capacity} seats
        </span>
        <span className="muted">{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-white/10" aria-hidden>
        <div className="h-1.5 rounded-full bg-[var(--teal)]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
