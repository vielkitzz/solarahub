import { formatCurrency } from "@/lib/format";

export type MarketTransferType = "compra" | "emprestimo" | "troca";

export type ForeignResponse = {
  status: "aceita" | "recusada" | "contraproposta";
  mensagem: string;
  valor_sugerido: number;
  salario_sugerido: number;
  luvas_sugeridas: number;
};

export function evaluateForeignProposal(
  player: { market_value: number; salary_demand: number; overall: number; name: string; club_origin?: string },
  proposta: { tipo: MarketTransferType; valor: number; salario: number; luvas: number },
  jogadorTrocado?: { valor_base_calculado: number; name: string } | null,
): ForeignResponse {
  const valorJusto = Number(player.market_value) || 0;
  const salarioJusto = Number(player.salary_demand) || 0;
  const clube = player.club_origin || "O clube";
  const jogadorNome = player.name;

  if (proposta.tipo === "emprestimo") {
    const salRatio = salarioJusto > 0 ? proposta.salario / salarioJusto : 1;
    if (salRatio >= 0.85) {
      return {
        status: "aceita",
        mensagem: `${clube} aceitou o empréstimo de ${jogadorNome}. O salário oferecido é satisfatório e o jogador seguirá emprestado.`,
        valor_sugerido: 0,
        salario_sugerido: proposta.salario,
        luvas_sugeridas: 0,
      };
    }
    if (salRatio >= 0.5) {
      const sugSal = Math.round(salarioJusto * (0.8 + Math.random() * 0.15));
      return {
        status: "contraproposta",
        mensagem: `${clube} está aberto ao empréstimo, mas considera o salário de ${formatCurrency(proposta.salario)} abaixo do adequado para ${jogadorNome}. Pedimos um ajuste.`,
        valor_sugerido: 0,
        salario_sugerido: sugSal,
        luvas_sugeridas: 0,
      };
    }
    return {
      status: "recusada",
      mensagem: `${clube} recusou o empréstimo. O salário oferecido (${formatCurrency(proposta.salario)}/ano) está muito abaixo da demanda de ${jogadorNome} (${formatCurrency(salarioJusto)}/ano).`,
      valor_sugerido: 0,
      salario_sugerido: salarioJusto,
      luvas_sugeridas: 0,
    };
  }

  if (proposta.tipo === "troca") {
    if (!jogadorTrocado) {
      return {
        status: "recusada",
        mensagem: `${clube} espera que você ofereça um jogador na troca por ${jogadorNome}.`,
        valor_sugerido: Math.round(valorJusto * 0.9),
        salario_sugerido: salarioJusto,
        luvas_sugeridas: 0,
      };
    }
    const valorTrocado = Number(jogadorTrocado.valor_base_calculado) || 0;
    const totalOferecido = valorTrocado + proposta.valor;
    const ratio = valorJusto > 0 ? totalOferecido / valorJusto : 0;
    const adjustedRatio = ratio * (0.95 + Math.random() * 0.1);
    if (adjustedRatio >= 0.9) {
      const msgDinheiro = proposta.valor > 0 ? ` + ${formatCurrency(proposta.valor)}` : "";
      return {
        status: "aceita",
        mensagem: `${clube} aceitou a troca! ${jogadorTrocado.name}${msgDinheiro} por ${jogadorNome}. Negócio fechado.`,
        valor_sugerido: proposta.valor,
        salario_sugerido: proposta.salario,
        luvas_sugeridas: 0,
      };
    }
    if (adjustedRatio >= 0.55) {
      const deficit = Math.round(valorJusto - totalOferecido);
      const deficitStr = deficit > 0 ? ` Falta ${formatCurrency(deficit)}.` : "";
      return {
        status: "contraproposta",
        mensagem: `${clube} considera ${jogadorTrocado.name} interessante, mas avalia que o pacote está abaixo do valor de ${jogadorNome} (${formatCurrency(valorJusto)}).${deficitStr}`,
        valor_sugerido: Math.round(deficit * 1.1),
        salario_sugerido: proposta.salario,
        luvas_sugeridas: 0,
      };
    }
    return {
      status: "recusada",
      mensagem: `${clube} recusou a troca. ${jogadorTrocado.name} (${formatCurrency(valorTrocado)}) não tem valor suficiente para ${jogadorNome} (${formatCurrency(valorJusto)}).`,
      valor_sugerido: Math.round(valorJusto - valorTrocado),
      salario_sugerido: salarioJusto,
      luvas_sugeridas: 0,
    };
  }

  // COMPRA
  const valorRatio = valorJusto > 0 ? proposta.valor / valorJusto : 0;
  const salRatio = salarioJusto > 0 ? proposta.salario / salarioJusto : 0;
  const luvasBonus = valorJusto > 0 ? proposta.luvas / valorJusto : 0;
  let score = valorRatio * 0.6 + Math.min(salRatio, 1.2) * 0.3 + Math.min(luvasBonus, 0.3) * 0.1;
  if (player.overall >= 88) score *= 0.82;
  else if (player.overall >= 84) score *= 0.88;
  else if (player.overall >= 80) score *= 0.93;
  else if (player.overall <= 65) score *= 1.05;
  score *= 0.95 + Math.random() * 0.1;

  if (score >= 0.92) {
    const msgs = [
      `${clube} aceitou a proposta por ${jogadorNome}. O valor de ${formatCurrency(proposta.valor)} foi considerado justo.`,
      `Acordo fechado! ${clube} libera ${jogadorNome} por ${formatCurrency(proposta.valor)}.`,
      `${clube} confirmou a venda de ${jogadorNome} por ${formatCurrency(proposta.valor)}.`,
    ];
    return {
      status: "aceita",
      mensagem: msgs[Math.floor(Math.random() * msgs.length)],
      valor_sugerido: proposta.valor,
      salario_sugerido: proposta.salario,
      luvas_sugeridas: proposta.luvas,
    };
  }
  if (score >= 0.55) {
    const gap = 1 - score;
    const multiplicador = 1 + gap * 0.6 + Math.random() * 0.15;
    const valorSugerido = Math.round(valorJusto * multiplicador);
    const salarioSugerido = Math.round(Math.max(proposta.salario, salarioJusto * 0.85));
    const luvasSugeridas = proposta.luvas > 0 ? Math.round(proposta.luvas * 1.1) : Math.round(valorJusto * 0.05);
    const msgs = [
      `${clube} avalia que a proposta por ${jogadorNome} está abaixo do esperado. O valor justo estaria na casa de ${formatCurrency(valorSugerido)}.`,
      `${clube} contrapropõe: ${formatCurrency(valorSugerido)} por ${jogadorNome}.`,
      `Interesse existe, mas ${clube} pede um ajuste. Para ${jogadorNome}, o mínimo seria ${formatCurrency(valorSugerido)}.`,
    ];
    return {
      status: "contraproposta",
      mensagem: msgs[Math.floor(Math.random() * msgs.length)],
      valor_sugerido: Math.min(valorSugerido, Math.round(valorJusto * 1.5)),
      salario_sugerido: salarioSugerido,
      luvas_sugeridas: luvasSugeridas,
    };
  }
  const msgs = [
    `${clube} recusou a proposta. ${formatCurrency(proposta.valor)} por ${jogadorNome} está muito abaixo do valor de mercado (${formatCurrency(valorJusto)}).`,
    `Proposta recusada. ${clube} não considera ${formatCurrency(proposta.valor)} uma oferta séria por ${jogadorNome}.`,
    `${clube} rejeitou a oferta. ${jogadorNome} é peça importante e o valor proposto não atende às expectativas.`,
  ];
  return {
    status: "recusada",
    mensagem: msgs[Math.floor(Math.random() * msgs.length)],
    valor_sugerido: Math.round(valorJusto * 0.9),
    salario_sugerido: salarioJusto,
    luvas_sugeridas: 0,
  };
}
