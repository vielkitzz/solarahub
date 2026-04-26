import { Star, StarHalf } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: number; // 0 a 5 (em meias estrelas)
  className?: string;
  size?: number;
}

/**
 * Exibe estrelas (cheias / meias / vazias) de 0 a 5. Não mostra valor numérico.
 */
export const StarRating = ({ value, className, size = 14 }: Props) => {
  const safe = Math.max(0, Math.min(5, value || 0));
  const full = Math.floor(safe);
  const hasHalf = safe - full >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);

  return (
    <div className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${safe} de 5 estrelas`}>
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f-${i}`} className="text-primary fill-primary" style={{ width: size, height: size }} />
      ))}
      {hasHalf && (
        <span className="relative inline-block" style={{ width: size, height: size }}>
          <Star className="absolute inset-0 text-primary/30" style={{ width: size, height: size }} />
          <StarHalf className="absolute inset-0 text-primary fill-primary" style={{ width: size, height: size }} />
        </span>
      )}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e-${i}`} className="text-primary/25" style={{ width: size, height: size }} />
      ))}
    </div>
  );
};
