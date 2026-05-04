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
        if (v <= Math.floor(starsMin))
          return <Star key={i} className="text-primary fill-primary" style={{ width: size, height: size }} />;
        if (v === Math.ceil(starsMin) && starsMin % 1 >= 0.5)
          return (
            <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
              <Star
                className={
                  v <= Math.ceil(starsMax)
                    ? "absolute inset-0 text-foreground/80 fill-foreground/80"
                    : "absolute inset-0 text-primary/20"
                }
                style={{ width: size, height: size }}
              />
              <svg
                viewBox="0 0 24 24"
                className="absolute inset-0 text-primary fill-primary"
                style={{ width: size, height: size }}
              >
                <defs>
                  <clipPath id={`hp-${i}`}>
                    <rect x="0" y="0" width="12" height="24" />
                  </clipPath>
                </defs>
                <path
                  clipPath={`url(#hp-${i})`}
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                />
              </svg>
            </span>
          );
        if (v <= Math.ceil(starsMax))
          return (
            <Star key={i} className="text-foreground/80 fill-foreground/80" style={{ width: size, height: size }} />
          );
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
