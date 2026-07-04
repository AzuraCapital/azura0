import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatKz, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui-kit";
import { ExportButton } from "@/components/ExportButton";
import { exportToExcel, exportToPdf } from "@/lib/export";
import { ArrowDownCircle, ArrowUpCircle, CalendarClock, TrendingUp, TrendingDown } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, addMonths, addYears } from "date-fns";

const HIST_URL = "https://azura0.lovable.app/app/historico";
const HIST_TITLE = "Histórico Financeiro — Azura Capital";
const HIST_DESC = "Timeline consolidada de todas as suas operações — receitas, despesas, compras, vendas e eventos efetuados — com filtros mensais e anuais.";

export const Route = createFileRoute("/_authenticated/app/historico")({
  head: () => ({
    meta: [
      { title: HIST_TITLE },
      { name: "description", content: HIST_DESC },
      { property: "og:title", content: HIST_TITLE },
      { property: "og:description", content: HIST_DESC },
      { property: "og:url", content: HIST_URL },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [{ rel: "canonical", href: HIST_URL }],
  }),
  component: Page,
});

type Row = {
  id: string;
  date: string;
  kind: "receita" | "despesa" | "compra" | "venda" | "calendario_receita" | "calendario_despesa";
  label: string;
  detail: string;
  amount: number;
  positive: boolean;
};

function Page() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<"mensal" | "anual">("mensal");
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<"todos" | "receitas" | "despesas" | "investimentos">("todos");

  const refDate = useMemo(() => period === "mensal" ? addMonths(new Date(), offset) : addYears(new Date(), offset), [offset, period]);
  const range = useMemo(() => {
    if (period === "mensal") return { s: format(startOfMonth(refDate), "yyyy-MM-dd"), e: format(endOfMonth(refDate), "yyyy-MM-dd") };
    return { s: format(startOfYear(refDate), "yyyy-MM-dd"), e: format(endOfYear(refDate), "yyyy-MM-dd") };
  }, [refDate, period]);

  const { data: txns } = useQuery({
    queryKey: ["hist-tx", user?.id, range.s, range.e],
    enabled: !!user,
    queryFn: async () => (await supabase.from("transactions").select("*, income_categories(name), expense_categories(name), bank_accounts(bank_name)").gte("transaction_date", range.s).lte("transaction_date", range.e)).data ?? [],
  });
  const { data: assetTx } = useQuery({
    queryKey: ["hist-atx", user?.id, range.s, range.e],
    enabled: !!user,
    queryFn: async () => (await supabase.from("asset_transactions").select("*, assets(name), bank_accounts(bank_name)").gte("transaction_date", range.s).lte("transaction_date", range.e)).data ?? [],
  });
  const { data: events } = useQuery({
    queryKey: ["hist-ev", user?.id, range.s, range.e],
    enabled: !!user,
    queryFn: async () => (await supabase.from("calendar_events").select("*, bank_accounts(bank_name)").eq("status", "efetuado").gte("event_date", range.s).lte("event_date", range.e)).data ?? [],
  });

  const rows: Row[] = useMemo(() => {
    const list: Row[] = [];
    (txns ?? []).forEach((t: any) => {
      const cat = t.type === "receita" ? t.income_categories?.name : t.expense_categories?.name;
      list.push({
        id: "t_" + t.id, date: t.transaction_date, kind: t.type,
        label: t.description || cat || (t.type === "receita" ? "Receita" : "Despesa"),
        detail: [cat, t.bank_accounts?.bank_name].filter(Boolean).join(" · "),
        amount: Number(t.amount), positive: t.type === "receita",
      });
    });
    (assetTx ?? []).forEach((a: any) => {
      list.push({
        id: "a_" + a.id, date: a.transaction_date, kind: a.type,
        label: (a.type === "compra" ? "Compra" : "Venda") + " · " + (a.assets?.name ?? "Ativo"),
        detail: a.bank_accounts?.bank_name ?? "Sem banco",
        amount: Number(a.amount), positive: a.type === "venda",
      });
    });
    (events ?? []).forEach((e: any) => {
      list.push({
        id: "e_" + e.id, date: e.event_date,
        kind: e.direction === "receita" ? "calendario_receita" : "calendario_despesa",
        label: e.title || "Evento",
        detail: ["Calendário", e.bank_accounts?.bank_name].filter(Boolean).join(" · "),
        amount: Number(e.amount ?? 0), positive: e.direction === "receita",
      });
    });
    return list.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : b.id > a.id ? 1 : -1));
  }, [txns, assetTx, events]);

  const filtered = rows.filter(r => {
    if (filter === "todos") return true;
    if (filter === "receitas") return r.positive;
    if (filter === "despesas") return !r.positive && r.kind !== "compra";
    return r.kind === "compra" || r.kind === "venda";
  });

  const totalRec = rows.filter(r => r.positive).reduce((s, r) => s + r.amount, 0);
  const totalDesp = rows.filter(r => !r.positive).reduce((s, r) => s + r.amount, 0);

  const periodLabel = period === "mensal"
    ? new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(refDate)
    : new Intl.DateTimeFormat("pt-PT", { year: "numeric" }).format(refDate);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
  const handleExport = async (fmt: "pdf" | "excel", range: { from: string | null; to: string | null }) => {
    let q1 = supabase.from("transactions").select("*, income_categories(name), expense_categories(name), bank_accounts(bank_name)");
    let q2 = supabase.from("asset_transactions").select("*, assets(name), bank_accounts(bank_name)");
    let q3 = supabase.from("calendar_events").select("*, bank_accounts(bank_name)").eq("status", "efetuado");
    if (range.from) { q1 = q1.gte("transaction_date", range.from); q2 = q2.gte("transaction_date", range.from); q3 = q3.gte("event_date", range.from); }
    if (range.to) { q1 = q1.lte("transaction_date", range.to); q2 = q2.lte("transaction_date", range.to); q3 = q3.lte("event_date", range.to); }
    const [t, a, e] = await Promise.all([q1, q2, q3]);
    const list: Row[] = [];
    (t.data ?? []).forEach((x: any) => {
      const cat = x.type === "receita" ? x.income_categories?.name : x.expense_categories?.name;
      list.push({ id: "t_" + x.id, date: x.transaction_date, kind: x.type, label: x.description || cat || (x.type === "receita" ? "Receita" : "Despesa"), detail: [cat, x.bank_accounts?.bank_name].filter(Boolean).join(" · "), amount: Number(x.amount), positive: x.type === "receita" });
    });
    (a.data ?? []).forEach((x: any) => {
      list.push({ id: "a_" + x.id, date: x.transaction_date, kind: x.type, label: (x.type === "compra" ? "Compra" : "Venda") + " · " + (x.assets?.name ?? "Ativo"), detail: x.bank_accounts?.bank_name ?? "Sem banco", amount: Number(x.amount), positive: x.type === "venda" });
    });
    (e.data ?? []).forEach((x: any) => {
      list.push({ id: "e_" + x.id, date: x.event_date, kind: x.direction === "receita" ? "calendario_receita" : "calendario_despesa", label: x.title || "Evento", detail: ["Calendário", x.bank_accounts?.bank_name].filter(Boolean).join(" · "), amount: Number(x.amount ?? 0), positive: x.direction === "receita" });
    });
    list.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
    const rec = list.filter(r => r.positive).reduce((s, r) => s + r.amount, 0);
    const desp = list.filter(r => !r.positive).reduce((s, r) => s + r.amount, 0);
    const period = range.from || range.to ? `${range.from ?? "início"} até ${range.to ?? "hoje"}` : "Todos os movimentos";
    const columns = [
      { header: "Data", key: (r: Row) => formatDate(r.date) },
      { header: "Tipo", key: (r: Row) => ({ receita: "Receita", despesa: "Despesa", compra: "Compra", venda: "Venda", calendario_receita: "Calendário (Receita)", calendario_despesa: "Calendário (Despesa)" }[r.kind]) },
      { header: "Descrição", key: (r: Row) => r.label },
      { header: "Detalhe", key: (r: Row) => r.detail },
      { header: "Valor (AOA)", key: (r: Row) => (r.positive ? "+" : "-") + formatKz(r.amount), align: "right" as const },
    ];
    const meta = {
      title: "Histórico Financeiro",
      subtitle: "Azura Capital — Extrato completo de movimentos",
      period,
      filename: `historico_financeiro_${format(new Date(), "yyyyMMdd_HHmm")}`,
      summary: [
        { label: "Total de Movimentos", value: String(list.length) },
        { label: "Total Receitas", value: formatKz(rec) },
        { label: "Total Despesas", value: formatKz(desp) },
        { label: "Saldo Líquido", value: formatKz(rec - desp) },
      ],
    };
    if (fmt === "excel") exportToExcel(list, columns, meta);
    else exportToPdf(list, columns, meta);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader title="Histórico Financeiro" subtitle="Todos os movimentos: receitas, despesas, compras, vendas e eventos" action={<ExportButton onExport={handleExport} />} />

      <div className="flex flex-wrap gap-2">
        {(["mensal", "anual"] as const).map(p => (
          <button key={p} onClick={() => { setPeriod(p); setOffset(0); }} className={`rounded-full px-4 py-1.5 text-sm font-medium ${period === p ? "gradient-primary text-white" : "bg-secondary hover:bg-secondary/70"}`}>{p === "mensal" ? "Mensal" : "Anual"}</button>
        ))}
      </div>

      <div className="glass rounded-3xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setOffset(o => o - 1)} className="rounded-full px-3 py-1.5 text-sm bg-secondary hover:bg-secondary/70">← Anterior</button>
          <div className="font-semibold capitalize flex items-center gap-2 px-2"><CalendarClock className="h-4 w-4" /> {periodLabel}</div>
          <button onClick={() => setOffset(o => o + 1)} className="rounded-full px-3 py-1.5 text-sm bg-secondary hover:bg-secondary/70">Próximo →</button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["todos", "receitas", "despesas", "investimentos"] as const).map(t => (
            <button key={t} onClick={() => setFilter(t)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${filter === t ? "gradient-primary text-white" : "bg-secondary hover:bg-secondary/70"}`}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="glass rounded-2xl p-4 flex items-center gap-3">
          <div className="rounded-full p-2 bg-success/10 text-success"><TrendingUp className="h-4 w-4" /></div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Total Receita do {period === "mensal" ? "Mês" : "Ano"}</div>
            <div className="text-xl font-bold text-success truncate">{formatKz(totalRec)}</div>
          </div>
        </div>
        <div className="glass rounded-2xl p-4 flex items-center gap-3">
          <div className="rounded-full p-2 bg-destructive/10 text-destructive"><TrendingDown className="h-4 w-4" /></div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Total Despesa do {period === "mensal" ? "Mês" : "Ano"}</div>
            <div className="text-xl font-bold text-destructive truncate">{formatKz(totalDesp)}</div>
          </div>
        </div>
      </div>

      <div className="glass rounded-3xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Sem movimentos no período.</div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-4">
                <div className={`rounded-full p-2.5 shrink-0 ${r.positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                  {r.positive ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.detail} · {formatDate(r.date)}</div>
                </div>
                <div className={`font-semibold text-right shrink-0 ${r.positive ? "text-success" : "text-destructive"}`}>
                  {r.positive ? "+" : "-"}{formatKz(r.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
