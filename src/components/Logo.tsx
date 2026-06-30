import logoLight from "@/assets/azura-logo-light.png.asset.json";
import logoDark from "@/assets/azura-logo-dark.png.asset.json";
import { useTheme } from "@/lib/theme";

export function Logo({ className = "h-10" }: { className?: string }) {
  const { theme } = useTheme();
  return (
    <img
      src={theme === "dark" ? logoLight.url : logoDark.url}
      alt="Azura Capital"
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}
