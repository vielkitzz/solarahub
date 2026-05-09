/**
 * Tipos centralizados do domínio.
 * Origem: tabelas geradas em src/integrations/supabase/types.ts
 *
 * Use estes aliases em vez de `any[]` espalhado pelos componentes.
 */
import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];

// ───── Linhas (SELECT) ─────
export type Club = T["clubs"]["Row"];
export type Player = T["players"]["Row"];
export type AcademyPlayer = T["academy_players"]["Row"];
export type Transferencia = T["transferencias"]["Row"];
export type Transaction = T["transactions"]["Row"];
export type ContratoClube = T["contratos_clube"]["Row"];
export type Empresa = T["empresas"]["Row"];
export type ExternalClub = T["external_clubs"]["Row"];
export type ExternalProposal = T["external_proposals"]["Row"];
export type ForeignMarketPlayer = T["foreign_market_players"]["Row"];
export type FreeAgent = T["free_agents"]["Row"];
export type InterestList = T["interest_list"]["Row"];
export type Loan = T["loans"]["Row"];
export type Notification = T["notifications"]["Row"];
export type ScoutReport = T["scout_reports"]["Row"];
export type Setting = T["settings"]["Row"];
export type Campanha = T["campanhas"]["Row"];
export type ResultadoTemporada = T["resultados_temporada"]["Row"];
export type PremiacaoTorneio = T["premiacoes_torneio"]["Row"];
export type UserPreference = T["user_preferences"]["Row"];
export type UserRole = T["user_roles"]["Row"];

// ───── Inserts / Updates ─────
export type ClubInsert = T["clubs"]["Insert"];
export type ClubUpdate = T["clubs"]["Update"];
export type PlayerInsert = T["players"]["Insert"];
export type PlayerUpdate = T["players"]["Update"];
export type TransferenciaInsert = T["transferencias"]["Insert"];
export type TransactionInsert = T["transactions"]["Insert"];

// ───── Enums ─────
export type AppRole = Database["public"]["Enums"]["app_role"];
export type TransferStatus = Database["public"]["Enums"]["transfer_status"];
export type TransferType = Database["public"]["Enums"]["transfer_type"];
export type ExternalProposalStatus = Database["public"]["Enums"]["external_proposal_status"];
export type ExternalRegion = Database["public"]["Enums"]["external_region"];
export type ExternalBudgetTier = Database["public"]["Enums"]["external_budget_tier"];
export type ClubStatus = Database["public"]["Enums"]["club_status"];

// ───── Tipos compostos / view-models ─────
export type PlayerWithClub = Player & { clubs?: Pick<Club, "id" | "name" | "crest_url"> | null };
export type TransferenciaWithRefs = Transferencia & {
  player?: Pick<Player, "id" | "name" | "position"> | null;
  comprador?: Pick<Club, "id" | "name" | "crest_url"> | null;
  vendedor?: Pick<Club, "id" | "name" | "crest_url"> | null;
};

// ───── Posições ─────
export type Posicao = "GOL" | "ZAG" | "LAT" | "VOL" | "MEI" | "ATA";
export const POS_ORDER: Record<Posicao, number> = {
  GOL: 0,
  ZAG: 1,
  LAT: 2,
  VOL: 3,
  MEI: 4,
  ATA: 5,
};
