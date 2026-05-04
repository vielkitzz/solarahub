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
  const path = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`Potencial de ${starsMin} a ${starsMax} estrelas`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const v = i + 1;
        const isHalfMin = v === Math.ceil(starsMin) && starsMin % 1 >= 0.5;
        const isHalfMax = v === Math.ceil(starsMax) && starsMax % 1 >= 0.5 && !isHalfMin;
        const isFullYellow = v <= Math.floor(starsMin);
        const isFullWhite = !isFullYellow && !isHalfMin && !isHalfMax && v <= Math.floor(starsMax);

        // cor do stroke igual ao fill de cada estado
        const strokeColor = isFullYellow
          ? "var(--color-primary, #f59e0b)"
          : isFullWhite
            ? "rgba(255,255,255,0.8)"
            : "rgba(255,255,255,0.15)";

        return (
          <svg key={i} viewBox="0 0 24 24" style={{ width: size, height: size }} fill="none">
            <defs>
              <clipPath id={`left-${i}`}>
                <rect x="0" y="0" width="12" height="24" />
              </clipPath>
              <clipPath id={`right-${i}`}>
                <rect x="12" y="0" width="12" height="24" />
              </clipPath>
            </defs>

            {/* Fundo apagado com stroke */}
            <path
              d={path}
              fill="currentColor"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1"
              className="text-primary/20"
            />

            {isFullYellow && (
              <path
                d={path}
                fill="currentColor"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="1"
                className="text-primary"
              />
            )}

            {isFullWhite && (
              <path
                d={path}
                fill="currentColor"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="1"
                className="text-foreground/80"
              />
            )}

            {isHalfMin && (
              <>
                <path d={path} clipPath={`url(#left-${i})`} fill="currentColor" className="text-primary" />
                {v <= Math.ceil(starsMax) && (
                  <path d={path} clipPath={`url(#right-${i})`} fill="currentColor" className="text-foreground/80" />
                )}
                <path d={path} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
              </>
            )}

            {isHalfMax && (
              <>
                <path d={path} clipPath={`url(#left-${i})`} fill="currentColor" className="text-foreground/80" />
                <path d={path} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
              </>
            )}
          </svg>
        );
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
