export const formatCurrency = (value: number | string) => {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
};

export const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(value || 0);

export const POSITIONS = [
  "GOL", "ZAG", "LD", "LE", "VOL", "MC", "MEI", "PD", "PE", "SA", "ATA",
];

// Calcula a "exigência" do clube com base no rate
export const exigenciaClube = (rate: number | string | null | undefined): number => {
  const r = Number(rate ?? 2.8);
  return r * 7 + 42;
};

/**
 * Converte habilidade do jogador (45-99) em estrelas (0.5 a 5.0, em meias estrelas)
 * relativas ao nível exigido pelo clube.
 */
export const calcStars = (habilidade: number | null | undefined, rate: number | string | null | undefined): number => {
  if (habilidade == null) return 0;
  const exig = exigenciaClube(rate);
  const diff = habilidade - exig;
  let stars: number;
  if (diff >= 15) stars = 5;
  else if (diff >= 8) stars = 4 + (diff - 8) / 14; // 4.0 a 4.5
  else if (diff >= -7) stars = 3 + (diff + 7) / 28; // 3.0 a 3.5 dentro da margem
  else if (diff >= -14) stars = 2 + (diff + 14) / 14; // 2.0 a 2.5
  else stars = 1 + Math.max(0, (diff + 21) / 14); // 1.0 a 1.5
  // arredonda para meias estrelas
  return Math.max(0.5, Math.min(5, Math.round(stars * 2) / 2));
};
