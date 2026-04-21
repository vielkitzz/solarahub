export const formatCurrency = (value: number | string) => {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
};

export const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(value || 0);

export const POSITIONS = [
  "GOL", "ZAG", "LD", "LE", "VOL", "MC", "MEI", "PD", "PE", "SA", "ATA",
];
