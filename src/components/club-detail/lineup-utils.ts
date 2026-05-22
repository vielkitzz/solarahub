/**
 * Utilitários compartilhados de escalação.
 * Extraído de LineupManager.tsx para eliminar duplicação.
 */

export interface LineupPlayer {
  id: string;
  name: string;
  position: string;
  secondary_position?: string | null;
  habilidade?: number;
  age?: number;
  nationality?: string;
  shirt_number?: number;
  market_value?: number;
}

export const POS_SECTOR: Record<string, "GK" | "DEF" | "MID" | "ATT"> = {
  GOL: "GK",
  ZAG: "DEF",
  LD: "DEF",
  LE: "DEF",
  VOL: "MID",
  MC: "MID",
  MEI: "MID",
  PD: "ATT",
  PE: "ATT",
  SA: "ATT",
  ATA: "ATT",
};

export const POS_COMPAT: Record<string, string[]> = {
  GOL: ["GOL"],
  ZAG: ["ZAG", "VOL"],
  LD: ["LD", "ZAG", "MC", "MD", "PD"],
  LE: ["LE", "ZAG", "MC", "ME", "PE"],
  VOL: ["VOL", "MC", "ZAG"],
  MC: ["MC", "VOL", "MEI"],
  MEI: ["MEI", "MC", "PE", "PD", "SA"],
  PD: ["PD", "MEI", "ATA"],
  PE: ["PE", "MEI", "ATA"],
  SA: ["SA", "ATA", "PD", "PE", "MEI"],
  ATA: ["ATA", "SA", "PD", "PE"],
};

export const GRID_LABELS: Record<string, string> = {
  "0-1": "ATA",
  "0-2": "ATA",
  "0-3": "ATA",
  "1-0": "PE",
  "1-1": "ATA",
  "1-2": "SA",
  "1-3": "ATA",
  "1-4": "PD",
  "2-0": "PE/LE",
  "2-1": "MEI",
  "2-2": "MEI",
  "2-3": "MEI",
  "2-4": "PD/LD",
  "3-0": "PE/LE",
  "3-1": "MC",
  "3-2": "MEI",
  "3-3": "MC",
  "3-4": "PD/LD",
  "4-0": "LE",
  "4-1": "VOL",
  "4-2": "VOL",
  "4-3": "VOL",
  "4-4": "LD",
  "5-0": "LE",
  "5-1": "ZAG",
  "5-2": "ZAG",
  "5-3": "ZAG",
  "5-4": "LD",
  "6-2": "GOL",
};

export const FORMATIONS: Record<string, Record<string, string>> = {
  "4-4-2": {
    "6-2": "GOL",
    "5-0": "LE",
    "5-1": "ZAG",
    "5-3": "ZAG",
    "5-4": "LD",
    "3-0": "PE",
    "3-1": "MC",
    "3-3": "MC",
    "3-4": "PD",
    "0-1": "ATA",
    "0-3": "ATA",
  },
  "4-3-3": {
    "6-2": "GOL",
    "5-0": "LE",
    "5-1": "ZAG",
    "5-3": "ZAG",
    "5-4": "LD",
    "4-2": "VOL",
    "3-1": "MC",
    "3-3": "MC",
    "1-0": "PE",
    "0-2": "ATA",
    "1-4": "PD",
  },
  "4-2-3-1": {
    "6-2": "GOL",
    "5-0": "LE",
    "5-1": "ZAG",
    "5-3": "ZAG",
    "5-4": "LD",
    "4-1": "VOL",
    "4-3": "VOL",
    "2-0": "PE",
    "2-2": "MEI",
    "2-4": "PD",
    "0-2": "ATA",
  },
  "4-1-2-1-2 (Losango)": {
    "6-2": "GOL",
    "5-0": "LE",
    "5-1": "ZAG",
    "5-3": "ZAG",
    "5-4": "LD",
    "4-2": "VOL",
    "3-1": "MC",
    "3-3": "MC",
    "2-2": "MEI",
    "0-1": "ATA",
    "0-3": "ATA",
  },
  "4-5-1": {
    "6-2": "GOL",
    "5-0": "LE",
    "5-1": "ZAG",
    "5-3": "ZAG",
    "5-4": "LD",
    "4-1": "VOL",
    "4-3": "VOL",
    "3-2": "MC",
    "2-0": "PE",
    "2-4": "PD",
    "0-2": "ATA",
  },
  "3-5-2": {
    "6-2": "GOL",
    "5-1": "ZAG",
    "5-2": "ZAG",
    "5-3": "ZAG",
    "4-0": "LE",
    "4-2": "VOL",
    "4-4": "LD",
    "3-1": "MC",
    "3-3": "MC",
    "0-1": "ATA",
    "0-3": "ATA",
  },
  "3-4-3": {
    "6-2": "GOL",
    "5-1": "ZAG",
    "5-2": "ZAG",
    "5-3": "ZAG",
    "3-0": "LE",
    "4-1": "VOL",
    "4-3": "VOL",
    "3-4": "LD",
    "1-0": "PE",
    "0-2": "ATA",
    "1-4": "PD",
  },
  "3-2-4-1": {
    "6-2": "GOL",
    "5-1": "ZAG",
    "5-2": "ZAG",
    "5-3": "ZAG",
    "4-1": "VOL",
    "4-3": "VOL",
    "2-0": "PE",
    "2-1": "MEI",
    "2-3": "MEI",
    "2-4": "PD",
    "0-2": "ATA",
  },
  "5-4-1": {
    "6-2": "GOL",
    "5-0": "LE",
    "5-1": "ZAG",
    "5-2": "ZAG",
    "5-3": "ZAG",
    "5-4": "LD",
    "3-0": "PE",
    "4-1": "VOL",
    "4-3": "VOL",
    "3-4": "PD",
    "0-2": "ATA",
  },
  "5-3-2": {
    "6-2": "GOL",
    "5-0": "LE",
    "5-1": "ZAG",
    "5-2": "ZAG",
    "5-3": "ZAG",
    "5-4": "LD",
    "4-2": "VOL",
    "3-1": "MC",
    "3-3": "MC",
    "0-1": "ATA",
    "0-3": "ATA",
  },
};

export function getAdaptation(player: LineupPlayer | undefined, cellKey: string, formationRole?: string) {
  if (!player)
    return {
      loss: 0,
      color: "text-emerald-400",
      badge: "bg-emerald-500/20 border-emerald-500/50 text-emerald-400",
      bg: "bg-emerald-500/10",
    };

  const playerPos = (player.position || "").toUpperCase();
  const rawLabel = GRID_LABELS[cellKey] || formationRole || "";
  const targetRoles = Array.from(
    new Set([...rawLabel.split("/").map((r) => r.trim()), formationRole].filter(Boolean) as string[]),
  );

  if (targetRoles.includes(playerPos) || targetRoles.length === 0) {
    return {
      loss: 0,
      color: "text-emerald-400",
      badge: "bg-emerald-500/20 border-emerald-500/50 text-emerald-400",
      bg: "bg-emerald-500/10",
    };
  }

  const playerCompat = POS_COMPAT[playerPos] || [playerPos];
  const isCompatible = targetRoles.some(
    (role) => playerCompat.includes(role) || (POS_COMPAT[role] || []).includes(playerPos),
  );

  if (isCompatible) {
    return {
      loss: 5,
      color: "text-amber-400",
      badge: "bg-amber-500/20 border-amber-500/50 text-amber-400",
      bg: "bg-amber-500/15",
    };
  }

  return {
    loss: 15,
    color: "text-rose-400",
    badge: "bg-rose-500/20 border-rose-500/50 text-rose-400",
    bg: "bg-rose-500/15",
  };
}

// ─── Configurações táticas ───────────────────────────────────────────────────
export const PLAY_STYLES = ["Posse de Bola", "Ligação Direta", "Contra-ataque"] as const;
export type PlayStyle = (typeof PLAY_STYLES)[number];

export const PRESSINGS = ["Alta", "Média", "Baixa"] as const;
export type Pressing = (typeof PRESSINGS)[number];

export const AERIALS = ["Priorizar", "Evitar"] as const;
export type Aerial = (typeof AERIALS)[number];

export const PLAY_STYLE_META: Record<PlayStyle, { color: string; desc: string }> = {
  "Posse de Bola": { color: "text-sky-400", desc: "Controle do jogo, construção paciente" },
  "Ligação Direta": { color: "text-amber-400", desc: "Bolas longas, velocidade na transição" },
  "Contra-ataque": { color: "text-rose-400", desc: "Defesa sólida, explorar espaços" },
};

export const PRESSING_META: Record<Pressing, { color: string; desc: string }> = {
  Alta: { color: "text-rose-400", desc: "Recuperação no campo adversário, gasto físico elevado" },
  Média: { color: "text-amber-400", desc: "Equilíbrio entre pressão e organização" },
  Baixa: { color: "text-sky-400", desc: "Bloco recuado, preservar energia" },
};

export const AERIAL_META: Record<Aerial, { color: string; desc: string }> = {
  Priorizar: { color: "text-amber-400", desc: "Explora cruzamentos e bolas paradas" },
  Evitar: { color: "text-sky-400", desc: "Jogo rasteiro, construção pelo chão" },
};
