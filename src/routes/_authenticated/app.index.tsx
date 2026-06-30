import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatKz } from "@/lib/format";
import { TrendingUp, TrendingDown, Wallet, Target, PieChart as PieIcon } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, BarChart, Bar, Legend } from "recharts";
import { useAuth } from "@/lib/auth";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Dashboard — Azura Capital" }] }),
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
      const [assets, banks, liab, goals, txns, assetCats] = await Promise.all([
        supabase.from("assets").select("invested_amount, asset_category_id, acquisition_date"),
        supabase.from("bank_accounts").select("current_balance"),
        supabase.from("liabilities").select("amount, type"),
        supabase.from("goals").select("*").order("is_primary", { ascending: false }).limit(1),
        supabase.from("transactions").select("type, amount, transaction_date").gte("transaction_date", format(startOfMonth(new Date()), "yyyy-MM-dd")).lte("transaction_date", format(endOfMonth(new Date()), "yyyy-MM-dd")),
        supabase.from("asset_categories").select("id, name"),
      ]);
      const invested = (assets.data ?? []).reduce((s, a) => s + Number(a.invested_amount), 0);
      const bankTotal = (banks.data ?? []).reduce((s, b) => s + Number(b.current_balance), 0);
      const liabTotal = (liab.data ?? []).filter(l => l.type !== "divida_a_receber").reduce((s, l) => s + Number(l.amount), 0);
      const receivable = (liab.data ?? []).filter(l => l.type === "divida_a_receber").reduce((s, l) => s + Number(l.amount), 0);
      const net = invested + bankTotal + receivable - liabTotal;

      // pie by category
      const catMap = new Map((assetCats.data ?? []).map(c => [c.id, c.name]));
      const byCat = new Map<string, number>();
      (assets.data ?? []).forEach(a => {
        const name = catMap.get(a.asset_category_id) || "Outros";
        byCat.set(name, (byCat.get(name) ?? 0) + Number(a.invested_amount));
      });
      const pie = Array.from(byCat.entries()).map(([name, value]) => ({ name, value }));

      // monthly evolution (last 12m cumulative invested)
      const months = Array.from({ length: 12 }).map((_, i) => subMonths(new Date(), 11 - i));
      const line = months.map(m => {
        const cut = endOfMonth(m);
        const v = (assets.data ?? []).filter(a => a.acquisition_date && new Date(a.acquisition_date) <= cut).reduce((s, a) => s + Number(a.invested_amount), 0);
        return { month: format(m, "MMM"), value: v + bankTotal };
      });

      // bar chart receitas vs despesas
      const rec = (txns.data ?? []).filter(t => t.type === "receita").reduce((s, t) => s + Number(t.amount), 0);
      const desp = (txns.data ?? []).filter(t => t.type === "despesa").reduce((s, t) => s + Number(t.amount), 0);
      const bars = [{ name: "Este mês", Receitas: rec, Despesas: desp }];

      const goal = (goals.data ?? [])[0];
      const goalPct = goal ? Math.min(100, (Number(goal.current_amount) / Number(goal.target_amount)) * 100) : 0;

      return { invested, bankTotal, liabTotal, net, pie, line, bars, goal, goalPct };
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-name", uid],
    enabled: !!uid,
    queryFn: async () => (await supabase.from("profiles").select("first_name,last_name").eq("id", uid!).maybeSingle()).data,
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 19 ? "Boa tarde" : "Boa noite";
  const emoji = hour < 12 ? "☀️" : hour < 19 ? "👋" : "🌙";
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  const today = new Intl.DateTimeFormat("pt-PT", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <p className="text-sm sm:text-base font-medium text-primary">{greeting}{name ? `, ${name}` : ""} {emoji}</p>
        <p className="text-xs text-muted-foreground capitalize mt-0.5">{today}</p>
        <h1 className="text-3xl font-bold mt-2">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do seu património</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Wallet} label="Património Líquido" value={formatKz(data?.net ?? 0)} positive />
        <MetricCard icon={Wallet} label="Saldo Contas" value={formatKz(data?.bankTotal ?? 0)} />
        <MetricCard icon={TrendingUp} label="Total Investido" value={formatKz(data?.invested ?? 0)} positive />
        <MetricCard icon={TrendingDown} label="Passivos" value={formatKz(data?.liabTotal ?? 0)} negative />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="glass rounded-3xl p-6 lg:col-span-2">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Evolução (12 meses)</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={data?.line ?? []}>
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                <Tooltip formatter={(v: number) => formatKz(v)} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" }} />
                <Line type="monotone" dataKey="value" stroke="#1A8C3A" strokeWidth={3} dot={{ fill: "#22C55E", r: 4 }} animationDuration={800} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-3xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Meta principal</h3>
          {data?.goal ? (
            <div className="text-center py-4">
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-36 h-36 -rotate-90">
                  <circle cx="72" cy="72" r="60" stroke="var(--muted)" strokeWidth="10" fill="none" />
                  <circle cx="72" cy="72" r="60" stroke="url(#g1)" strokeWidth="10" fill="none" strokeDasharray={`${(data.goalPct / 100) * 377} 377`} strokeLinecap="round" />
                  <defs><linearGradient id="g1"><stop offset="0" stopColor="#1A8C3A" /><stop offset="1" stopColor="#22C55E" /></linearGradient></defs>
                </svg>
                <div className="absolute text-2xl font-bold">{data.goalPct.toFixed(0)}%</div>
              </div>
              <div className="mt-4 font-medium">{data.goal.name}</div>
              <div className="text-xs text-muted-foreground">{formatKz(data.goal.current_amount)} / {formatKz(data.goal.target_amount)}</div>
            </div>
          ) : (
            <div className="text-center py-12 text-sm text-muted-foreground">Defina um objetivo principal em Objetivos</div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-3xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><PieIcon className="h-4 w-4 text-primary" /> Carteira por tipo</h3>
          <div className="h-64">
            {(data?.pie ?? []).length ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={data!.pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} animationDuration={800}>
                    {data!.pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatKz(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty msg="Sem investimentos ainda" />}
          </div>
        </div>

        <div className="glass rounded-3xl p-6">
          <h3 className="font-semibold mb-4">Receitas vs Despesas (mês)</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data?.bars ?? []}>
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatKz(v)} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" }} />
                <Legend />
                <Bar dataKey="Receitas" fill="#22C55E" radius={[8, 8, 0, 0]} animationDuration={800} />
                <Bar dataKey="Despesas" fill="#EF4444" radius={[8, 8, 0, 0]} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
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
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">{msg}</div>;
}
