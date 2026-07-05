import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import logoDark from "@/assets/azura-logo-dark.png.asset.json";

// ============================================================
// Azura Capital — Export System (PDF + Excel)
// Modern, coloured, branded.
// ============================================================

export type ExportColumn<T> = {
  header: string;
  key: keyof T | ((row: T) => string | number);
  align?: "left" | "right" | "center";
  /** Optional per-column formatter used only for XLSX cell values */
  excel?: (row: T) => string | number;
};

export type ExportMeta = {
  title: string;
  subtitle?: string;
  period?: string;
  filename: string;
  summary?: { label: string; value: string; tone?: "default" | "positive" | "negative" | "primary" }[];
  /** Optional accessor for row semantic type used for color coding */
  rowType?: (row: any) => "positive" | "negative" | "neutral" | "warning";
};

// Brand palette (RGB for jsPDF / hex for XLSX styling comments)
const BRAND = {
  primary: [26, 140, 58] as [number, number, number],       // #1A8C3A
  primarySoft: [232, 245, 236] as [number, number, number], // subtle green
  positive: [34, 197, 94] as [number, number, number],      // #22C55E
  positiveSoft: [220, 252, 231] as [number, number, number],
  negative: [239, 68, 68] as [number, number, number],      // #EF4444
  negativeSoft: [254, 226, 226] as [number, number, number],
  warning: [234, 179, 8] as [number, number, number],
  warningSoft: [254, 249, 195] as [number, number, number],
  neutral: [100, 116, 139] as [number, number, number],
  ink: [15, 23, 42] as [number, number, number],
  inkSoft: [71, 85, 105] as [number, number, number],
  line: [226, 232, 240] as [number, number, number],
  bg: [248, 250, 252] as [number, number, number],
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
// EXCEL
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

  // Simple row highlighting via cell comments/notes — visual color needs xlsx-style,
  // but we set number/format basics + freeze the header row so it stays professional.
  ws["!freeze"] = { xSplit: 0, ySplit: dataStart } as any;

  const wb = XLSX.utils.book_new();
  (wb as any).Props = {
    Title: meta.title,
    Author: "Azura Capital",
    CreatedDate: new Date(),
  };
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");
  XLSX.writeFile(wb, `${meta.filename}.xlsx`);
}

// ============================================================
// PDF
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

  const logo = await loadLogoDataUrl();

  // ------ Header band ------
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, pageWidth, 90, "F");

  if (logo) {
    try {
      doc.addImage(logo, "PNG", margin, 22, 46, 46);
    } catch {}
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("AZURA CAPITAL", logo ? margin + 60 : margin, 44);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(232, 245, 236);
  doc.text(meta.title, logo ? margin + 60 : margin, 62);

  // Right side: date
  doc.setFontSize(8);
  doc.setTextColor(232, 245, 236);
  doc.text(format(new Date(), "dd/MM/yyyy HH:mm"), pageWidth - margin, 44, { align: "right" });
  if (meta.period) doc.text(meta.period, pageWidth - margin, 60, { align: "right" });

  let y = 120;

  // ------ Sub-header ------
  if (meta.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.inkSoft);
    doc.text(meta.subtitle, margin, y);
    y += 18;
  }

  // ------ Summary cards ------
  if (meta.summary?.length) {
    const cardsPerRow = Math.min(meta.summary.length, 4);
    const gap = 10;
    const cardW = (pageWidth - margin * 2 - gap * (cardsPerRow - 1)) / cardsPerRow;
    const cardH = 54;

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
      doc.roundedRect(x, cy, cardW, cardH, 8, 8, "FD");

      // accent bar
      doc.setFillColor(...tone);
      doc.roundedRect(x, cy, 4, cardH, 2, 2, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...BRAND.inkSoft);
      doc.text(s.label.toUpperCase(), x + 12, cy + 18);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...tone);
      doc.text(String(s.value), x + 12, cy + 38, { maxWidth: cardW - 20 });
    });

    const rows2 = Math.ceil(meta.summary.length / cardsPerRow);
    y += rows2 * (cardH + gap) + 8;
  }

  // ------ Table ------
  autoTable(doc, {
    startY: y,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => String(getVal(r, c.key) ?? ""))),
    styles: {
      fontSize: 8.5,
      cellPadding: 6,
      textColor: BRAND.ink as any,
      lineColor: BRAND.line as any,
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: BRAND.primary as any,
      textColor: [255, 255, 255] as any,
      fontStyle: "bold",
      fontSize: 9,
      halign: "left",
    },
    alternateRowStyles: { fillColor: [249, 250, 251] as any },
    columnStyles: columns.reduce((acc, c, i) => {
      if (c.align) acc[i] = { halign: c.align };
      return acc;
    }, {} as Record<number, any>),
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      if (data.section !== "body" || !meta.rowType) return;
      const type = meta.rowType(rows[data.row.index]);
      if (type === "positive") {
        data.cell.styles.textColor = BRAND.positive as any;
      } else if (type === "negative") {
        data.cell.styles.textColor = BRAND.negative as any;
      } else if (type === "warning") {
        data.cell.styles.textColor = BRAND.warning as any;
      }
      // Only color the last (amount) column strongly; others stay ink
      if (data.column.index !== columns.length - 1) {
        data.cell.styles.textColor = BRAND.ink as any;
      }
      // Add a soft left indicator on first cell
      if (data.column.index === 0) {
        const tone =
          type === "positive" ? BRAND.positiveSoft
          : type === "negative" ? BRAND.negativeSoft
          : type === "warning" ? BRAND.warningSoft
          : null;
        if (tone) data.cell.styles.fillColor = tone as any;
      }
    },
    didDrawPage: () => {
      // Footer
      const pageCount = doc.getNumberOfPages();
      const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;
      doc.setDrawColor(...BRAND.line);
      doc.setLineWidth(0.4);
      doc.line(margin, pageHeight - 34, pageWidth - margin, pageHeight - 34);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...BRAND.inkSoft);
      doc.text("Azura Capital · Relatório Financeiro Oficial", margin, pageHeight - 20);
      doc.text(`Página ${currentPage} de ${pageCount}`, pageWidth - margin, pageHeight - 20, { align: "right" });
    },
  });

  const blob = doc.output("blob");
  doc.save(`${meta.filename}.pdf`);
  return blob;
}

// ============================================================
// EMAIL via mailto (opens user's mail client with pre-filled body)
// The PDF is already downloaded — user attaches manually.
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
