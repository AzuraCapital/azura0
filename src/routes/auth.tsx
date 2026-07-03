import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User as UserIcon, Phone } from "lucide-react";

type Mode = "signin" | "signup" | "forgot";

const AUTH_URL = "https://azura0.lovable.app/auth";
const AUTH_TITLE = "Entrar ou Criar Conta — Azura Capital";
const AUTH_DESC = "Aceda à sua conta Azura Capital ou registe-se para começar a gerir os seus investimentos, contas bancárias e objetivos financeiros.";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: (s.mode === "signup" || s.mode === "forgot" ? s.mode : "signin") as Mode,
  }),
  head: () => ({
    meta: [
      { title: AUTH_TITLE },
      { name: "description", content: AUTH_DESC },
      { property: "og:title", content: AUTH_TITLE },
      { property: "og:description", content: AUTH_DESC },
      { property: "og:url", content: AUTH_URL },
      { name: "twitter:title", content: AUTH_TITLE },
      { name: "twitter:description", content: AUTH_DESC },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [{ rel: "canonical", href: AUTH_URL }],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app" });
  },
  component: AuthPage,
});

const signupSchema = z.object({
  first_name: z.string().trim().min(1, "Obrigatório").max(50),
  last_name: z.string().trim().min(1, "Obrigatório").max(50),
  identifier: z.string().trim().min(1, "Email ou telefone obrigatório"),
  password: z.string().min(8, "Mínimo 8 caracteres").regex(/[A-Z]/, "Inclua uma maiúscula").regex(/[0-9]/, "Inclua um número"),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, { path: ["confirm"], message: "Passwords não coincidem" });

function isEmail(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function isAngolaPhone(v: string) { return /^(\+?244)?[\s-]?9\d{8}$/.test(v.replace(/\s/g, "")); }

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", identifier: "", password: "", confirm: "" });

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const onSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const id = form.identifier.trim();
      const credentials = isEmail(id)
        ? { email: id, password: form.password }
        : { phone: id.startsWith("+") ? id : `+244${id.replace(/^244/, "")}`, password: form.password };
      const { error } = await supabase.auth.signInWithPassword(credentials);
      if (error) throw error;
      toast.success("Sessão iniciada");
      navigate({ to: "/app" });
    } catch (err: any) {
      toast.error(err.message || "Falha no login");
    } finally { setLoading(false); }
  };

  const onSignUp = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    const id = form.identifier.trim();
    if (!isEmail(id) && !isAngolaPhone(id)) { toast.error("Email ou telefone Angola inválido"); return; }
    setLoading(true);
    try {
      const meta = { first_name: form.first_name, last_name: form.last_name };
      const opts = isEmail(id)
        ? { email: id, password: form.password, options: { data: meta, emailRedirectTo: `${window.location.origin}/app` } }
        : { phone: id.startsWith("+") ? id : `+244${id.replace(/^244/, "")}`, password: form.password, options: { data: meta } };
      const { data, error } = await supabase.auth.signUp(opts as any);
      if (error) throw error;
      if (data.session) {
        toast.success("Conta criada");
        navigate({ to: "/app" });
      } else {
        toast.success("Verifique o seu email para confirmar a conta.");
      }
    } catch (err: any) {
      toast.error(err.message || "Falha no registo");
    } finally { setLoading(false); }
  };

  const onForgot = async (e: FormEvent) => {
    e.preventDefault();
    if (!isEmail(form.identifier)) { toast.error("Indique um email válido"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(form.identifier, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      toast.success("Enviámos um link para o seu email");
    } catch (err: any) {
      toast.error(err.message || "Erro");
    } finally { setLoading(false); }
  };

  const onGoogle = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/app` },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || "Falha Google");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      <header className="mx-auto w-full max-w-7xl flex items-center justify-between px-6 py-6">
        <Link to="/"><Logo className="h-9" /></Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="glass rounded-3xl p-8 md:p-10 w-full max-w-md animate-fade-up">
          <h1 className="text-3xl font-bold mb-2">
            {mode === "signin" ? "Bem-vindo de volta" : mode === "signup" ? "Criar Conta" : "Recuperar Password"}
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            {mode === "signin" ? "Entre na sua conta Azura Capital" : mode === "signup" ? "Comece a gerir o seu património" : "Receba um link no seu email"}
          </p>

          {mode !== "forgot" && (
            <>
              <button
                onClick={onGoogle}
                disabled={loading}
                className="w-full rounded-full border border-border bg-card px-6 py-3 font-medium flex items-center justify-center gap-3 hover:bg-secondary transition mb-4"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
                Continuar com Google
              </button>
              <div className="flex items-center gap-3 my-6">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">ou</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          <form onSubmit={mode === "signin" ? onSignIn : mode === "signup" ? onSignUp : onForgot} className="space-y-3">
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-3">
                <Input icon={UserIcon} placeholder="Primeiro nome" value={form.first_name} onChange={update("first_name")} />
                <Input icon={UserIcon} placeholder="Último nome" value={form.last_name} onChange={update("last_name")} />
              </div>
            )}
            <Input
              icon={mode === "forgot" ? Mail : isAngolaPhone(form.identifier) ? Phone : Mail}
              type="text"
              placeholder={mode === "forgot" ? "Email" : "Email ou +244 9XX XXX XXX"}
              value={form.identifier}
              onChange={update("identifier")}
              required
            />
            {mode !== "forgot" && (
              <Input icon={Lock} type="password" placeholder="Password" value={form.password} onChange={update("password")} required />
            )}
            {mode === "signup" && (
              <Input icon={Lock} type="password" placeholder="Confirmar password" value={form.confirm} onChange={update("confirm")} required />
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full gradient-primary px-6 py-3 font-semibold text-white shadow-lg shadow-primary/25 hover:scale-[1.01] transition disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : mode === "signin" ? "Entrar" : mode === "signup" ? "Criar Conta" : "Enviar link"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            {mode === "signin" && (
              <>
                <Link to="/auth" search={{ mode: "forgot" }} className="text-primary hover:underline">Esqueci a password</Link>
                <p className="mt-3 text-muted-foreground">
                  Sem conta?{" "}
                  <Link to="/auth" search={{ mode: "signup" }} className="text-primary font-medium hover:underline">Criar conta</Link>
                </p>
              </>
            )}
            {mode === "signup" && (
              <p className="text-muted-foreground">
                Já tem conta?{" "}
                <Link to="/auth" search={{ mode: "signin" }} className="text-primary font-medium hover:underline">Entrar</Link>
              </p>
            )}
            {mode === "forgot" && (
              <Link to="/auth" search={{ mode: "signin" }} className="text-primary hover:underline">← Voltar ao login</Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Input({ icon: Icon, ...props }: any) {
  return (
    <div className="relative">
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        {...props}
        className="w-full rounded-full border border-border bg-card pl-11 pr-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
      />
    </div>
  );
}
