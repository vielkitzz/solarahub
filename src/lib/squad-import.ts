// Mapeia posições do JSON exportado (PT-BR completo) para o enum curto usado no banco
const POSITION_MAP: Record<string, string> = {
  "goleiro": "GOL",
  "zagueiro": "ZAG",
  "lateral direito": "LD",
  "lateral esquerdo": "LE",
  "volante": "VOL",
  "meia": "MEI",
  "meio campo": "MC",
  "meio-campo": "MC",
  "meia atacante": "MEI",
  "meia-atacante": "MEI",
  "ponta direita": "PD",
  "ponta esquerda": "PE",
  "centroavante": "ATA",
  "atacante": "ATA",
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
  attributes: Record<string, any>;
}

// rating 1-5 → valor de mercado estimado (curva exponencial)
const ratingToValue = (rating: number): number => {
  const r = Math.max(1, Math.min(5, rating || 1));
  return Math.round(Math.pow(r, 4) * 50000); // 1=50k, 3=4M, 4=12.8M, 5=31M
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
    return {
      name: String(p.name),
      position: normalizePosition(p.position || "ATA"),
      age: p.age ? Number(p.age) : null,
      nationality: p.nationality || null,
      market_value: ratingToValue(Number(p.rating) || 1),
      attributes: {
        shirtNumber: p.shirtNumber ?? null,
        rating: p.rating ?? null,
        seasonYear: p.seasonYear ?? null,
        originalPosition: p.position ?? null,
      },
    };
  });
};
