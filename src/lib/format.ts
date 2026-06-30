export const formatKz = (value: number | null | undefined) => {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    maximumFractionDigits: 0,
  }).format(n);
};

export const formatNumber = (value: number | null | undefined) =>
  new Intl.NumberFormat("pt-AO", { maximumFractionDigits: 2 }).format(Number(value ?? 0));

export const formatDate = (d: string | Date) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};
