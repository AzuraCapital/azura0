import { createFileRoute, Link } from "@tanstack/react-router";
import { TrendingUp, Wallet, Target, BarChart3, Calendar, Bell, ShieldCheck, PieChart } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

const HOME_URL = "https://azura0.lovable.app/";
const HOME_TITLE = "Azura Capital — Gestão Patrimonial";
const HOME_DESC = "Azura Capital: plataforma de gestão patrimonial para investidores. Consolide investimentos, contas bancárias, objetivos e finanças pessoais num único lugar.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESC },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_DESC },
      { property: "og:url", content: HOME_URL },
      { name: "twitter:title", content: HOME_TITLE },
      { name: "twitter:description", content: HOME_DESC },
    ],
    links: [{ rel: "canonical", href: HOME_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Azura Capital",
          url: HOME_URL,
        }),
      },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: TrendingUp, title: "Investimentos", desc: "Ações, ETFs, obrigações, fundos e depósitos num só lugar." },
  { icon: Wallet, title: "Contas Bancárias", desc: "Saldos e movimentos de todos os seus bancos consolidados." },
  { icon: Target, title: "Objetivos", desc: "Defina metas e veja quanto poupar por mês para as atingir." },
  { icon: PieChart, title: "Património Líquido", desc: "Visão completa de ativos e passivos em tempo real." },
  { icon: Calendar, title: "Calendário Financeiro", desc: "Eventos recorrentes, vencimentos e receitas esperadas." },
  { icon: Bell, title: "Alertas Inteligentes", desc: "Nunca perca um pagamento, dividendo ou vencimento." },
];

function Landing() {
  return (
    <div className="min-h-screen gradient-hero">
      {/* Nav */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Logo className="h-9" />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link to="/auth" className="rounded-full border border-primary/30 px-5 py-2 text-sm font-medium text-primary hover:bg-primary/5 transition">
            Entrar
          </Link>
        </div>
      </header>

      <main>
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 pt-12 pb-20 text-center">
        <div className="animate-fade-up inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-medium text-primary mb-8">
          <ShieldCheck className="h-3.5 w-3.5" /> Gestão patrimonial premium
        </div>
        <h1 className="animate-fade-up text-5xl md:text-7xl font-bold tracking-tight text-foreground">
          Plataforma de Gestão<br />
          <span className="text-gradient-primary">Financeira</span>
        </h1>
        <p className="animate-fade-up mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Acompanhe os seus investimentos e finanças pessoais num único lugar — com clareza, controlo e confiança.
        </p>
        <div className="animate-fade-up mt-10 flex flex-wrap justify-center gap-4">
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="rounded-full gradient-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary/25 hover:scale-[1.02] transition-transform"
          >
            Criar Conta
          </Link>
          <Link
            to="/auth"
            className="rounded-full border-2 border-primary px-8 py-3.5 text-base font-semibold text-primary hover:bg-primary/5 transition-colors"
          >
            Entrar
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <h2 className="text-center text-3xl md:text-4xl font-bold mb-4">Tudo o que precisa, num só lugar</h2>
        <p className="text-center text-muted-foreground mb-14 max-w-xl mx-auto">
          Construído para investidores que querem ver o panorama completo.
        </p>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="glass rounded-3xl p-6 hover:scale-[1.02] transition-transform animate-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="inline-flex items-center justify-center rounded-2xl gradient-primary p-3 mb-4">
                <f.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="glass rounded-3xl p-10 md:p-14 text-center">
          <BarChart3 className="h-10 w-10 text-primary mx-auto mb-4" />
          <h3 className="text-2xl md:text-3xl font-bold mb-3">Comece hoje, sem custos</h3>
          <p className="text-muted-foreground mb-8">Crie a sua conta em menos de um minuto.</p>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="inline-block rounded-full gradient-primary px-8 py-3.5 font-semibold text-white shadow-lg shadow-primary/25"
          >
            Criar Conta Grátis
          </Link>
        </div>
      </section>
      </main>

      <footer className="border-t border-border/50 py-8">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <Logo className="h-6" />
            <span>© {new Date().getFullYear()} Azura Capital. Building the Future.</span>
          </div>
          <div className="flex gap-6">
            <Link to="/auth" className="hover:text-primary">Entrar</Link>
            <Link to="/auth" search={{ mode: "signup" }} className="hover:text-primary">Registar</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
