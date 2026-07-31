import type { ActionResult } from "@/app/admin/actions";

/**
 * Formular-Bausteine in der Designsprache der App: alles eckig, Rahmen in
 * `line`, Fokus/Hover wandert nach Amber. Bewusst geteilt, damit die
 * Klassenketten nicht in jedem Formular erneut auftauchen.
 */

const inputClasses =
  "w-full min-h-11 border border-line bg-asphalt/60 px-3 py-2 text-foam outline-none transition focus:border-amber";

export function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  min,
}: {
  label: string;
  name: string;
  type?: "text" | "number" | "date";
  required?: boolean;
  placeholder?: string;
  min?: number;
}) {
  return (
    <label className="block">
      <span className="block text-[0.65rem] uppercase tracking-[0.14em] text-foam-muted">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        className={`mt-1 ${inputClasses}`}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        min={min}
      />
    </label>
  );
}

export function SelectField({
  label,
  name,
  required,
  options,
}: {
  label: string;
  name: string;
  required?: boolean;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="block text-[0.65rem] uppercase tracking-[0.14em] text-foam-muted">
        {label}
        {required ? " *" : ""}
      </span>
      <select className={`mt-1 ${inputClasses}`} name={name} required={required}>
        <option value="">– bitte wählen –</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 bg-amber px-5 py-3 font-display uppercase tracking-wide text-asphalt transition hover:bg-amber-hot disabled:opacity-50"
    >
      {pending ? "Speichert…" : children}
    </button>
  );
}

export function FormStatus({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <p
      role="status"
      className={`border px-3 py-2 text-sm ${
        state.ok ? "border-moss text-moss" : "border-clay text-clay"
      }`}
    >
      {state.ok ? state.message : state.error}
    </p>
  );
}
