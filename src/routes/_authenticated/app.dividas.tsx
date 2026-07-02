import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatKz, formatDate } from "@/lib/format";
import { PageHeader, GhostButton } from "@/components/ui-kit";
import { CheckCircle2, Circle, ArrowUpCircle, ArrowDownCircle, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/dividas")({
  head: () => ({ meta: [{ title: "Gestão de Dívida — Azura Capital" }] }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"receber" | "pagar">("pagar");

  const { data: dividas } = useQuery({
    queryKey: ["dividas", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase
        .from("calendar_events")
        .select("*, bank_accounts(bank_name)")
        .in("category", ["divida_a_pagar", "divida_a_receber"])
        .order("event_date", { ascending: true })
      ).data ?? [],
  });

  const toggleStatus = async (e: any) => {
    if (!user) return;
    const next = e.status === "efetuado" ? "pendente" : "efetuado";
    const { error } = await supabase
      .from("calendar_events")
      .update({ status: next } as never)
      .eq("id", e.id);
    if (error) toast.error(error.message);
    else toast.success(next === "efetuado" ? "Marcada como paga" : "Marcada como não paga");
    qc.invalidateQueries({ queryKey: ["dividas"] });
    qc.invalidateQueries({ queryKey: ["events"] });
  };

  const filtered = (dividas ?? []).filter((e: any) =>
    tab === "pagar"
      ? e.category === "divida_a_pagar"
      : e.category === "divida_a_receber"
  );

  const totalPendente = filtered
    .filter((e: any) => e.status !== "efetuado")
    .reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);

  const totalPago = filtered
    .filter((e: any) => e.status === "efetuado")
    .reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);

  const pendentes = filtered.filter((e: any) => e.status !== "efetuado");
  const pagas = filtered.filter((e: any) => e.status === "efetuado");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Gestão de Dívida"
        subtitle="Dívidas a pagar e a receber"
        action={
          <GhostButton onClick={() => navigate({ to: "/app/calendario" })}>
            <ChevronLeft className="h-4 w-4 inline mr-1" /> Calendário
          </GhostButton>
        }
      />

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("pagar")}
          className={`rounded-full px-5 py-2 text-sm font-medium transition ${
            tab === "pagar" ? "bg-destructive text-white" : "bg-secondary hover:bg-secondary/70"
          }`}
        >
          A Pagar
        </button>
        <button
          onClick={() => setTab("receber")}
          className={`rounded-full px-5 py-2 text-sm font-medium transition ${
            tab === "receber" ? "gradient-primary text-white" : "bg-secondary hover:bg-secondary/70"
          }`}
        >
          A Receber
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass rounded-3xl p-5">
          <div className="text-xs text-muted-foreground mb-1">
            {tab === "pagar" ? "Total em dívida" : "Total a receber"}
          </div>
          <div className={`text-2xl font-bold ${tab === "pagar" ? "text-destructive" : "text-success"}`}>
            {formatKz(totalPendente)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {pendentes.length} pendente{pendentes.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div className="glass rounded-3xl p-5">
          <div className="text-xs text-muted-foreground mb-1">
            {tab === "pagar" ? "Total já pago" : "Total já recebido"}
          </div>
          <div className="text-2xl font-bold text-muted-foreground">{formatKz(totalPago)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {pagas.length} liquidada{pagas.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Pendentes */}
      {pendentes.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Pendentes
          </h2>
          <div className="space-y-2">
            {pendentes.map((e: any) => (
              <DebtRow key={e.id} event={e} onToggle={toggleStatus} tab={tab} />
            ))}
          </div>
        </div>
      )}

      {/* Liquidadas */}
      {pagas.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Liquidadas
          </h2>
          <div className="space-y-2 opacity-60">
            {pagas.map((e: any) => (
              <DebtRow key={e.id} event={e} onToggle={toggleStatus} tab={tab} done />
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="glass rounded-3xl p-12 text-center text-sm text-muted-foreground">
          Sem dívidas {tab === "pagar" ? "a pagar" : "a receber"}. Crie um evento do tipo correspondente no Calendário.
        </div>
      )}
    </div>
  );
}

function DebtRow({ event: e, onToggle, tab, done }: {
  event: any;
  onToggle: (e: any) => void;
  tab: "pagar" | "receber";
  done?: boolean;
}) {
  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-3">
      <button
        onClick={() => onToggle(e)}
        className="shrink-0"
        title={done ? "Marcar como não paga" : "Marcar como paga"}
      >
        {done
          ? <CheckCircle2 className="h-5 w-5 text-success" />
          : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition" />
        }
      </button>

      <div className={`rounded-full p-2 shrink-0 ${tab === "receber" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
        {tab === "receber"
          ? <ArrowUpCircle className="h-4 w-4" />
          : <ArrowDownCircle className="h-4 w-4" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className={`font-medium truncate ${done ? "line-through text-muted-foreground" : ""}`}>
          {e.title || (tab === "pagar" ? "Dívida a Pagar" : "Dívida a Receber")}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {formatDate(e.event_date)}
          {e.bank_accounts && ` · ${e.bank_accounts.bank_name}`}
        </div>
      </div>

      <div className={`font-semibold text-right shrink-0 ${done ? "line-through text-muted-foreground" : tab === "receber" ? "text-success" : "text-destructive"}`}>
        {tab === "receber" ? "+" : "-"}{formatKz(e.amount ?? 0)}
      </div>
    </div>
  );
}
