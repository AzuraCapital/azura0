import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  Landmark,
  Target,
  Receipt,
  Calendar,
  Settings,
  LogOut,
  History,
  Menu,
  X,
  Vault,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth, signOut } from "@/lib/auth";

const nav = [
  { to: "/app", label: "Património", icon: LayoutDashboard, exact: true },
  { to: "/app/investimentos", label: "Investimentos", icon: TrendingUp },
  { to: "/app/bancos", label: "Bancos", icon: Landmark },
  { to: "/app/custodia", label: "Conta Custódia", icon: Vault },
  { to: "/app/objetivos", label: "Objetivos", icon: Target },
  { to: "/app/financas", label: "Finanças Pessoais", icon: Receipt },
  { to: "/app/calendario", label: "Calendário Financeiro", icon: Calendar },
  { to: "/app/historico", label: "Histórico Financeiro", icon: History },
  { to: "/app/definicoes", label: "Definições", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (to: string, exact?: boolean) =>
    exact ? path === to : path === to || path.startsWith(to + "/");

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="relative min-h-dvh">
      <div className="fixed inset-0 -z-10 gradient-hero" aria-hidden />

      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 bg-sidebar border-r border-sidebar-border flex-col">
        <div className="p-5 border-b border-sidebar-border">
          <Logo className="h-8" />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map((item) => (
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
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">
            {user?.email || user?.phone}
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col lg:hidden">
            <div className="flex items-center justify-between p-5 border-b border-sidebar-border">
              <Logo className="h-8" />
              <button onClick={() => setMobileOpen(false)} className="p-2 rounded-lg hover:bg-sidebar-accent">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {nav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
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
              <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition">
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </aside>
        </>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-8 py-3 border-b border-border/50 bg-background/60 backdrop-blur-xl">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-accent">
            <Menu className="h-6 w-6" />
          </button>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <main className="px-4 md:px-8 py-6">
          <div className="animate-fade-up">{children}</div>
        </main>
      </div>
    </div>
  );
}
