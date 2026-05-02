// Mapeia posições do JSON exportado (PT-BR completo) para o enum curto usado no banco
const POSITION_MAP: Record<string, string> = {
  goleiro: "GOL",
  zagueiro: "ZAG",
  "lateral direito": "LD",
  "lateral esquerdo": "LE",
  volante: "VOL",
  meia: "MEI",
  "meio campo": "MC",
  "meia central": "MC",
  "meia atacante": "MEI",
  "meia ofensivo": "MEI",
  "ponta direita": "PD",
  "ponta esquerda": "PE",
  centroavante: "ATA",
  atacante: "ATA",
  "segundo atacante": "SA",
};

export const normalizePosition = (pos: string): string => {
  const key = pos?.trim().toLowerCase();
  return POSITION_MAP[key] || pos?.toUpperCase().slice(0, 4) || "ATA";
};

export interface ImportedPlayer {
  name: string;
  position: string;
  age: number | null;
  nationality: string | null;
  market_value: number;
  habilidade: number;
  shirt_number: number | null; // <-- ADICIONAMOS A COLUNA AQUI
  attributes: Record<string, any>;
}

// habilidade 45-99 → valor de mercado estimado (escala linear)
const habilidadeToValue = (habilidade: number): number => {
  const o = Math.max(45, Math.min(99, habilidade || 45));
  return Math.round(o * 100000); // 45=4.5M, 99=9.9M
};

export const parseSquadJson = (raw: string): ImportedPlayer[] => {
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("JSON inválido");
  }
  const players = data?.players;
  if (!Array.isArray(players)) throw new Error("Formato inválido: campo 'players' não encontrado");

  return players.map((p: any) => {
    if (!p?.name) throw new Error("Jogador sem nome");
    const skill = Math.max(45, Math.min(99, Number(p.skill) || 45));
    return {
      name: String(p.name),
      position: normalizePosition(p.position || "ATA"),
      age: p.age ? Number(p.age) : null,
      nationality: p.nationality || null,
      habilidade: skill,
      market_value: habilidadeToValue(skill),
      shirt_number: p.shirtNumber ? Number(p.shirtNumber) : null, // <-- MAPEAMOS O JSON DIRETO PARA A COLUNA AQUI
      attributes: {
        shirtNumber: p.shirtNumber ?? null,
        seasonYear: p.seasonYear ?? null,
        originalPosition: p.position ?? null,
      },
    };
  });
};
