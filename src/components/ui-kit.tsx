import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="min-h-full flex items-start sm:items-center justify-center p-4">
        <div className="bg-card border border-border rounded-3xl w-full max-w-lg animate-fade-up flex flex-col max-h-[calc(100dvh-2rem)] my-auto shadow-xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5 pb-4 border-b border-border/40 shrink-0">
            <h2 className="text-lg sm:text-xl font-bold">{title}</h2>
            <button onClick={onClose} className="rounded-full p-2 hover:bg-secondary"><X className="h-4 w-4" /></button>
          </div>
          <div className="p-5 overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={"w-full rounded-full border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 " + (props.className ?? "")} />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={"w-full rounded-full border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 " + (props.className ?? "")} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={"w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[80px] " + (props.className ?? "")} />;
}

export function PrimaryButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...rest} className={"rounded-full gradient-primary px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 hover:scale-[1.02] transition disabled:opacity-60 " + (rest.className ?? "")}>{children}</button>;
}

export function GhostButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...rest} className={"rounded-full border border-border bg-card px-5 py-2 text-sm font-medium hover:bg-secondary transition " + (rest.className ?? "")}>{children}</button>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SelectWithCustom({
  label, value, onChange, options, placeholder = "Selecionar...", customLabel = "Outro...",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  customLabel?: string;
}) {
  const isCustom = value !== "" && !options.some(o => o.value === value);
  return (
    <Field label={label}>
      <div className="space-y-2">
        <SelectInput
          value={isCustom ? "__custom__" : value}
          onChange={e => {
            if (e.target.value === "__custom__") onChange(" ");
            else onChange(e.target.value);
          }}
        >
          <option value="">{placeholder}</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          <option value="__custom__">{customLabel}</option>
        </SelectInput>
        {isCustom && (
          <TextInput
            autoFocus
            value={value.trim() === "" ? "" : value}
            placeholder="Escreva o nome personalizado"
            onChange={e => onChange(e.target.value || " ")}
          />
        )}
      </div>
    </Field>
  );
}
