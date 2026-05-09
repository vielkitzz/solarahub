import { supabase } from "@/integrations/supabase/client";
import type { Player, PlayerUpdate } from "@/types";

export const playersService = {
  async listByClub(clubId: string): Promise<Player[]> {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("club_id", clubId)
      .order("habilidade", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<Player | null> {
    const { data, error } = await supabase.from("players").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: PlayerUpdate): Promise<void> {
    const { error } = await supabase.from("players").update(patch).eq("id", id);
    if (error) throw error;
  },

  async listOnSale(): Promise<Player[]> {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("a_venda", true)
      .order("market_value", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
};
