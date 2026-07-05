import { useState } from "react";
import { Modal, PrimaryButton, GhostButton, Field, TextInput } from "@/components/ui-kit";
import { FileSpreadsheet, FileText, Download, Mail } from "lucide-react";
import { toast } from "sonner";

export type ExportRangeChoice = { from: string | null; to: string | null };

export type ExportResult = { blob?: Blob; filename?: string; subject?: string; summary?: string };

export function ExportButton({
  onExport,
  label = "Exportar",
  askRange = true,
}: {
  onExport: (
    format: "pdf" | "excel",
    range: ExportRangeChoice,
  ) => void | Promise<void | ExportResult>;
  label?: string;
  askRange?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const range = { from: from || null, to: to || null };

  const doExport = async (fmt: "pdf" | "excel") => {
    setBusy(true);
    try {
      await onExport(fmt, range);
      toast.success(fmt === "pdf" ? "PDF gerado" : "Excel gerado");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao exportar");
    } finally {
      setBusy(false);
    }
  };

  const doSendEmail = async () => {
    const clean = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      toast.error("Introduza um email válido");
      return;
    }
    setBusy(true);
    try {
      const result = (await onExport("pdf", range)) as ExportResult | void;
      const filename = result?.filename ?? "relatorio";
      const subject = result?.subject ?? "Relatório Azura Capital";
      const summary = result?.summary ?? "";
      const body = [
        "Olá,",
        "",
        `Segue o relatório solicitado: ${filename}.pdf`,
        "",
        summary,
        "",
        "O PDF foi descarregado no seu dispositivo — anexe-o ao email antes de enviar.",
        "",
        "— Azura Capital",
      ].filter(Boolean).join("\n");
      const url = `mailto:${encodeURIComponent(clean)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = url;
      toast.success("PDF pronto — cliente de email aberto");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao preparar email");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => (askRange ? setOpen(true) : doExport("pdf"))}
        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium bg-secondary hover:bg-secondary/70 transition"
      >
        <Download className="h-4 w-4" /> {label}
      </button>

      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Exportar Relatório">
        <div className="space-y-5">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Período</h3>
            <p className="text-xs text-muted-foreground">Deixe em branco para incluir todos os movimentos.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="De"><TextInput type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
              <Field label="Até"><TextInput type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descarregar</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => doExport("excel")}
                disabled={busy}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium bg-success/10 text-success hover:bg-success/20 transition disabled:opacity-60"
              >
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </button>
              <button
                onClick={() => doExport("pdf")}
                disabled={busy}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full gradient-primary px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 hover:scale-[1.01] transition disabled:opacity-60"
              >
                <FileText className="h-4 w-4" /> PDF
              </button>
            </div>
          </section>

          <section className="space-y-2 border-t border-border/50 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Enviar PDF por Email
            </h3>
            <p className="text-xs text-muted-foreground">
              O PDF é descarregado e o seu cliente de email abre para envio ao destinatário.
            </p>
            <Field label="Email do destinatário">
              <TextInput
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="ex: contabilidade@empresa.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </Field>
            <button
              onClick={doSendEmail}
              disabled={busy || !email}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition disabled:opacity-60"
            >
              <Mail className="h-4 w-4" /> Preparar Email
            </button>
          </section>

          <div className="flex justify-end pt-1">
            <GhostButton onClick={() => setOpen(false)} disabled={busy}>Fechar</GhostButton>
          </div>
        </div>
      </Modal>
    </>
  );
}
