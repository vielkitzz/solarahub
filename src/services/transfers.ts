import { supabase } from "@/integrations/supabase/client";
import type { Transferencia } from "@/types";

export const transfersService = {
  async listSent(clubId: string): Promise<Transferencia[]> {
    const { data, error } = await supabase
      .from("transferencias")
      .select("*")
      .eq("clube_comprador_id", clubId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async listReceived(clubId: string): Promise<Transferencia[]> {
    const { data, error } = await supabase
      .from("transferencias")
      .select("*")
      .eq("clube_vendedor_id", clubId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async accept(transferId: string) {
    const { error } = await supabase.rpc("accept_transfer" as never, { _transfer_id: transferId } as never);
    if (error) throw error;
  },

  async reject(transferId: string) {
    const { error } = await supabase
      .from("transferencias")
      .update({ status: "recusada" })
      .eq("id", transferId);
    if (error) throw error;
  },
};
