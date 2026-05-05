import { StarRating } from "@/components/StarRating";
import { calcStars } from "@/lib/format";
import { useUserPreferences } from "@/hooks/useUserPreferences";

interface Props {
  /** Habilidade real (45-99) */
  value: number | null | undefined;
  /** Rate do clube de referência para conversão em estrelas */
  rate: number | string | null | undefined;
  /** Força modo (override). Se omitido, usa preferências do usuário. */
  mode?: "stars" | "numeric";
  /** Indica se este display é de potencial (usa show_numeric_potential) ou habilidade. */
  kind?: "skill" | "potential";
  /** Texto numérico custom (ex: "78-85" para faixa de potencial) */
  numericLabel?: string;
}

export const SkillDisplay = ({ value, rate, mode, kind = "skill", numericLabel }: Props) => {
  const { prefs } = useUserPreferences();
  const useNumber =
    mode === "numeric" || (mode === undefined && (kind === "skill" ? prefs.show_numeric_skill : prefs.show_numeric_potential));

  if (value == null && !numericLabel) return <span className="text-muted-foreground">—</span>;

  if (useNumber) {
    return (
      <span className="font-display font-bold tabular-nums text-sm">
        {numericLabel ?? value}
      </span>
    );
  }
  return <StarRating value={calcStars(value ?? 0, rate)} />;
};
