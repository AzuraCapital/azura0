import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type Theme = "light" | "dark";

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

const STORAGE = "azura-theme";

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", t === "dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE)) as Theme | null;
    if (saved === "light" || saved === "dark") {
      setThemeState(saved);
      applyTheme(saved);
    } else {
      applyTheme("light");
    }
  }, []);

  // Sync from profile after auth
  useEffect(() => {
    const sync = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: prof } = await supabase.from("profiles").select("theme_preference").eq("id", data.user.id).maybeSingle();
      const pref = prof?.theme_preference as Theme | undefined;
      if (pref === "light" || pref === "dark") {
        setThemeState(pref);
        applyTheme(pref);
        localStorage.setItem(STORAGE, pref);
      }
    };
    sync();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") sync();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE, t);
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) supabase.from("profiles").update({ theme_preference: t }).eq("id", data.user.id);
    });
  };

  return <Ctx.Provider value={{ theme, toggle: () => setTheme(theme === "light" ? "dark" : "light"), setTheme }}>{children}</Ctx.Provider>;
}

export const useTheme = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("ThemeProvider missing");
  return c;
};
