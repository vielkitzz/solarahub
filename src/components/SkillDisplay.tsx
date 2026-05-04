import { Star } from "lucide-react";
import { StarRating } from "@/components/StarRating";
import { calcStars } from "@/lib/format";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { cn } from "@/lib/utils";

// ── Range inline ──────────────────────────────────────────────────────────────
const StarRatingRange = ({
  min,
  max,
  rate,
  size = 14,
}: {
  min: number;
  max: number;
  rate: number | string | null | undefined;
  size?: number;
}) => {
  const starsMin = calcStars(min, rate);
  const starsMax = calcStars(max, rate);

  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`Potencial de ${starsMin} a ${starsMax} estrelas`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const v = i + 1;

        // 1. Amarela cheia (dentro do mínimo)
        if (v <= Math.floor(starsMin))
          return <Star key={i} className="text-primary fill-primary" style={{ width: size, height: size }} />;

        // 2. Meia amarela (borda do mínimo)
        if (v === Math.ceil(starsMin) && starsMin % 1 >= 0.5) {
          const isWhiteBg = v <= Math.ceil(starsMax);
          return (
            <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
              {/* Fundo (direita) */}
              <Star
                className={isWhiteBg ? "text-foreground fill-foreground" : "text-primary/20"}
                style={{ width: size, height: size }}
              />
              {/* Frente (esquerda amarela) cortada ao meio com CSS */}
              <div className="absolute inset-0" style={{ clipPath: "inset(0 50% 0 0)" }}>
                <Star className="text-primary fill-primary" style={{ width: size, height: size }} />
              </div>
            </span>
          );
        }

        // 3. Meia branca (borda do máximo)
        if (v === Math.ceil(starsMax) && starsMax % 1 >= 0.5) {
          return (
            <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
              {/* Fundo (direita) apagado */}
              <Star className="text-primary/20" style={{ width: size, height: size }} />
              {/* Frente (esquerda branca) cortada ao meio com CSS */}
              <div className="absolute inset-0" style={{ clipPath: "inset(0 50% 0 0)" }}>
                <Star className="text-foreground fill-foreground" style={{ width: size, height: size }} />
              </div>
            </span>
          );
        }

        // 4. Branca cheia (entre mínimo e máximo)
        if (v <= Math.floor(starsMax))
          return <Star key={i} className="text-foreground fill-foreground" style={{ width: size, height: size }} />;

        // 5. Apagada (fora do máximo)
        return <Star key={i} className="text-primary/20" style={{ width: size, height: size }} />;
      })}
    </div>
  );
};

// ── SkillDisplay ──────────────────────────────────────────────────────────────
interface Props {
  value: number | null | undefined;
  rate: number | string | null | undefined;
  mode?: "stars" | "numeric";
  kind?: "skill" | "potential";
  numericLabel?: string;
  valueMin?: number;
}

export const SkillDisplay = ({ value, rate, mode, kind = "skill", numericLabel, valueMin }: Props) => {
  const { prefs } = useUserPreferences();
  const useNumber =
    mode === "numeric" ||
    (mode === undefined && (kind === "skill" ? prefs.show_numeric_skill : prefs.show_numeric_potential));

  if (value == null && !numericLabel) return <span className="text-muted-foreground">—</span>;

  if (useNumber) return <span className="font-display font-bold tabular-nums text-sm">{numericLabel ?? value}</span>;

  if (kind === "potential" && valueMin != null) return <StarRatingRange min={valueMin} max={value ?? 0} rate={rate} />;

  return <StarRating value={calcStars(value ?? 0, rate)} />;
};
