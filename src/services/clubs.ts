/**
 * Service layer: chamadas ao Supabase isoladas dos componentes.
 * Cada função retorna data/throws — ideal para usar com React Query.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Club, ClubUpdate } from "@/types";

export const clubsService = {
  async listAll(): Promise<Club[]> {
    const { data, error } = await supabase.from("clubs").select("*").order("name");
    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<Club | null> {
    const { data, error } = await supabase.from("clubs").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async getByOwner(ownerId: string): Promise<Club[]> {
    const { data, error } = await supabase
      .from("clubs")
      .select("*")
      .eq("owner_id", ownerId)
      .order("name");
    if (error) throw error;
    return data ?? [];
  },

  async update(id: string, patch: ClubUpdate): Promise<void> {
    const { error } = await supabase.from("clubs").update(patch).eq("id", id);
    if (error) throw error;
  },
};
