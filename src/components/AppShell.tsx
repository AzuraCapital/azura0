import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
  LayoutDashboard, TrendingUp, Landmark, Target, Receipt, Calendar, Settings, LogOut, History,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth, signOut } from "@/lib/auth";

const nav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/investimentos", label: "Investimentos", icon: TrendingUp },
  { to: "/app/bancos", label: "Bancos", icon: Landmark },
  { to: "/app/objetivos", label: "Objetivos", icon: Target },
  { to: "/app/financas", label: "Finanças Pessoais", icon: Receipt },
  { to: "/app/calendario", label: "Calendário", icon: Calendar },
  { to: "/app/historico", label: "Histórico", icon: History },
  { to: "/app/definicoes", label: "Definições", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: s => s.location.pathname });
  const { user } = useAuth();
  const navigate = useNavigate();

  const isActive = (to: string, exact?: boolean) =>
    exact ? path === to : path === to || path.startsWith(to + "/");

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="relative min-h-dvh">
      {/* Background fixo */}
      <div className="fixed inset-0 -z-10 gradient-hero" aria-hidden />

      {/* Sidebar — apenas desktop */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 bg-sidebar border-r border-sidebar-border flex-col">
        <div className="p-5 border-b border-sidebar-border">
          <Logo className="h-8" />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition ${
                isActive(item.to, (item as any).exact)
                  ? "gradient-primary text-white shadow-md shadow-primary/25"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-sidebar-border space-y-2">
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">{user?.email || user?.phone}</div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-64 pb-20 lg:pb-0">
        <header className="sticky top-0 z-20 flex items-center justify-end px-4 md:px-8 py-4 border-b border-border/50 bg-background/60 backdrop-blur-xl">
          <ThemeToggle />
        </header>
        <main className="px-4 md:px-8 py-6">
          <div className="animate-fade-up">{children}</div>
        </main>
      </div>

      {/* Bottom nav — apenas mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-sidebar border-t border-sidebar-border">
        <div className="flex items-center justify-around px-2 py-2">
          {nav.slice(0, 5).map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl text-xs font-medium transition ${
                isActive(item.to, (item as any).exact)
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
