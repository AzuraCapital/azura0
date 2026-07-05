import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import logoDark from "@/assets/azura-logo-dark.png.asset.json";

// ============================================================
// Azura Capital — Export System (PDF + Excel)
// Modern, coloured, branded — estilo extrato bancário.
// ============================================================

export type ExportColumn<T> = {
  header: string;
  key: keyof T | ((row: T) => string | number);
  align?: "left" | "right" | "center";
  excel?: (row: T) => string | number;
};

export type ExportMeta = {
  title: string;
  subtitle?: string;
  period?: string;
  filename: string;
  summary?: { label: string; value: string; tone?: "default" | "positive" | "negative" | "primary" }[];
  rowType?: (row: any) => "positive" | "negative" | "neutral" | "warning";
};

// Brand palette (RGB for jsPDF / hex for XLSX styling comments)
const BRAND = {
  primary: [26, 140, 58] as [number, number, number],       // #1A8C3A
  primaryDark: [16, 92, 39] as [number, number, number],    // #105C27
  primarySoft: [232, 245, 236] as [number, number, number],
  positive: [22, 163, 74] as [number, number, number],      // #16A34A
  positiveSoft: [220, 252, 231] as [number, number, number],
  negative: [220, 38, 38] as [number, number, number],       // #DC2626
  negativeSoft: [254, 226, 226] as [number, number, number],
  warning: [202, 138, 4] as [number, number, number],
  warningSoft: [254, 249, 195] as [number, number, number],
  neutral: [100, 116, 139] as [number, number, number],
  ink: [15, 23, 42] as [number, number, number],
  inkSoft: [100, 116, 139] as [number, number, number],
  line: [226, 232, 240] as [number, number, number],
  lineSoft: [241, 245, 249] as [number, number, number],
  bg: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

const getVal = <T,>(row: T, key: ExportColumn<T>["key"]) =>
  typeof key === "function" ? key(row) : (row as any)[key];

// ------------------------------------------------------------
// Logo helper — fetches once per session and caches
// ------------------------------------------------------------
let cachedLogo: string | null = null;
async function loadLogoDataUrl(): Promise<string | null> {
  if (cachedLogo) return cachedLogo;
  try {
    const res = await fetch(logoDark.url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error("logo read failed"));
      r.readAsDataURL(blob);
    });
    cachedLogo = dataUrl;
    return dataUrl;
  } catch {
    return null;
  }
}

// ============================================================
// EXCEL (inalterado)
// ============================================================
export function exportToExcel<T>(rows: T[], columns: ExportColumn<T>[], meta: ExportMeta) {
  const aoa: any[][] = [
    ["AZURA CAPITAL"],
    [meta.title],
    ...(meta.subtitle ? [[meta.subtitle]] : []),
    ...(meta.period ? [[`Período: ${meta.period}`]] : []),
    [`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
    [],
  ];
  if (meta.summary?.length) {
    aoa.push(["RESUMO"]);
    meta.summary.forEach((s) => aoa.push([s.label, s.value]));
    aoa.push([]);
  }
  aoa.push(columns.map((c) => c.header));
  const dataStart = aoa.length;
  rows.forEach((r) =>
    aoa.push(columns.map((c) => (c.excel ? c.excel(r) : getVal(r, c.key)))),
  );

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = columns.map((c) => ({ wch: c.header.length > 18 ? c.header.length + 4 : 22 }));
  ws["!freeze"] = { xSplit: 0, ySplit: dataStart } as any;

  const wb = XLSX.utils.book_new();
  (wb as any).Props = { Title: meta.title, Author: "Azura Capital", CreatedDate: new Date() };
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");
  XLSX.writeFile(wb, `${meta.filename}.xlsx`);
}

// ============================================================
// PDF — estilo extrato bancário
// ============================================================
export async function exportToPdf<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  meta: ExportMeta,
): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentW = pageWidth - margin * 2;

  const logo = await loadLogoDataUrl();

  // ============================================================
  // FAIXA 1 — Identidade (fundo branco, como um cabeçalho de banco)
  // ============================================================
  const brandBandH = 64;
  doc.setFillColor(...BRAND.white);
  doc.rect(0, 0, pageWidth, brandBandH, "F");

  let textX = margin;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", margin, 12, 40, 40);
      textX = margin + 52;
    } catch {}
  }

  doc.setFont("times", "bold");
  doc.setFontSize(19);
  doc.setTextColor(...BRAND.ink);
  doc.text("AZURA CAPITAL", textX, 32);

  doc.setFont("times", "italic");
  doc.setFontSize(9.5);
  doc.setTextColor(...BRAND.inkSoft);
  doc.text("Building the Future", textX, 46);

  // linha fina a fechar a faixa branca
  doc.setDrawColor(...BRAND.line);
  doc.setLineWidth(0.6);
  doc.line(0, brandBandH, pageWidth, brandBandH);

  // ============================================================
  // FAIXA 2 — Bloco verde: título do relatório + metadados
  // ============================================================
  const infoBandY = brandBandH;
  const infoBandH = 62;
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, infoBandY, pageWidth, infoBandH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...BRAND.white);
  doc.text(meta.title, margin, infoBandY + 26);

  if (meta.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...BRAND.primarySoft);
    doc.text(meta.subtitle, margin, infoBandY + 42);
  }

  // metadados à direita, estilo "label em cima, valor em baixo"
  const metaColW = 130;
  let metaX = pageWidth - margin - metaColW;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...BRAND.primarySoft);
  doc.text("DATA DE EMISSÃO", metaX, infoBandY + 20, { align: "left" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...BRAND.white);
  doc.text(format(new Date(), "dd/MM/yyyy HH:mm"), metaX, infoBandY + 32);

  if (meta.period) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...BRAND.primarySoft);
    doc.text("PERÍODO", metaX, infoBandY + 48);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...BRAND.white);
    doc.text(meta.period, metaX, infoBandY + 60, { maxWidth: metaColW });
  }

  let y = infoBandY + infoBandH + 26;

  // ============================================================
  // Barra de secção — "EXTRATO DE MOVIMENTOS"
  // ============================================================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.primaryDark);
  doc.text("EXTRATO DE MOVIMENTOS", pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setDrawColor(...BRAND.primary);
  doc.setLineWidth(1.2);
  doc.line(pageWidth / 2 - 60, y, pageWidth / 2 + 60, y);
  y += 26;

  // ============================================================
  // Cards de resumo
  // ============================================================
  if (meta.summary?.length) {
    const cardsPerRow = Math.min(meta.summary.length, 4);
    const gap = 12;
    const cardW = (contentW - gap * (cardsPerRow - 1)) / cardsPerRow;
    const cardH = 58;

    meta.summary.forEach((s, i) => {
      const col = i % cardsPerRow;
      const row = Math.floor(i / cardsPerRow);
      const x = margin + col * (cardW + gap);
      const cy = y + row * (cardH + gap);

      const tone =
        s.tone === "positive" ? BRAND.positive
        : s.tone === "negative" ? BRAND.negative
        : s.tone === "primary" ? BRAND.primary
        : BRAND.neutral;
      const bg =
        s.tone === "positive" ? BRAND.positiveSoft
        : s.tone === "negative" ? BRAND.negativeSoft
        : s.tone === "primary" ? BRAND.primarySoft
        : BRAND.bg;

      doc.setFillColor(...bg);
      doc.setDrawColor(...BRAND.line);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, cy, cardW, cardH, 9, 9, "FD");

      // barra de destaque lateral
      doc.setFillColor(...tone);
      doc.roundedRect(x, cy, 3.5, cardH, 1.5, 1.5, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...BRAND.inkSoft);
      doc.text(s.label.toUpperCase(), x + 14, cy + 20);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...tone);
      doc.text(String(s.value), x + 14, cy + 42, { maxWidth: cardW - 24 });
    });

    const rows2 = Math.ceil(meta.summary.length / cardsPerRow);
    y += rows2 * (cardH + gap) + 10;
  }

  // ============================================================
  // Tabela de movimentos
  // ============================================================
  autoTable(doc, {
    startY: y,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => String(getVal(r, c.key) ?? ""))),
    styles: {
      fontSize: 8.5,
      cellPadding: 7,
      textColor: BRAND.ink as any,
      lineColor: BRAND.lineSoft as any,
      lineWidth: 0.4,
      font: "helvetica",
    },
    headStyles: {
      fillColor: BRAND.primaryDark as any,
      textColor: BRAND.white as any,
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "left",
      cellPadding: 8,
    },
    alternateRowStyles: { fillColor: BRAND.bg as any },
    columnStyles: columns.reduce((acc, c, i) => {
      acc[i] = { halign: c.align ?? "left", ...(i === columns.length - 1 ? { fontStyle: "bold" } : {}) };
      return acc;
    }, {} as Record<number, any>),
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      // zebra mais suave sobre a cor base
      if (data.column.index !== columns.length - 1) {
        data.cell.styles.textColor = BRAND.ink as any;
        return;
      }
      if (!meta.rowType) return;
      const type = meta.rowType(rows[data.row.index]);
      if (type === "positive") data.cell.styles.textColor = BRAND.positive as any;
      else if (type === "negative") data.cell.styles.textColor = BRAND.negative as any;
      else if (type === "warning") data.cell.styles.textColor = BRAND.warning as any;
    },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;

      doc.setDrawColor(...BRAND.line);
      doc.setLineWidth(0.6);
      doc.line(margin, pageHeight - 40, pageWidth - margin, pageHeight - 40);

      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(...BRAND.inkSoft);
      doc.text("Documento processado por computador — não carece de assinatura", margin, pageHeight - 24);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...BRAND.inkSoft);
      doc.text("Azura Capital · Relatório Financeiro Oficial", margin, pageHeight - 12);
      doc.text(`Página ${currentPage} de ${pageCount}`, pageWidth - margin, pageHeight - 12, { align: "right" });
    },
  });

  const blob = doc.output("blob");
  doc.save(`${meta.filename}.pdf`);
  return blob;
}

// ============================================================
// EMAIL via mailto (inalterado)
// ============================================================
export function openEmailComposer(opts: {
  to: string;
  subject: string;
  filename: string;
  summary?: string;
}) {
  const body = [
    "Olá,",
    "",
    `Segue em anexo o relatório: ${opts.filename}.pdf`,
    "",
    opts.summary ?? "",
    "",
    "Nota: o ficheiro foi descarregado no seu dispositivo. Anexe-o ao email antes de enviar.",
    "",
    "— Azura Capital",
  ].filter(Boolean).join("\n");

  const url = `mailto:${encodeURIComponent(opts.to)}?subject=${encodeURIComponent(opts.subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
}
