import { useState } from "react";
import { Landmark } from "lucide-react";
import { getBankLogoUrl } from "@/lib/bank-logos";

interface BankLogoProps {
  name: string | null | undefined;
  size?: number;
  className?: string;
}

/**
 * Mostra o logótipo oficial do banco (obtido do próprio site do banco).
 * Se o banco não tiver domínio conhecido ou a imagem falhar, mostra um ícone
 * genérico com as iniciais do banco.
 */
export function BankLogo({ name, size = 40, className = "" }: BankLogoProps) {
  const url = getBankLogoUrl(name, Math.max(64, size * 2));
  const [errored, setErrored] = useState(false);

  const initials = (name ?? "?")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const wrapperStyle: React.CSSProperties = { width: size, height: size };

  if (url && !errored) {
    return (
      <div
        className={`shrink-0 rounded-xl bg-white border border-border overflow-hidden flex items-center justify-center ${className}`}
        style={wrapperStyle}
      >
        <img
          src={url}
          alt={`${name ?? "Banco"} logótipo`}
          loading="lazy"
          onError={() => setErrored(true)}
          className="object-contain"
          style={{ width: size * 0.75, height: size * 0.75 }}
        />
      </div>
    );
  }

  return (
    <div
      className={`shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-semibold ${className}`}
      style={wrapperStyle}
      aria-label={name ?? "Banco"}
    >
      {initials || <Landmark className="h-5 w-5" />}
    </div>
  );
}
