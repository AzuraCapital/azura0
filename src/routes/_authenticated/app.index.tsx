import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatKz, formatDate } from "@/lib/format";
import { TrendingUp, Wallet, Target, PieChart as PieIcon, Layers } from "lucide-react";
import { ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";
import { useAuth } from "@/lib/auth";
import { format, startOfMonth, endOfMonth } from "date-fns";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Património — Azura Capital" }] }),
  component: Dashboard,
});

const COLORS = ["#1A8C3A", "#22C55E", "#86EFAC", "#15803D", "#4ADE80", "#166534"];

function Dashboard() {
  const { user } = useAuth();
  const uid = user?.id;

  const { data } = useQuery({
    queryKey: ["dashboard", uid],
    enabled: !!uid,
    queryFn: async () => {
      const ms = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const me = format(endOfMonth(new Date()), "yyyy-MM-dd");
      const [assets, banks, goals, txns, assetCats] = await Promise.all([
        supabase.from("assets").select("invested_amount, asset_category_id, quantity"),
        supabase.from("bank_accounts").select("current_balance, currency"),
        supabase.from("goals").select("*").order("is_primary", { ascending: false }).limit(3),
        supabase.from("transactions").select("type, amount, transaction_date").gte("transaction_date", ms).lte("transaction_date", me),
        supabase.from("asset_categories").select("id, name"),
      ]);
      const assetCount = (assets.data ?? []).length;
      const invested = (assets.data ?? []).reduce((s, a) => s + Number(a.invested_amount), 0);
      const bankTotal = (banks.data ?? []).filter(b => b.currency === "AOA").reduce((s, b) => s + Number(b.current_balance), 0);

      const catMap = new Map((assetCats.data ?? []).map(c => [c.id, c.name]));
      const byCat = new Map<string, number>();
      (assets.data ?? []).forEach(a => {
        const name = catMap.get(a.asset_category_id) || "Outros";
        byCat.set(name, (byCat.get(name) ?? 0) + Number(a.invested_amount));
      });
      const totalPie = Array.from(byCat.values()).reduce((s, v) => s + v, 0);
      const pie = Array.from(byCat.entries()).map(([name, value]) => ({ name, value, pct: totalPie > 0 ? (value / totalPie) * 100 : 0 }));

      const rec = (txns.data ?? []).filter(t => t.type === "receita").reduce((s, t) => s + Number(t.amount), 0);
      const desp = (txns.data ?? []).filter(t => t.type === "despesa").reduce((s, t) => s + Number(t.amount), 0);
      const totalRD = rec + desp;
      const rdPie = totalRD > 0
        ? [
            { name: "Receitas", value: rec, pct: (rec / totalRD) * 100, color: "#22C55E" },
            { name: "Despesas", value: desp, pct: (desp / totalRD) * 100, color: "#EF4444" },
          ]
        : [];

      return { assetCount, invested, bankTotal, pie, rdPie, goals: goals.data ?? [] };
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-name", uid],
    enabled: !!uid,
    queryFn: async () => (await supabase.from("profiles").select("first_name,last_name").eq("id", uid!).maybeSingle()).data,
  });

  const hour = new Date().getHours();
  const greeting =
  hour >= 0 && hour < 12
    ? "Bom dia"
    : hour >= 12 && hour < 18
      ? "Boa tarde"
      : "Boa noite";
  const emoji = "🤩";
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  const today = new Intl.DateTimeFormat("pt-PT", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <p className="text-xl sm:text-2xl font-bold text-primary">
          {greeting}{name ? ", " : ""}{name ? <span className="text-foreground font-extrabold">
    {name}
</span> : ""} {emoji}
        </p>
        <p className="text-sm text-muted-foreground capitalize mt-0.5">{today}</p>
        <h1 className="text-3xl font-bold mt-2">Património</h1>
        <p className="text-sm text-muted-foreground">Visão Geral do seu Património</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={Layers} label="Quantidade de Ativos" value={String(data?.assetCount ?? 0)} />
        <MetricCard icon={Wallet} label="Saldo Bancário" value={formatKz(data?.bankTotal ?? 0)} positive={((data?.bankTotal ?? 0) >= 0)} negative={((data?.bankTotal ?? 0) < 0)} />
        <MetricCard icon={TrendingUp} label="Carteira de Investimento" value={formatKz(data?.invested ?? 0)} positive />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-3xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><PieIcon className="h-4 w-4 text-primary" /> Carteira de Investimento</h3>
          <div className="h-72">
            {(data?.pie ?? []).length ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={data!.pie}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={95}
                    animationDuration={800}
                    label={(e: any) => `${e.pct.toFixed(0)}%`}
                  >
                    {data!.pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip
    formatter={(v: number, _n: string, p: any) => [
        formatKz(v),
        `${p.payload.name} (${p.payload.pct.toFixed(1)}%)`
    ]}
/>
                  <Legend
                    verticalAlign="bottom"
                
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty msg="Sem investimentos ainda" />}
          </div>
        </div>

        <div className="glass rounded-3xl p-6">
          <h3 className="font-semibold mb-4">Receitas vs Despesas (mês)</h3>
          <div className="h-72">
            {(data?.rdPie ?? []).length ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={data!.rdPie}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={95}
                    animationDuration={800}
                    label={(e: any) => `${e.pct.toFixed(0)}%`}
                  >
                    {data!.rdPie.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip
    formatter={(v: number, _n: string, p: any) => [
        formatKz(v),
        `${p.payload.name} (${p.payload.pct.toFixed(1)}%)`
    ]}
/>
                  <Legend
                    verticalAlign="bottom"
                  
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty msg="Sem movimentos este mês" />}
          </div>
        </div>
      </div>

      <div className="glass rounded-3xl p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Metas prioritárias</h3>
        {(data?.goals ?? []).length === 0 ? (
          <Empty msg="Sem metas definidas. Adicione objetivos na secção Objetivos." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {(data?.goals ?? []).slice(0, 2).map((g: any) => {
              const pct = Math.min(100, (Number(g.current_amount) / Number(g.target_amount)) * 100);
              return (
                <div key={g.id} className="rounded-2xl border border-border/60 p-5">
                  <div className="font-semibold truncate">{g.name}</div>
                  <div className="mt-3 h-3 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full gradient-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Atual: </span><span className="font-medium">{formatKz(g.current_amount)}</span></div>
                    <div className="text-right"><span className="text-muted-foreground">Alvo: </span><span className="font-medium">{formatKz(g.target_amount)}</span></div>
                    <div><span className="text-muted-foreground">Progressão: </span><span className="font-medium">{pct.toFixed(0)}%</span></div>
                    {g.target_date && <div className="text-right"><span className="text-muted-foreground">Data alvo: </span><span className="font-medium">{formatDate(g.target_date)}</span></div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, positive, negative }: any) {
  return (
    <div className="glass rounded-3xl p-5 hover:scale-[1.02] transition-transform">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-muted-foreground font-medium">{label}</div>
        <div className={`rounded-full p-2 ${positive ? "bg-success/10 text-success" : negative ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className={`text-2xl font-bold ${negative ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-6">{msg}</div>;
}
