import { useState } from "react";
import { Modal, PrimaryButton, GhostButton, Field, TextInput } from "@/components/ui-kit";
import { FileSpreadsheet, FileText, Download } from "lucide-react";

export type ExportRangeChoice = { from: string | null; to: string | null };

export function ExportButton({
  onExport,
  label = "Exportar",
  askRange = true,
}: {
  onExport: (format: "pdf" | "excel", range: ExportRangeChoice) => void;
  label?: string;
  askRange?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const doExport = (fmt: "pdf" | "excel") => {
    onExport(fmt, { from: from || null, to: to || null });
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => (askRange ? setOpen(true) : doExport("pdf"))}
        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium bg-secondary hover:bg-secondary/70 transition"
      >
        <Download className="h-4 w-4" /> {label}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Exportar Relatório">
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Escolha o período. Deixe em branco para incluir todos os movimentos.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="De"><TextInput type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
            <Field label="Até"><TextInput type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
            <GhostButton onClick={() => setOpen(false)}>Cancelar</GhostButton>
            <button onClick={() => doExport("excel")} className="inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium bg-success/10 text-success hover:bg-success/20 transition">
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </button>
            <PrimaryButton onClick={() => doExport("pdf")}>
              <FileText className="h-4 w-4 inline mr-1" /> PDF
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </>
  );
}
