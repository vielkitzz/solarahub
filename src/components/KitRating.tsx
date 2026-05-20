import { useEffect, useState } from "react";
import { Star, StarHalf } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  kitId: string;
  size?: number;
}

interface RatingRow {
  user_id: string;
  rating: number;
}

export const KitRating = ({ kitId, size = 16 }: Props) => {
  const { user } = useAuth();
  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [hover, setHover] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("kit_ratings" as any)
      .select("user_id,rating")
      .eq("kit_id", kitId);
    setRatings(((data as any) || []) as RatingRow[]);
  };

  useEffect(() => {
    load();
  }, [kitId]);

  const myRating = user ? (ratings.find((r) => r.user_id === user.id)?.rating ?? 0) : 0;
  const avg = ratings.length ? ratings.reduce((s, r) => s + Number(r.rating), 0) / ratings.length : 0;
  const display = hover ?? avg;

  const submit = async (value: number) => {
    if (!user) {
      toast.error("Faça login para avaliar.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("kit_ratings" as any)
      .upsert({ kit_id: kitId, user_id: user.id, rating: value }, { onConflict: "kit_id,user_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Avaliação registrada!");
    load();
  };

  return (
    <div className="space-y-1">
      <div className="inline-flex items-center gap-0.5" onMouseLeave={() => setHover(null)} aria-label="Avaliar camisa">
        {[1, 2, 3, 4, 5].map((i) => {
          const fullVal = i;
          const halfVal = i - 0.5;
          const filled = display >= fullVal;
          const half = !filled && display >= halfVal;
          return (
            <span key={i} className="relative inline-block cursor-pointer" style={{ width: size, height: size }}>
              {/* half (left) hit area */}
              <button
                type="button"
                disabled={saving || !user}
                onMouseEnter={() => setHover(halfVal)}
                onClick={() => submit(halfVal)}
                className="absolute left-0 top-0 h-full w-1/2 z-10"
                aria-label={`${halfVal} estrelas`}
              />
              <button
                type="button"
                disabled={saving || !user}
                onMouseEnter={() => setHover(fullVal)}
                onClick={() => submit(fullVal)}
                className="absolute right-0 top-0 h-full w-1/2 z-10"
                aria-label={`${fullVal} estrelas`}
              />
              <Star
                className={cn(
                  "absolute inset-0",
                  filled ? "text-primary fill-primary" : "text-primary/25",
                  // anel sutil na estrela que o usuário votou
                  myRating > 0 && i === Math.ceil(myRating) ? "drop-shadow-[0_0_3px_hsl(var(--primary))]" : "",
                )}
                style={{ width: size, height: size }}
              />
              {half && (
                <StarHalf
                  className="absolute inset-0 text-primary fill-primary"
                  style={{ width: size, height: size }}
                />
              )}
            </span>
          );
        })}
      </div>
      <div className="text-[10px] text-muted-foreground leading-none">
        {ratings.length > 0 ? (
          <>
            <span className="text-foreground font-semibold">{avg.toFixed(1)}</span>
            <span>
              {" "}
              · {ratings.length} {ratings.length === 1 ? "voto" : "votos"}
            </span>
          </>
        ) : (
          <span>Sem avaliações</span>
        )}
      </div>
    </div>
  );
};
