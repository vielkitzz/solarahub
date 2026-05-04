import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface InterestEntry {
  id: string;
  player_id: string;
  notes: string | null;
  priority: number;
  created_at: string;
}

export const useInterestList = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<InterestEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("interest_list")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setItems((data as any) || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const has = (playerId: string) => items.some((i) => i.player_id === playerId);

  const toggle = async (playerId: string) => {
    if (!user) {
      toast.error("Faça login para usar a lista de interesses");
      return;
    }
    if (has(playerId)) {
      const entry = items.find((i) => i.player_id === playerId)!;
      const { error } = await supabase.from("interest_list").delete().eq("id", entry.id);
      if (error) return toast.error(error.message);
      setItems((prev) => prev.filter((i) => i.id !== entry.id));
      toast.success("Removido da lista de interesses");
    } else {
      const { data, error } = await supabase
        .from("interest_list")
        .insert({ user_id: user.id, player_id: playerId })
        .select()
        .maybeSingle();
      if (error) return toast.error(error.message);
      if (data) setItems((prev) => [data as any, ...prev]);
      toast.success("Adicionado à lista de interesses");
    }
  };

  const remove = async (playerId: string) => {
    const entry = items.find((i) => i.player_id === playerId);
    if (!entry) return;
    await supabase.from("interest_list").delete().eq("id", entry.id);
    setItems((prev) => prev.filter((i) => i.id !== entry.id));
  };

  return { items, loading, has, toggle, remove, reload: load };
};
