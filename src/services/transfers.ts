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

  async getStats(clubId: string): Promise<{ total_compras: number; total_vendas: number; total_estrangeiros: number }> {
    const { data, error } = await supabase.rpc("get_transfer_stats" as never, { _club_id: clubId } as never);
    if (error) throw error;
    const row = Array.isArray(data) ? (data as any[])[0] : data;
    return {
      total_compras: Number((row as any)?.total_compras ?? 0),
      total_vendas: Number((row as any)?.total_vendas ?? 0),
      total_estrangeiros: Number((row as any)?.total_estrangeiros ?? 0),
    };
  },

  async setTransferBan(clubId: string, banned: boolean) {
    const { error } = await supabase.from("clubs").update({ transfer_ban: banned } as any).eq("id", clubId);
    if (error) throw error;
  },
};
