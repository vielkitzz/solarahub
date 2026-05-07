import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users,
  Search,
  Tag,
  ArrowRightLeft,
  Inbox,
  Send,
  AlertTriangle,
  LogIn,
  MessageSquare,
  History,
  Radio,
  CheckCircle2,
  XCircle,
  Clock,
  Heart,
  Globe2,
  UserMinus,
} from "lucide-react";
import { formatCurrency, POSITIONS, calcStars } from "@/lib/format";
import { getFlagUrl } from "@/lib/countries";
import { StarRating } from "@/components/StarRating";
import { PlayerProfileDialog } from "@/components/PlayerProfileDialog";
import { useInterestList } from "@/hooks/useInterestList";
import { toast } from "sonner";

type TransferType = "compra" | "emprestimo" | "troca";

// ─── IA DE NEGOCIAÇÃO ESTRANGEIRA ────────────────────────────────────────────

type ForeignResponse = {
  status: "aceita" | "recusada" | "contraproposta";
  mensagem: string;
  valor_sugerido: number;
  salario_sugerido: number;
  luvas_sugeridas: number;
};

function evaluateForeignProposal(
  player: { market_value: number; salary_demand: number; overall: number; name: string; club_origin?: string },
  proposta: { tipo: TransferType; valor: number; salario: number; luvas: number },
  jogadorTrocado?: { valor_base_calculado: number; name: string } | null,
): ForeignResponse {
  const valorJusto = Number(player.market_value) || 0;
  const salarioJusto = Number(player.salary_demand) || 0;
  const clube = player.club_origin || "O clube";
  const jogadorNome = player.name;

  // ── EMPRÉSTIMO: foco principal é salário ──
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
      mensagem: `${clube} recusou o empréstimo. O salário oferecido (${formatCurrency(proposta.salario)}/ano) está muito abaixo da demanda de ${jogadorNome} (${formatCurrency(salarioJusto)}/ano). Negociação encerrada por agora.`,
      valor_sugerido: 0,
      salario_sugerido: salarioJusto,
      luvas_sugeridas: 0,
    };
  }

  // ── TROCA: avalia valor do jogador + dinheiro ──
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

    // Variação aleatória sutil
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
        mensagem: `${clube} considera ${jogadorTrocado.name} interessante, mas avalia que o pacote está abaixo do valor de ${jogadorNome} (${formatCurrency(valorJusto)}).${deficitStr} Considere incluir mais dinheiro ou oferecer um jogador de maior valor.`,
        valor_sugerido: Math.round(deficit * 1.1),
        salario_sugerido: proposta.salario,
        luvas_sugeridas: 0,
      };
    }

    return {
      status: "recusada",
      mensagem: `${clube} recusou a troca. ${jogadorTrocado.name} (${formatCurrency(valorTrocado)}) não tem valor suficiente para ${jogadorNome} (${formatCurrency(valorJusto)}). Ofereça um jogador melhor ou inclua dinheiro.`,
      valor_sugerido: Math.round(valorJusto - valorTrocado),
      salario_sugerido: salarioJusto,
      luvas_sugeridas: 0,
    };
  }

  // ── COMPRA: avaliação composta ──
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
      `${clube} confirmou a venda de ${jogadorNome} por ${formatCurrency(proposta.valor)}. Negociação concluída.`,
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
      `${clube} contrapropõe: ${formatCurrency(valorSugerido)} por ${jogadorNome}. O valor ofertado (${formatCurrency(proposta.valor)}) não reflete o potencial do jogador.`,
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

const Market = () => {
  const { user, loading, signInWithDiscord } = useAuth();
  const [players, setPlayers] = useState<any[]>([]);
  const [clubs, setClubs] = useState<Record<string, any>>({});
  const [myClubs, setMyClubs] = useState<any[]>([]);
  const [activeClubId, setActiveClubId] = useState<string>("");
  const [proposals, setProposals] = useState<any[]>([]);
  const [seasonTransfers, setSeasonTransfers] = useState<any[]>([]);
  const [rumores, setRumores] = useState<any[]>([]);
  const [temporadaAtual, setTemporadaAtual] = useState<number>(new Date().getFullYear());

  // filtros
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<string>("all");
  const [onlyForSale, setOnlyForSale] = useState(false);

  // proposta modal
  const [target, setTarget] = useState<any>(null);
  const [tipo, setTipo] = useState<TransferType>("compra");
  const [valor, setValor] = useState("");
  const [salario, setSalario] = useState("");
  const [luvas, setLuvas] = useState("");
  const [duracao, setDuracao] = useState("1");
  const [jogadorTrocado, setJogadorTrocado] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // resposta da IA estrangeira
  const [foreignResponse, setForeignResponse] = useState<ForeignResponse | null>(null);
  const [foreignLoading, setForeignLoading] = useState(false);

  // contraproposta modal
  const [counterTarget, setCounterTarget] = useState<any>(null);
  const [cValor, setCValor] = useState("");
  const [cSalario, setCSalario] = useState("");
  const [cLuvas, setCLuvas] = useState("");

  // perfil do jogador
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const { items: interestItems, has: inInterest, toggle: toggleInterest } = useInterestList();

  useEffect(() => {
    document.title = "Mercado — Solara Hub";
  }, []);

  const loadAll = async () => {
    const [{ data: cs }, { data: ps }] = await Promise.all([
      supabase.from("clubs").select("id, name, crest_url, owner_id, rate").order("name"),
      supabase.from("players").select("*"),
    ]);
    const map: Record<string, any> = {};
    (cs || []).forEach((c) => {
      map[c.id] = c;
    });
    setClubs(map);
    setPlayers(ps || []);
  };

  const loadMine = async () => {
    if (!user) return;
    const { data } = await supabase.from("clubs").select("*").eq("owner_id", user.id);
    setMyClubs(data || []);
    if (data && data.length && !activeClubId) setActiveClubId(data[0].id);
  };

  const loadProposals = async () => {
    if (!activeClubId) {
      setProposals([]);
      return;
    }
    const { data } = await supabase
      .from("transferencias")
      .select("*")
      .or(`clube_vendedor_id.eq.${activeClubId},clube_comprador_id.eq.${activeClubId}`)
      .order("created_at", { ascending: false });
    setProposals(data || []);
  };

  const loadSeasonAndRumors = async () => {
    const { data: cfg } = await supabase.from("settings").select("value").eq("key", "temporada_atual").maybeSingle();
    const temp = Number((cfg?.value as any)?.ano) || new Date().getFullYear();
    setTemporadaAtual(temp);

    const { data: tx } = await supabase
      .from("transactions")
      .select("*")
      .eq("categoria", "transferencia")
      .eq("tipo", "entrada")
      .eq("temporada", temp)
      .order("created_at", { ascending: false })
      .limit(200);
    setSeasonTransfers(tx || []);

    const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const { data: rs } = await supabase
      .from("transferencias")
      .select("*")
      .or(`status.eq.pendente,and(status.in.(aceita,recusada,contraproposta),created_at.gte.${since})`)
      .order("created_at", { ascending: false })
      .limit(150);
    setRumores(rs || []);
  };

  useEffect(() => {
    loadAll();
    loadSeasonAndRumors();
  }, []);
  useEffect(() => {
    loadMine();
  }, [user]);
  useEffect(() => {
    loadProposals();
  }, [activeClubId]);

  const filteredNegociar = useMemo(() => {
    return players
      .filter((p) => p.club_id && p.club_id !== activeClubId)
      .filter((p) => !onlyForSale || p.a_venda)
      .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
      .filter((p) => pos === "all" || p.position === pos)
      .sort((a, b) => {
        if (a.a_venda !== b.a_venda) return a.a_venda ? -1 : 1;
        return Number(b.valor_base_calculado || 0) - Number(a.valor_base_calculado || 0);
      });
  }, [players, activeClubId, q, pos, onlyForSale]);

  const myPlayers = useMemo(() => players.filter((p) => p.club_id === activeClubId), [players, activeClubId]);

  const openProposal = async (player: any) => {
    // Jogadores externos (mercado estrangeiro / passes livres sem DB id real)
    // podem não ter valor_base_calculado — usamos market_value como fallback.
    const base = Number(player.valor_base_calculado) || Number(player.market_value) || 0;
    const enriched = { ...player, valor_base_calculado: base };
    setTarget(enriched);
    setTipo("compra");
    setValor(String(Math.round(base)));
    let sugerido = Math.round(base * 0.1);
    // Só consulta a RPC se for um jogador real na tabela players
    if (base > 0 && !player._isForeign && !player._isFreeAgent) {
      try {
        const { data } = await supabase.rpc("sugerir_salario_jogador", { _jogador_id: player.id });
        if (data) sugerido = Math.round(Number(data));
      } catch {}
    }
    setSalario(String(Math.max(50000, sugerido)));
    setLuvas("0");
    setDuracao("1");
    setJogadorTrocado("");
  };

  const fairPlayCheck = (v: number, base: number) => {
    if (!base) return "Jogador sem valor base";
    if (v < base * 0.5) return `Mínimo permitido: ${formatCurrency(base * 0.5)} (50%)`;
    if (v > base * 3.0) return `Máximo permitido: ${formatCurrency(base * 3.0)} (300%)`;
    return null;
  };

  const activeClub = myClubs.find((c) => c.id === activeClubId);
  const caixaComprador = Number(activeClub?.budget || 0);
  const valorNum = parseFloat(valor) || 0;
  const luvasNum = parseFloat(luvas) || 0;
  const totalDevido = valorNum + luvasNum;

  const fpError = target && tipo === "compra" ? fairPlayCheck(valorNum, Number(target.valor_base_calculado)) : null;
  const caixaError =
    target && tipo !== "emprestimo" && totalDevido > caixaComprador
      ? `Caixa insuficiente: necessário ${formatCurrency(totalDevido)}, disponível ${formatCurrency(caixaComprador)}`
      : null;
  const trocaError = tipo === "troca" && !jogadorTrocado ? "Selecione um jogador para oferecer na troca" : null;

  const submit = async () => {
    if (!target || !activeClubId || !user) return;
    if (fpError) return toast.error(fpError);
    if (caixaError) return toast.error(caixaError);
    if (trocaError) return toast.error(trocaError);
    if (!salario || parseFloat(salario) < 0) return toast.error("Salário inválido");
    setSubmitting(true);

    const isForeign = !!target._isForeign;
    const isDirect = isForeign || target._isFreeAgent || !target.club_id;

    if (isForeign) {
      // ── MERCADO ESTRANGEIRO: IA avalia antes de contratar ──
      setForeignLoading(true);

      // Simula "tempo de resposta" do clube estrangeiro (1-2s)
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));

      // Busca dados do jogador trocado (se for troca)
      const trocado = tipo === "troca" && jogadorTrocado ? players.find((p) => p.id === jogadorTrocado) : null;

      const response = evaluateForeignProposal(
        {
          market_value: Number(target.market_value) || Number(target.valor_base_calculado) || 0,
          salary_demand: Number((target as any).salary_demand) || 0,
          overall: Number((target as any).overall) || 70,
          name: target.name,
          club_origin: (target as any).club_origin,
        },
        { tipo, valor: valorNum, salario: parseFloat(salario) || 0, luvas: luvasNum },
        trocado ? { valor_base_calculado: Number(trocado.valor_base_calculado), name: trocado.name } : null,
      );

      // Anexa dados do jogador para poder reabrir dialog se necessário
      (response as any)._playerId = target.id;
      (response as any)._playerName = target.name;
      (response as any)._playerPosition = target.position;
      (response as any)._playerAge = target.age;
      (response as any)._playerNationality = target.nationality;
      (response as any)._playerMarketValue = Number(target.market_value) || Number(target.valor_base_calculado) || 0;
      (response as any)._playerClubOrigin = (target as any).club_origin;
      (response as any)._playerSalaryDemand = Number((target as any).salary_demand) || 0;
      (response as any)._playerOverall = Number((target as any).overall) || 70;

      // Anexa dados do jogador trocado (se houver) para processar a troca depois
      if (trocado) {
        (response as any)._trocadoId = trocado.id;
        (response as any)._trocadoName = trocado.name;
        (response as any)._trocadoValor = Number(trocado.valor_base_calculado);
      }

      setForeignLoading(false);
      setForeignResponse(response);
      setTarget(null);
      return;
    }

    if (isDirect) {
      // ── PASSES LIVRES: contratação direta (sem negociação) ──
      const { error } = await supabase.rpc("contratar_jogador_direto" as any, {
        _clube_id: activeClubId,
        _jogador_id: target.id,
        _salario: parseFloat(salario),
        _luvas: luvasNum,
        _valor: valorNum,
        _tipo: "livre",
        _user_id: user.id,
      });
      setSubmitting(false);
      if (error) return toast.error(error.message);
      toast.success("Contratação realizada!");
      setTarget(null);
      await Promise.all([loadAll(), loadProposals(), loadSeasonAndRumors()]);
      return;
    }

    const payload: any = {
      jogador_id: target.id,
      clube_comprador_id: activeClubId,
      clube_vendedor_id: target.club_id,
      valor_ofertado: tipo === "emprestimo" ? 0 : valorNum,
      salario_ofertado: parseFloat(salario),
      luvas: tipo === "compra" ? luvasNum : 0,
      tipo,
      created_by: user.id,
    };
    if (tipo === "troca") payload.jogador_trocado_id = jogadorTrocado;
    if (tipo === "emprestimo") payload.duracao_emprestimo = parseInt(duracao) || 1;

    const { error } = await supabase.from("transferencias").insert(payload);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Proposta enviada!");
    setTarget(null);
    loadProposals();
    loadSeasonAndRumors();
  };

  const respond = async (id: string, accept: boolean) => {
    if (accept) {
      const { error } = await supabase.rpc("accept_transfer", { _transfer_id: id });
      if (error) return toast.error(error.message);
      toast.success("Proposta aceita — aguardando confirmação do comprador");
    } else {
      const { error } = await supabase.from("transferencias").update({ status: "recusada" }).eq("id", id);
      if (error) return toast.error(error.message);
      toast.success("Proposta recusada");
    }
    await Promise.all([loadAll(), loadProposals(), loadSeasonAndRumors()]);
  };

  const confirmar = async (id: string) => {
    const { error } = await supabase.rpc("confirmar_contratacao" as any, { _transfer_id: id });
    if (error) return toast.error(error.message);
    toast.success("Contratação confirmada!");
    await Promise.all([loadAll(), loadProposals(), loadSeasonAndRumors()]);
  };

  const cancelarConf = async (id: string) => {
    const { error } = await supabase.rpc("cancelar_contratacao" as any, { _transfer_id: id });
    if (error) return toast.error(error.message);
    toast.success("Contratação cancelada");
    await Promise.all([loadAll(), loadProposals(), loadSeasonAndRumors()]);
  };

  const removerProposta = async (id: string) => {
    if (!confirm("Remover esta proposta?")) return;
    const { error } = await supabase.rpc("remover_proposta" as any, { _transfer_id: id });
    if (error) return toast.error(error.message);
    toast.success("Proposta removida");
    await Promise.all([loadProposals(), loadSeasonAndRumors()]);
  };

  const openCounter = (proposal: any) => {
    setCounterTarget(proposal);
    setCValor(String(Math.round(Number(proposal.valor_ofertado || 0))));
    setCSalario(String(Math.round(Number(proposal.salario_ofertado || 0))));
    setCLuvas(String(Math.round(Number(proposal.luvas || 0))));
  };

  const sendCounter = async () => {
    if (!counterTarget) return;
    const { error } = await supabase.rpc("criar_contraproposta", {
      _proposta_id: counterTarget.id,
      _valor: parseFloat(cValor) || 0,
      _salario: parseFloat(cSalario) || 0,
      _luvas: parseFloat(cLuvas) || 0,
    });
    if (error) return toast.error(error.message);
    toast.success("Contraproposta enviada!");
    setCounterTarget(null);
    loadProposals();
    loadSeasonAndRumors();
  };

  const inbox = useMemo(() => {
    return proposals.filter((p) => {
      if (!["pendente", "aguardando_confirmacao"].includes(p.status)) return false;
      const isCounter = !!p.proposta_pai_id;
      if (p.status === "aguardando_confirmacao") {
        return p.clube_comprador_id === activeClubId;
      }
      if (isCounter) {
        if (p.created_by && user && p.created_by === user.id) return false;
        return p.clube_vendedor_id === activeClubId || p.clube_comprador_id === activeClubId;
      }
      return p.clube_vendedor_id === activeClubId;
    });
  }, [proposals, activeClubId, user]);

  const sent = useMemo(() => {
    return proposals.filter((p) => {
      const isCounter = !!p.proposta_pai_id;
      if (isCounter) return user && p.created_by === user.id;
      return p.clube_comprador_id === activeClubId;
    });
  }, [proposals, activeClubId, user]);

  const playerById = (id: string) => players.find((p) => p.id === id);
  const tipoLabel = (t: TransferType) => (t === "compra" ? "Compra" : t === "emprestimo" ? "Empréstimo" : "Troca");

  // Busca ou cria clube estrangeiro e move jogador trocado pra lá
  const movePlayerToForeignClub = async (playerId: string, clubOrigin: string) => {
    if (!clubOrigin) return;

    // Busca clube estrangeiro pelo nome
    const { data: existingClub } = await supabase
      .from("external_clubs")
      .select("id")
      .eq("name", clubOrigin)
      .maybeSingle();

    let externalClubId = existingClub?.id;

    // Se não existe, cria um
    if (!externalClubId) {
      const { data: newClub } = await supabase
        .from("external_clubs")
        .insert({ name: clubOrigin, active: true } as any)
        .select("id")
        .single();
      externalClubId = newClub?.id;
    }

    if (!externalClubId) return;

    // Move o jogador: remove do elenco, vincula ao clube estrangeiro
    await supabase
      .from("players")
      .update({
        club_id: null,
        external_club_id: externalClubId,
        a_venda: false,
      })
      .eq("id", playerId);
  };

  // Aceitar contraproposta da IA estrangeira
  const acceptForeignCounter = async () => {
    if (!foreignResponse || !activeClubId || !user) return;
    setForeignLoading(true);

    const { error } = await supabase.rpc("contratar_jogador_direto" as any, {
      _clube_id: activeClubId,
      _jogador_id: (foreignResponse as any)._playerId,
      _salario: foreignResponse.salario_sugerido,
      _luvas: foreignResponse.luvas_sugeridas,
      _valor: foreignResponse.valor_sugerido,
      _tipo: "estrangeiro",
      _user_id: user.id,
    });

    if (error) {
      setForeignLoading(false);
      return toast.error(error.message);
    }

    // Se foi troca, move o jogador trocado pro clube estrangeiro
    if ((foreignResponse as any)._trocadoId) {
      await movePlayerToForeignClub((foreignResponse as any)._trocadoId, (foreignResponse as any)._playerClubOrigin);
    }

    setForeignLoading(false);
    toast.success("Contratação realizada!");
    setForeignResponse(null);
    await Promise.all([loadAll(), loadProposals(), loadSeasonAndRumors()]);
  };

  // Tentar novamente com novos valores (abre o dialog de proposta de novo)
  const retryForeignNegotiation = () => {
    if (!foreignResponse) return;
    const enriched = {
      id: (foreignResponse as any)._playerId,
      name: (foreignResponse as any)._playerName,
      position: (foreignResponse as any)._playerPosition,
      age: (foreignResponse as any)._playerAge,
      nationality: (foreignResponse as any)._playerNationality,
      valor_base_calculado: (foreignResponse as any)._playerMarketValue,
      market_value: (foreignResponse as any)._playerMarketValue,
      club_id: null,
      a_venda: true,
      _isForeign: true,
      club_origin: (foreignResponse as any)._playerClubOrigin,
      salary_demand: (foreignResponse as any)._playerSalaryDemand,
      overall: (foreignResponse as any)._playerOverall,
    };
    setForeignResponse(null);
    if (foreignResponse.status === "contraproposta") {
      setTarget(enriched);
      setTipo("compra");
      setValor(String(foreignResponse.valor_sugerido));
      setSalario(String(foreignResponse.salario_sugerido));
      setLuvas(String(foreignResponse.luvas_sugeridas));
      setDuracao("1");
      setJogadorTrocado("");
    }
  };

  if (loading) return null;

  const inboxCount = inbox.length;
  const hasClub = myClubs.length > 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Mercado da Bola</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Negociações, rumores e movimentações.</p>
          </div>
        </div>
        {hasClub && myClubs.length > 1 && (
          <Select value={activeClubId} onValueChange={setActiveClubId}>
            <SelectTrigger className="md:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {myClubs.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </header>

      <Tabs defaultValue={hasClub ? "negociar" : "rumores"}>
        <div className="-mx-3 sm:-mx-4 md:mx-0 overflow-x-auto scrollbar-thin">
          <TabsList className="bg-secondary/50 mx-3 sm:mx-4 md:mx-0 w-max">
            {hasClub && (
              <TabsTrigger value="negociar">
                <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Negociar
              </TabsTrigger>
            )}
            <TabsTrigger value="rumores">
              <Radio className="h-3.5 w-3.5 mr-1" /> Rumores
            </TabsTrigger>
            <TabsTrigger value="estrangeiro">
              <Globe2 className="h-3.5 w-3.5 mr-1" /> Mercado Estrangeiro
            </TabsTrigger>
            <TabsTrigger value="livres">
              <UserMinus className="h-3.5 w-3.5 mr-1" /> Passes Livres
            </TabsTrigger>
            <TabsTrigger value="temporada">
              <History className="h-3.5 w-3.5 mr-1" /> Transferências
            </TabsTrigger>
            {hasClub && (
              <TabsTrigger value="inbox">
                <Inbox className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">Caixa de Entrada</span>
                <span className="sm:hidden">Inbox</span>
                {inboxCount > 0 && <Badge className="ml-2 bg-primary text-primary-foreground">{inboxCount}</Badge>}
              </TabsTrigger>
            )}
            {hasClub && (
              <TabsTrigger value="sent">
                <Send className="h-3.5 w-3.5 mr-1" /> Enviadas
              </TabsTrigger>
            )}
            {user && (
              <TabsTrigger value="interesses">
                <Heart className="h-3.5 w-3.5 mr-1" /> Interesses
                {interestItems.length > 0 && (
                  <Badge className="ml-2 bg-primary text-primary-foreground">{interestItems.length}</Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* ─── NEGOCIAR ────────────────────────────────────────────────────── */}
        {hasClub && (
          <TabsContent value="negociar" className="space-y-3 mt-4">
            <Filters
              q={q}
              setQ={setQ}
              pos={pos}
              setPos={setPos}
              onlyForSale={onlyForSale}
              setOnlyForSale={setOnlyForSale}
            />
            <Card className="bg-gradient-card border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-16">Posição</TableHead>
                    <TableHead>Jogador</TableHead>
                    <TableHead className="w-20 hidden sm:table-cell"></TableHead>
                    <TableHead>Clube</TableHead>
                    <TableHead className="text-center w-16 hidden sm:table-cell">Idade</TableHead>
                    <TableHead className="text-right">Valor base</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNegociar.map((p) => {
                    const club = clubs[p.club_id];
                    return (
                      <TableRow key={p.id} className={p.a_venda ? "bg-primary/5" : ""}>
                        <TableCell>
                          <Badge variant="outline" className="border-primary/40 text-primary">
                            {p.position}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => setProfilePlayerId(p.id)}
                              className="hover:text-primary transition-colors"
                            >
                              {p.name}
                            </button>
                            {p.a_venda && (
                              <Badge className="bg-primary/20 text-primary border-primary/40 text-[10px] px-1.5 py-0">
                                <Tag className="h-2.5 w-2.5 mr-0.5" />À VENDA
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell py-2 w-10">
                          {p.nationality && <FlagImg nationality={p.nationality} />}
                        </TableCell>
                        <TableCell>
                          {club ? (
                            <Link
                              to={`/clubes/${club.id}`}
                              className="flex items-center gap-2 hover:text-primary transition-colors"
                            >
                              <div className="h-7 w-7 shrink-0 flex items-center justify-center">
                                {club.crest_url && (
                                  <img src={club.crest_url} alt={club.name} className="w-full h-full object-contain" />
                                )}
                              </div>
                              <span className="text-sm hidden md:inline">{club.name}</span>
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell text-sm">{p.age || "—"}</TableCell>
                        <TableCell className="text-right font-display font-bold text-primary">
                          {formatCurrency(Number(p.valor_base_calculado))}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => openProposal(p)}
                            className="bg-gradient-gold text-primary-foreground hover:opacity-90"
                          >
                            Negociar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredNegociar.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                        Nenhum jogador disponível.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        )}

        {/* ─── RUMORES ─────────────────────────────────────────────────────── */}
        <TabsContent value="rumores" className="space-y-2 mt-4">
          <Card className="p-3 bg-gradient-card border-border/50 text-xs text-muted-foreground flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            Feed de propostas em andamento e movimentações recentes (últimas 48h).
          </Card>
          {rumores.length === 0 && (
            <Card className="p-10 text-center text-muted-foreground bg-gradient-card border-border/50">
              Sem movimentações no momento.
            </Card>
          )}
          {rumores.map((t) => {
            const player = players.find((p) => p.id === t.jogador_id);
            const comp = clubs[t.clube_comprador_id];
            const vend = clubs[t.clube_vendedor_id];
            const statusBadge =
              t.status === "pendente"
                ? { icon: Clock, cls: "bg-amber-500/20 text-amber-400 border-amber-500/40", label: "Em negociação" }
                : t.status === "aceita"
                  ? {
                      icon: CheckCircle2,
                      cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
                      label: "Acordo fechado",
                    }
                  : t.status === "contraproposta"
                    ? {
                        icon: MessageSquare,
                        cls: "bg-primary/20 text-primary border-primary/40",
                        label: "Contraproposta",
                      }
                    : {
                        icon: XCircle,
                        cls: "bg-destructive/20 text-destructive border-destructive/40",
                        label: "Recusada",
                      };
            const StatusIcon = statusBadge.icon;
            return (
              <Card key={t.id} className="p-3 sm:p-4 bg-gradient-card border-border/50">
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant="outline" className={`text-[10px] ${statusBadge.cls}`}>
                    <StatusIcon className="h-3 w-3 mr-1" /> {statusBadge.label}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] uppercase border-primary/40 text-primary">
                    {tipoLabel(t.tipo)}
                  </Badge>
                  {comp && (
                    <Link to={`/clubes/${comp.id}`} className="flex items-center gap-1.5 hover:text-primary">
                      <div className="h-6 w-6 flex items-center justify-center">
                        {comp.crest_url && (
                          <img src={comp.crest_url} alt={comp.name} className="w-full h-full object-contain" />
                        )}
                      </div>
                      <span className="text-sm font-medium">{comp.name}</span>
                    </Link>
                  )}
                  <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                  <button
                    onClick={() => player && setProfilePlayerId(player.id)}
                    className="text-sm font-bold hover:text-primary transition-colors"
                  >
                    {player?.name || "—"}
                  </button>
                  <span className="text-xs text-muted-foreground">de</span>
                  {vend && (
                    <Link to={`/clubes/${vend.id}`} className="flex items-center gap-1.5 hover:text-primary">
                      <div className="h-6 w-6 flex items-center justify-center">
                        {vend.crest_url && (
                          <img src={vend.crest_url} alt={vend.name} className="w-full h-full object-contain" />
                        )}
                      </div>
                      <span className="text-sm font-medium">{vend.name}</span>
                    </Link>
                  )}
                  <div className="ml-auto text-right">
                    {t.tipo !== "emprestimo" && Number(t.valor_ofertado) > 0 && (
                      <div className="font-display font-bold text-primary text-sm">
                        {formatCurrency(Number(t.valor_ofertado))}
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(t.created_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </TabsContent>

        {/* ─── MERCADO ESTRANGEIRO ─────────────────────────────────────────── */}
        <TabsContent value="estrangeiro" className="mt-4">
          <ForeignMarketTab activeClubId={activeClubId} hasClub={hasClub} onNegotiate={openProposal} />
        </TabsContent>

        {/* ─── PASSES LIVRES ───────────────────────────────────────────────── */}
        <TabsContent value="livres" className="mt-4">
          <FreeAgentsTab
            activeClubId={activeClubId}
            hasClub={hasClub}
            onProfileOpen={setProfilePlayerId}
            onNegotiate={openProposal}
          />
        </TabsContent>

        {/* ─── TRANSFERÊNCIAS DA TEMPORADA ─────────────────────────────────── */}
        <TabsContent value="temporada" className="space-y-3 mt-4">
          <Card className="p-3 bg-gradient-card border-border/50 text-xs text-muted-foreground flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Negócios fechados na temporada {temporadaAtual} ({seasonTransfers.length}{" "}
            {seasonTransfers.length === 1 ? "operação" : "operações"}).
          </Card>
          <Card className="bg-gradient-card border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Jogador</TableHead>
                  <TableHead>De</TableHead>
                  <TableHead>Para</TableHead>
                  <TableHead className="text-center">Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seasonTransfers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      Nenhuma transferência registrada nesta temporada.
                    </TableCell>
                  </TableRow>
                )}
                {seasonTransfers.map((tx) => {
                  const player = players.find((p) => p.id === tx.related_player_id);
                  const compradorClub = clubs[tx.related_club_id];
                  const vendedorClub = clubs[tx.club_id];
                  const tipoOp = (tx.metadata as any)?.tipo_op || "compra";
                  const isEstrangeiro = tipoOp === "estrangeiro";
                  const isLivre = tipoOp === "livre";

                  // Para estrangeiros e livres, "De" não é um clube real
                  const vendedorDisplay = isEstrangeiro
                    ? { name: "Mercado Estrangeiro", crest_url: null, id: null }
                    : isLivre
                      ? { name: "Passes Livres", crest_url: null, id: null }
                      : vendedorClub;

                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium">
                        <button
                          onClick={() => player && setProfilePlayerId(player.id)}
                          className="hover:text-primary transition-colors text-left"
                        >
                          {player?.name || tx.descricao}
                        </button>
                      </TableCell>
                      <TableCell>
                        {vendedorDisplay ? (
                          vendedorDisplay.id ? (
                            <Link
                              to={`/clubes/${vendedorDisplay.id}`}
                              className="flex items-center gap-2 hover:text-primary"
                            >
                              <div className="h-6 w-6 shrink-0">
                                {vendedorDisplay.crest_url && (
                                  <img
                                    src={vendedorDisplay.crest_url}
                                    className="w-full h-full object-contain"
                                    alt=""
                                  />
                                )}
                              </div>
                              <span className="text-sm hidden md:inline">{vendedorDisplay.name}</span>
                            </Link>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">{vendedorDisplay.name}</span>
                          )
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {compradorClub ? (
                          <Link
                            to={`/clubes/${compradorClub.id}`}
                            className="flex items-center gap-2 hover:text-primary"
                          >
                            <div className="h-6 w-6 shrink-0">
                              {compradorClub.crest_url && (
                                <img src={compradorClub.crest_url} className="w-full h-full object-contain" alt="" />
                              )}
                            </div>
                            <span className="text-sm hidden md:inline">{compradorClub.name}</span>
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-[10px] uppercase border-primary/40 text-primary">
                          {tipoOp}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-display font-bold text-primary">
                        {Number(tx.valor) > 0 ? (
                          formatCurrency(Number(tx.valor))
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ─── INBOX ───────────────────────────────────────────────────────── */}
        {hasClub && (
          <TabsContent value="inbox" className="space-y-2 mt-4">
            {inbox.length === 0 && (
              <Card className="p-10 text-center text-muted-foreground bg-gradient-card border-border/50">
                Nenhuma proposta para responder.
              </Card>
            )}
            {inbox.map((t) => {
              const player = playerById(t.jogador_id);
              const oferecido = t.jogador_trocado_id ? playerById(t.jogador_trocado_id) : null;
              const isCounter = !!t.proposta_pai_id;
              const fromClub = isCounter
                ? t.clube_vendedor_id === activeClubId
                  ? clubs[t.clube_comprador_id]
                  : clubs[t.clube_vendedor_id]
                : clubs[t.clube_comprador_id];
              const base = Number(player?.valor_base_calculado || 0);
              return (
                <Card key={t.id} className="p-4 bg-gradient-card border-border/50">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isCounter && (
                        <Badge className="bg-primary/30 text-primary border-primary/50 text-[10px]">
                          <MessageSquare className="h-2.5 w-2.5 mr-1" />
                          CONTRAPROPOSTA
                        </Badge>
                      )}
                      <Badge variant="outline" className="border-primary/40 text-primary uppercase text-[10px]">
                        {tipoLabel(t.tipo)}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {player?.position}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{player?.name || "Jogador"}</div>
                        <div className="text-xs text-muted-foreground">
                          {isCounter ? "Contraproposta de" : "Oferta de"} <strong>{fromClub?.name || "?"}</strong> ·
                          base {formatCurrency(base)}
                          {t.tipo === "emprestimo" && t.duracao_emprestimo && <> · {t.duracao_emprestimo} temp.</>}
                          {t.tipo === "troca" && oferecido && (
                            <>
                              {" "}
                              · oferece <strong>{oferecido.name}</strong>
                            </>
                          )}
                          {Number(t.luvas) > 0 && <> · luvas {formatCurrency(Number(t.luvas))}</>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-end justify-between gap-3 flex-wrap">
                      <div className="flex gap-4">
                        {t.tipo !== "emprestimo" && (
                          <div>
                            <div className="text-[10px] uppercase text-muted-foreground">Valor</div>
                            <div className="font-display font-bold text-primary text-sm">
                              {formatCurrency(Number(t.valor_ofertado))}
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="text-[10px] uppercase text-muted-foreground">Salário</div>
                          <div className="font-display font-bold text-sm">
                            {formatCurrency(Number(t.salario_ofertado))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {t.status === "aguardando_confirmacao" ? (
                          <>
                            <Button size="sm" variant="outline" onClick={() => cancelarConf(t.id)}>
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => confirmar(t.id)}
                              className="bg-gradient-gold text-primary-foreground hover:opacity-90"
                            >
                              Confirmar contratação
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => respond(t.id, false)}>
                              Recusar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openCounter(t)}
                              className="border-primary/40 text-primary hover:bg-primary/10"
                            >
                              <MessageSquare className="h-3.5 w-3.5" /> Contra-propor
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => respond(t.id, true)}
                              className="bg-gradient-gold text-primary-foreground hover:opacity-90"
                            >
                              Aceitar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </TabsContent>
        )}

        {/* ─── SENT ────────────────────────────────────────────────────────── */}
        {hasClub && (
          <TabsContent value="sent" className="space-y-2 mt-4">
            {sent.length === 0 && (
              <Card className="p-10 text-center text-muted-foreground bg-gradient-card border-border/50">
                Você ainda não enviou propostas.
              </Card>
            )}
            {sent.map((t) => {
              const player = playerById(t.jogador_id);
              const isCounter = !!t.proposta_pai_id;
              const otherClub = isCounter ? clubs[t.clube_comprador_id] : clubs[t.clube_vendedor_id];
              return (
                <Card key={t.id} className="p-4 bg-gradient-card border-border/50">
                  <div className="flex items-center gap-3 flex-wrap">
                    {isCounter && (
                      <Badge className="bg-primary/30 text-primary border-primary/50 text-[10px]">
                        <MessageSquare className="h-2.5 w-2.5 mr-1" />
                        CONTRAPROPOSTA
                      </Badge>
                    )}
                    <Badge variant="outline" className="border-primary/40 text-primary uppercase text-[10px]">
                      {tipoLabel(t.tipo)}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {player?.position}
                    </Badge>
                    <div className="flex-1 min-w-0 basis-full sm:basis-auto">
                      <div className="font-bold truncate">{player?.name || "Jogador"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        Para <strong>{otherClub?.name || "?"}</strong>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase text-muted-foreground">Valor</div>
                      <div className="font-display font-bold text-primary text-sm">
                        {formatCurrency(Number(t.valor_ofertado))}
                      </div>
                    </div>
                    <Badge
                      variant={
                        t.status === "aceita"
                          ? "default"
                          : t.status === "recusada" || t.status === "cancelada"
                            ? "destructive"
                            : "secondary"
                      }
                      className={t.status === "aceita" ? "bg-primary text-primary-foreground" : ""}
                    >
                      {t.status}
                    </Badge>
                    {t.status === "pendente" && (
                      <Button size="sm" variant="ghost" onClick={() => removerProposta(t.id)}>
                        Remover
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </TabsContent>
        )}

        {/* ─── INTERESSES ──────────────────────────────────────────────────── */}
        {user && (
          <TabsContent value="interesses" className="space-y-2 mt-4">
            <Card className="p-3 bg-gradient-card border-border/50 text-xs text-muted-foreground flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" />
              Sua lista pessoal de jogadores observados. Clique em qualquer um para abrir o perfil.
            </Card>
            {interestItems.length === 0 && (
              <Card className="p-10 text-center text-muted-foreground bg-gradient-card border-border/50">
                Sua lista está vazia. Clique no coração no perfil de um jogador para adicioná-lo.
              </Card>
            )}
            {interestItems.map((entry) => {
              const p = players.find((pl) => pl.id === entry.player_id);
              if (!p) return null;
              const c = p.club_id ? clubs[p.club_id] : null;
              return (
                <Card key={entry.id} className="p-3 bg-gradient-card border-border/50">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      {p.position}
                    </Badge>
                    <button
                      onClick={() => setProfilePlayerId(p.id)}
                      className="font-bold hover:text-primary transition-colors text-left flex items-center gap-2"
                    >
                      {p.name}
                      {p.nationality && <FlagImg nationality={p.nationality} />}
                    </button>
                    {p.a_venda && (
                      <Badge className="bg-primary/20 text-primary border-primary/40 text-[10px]">
                        <Tag className="h-2.5 w-2.5 mr-0.5" />À VENDA
                      </Badge>
                    )}
                    {c && (
                      <Link to={`/clubes/${c.id}`} className="flex items-center gap-1.5 hover:text-primary text-xs">
                        <div className="h-6 w-6">
                          {c.crest_url && <img src={c.crest_url} className="w-full h-full object-contain" alt="" />}
                        </div>
                        <span className="hidden md:inline">{c.name}</span>
                      </Link>
                    )}
                    <div className="ml-auto text-right">
                      <div className="text-[10px] uppercase text-muted-foreground">Valor</div>
                      <div className="font-display font-bold text-primary text-sm">
                        {formatCurrency(Number(p.valor_base_calculado))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {hasClub && p.club_id && p.club_id !== activeClubId && (
                        <Button
                          size="sm"
                          onClick={() => openProposal(p)}
                          className="bg-gradient-gold text-primary-foreground hover:opacity-90"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" /> Negociar
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => toggleInterest(p.id)}>
                        <Heart className="h-3.5 w-3.5 fill-current text-primary" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </TabsContent>
        )}
      </Tabs>

      {/* ─── MODAL: PROPOSTA ─────────────────────────────────────────────── */}
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Negociar jogador</DialogTitle>
            <DialogDescription>
              {target && (
                <>
                  Por <strong>{target.name}</strong> · valor base {formatCurrency(Number(target.valor_base_calculado))}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {target && (
            <Tabs value={tipo} onValueChange={(v) => setTipo(v as TransferType)}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="compra">Compra</TabsTrigger>
                <TabsTrigger value="emprestimo">Empréstimo</TabsTrigger>
                <TabsTrigger value="troca">Troca</TabsTrigger>
              </TabsList>
              <TabsContent value="compra" className="space-y-3 mt-3">
                <div>
                  <Label>Valor da transferência (€)</Label>
                  <NumberInput value={valor} onChange={(v) => setValor(String(v))} />
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Faixa Fair Play: {formatCurrency(Number(target.valor_base_calculado) * 0.5)} –{" "}
                    {formatCurrency(Number(target.valor_base_calculado) * 3.0)}
                  </div>
                </div>
                <div>
                  <Label>Salário ofertado (€/ano)</Label>
                  <NumberInput value={salario} onChange={(v) => setSalario(String(v))} min={0} />
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Sugerido: {formatCurrency(Math.round(Number(target.valor_base_calculado || 0) * 0.1))}/ano (10% do
                    valor base)
                  </div>
                </div>
                <div>
                  <Label>Luvas (€)</Label>
                  <NumberInput
                    value={luvas}
                    onChange={(v) => setLuvas(String(v))}
                    min={0}
                    max={Math.max(0, caixaComprador)}
                  />
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Total à vista: <strong>{formatCurrency(totalDevido)}</strong> · Caixa:{" "}
                    {formatCurrency(caixaComprador)}
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="emprestimo" className="space-y-3 mt-3">
                <div>
                  <Label>Duração (temporadas)</Label>
                  <NumberInput
                    value={duracao}
                    onChange={(v) => setDuracao(String(v))}
                    min={1}
                    max={3}
                    thousands={false}
                  />
                </div>
                <div>
                  <Label>Salário pago pelo empréstimo (€/ano)</Label>
                  <NumberInput value={salario} onChange={(v) => setSalario(String(v))} min={0} />
                </div>
              </TabsContent>
              <TabsContent value="troca" className="space-y-3 mt-3">
                <div>
                  <Label>Jogador que você oferece</Label>
                  <Select value={jogadorTrocado} onValueChange={setJogadorTrocado}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione do seu elenco..." />
                    </SelectTrigger>
                    <SelectContent>
                      {myPlayers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.position} · {p.name} ({formatCurrency(Number(p.valor_base_calculado))})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Diferença em dinheiro (€) — opcional</Label>
                  <NumberInput value={valor} onChange={(v) => setValor(String(v))} min={0} />
                </div>
                <div>
                  <Label>Salário ofertado ao jogador-alvo (€/ano)</Label>
                  <NumberInput value={salario} onChange={(v) => setSalario(String(v))} min={0} />
                </div>
              </TabsContent>
              {fpError && (
                <div className="flex items-start gap-2 p-3 mt-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {fpError}
                </div>
              )}
              {caixaError && !fpError && (
                <div className="flex items-start gap-2 p-3 mt-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {caixaError}
                </div>
              )}
              {trocaError && (
                <div className="flex items-start gap-2 p-3 mt-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {trocaError}
                </div>
              )}
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={!!fpError || !!caixaError || !!trocaError || submitting}
              className="bg-gradient-gold text-primary-foreground hover:opacity-90"
            >
              {submitting ? "Enviando..." : "Enviar proposta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: CONTRAPROPOSTA ───────────────────────────────────────── */}
      <Dialog open={!!counterTarget} onOpenChange={(o) => !o && setCounterTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" /> Enviar contraproposta
            </DialogTitle>
            <DialogDescription>
              Edite os valores e devolva. A proposta original será encerrada e a nova vai pra caixa de entrada do
              comprador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Valor da transferência (€)</Label>
              <NumberInput value={cValor} onChange={(v) => setCValor(String(v))} min={0} />
            </div>
            <div>
              <Label>Salário (€/ano)</Label>
              <NumberInput value={cSalario} onChange={(v) => setCSalario(String(v))} min={0} />
            </div>
            <div>
              <Label>Luvas (€)</Label>
              <NumberInput value={cLuvas} onChange={(v) => setCLuvas(String(v))} min={0} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCounterTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={sendCounter} className="bg-gradient-gold text-primary-foreground hover:opacity-90">
              Enviar contraproposta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: RESPOSTA IA ESTRANGEIRA ─────────────────────────────── */}
      <Dialog open={!!foreignResponse} onOpenChange={(o) => !o && setForeignResponse(null)}>
        <DialogContent className="max-w-md">
          {foreignLoading ? (
            <div className="py-10 flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">
                {(foreignResponse as any)?._playerClubOrigin || "O clube"} está analisando a proposta...
              </p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {foreignResponse?.status === "aceita" && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                  {foreignResponse?.status === "recusada" && <XCircle className="h-5 w-5 text-destructive" />}
                  {foreignResponse?.status === "contraproposta" && <MessageSquare className="h-5 w-5 text-amber-500" />}
                  {foreignResponse?.status === "aceita"
                    ? "Proposta Aceita!"
                    : foreignResponse?.status === "recusada"
                      ? "Proposta Recusada"
                      : "Contraproposta"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">{foreignResponse?.mensagem}</p>

                {foreignResponse?.status === "contraproposta" && (
                  <Card className="p-3 bg-amber-500/10 border-amber-500/30 space-y-2">
                    <div className="text-xs font-semibold text-amber-400 uppercase">Valores sugeridos</div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Valor:</span>
                      <span className="font-display font-bold text-primary">
                        {formatCurrency(foreignResponse.valor_sugerido)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Salário:</span>
                      <span className="font-display font-bold">
                        {formatCurrency(foreignResponse.salario_sugerido)}/ano
                      </span>
                    </div>
                    {foreignResponse.luvas_sugeridas > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Luvas:</span>
                        <span className="font-display font-bold">
                          {formatCurrency(foreignResponse.luvas_sugeridas)}
                        </span>
                      </div>
                    )}
                  </Card>
                )}
              </div>

              <DialogFooter className="flex gap-2">
                <Button variant="outline" onClick={() => setForeignResponse(null)}>
                  Fechar
                </Button>
                {foreignResponse?.status === "contraproposta" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={retryForeignNegotiation}
                      className="border-primary/40 text-primary hover:bg-primary/10"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Nova proposta
                    </Button>
                    <Button
                      onClick={acceptForeignCounter}
                      className="bg-gradient-gold text-primary-foreground hover:opacity-90"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aceitar contraproposta
                    </Button>
                  </>
                )}
                {foreignResponse?.status === "recusada" && (
                  <Button
                    variant="outline"
                    onClick={retryForeignNegotiation}
                    className="border-primary/40 text-primary hover:bg-primary/10"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Tentar novamente
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <PlayerProfileDialog
        playerId={profilePlayerId}
        open={!!profilePlayerId}
        onOpenChange={(v) => !v && setProfilePlayerId(null)}
        onNegotiate={(p) => {
          setProfilePlayerId(null);
          openProposal(p);
        }}
      />
    </div>
  );
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function FlagImg({ nationality }: { nationality: string }) {
  const url = getFlagUrl(nationality);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={nationality}
      title={nationality}
      className="h-6 w-8 object-cover rounded-sm shrink-0"
      style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.1)" }}
    />
  );
}

interface FiltersProps {
  q: string;
  setQ: (s: string) => void;
  pos: string;
  setPos: (s: string) => void;
  onlyForSale: boolean;
  setOnlyForSale: (v: boolean | ((p: boolean) => boolean)) => void;
}
const Filters = ({ q, setQ, pos, setPos, onlyForSale, setOnlyForSale }: FiltersProps) => (
  <div className="flex flex-col sm:flex-row gap-3">
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar jogador..." className="pl-10" />
    </div>
    <div className="flex gap-3">
      <Select value={pos} onValueChange={setPos}>
        <SelectTrigger className="flex-1 sm:w-48">
          <SelectValue placeholder="Posição" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas posições</SelectItem>
          {POSITIONS.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant={onlyForSale ? "default" : "outline"}
        onClick={() => setOnlyForSale((v) => !v)}
        className={onlyForSale ? "bg-gradient-gold text-primary-foreground shrink-0" : "shrink-0"}
      >
        <Tag className="h-4 w-4" />{" "}
        <span className="hidden sm:inline">{onlyForSale ? "Mostrando à venda" : "Só à venda"}</span>
      </Button>
    </div>
  </div>
);

// ─── MERCADO ESTRANGEIRO ──────────────────────────────────────────────────────

interface ForeignMarketTabProps {
  activeClubId: string;
  hasClub: boolean;
  onNegotiate: (player: any) => void;
}

const ForeignMarketTab = ({ activeClubId, hasClub, onNegotiate }: ForeignMarketTabProps) => {
  const [rows, setRows] = useState<any[]>([]);
  const [pos, setPos] = useState("all");
  const [temp, setTemp] = useState<string>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase
      .from("foreign_market_players")
      .select("*")
      .order("overall", { ascending: false })
      .then(({ data }) => setRows(data || []));
  }, []);

  const temporadas = useMemo(
    () => Array.from(new Set(rows.map((r) => r.temporada).filter(Boolean))).sort((a, b) => b - a),
    [rows],
  );

  const filtered = rows.filter(
    (r) =>
      (pos === "all" || r.position === pos) &&
      (temp === "all" || String(r.temporada) === temp) &&
      (!q || r.name.toLowerCase().includes(q.toLowerCase())),
  );

  // Build a synthetic player object compatible with openProposal
  const buildForeignPlayer = (r: any) => ({
    id: r.id,
    name: r.name,
    position: r.position,
    age: r.age,
    nationality: r.nationality,
    valor_base_calculado: Number(r.market_value) || 0,
    market_value: Number(r.market_value) || 0,
    salary_demand: Number(r.salary_demand) || 0,
    overall: Number(r.overall) || 70,
    club_id: null,
    club_origin: r.club_origin,
    a_venda: true,
    _isForeign: true,
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar jogador..." className="pl-10" />
        </div>
        <div className="flex gap-2">
          <Select value={pos} onValueChange={setPos}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Posição" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas posições</SelectItem>
              {POSITIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={temp} onValueChange={setTemp}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Temporada" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas temporadas</SelectItem>
              {temporadas.map((t) => (
                <SelectItem key={t} value={String(t)}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Card className="bg-gradient-card border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16">Posição</TableHead>
              <TableHead>Jogador</TableHead>
              <TableHead className="hidden sm:table-cell w-20"></TableHead>
              <TableHead>Clube / Liga</TableHead>
              <TableHead className="text-center w-16 hidden sm:table-cell">Idade</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Salário</TableHead>
              {hasClub && <TableHead className="w-24"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    {r.position}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="hidden sm:table-cell py-2">
                  {r.nationality && <FlagImg nationality={r.nationality} />}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.club_origin}
                  {r.league_origin ? ` / ${r.league_origin}` : ""}
                </TableCell>
                <TableCell className="text-center hidden sm:table-cell text-sm">{r.age ?? "—"}</TableCell>
                <TableCell className="text-right font-display font-bold text-primary">
                  {formatCurrency(r.market_value)}
                </TableCell>
                <TableCell className="text-right text-sm">{formatCurrency(r.salary_demand)}</TableCell>
                {hasClub && (
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => onNegotiate(buildForeignPlayer(r))}
                      className="bg-gradient-gold text-primary-foreground hover:opacity-90"
                    >
                      Negociar
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={hasClub ? 8 : 7} className="text-center text-muted-foreground py-10">
                  Nenhum jogador encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

// ─── PASSES LIVRES ────────────────────────────────────────────────────────────

interface FreeAgentsTabProps {
  activeClubId: string;
  hasClub: boolean;
  onProfileOpen: (id: string) => void;
  onNegotiate: (player: any) => void;
}

const FreeAgentsTab = ({ activeClubId, hasClub, onProfileOpen, onNegotiate }: FreeAgentsTabProps) => {
  const [rows, setRows] = useState<any[]>([]);
  const [pos, setPos] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: fa }, { data: pls }] = await Promise.all([
        supabase.from("free_agents").select("*"),
        (supabase.from("players") as any)
          .select("id,name,position,age,nationality,habilidade,salario_atual,valor_base_calculado")
          .is("club_id", null)
          .is("external_club_id", null),
      ]);
      const merged = [
        ...(fa || []).map((r: any) => ({ ...r, _src: "free_agents" })),
        ...(pls || []).map((p: any) => ({
          id: "p_" + p.id,
          _realId: p.id,
          name: p.name,
          position: p.position,
          age: p.age,
          nationality: p.nationality,
          overall: p.habilidade,
          salary_demand: p.salario_atual,
          valor_base_calculado: p.valor_base_calculado,
          last_club: null,
          _src: "players",
        })),
      ];
      const seen = new Set((fa || []).map((r: any) => r.source_player_id).filter(Boolean));
      setRows(merged.filter((r: any) => !(r._src === "players" && seen.has(r.id.replace("p_", "")))));
    })();
  }, []);

  const filtered = rows
    .filter((r) => pos === "all" || r.position === pos)
    .filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(b.overall || 0) - Number(a.overall || 0));

  // Build a synthetic player object compatible with openProposal
  const buildFreeAgentPlayer = (r: any) => ({
    id: r._src === "players" ? r._realId : r.id,
    name: r.name,
    position: r.position,
    age: r.age,
    nationality: r.nationality,
    valor_base_calculado: Number(r.valor_base_calculado) || Number(r.salary_demand) || 0,
    market_value: Number(r.valor_base_calculado) || Number(r.salary_demand) || 0,
    club_id: null,
    a_venda: true,
    _isFreeAgent: r._src !== "players",
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar jogador..." className="pl-10" />
        </div>
        <Select value={pos} onValueChange={setPos}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Posição" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas posições</SelectItem>
            {POSITIONS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Card className="bg-gradient-card border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16">Posição</TableHead>
              <TableHead>Jogador</TableHead>
              <TableHead className="hidden sm:table-cell w-20"></TableHead>
              <TableHead className="text-center w-16 hidden sm:table-cell">Idade</TableHead>
              <TableHead>Último clube</TableHead>
              <TableHead className="text-right">OVR</TableHead>
              <TableHead className="text-right">Salário pedido</TableHead>
              {hasClub && <TableHead className="w-24"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    {r.position}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {r._src === "players" ? (
                    <button
                      onClick={() => onProfileOpen(r._realId)}
                      className="hover:text-primary transition-colors text-left"
                    >
                      {r.name}
                    </button>
                  ) : (
                    r.name
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell py-2">
                  {r.nationality && <FlagImg nationality={r.nationality} />}
                </TableCell>
                <TableCell className="text-center hidden sm:table-cell text-sm">{r.age ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.last_club || "—"}</TableCell>
                <TableCell className="text-right font-bold">{r.overall ?? "—"}</TableCell>
                <TableCell className="text-right font-display font-bold text-primary">
                  {formatCurrency(r.salary_demand || 0)}
                </TableCell>
                {hasClub && (
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => onNegotiate(buildFreeAgentPlayer(r))}
                      className="bg-gradient-gold text-primary-foreground hover:opacity-90"
                    >
                      Negociar
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={hasClub ? 8 : 7} className="text-center text-muted-foreground py-10">
                  Nenhum jogador encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default Market;
