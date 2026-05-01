// Helpers para exibição de potencial via olheiros.

export type ScoutReport = {
  scouter_club_id: string;
  target_player_id: string;
  potential_min_revelado: number;
  potential_max_revelado: number;
  margem_aplicada: number;
};

// Margem por nível da base (1 -> 12, 5 -> 2). Mesma fórmula da função SQL scout_player.
export const margemPorNivelBase = (nivelBase: number | null | undefined): number => {
  const n = Math.max(1, Math.min(5, Number(nivelBase || 1)));
  return Math.max(2, Math.round(12 - (n - 1) * 2.5));
};

// Hash determinístico simples (string -> [0,1)).
const seededRandom = (seed: string): number => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
};

/**
 * Calcula o potencial estimado (pmin, pmax) que o usuário enxerga para um jogador
 * do PRÓPRIO clube — usa o nível da base do clube observador para definir a margem.
 * É determinístico por (player_id + scouter_club_id) para não trocar a cada render.
 */
export const estimarPotencialOwn = (
  player: { id: string; potential_min: number | null; potential_max: number | null },
  scouterClubId: string,
  scouterNivelBase: number,
): { pmin: number; pmax: number; margem: number } | null => {
  if (player.potential_max == null || player.potential_min == null) return null;
  const margem = margemPorNivelBase(scouterNivelBase);
  const r1 = seededRandom(player.id + ":" + scouterClubId + ":min");
  const r2 = seededRandom(player.id + ":" + scouterClubId + ":max");
  const dMin = Math.round(-margem + r1 * (margem * 2 + 1));
  const dMax = Math.round(-margem + r2 * (margem * 2 + 1));
  let pmin = Math.max(45, Math.min(99, player.potential_min + dMin));
  let pmax = Math.max(pmin, Math.min(99, player.potential_max + dMax));
  return { pmin, pmax, margem };
};
