import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export type ExportColumn<T> = {
  header: string;
  key: keyof T | ((row: T) => string | number);
  align?: "left" | "right" | "center";
};

export type ExportMeta = {
  title: string;
  subtitle?: string;
  period?: string;
  filename: string;
  summary?: { label: string; value: string }[];
};

const getVal = <T,>(row: T, key: ExportColumn<T>["key"]) =>
  typeof key === "function" ? key(row) : (row as any)[key];

export function exportToExcel<T>(rows: T[], columns: ExportColumn<T>[], meta: ExportMeta) {
  const headerRows: any[][] = [
    [meta.title],
    ...(meta.subtitle ? [[meta.subtitle]] : []),
    ...(meta.period ? [[`Período: ${meta.period}`]] : []),
    [`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
    [],
  ];
  if (meta.summary?.length) {
    meta.summary.forEach(s => headerRows.push([s.label, s.value]));
    headerRows.push([]);
  }
  headerRows.push(columns.map(c => c.header));
  const dataRows = rows.map(r => columns.map(c => getVal(r, c.key)));

  const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);
  ws["!cols"] = columns.map(() => ({ wch: 22 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");
  XLSX.writeFile(wb, `${meta.filename}.xlsx`);
}

export function exportToPdf<T>(rows: T[], columns: ExportColumn<T>[], meta: ExportMeta) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(meta.title, 40, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  if (meta.subtitle) { doc.text(meta.subtitle, 40, y); y += 14; }
  if (meta.period) { doc.text(`Período: ${meta.period}`, 40, y); y += 14; }
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 40, y);
  y += 18;

  if (meta.summary?.length) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    meta.summary.forEach(s => {
      doc.text(`${s.label}:`, 40, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(s.value), 180, y);
      doc.setFont("helvetica", "bold");
      y += 14;
    });
    y += 6;
  }

  autoTable(doc, {
    startY: y,
    head: [columns.map(c => c.header)],
    body: rows.map(r => columns.map(c => String(getVal(r, c.key) ?? ""))),
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: columns.reduce((acc, c, i) => {
      if (c.align) acc[i] = { halign: c.align };
      return acc;
    }, {} as Record<number, any>),
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Azura Capital · Página ${currentPage} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 20,
        { align: "center" }
      );
    },
  });

  doc.save(`${meta.filename}.pdf`);
}
