import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, signOut } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { PageHeader, GhostButton, Field, TextInput, PrimaryButton } from "@/components/ui-kit";
import { Moon, Sun, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/definicoes")({
  head: () => ({ meta: [{ title: "Definições — Azura Capital" }] }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });

  useEffect(() => {
    if (profile) {
      setFirstName((profile as any).first_name ?? "");
      setLastName((profile as any).last_name ?? "");
    }
  }, [profile]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ first_name: firstName, last_name: lastName } as never).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Perfil atualizado");
  };

  const handleSignOut = async () => { await signOut(); navigate({ to: "/" }); };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader title="Definições" subtitle="Conta e preferências" />

      <div className="glass rounded-3xl p-6 space-y-4">
        <h2 className="font-semibold">Perfil</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Primeiro nome"><TextInput value={firstName} onChange={e => setFirstName(e.target.value)} /></Field>
          <Field label="Último nome"><TextInput value={lastName} onChange={e => setLastName(e.target.value)} /></Field>
        </div>
        <Field label="Email"><TextInput value={user?.email ?? ""} disabled /></Field>
        {user?.phone && <Field label="Telefone"><TextInput value={user.phone} disabled /></Field>}
        <PrimaryButton onClick={save} disabled={saving}>Guardar</PrimaryButton>
      </div>

      <div className="glass rounded-3xl p-6 space-y-4">
        <h2 className="font-semibold">Aparência</h2>
        <div className="flex gap-2">
          <button onClick={() => setTheme("light")} className={`flex-1 rounded-2xl p-4 border ${theme === "light" ? "border-primary bg-primary/5" : "border-border"}`}>
            <Sun className="h-5 w-5 mx-auto mb-2" /> <div className="text-sm">Claro</div>
          </button>
          <button onClick={() => setTheme("dark")} className={`flex-1 rounded-2xl p-4 border ${theme === "dark" ? "border-primary bg-primary/5" : "border-border"}`}>
            <Moon className="h-5 w-5 mx-auto mb-2" /> <div className="text-sm">Escuro</div>
          </button>
        </div>
      </div>

      <div className="glass rounded-3xl p-6">
        <GhostButton onClick={handleSignOut}><LogOut className="h-4 w-4 inline mr-2" />Terminar sessão</GhostButton>
      </div>
    </div>
  );
}
