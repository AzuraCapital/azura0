import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatKz, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui-kit";
import { ArrowDownCircle, ArrowUpCircle, CalendarClock } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";

export const Route = createFileRoute("/_authenticated/app/historico")({
  head: () => ({ meta: [{ title: "Histórico — Azura Capital" }] }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  const [monthOffset, setMonthOffset] = useState(0);
  const [filter, setFilter] = useState<"todos" | "receita" | "despesa">("todos");

  const refDate = useMemo(() => addMonths(new Date(), monthOffset), [monthOffset]);
  const ms = format(startOfMonth(refDate), "yyyy-MM-dd");
  const me = format(endOfMonth(refDate), "yyyy-MM-dd");

  const { data: txns } = useQuery({
    queryKey: ["hist-tx", user?.id, ms, me],
    enabled: !!user,
    queryFn: async () => (await supabase
      .from("transactions")
      .select("*, income_categories(name), expense_categories(name), bank_accounts(account_name)")
      .gte("transaction_date", ms).lte("transaction_date", me)
      .order("transaction_date", { ascending: false })
    ).data ?? [],
  });

  const items = (txns ?? []).filter((t: any) => filter === "todos" || t.type === filter);
  const totalRec = (txns ?? []).filter((t: any) => t.type === "receita").reduce((s, t: any) => s + Number(t.amount), 0);
  const totalDesp = (txns ?? []).filter((t: any) => t.type === "despesa").reduce((s, t: any) => s + Number(t.amount), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader title="Histórico" subtitle="Tudo o que entrou e saiu" />

      <div className="glass rounded-3xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setMonthOffset(o => o - 1)} className="rounded-full px-3 py-1.5 text-sm bg-secondary hover:bg-secondary/70">← Anterior</button>
          <div className="font-semibold capitalize flex items-center gap-2 px-2"><CalendarClock className="h-4 w-4" /> {new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(refDate)}</div>
          <button onClick={() => setMonthOffset(o => o + 1)} className="rounded-full px-3 py-1.5 text-sm bg-secondary hover:bg-secondary/70">Próximo →</button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["todos", "receita", "despesa"] as const).map(t => (
            <button key={t} onClick={() => setFilter(t)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${filter === t ? "gradient-primary text-white" : "bg-secondary hover:bg-secondary/70"}`}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="glass rounded-2xl p-4"><div className="text-xs text-muted-foreground">Receitas</div><div className="text-xl font-bold text-success truncate">{formatKz(totalRec)}</div></div>
        <div className="glass rounded-2xl p-4"><div className="text-xs text-muted-foreground">Despesas</div><div className="text-xl font-bold text-destructive truncate">{formatKz(totalDesp)}</div></div>
        <div className="glass rounded-2xl p-4"><div className="text-xs text-muted-foreground">Saldo do mês</div><div className={`text-xl font-bold truncate ${totalRec - totalDesp >= 0 ? "text-success" : "text-destructive"}`}>{formatKz(totalRec - totalDesp)}</div></div>
      </div>

      <div className="glass rounded-3xl overflow-hidden">
        {items.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Sem movimentos neste mês.</div>
        ) : (
          <div className="divide-y divide-border/50">
            {items.map((t: any) => {
              const cat = t.type === "receita" ? t.income_categories : t.expense_categories;
              return (
                <div key={t.id} className="flex items-center gap-3 p-4">
                  <div className={`rounded-full p-2.5 shrink-0 ${t.type === "receita" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                    {t.type === "receita" ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{t.description || cat?.name || "Sem descrição"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {cat?.name ?? (t.source_event_id ? "Evento do calendário" : "—")} · {formatDate(t.transaction_date)}
                      {t.bank_accounts && ` · ${t.bank_accounts.account_name}`}
                      {t.source_event_id && " · auto"}
                    </div>
                  </div>
                  <div className={`font-semibold text-right shrink-0 ${t.type === "receita" ? "text-success" : "text-destructive"}`}>
                    {t.type === "receita" ? "+" : "-"}{formatKz(t.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">A entrada automática provém de eventos do Calendário marcados como efetuados.</p>
    </div>
  );
}
