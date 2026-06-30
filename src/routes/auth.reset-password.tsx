import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({ meta: [{ title: "Nova password — Azura Capital" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) { toast.error("Mínimo 8 caracteres"); return; }
    if (pwd !== confirm) { toast.error("Passwords não coincidem"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      toast.success("Password actualizada");
      navigate({ to: "/app" });
    } catch (err: any) {
      toast.error(err.message || "Erro");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      <header className="mx-auto w-full max-w-7xl flex items-center justify-between px-6 py-6">
        <Logo className="h-9" />
        <ThemeToggle />
      </header>
      <div className="flex-1 flex items-center justify-center px-6 pb-12">
        <form onSubmit={onSubmit} className="glass rounded-3xl p-8 w-full max-w-md animate-fade-up space-y-4">
          <h1 className="text-2xl font-bold">Definir nova password</h1>
          <Field icon={Lock} type="password" placeholder="Nova password" value={pwd} onChange={e => setPwd(e.target.value)} />
          <Field icon={Lock} type="password" placeholder="Confirmar password" value={confirm} onChange={e => setConfirm(e.target.value)} />
          <button disabled={loading} className="w-full rounded-full gradient-primary px-6 py-3 font-semibold text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Atualizar password"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ icon: Icon, ...props }: any) {
  return (
    <div className="relative">
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input {...props} className="w-full rounded-full border border-border bg-card pl-11 pr-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
    </div>
  );
}
