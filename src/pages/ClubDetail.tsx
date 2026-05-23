import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Shield,
  MapPin,
  Users,
  Wallet,
  Building2,
  TrendingUp,
  TrendingDown,
  Save,
  Tag,
  AlertTriangle,
  FileSignature,
  Search,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { ContractRenewalDialog } from "@/components/ContractRenewalDialog";
import { ShirtNumberDialog } from "@/components/ShirtNumberDialog";
import { MultaRescisoriaDialog } from "@/components/MultaRescisoriaDialog";
import { Gavel, Telescope, Star } from "lucide-react";
import { formatCurrency, POSITIONS, calcStars } from "@/lib/format";
import { StarRating } from "@/components/StarRating";
import ScoutsManager from "@/components/ScoutsManager";
import { estimarPotencialOwn, type ScoutReport } from "@/lib/scout";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RichEditor } from "@/components/RichEditor";
import { WikiSectionsView, WikiData, WikiSectionKey } from "@/components/WikiSections";
import { ClubInfobox, InfoboxData } from "@/components/ClubInfobox";
import { ContractsManager } from "@/components/ContractsManager";
import { StadiumManager } from "@/components/StadiumManager";
import { AcademyManager } from "@/components/AcademyManager";
import { TrainingsManager } from "@/components/TrainingsManager";
import { LoanManager } from "@/components/LoanManager";
import { ChevronsUp, ChevronsDown, Equal, LineChart } from "lucide-react";
import { ImageUpload } from "@/components/ImageUpload";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { getFlagUrl } from "@/lib/countries";
import { PlayerProfileDialog } from "@/components/PlayerProfileDialog";
import { SkillDisplay } from "@/components/SkillDisplay";
import { SquadTable } from "@/components/club-detail/SquadTable";
import { StatCard, Row, EvolutionTable } from "@/components/club-detail/EvolutionTable";
import { transfersService } from "@/services/transfers";
import { LineupManager } from "@/components/club-detail/LineupManager";
import { KitsGallery } from "@/components/KitsGallery";
import {
  ResponsiveContainer,
  LineChart as RLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const ClubDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "elenco";
  const { user, isAdmin } = useAuth();
  const [club, setClub] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [contratosTotal, setContratosTotal] = useState(0);
  const [temporadaAtual, setTemporadaAtual] = useState<number>(2020);
  const [renewPlayer, setRenewPlayer] = useState<any>(null);
  const [shirtPlayer, setShirtPlayer] = useState<any>(null);
  const [multaPlayer, setMultaPlayer] = useState<any>(null);
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [wikiData, setWikiData] = useState<WikiData>({});
  const [editingClub, setEditingClub] = useState<any>(null);
  const [masterSponsor, setMasterSponsor] = useState<string | null>(null);
  const [kitSupplier, setKitSupplier] = useState<string | null>(null);

  // Apenas o dono do clube pode editar pela página do clube. Admins editam pelo painel /admin.
  const canEdit = !!user && !!club && club.owner_id === user.id;
  const [ownerInfo, setOwnerInfo] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);

  const handleScoutReportCreated = (rep: ScoutReport, novoUsado: number) => {
    setScoutReports((prev) => ({ ...prev, [rep.target_player_id]: rep }));
    setMyClub((prev: any) => (prev ? { ...prev, scout_searches_used: novoUsado } : prev));
  };

  const [direitosTv, setDireitosTv] = useState<number>(0);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [transferStats, setTransferStats] = useState<{ c: number; v: number; e: number }>({ c: 0, v: 0, e: 0 });
  const [econParams, setEconParams] = useState<{
    manut_base: number;
    manut_estadio: number;
    operacionais_pct: number;
  }>({ manut_base: 300000, manut_estadio: 200000, operacionais_pct: 0.25 });
  const [imgSettings, setImgSettings] = useState<{ custo_pct: number; receita_pct: number }>({
    custo_pct: 0.03,
    receita_pct: 0.5,
  });

  // Olheiros: clube do usuário observador + relatórios já feitos por ele
  const [myClub, setMyClub] = useState<any | null>(null);
  const [scoutReports, setScoutReports] = useState<Record<string, ScoutReport>>({});

  const load = async () => {
    if (!id) return;
    const [
      { data: c },
      { data: p },
      { data: ct },
      { data: settings },
      { data: masterContract },
      { data: kitContract },
      { data: tvRightsValue },
    ] = await Promise.all([
      supabase.from("clubs").select("*").eq("id", id).maybeSingle(),
      supabase.from("players").select("*").eq("club_id", id),
      supabase.from("contratos_clube").select("valor_anual").eq("club_id", id).eq("ativo", true),
      supabase
        .from("settings")
        .select("key, value")
        .in("key", ["temporada_atual", "direitos_imagem", "economia_params"]),
      supabase
        .from("contratos_clube")
        .select("empresa:empresas(nome), categoria")
        .eq("club_id", id)
        .eq("ativo", true)
        .in("categoria", ["master", "patrocinio_master"])
        .limit(1)
        .maybeSingle(),
      supabase
        .from("contratos_clube")
        .select("empresa:empresas(nome), categoria")
        .eq("club_id", id)
        .eq("ativo", true)
        .eq("categoria", "fornecedora")
        .limit(1)
        .maybeSingle(),
      supabase.rpc("get_tv_rights_value" as any, { _club_id: id }),
    ]);

    setClub(c);
    setMasterSponsor((masterContract as any)?.empresa?.nome ?? null);
    setKitSupplier((kitContract as any)?.empresa?.nome ?? null);
    setPlayers(p || []);
    setContratosTotal((ct || []).reduce((s, r: any) => s + Number(r.valor_anual || 0), 0));

    (settings || []).forEach((s: any) => {
      if (s.key === "temporada_atual" && typeof s.value?.ano === "number") setTemporadaAtual(s.value.ano);
      if (s.key === "direitos_imagem")
        setImgSettings({
          custo_pct: Number(s.value?.custo_pct ?? 0.03),
          receita_pct: Number(s.value?.receita_pct ?? 0.5),
        });
      if (s.key === "economia_params")
        setEconParams({
          manut_base: Number(s.value?.manutencao_por_nivel_base ?? 300000),
          manut_estadio: Number(s.value?.manutencao_estadio_por_nivel ?? 200000),
          operacionais_pct: Number(s.value?.custos_operacionais_pct ?? 0.25),
        });
    });

    setDireitosTv(Number(tvRightsValue || 0));
    setWikiData((c?.wiki as WikiData) || {});
    setEditingClub(c);
    setLoading(false);
    if (c) document.title = `${c.name} — Solara Hub`;

    // Carrega últimas transações relevantes (transferências + upgrades)
    const { data: tx } = await supabase
      .from("transactions")
      .select("*")
      .eq("club_id", id)
      .in("categoria", ["transferencia", "transferencia_externa", "upgrade_estadio", "upgrade_academia"])
      .order("created_at", { ascending: false })
      .limit(500);
    setRecentTransactions(tx || []);

    // Carrega TODAS as transações para os gráficos
    const { data: txAll } = await supabase
      .from("transactions")
      .select("tipo, categoria, valor, temporada, created_at")
      .eq("club_id", id)
      .order("created_at", { ascending: false })
      .limit(1000);
    setAllTransactions(txAll || []);

    // Contadores de transferências (todas as temporadas)
    try {
      const s = await transfersService.getStats(id);
      setTransferStats({ c: s.total_compras, v: s.total_vendas, e: s.total_estrangeiros });
    } catch {
      setTransferStats({ c: 0, v: 0, e: 0 });
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  // Carrega informação do dono (nome + avatar) quando o clube é carregado
  useEffect(() => {
    const loadOwner = async () => {
      if (!club?.owner_id) {
        setOwnerInfo(null);
        return;
      }
      const { data } = await supabase.rpc("get_owner_display_info", { _user_id: club.owner_id });
      const row = Array.isArray(data) ? data[0] : data;
      setOwnerInfo(row ? { display_name: row.display_name ?? null, avatar_url: row.avatar_url ?? null } : null);
    };
    loadOwner();
  }, [club?.owner_id]);

  // Carrega o clube do usuário observador (para o olheiro) e os relatórios já feitos
  useEffect(() => {
    const loadMyClubAndReports = async () => {
      if (!user) {
        setMyClub(null);
        setScoutReports({});
        return;
      }
      const { data: mine } = await supabase.from("clubs").select("*").eq("owner_id", user.id).maybeSingle();
      setMyClub(mine || null);
      if (mine) {
        const { data: reps } = await supabase
          .from("scout_reports" as any)
          .select("*")
          .eq("scouter_club_id", mine.id);
        const map: Record<string, ScoutReport> = {};
        (reps || []).forEach((r: any) => {
          map[r.target_player_id] = r as ScoutReport;
        });
        setScoutReports(map);
      } else {
        setScoutReports({});
      }
    };
    loadMyClubAndReports();
  }, [user?.id]);
  const saveWiki = async (next: WikiData) => {
    setWikiData(next);
    const { error } = await supabase
      .from("clubs")
      .update({ wiki: next as any })
      .eq("id", id!);
    if (error) toast.error(error.message);
    else toast.success("Wiki atualizada!");
  };

  const saveSection = async (key: WikiSectionKey, html: string) => {
    const next: WikiData = {
      ...wikiData,
      sections: { ...(wikiData.sections ?? {}), [key]: html },
    };
    await saveWiki(next);
  };

  const saveInfobox = async (next: InfoboxData) => {
    // Patrocinador e material são sempre derivados dos contratos ativos — nunca editáveis manualmente
    const synced: InfoboxData = {
      ...next,
      patrocinador: masterSponsor ?? next.patrocinador,
      material: kitSupplier ?? next.material,
    };
    await saveWiki({ ...wikiData, infobox: synced });
  };

  const saveClubInfo = async () => {
    const { error } = await supabase
      .from("clubs")
      .update({
        name: editingClub.name,
        crest_url: editingClub.crest_url,
        city: editingClub.city,
        stadium_name: editingClub.stadium_name,
        primary_color: editingClub.primary_color,
        founded_year: parseInt(editingClub.founded_year) || null,
      })
      .eq("id", id!);
    if (error) toast.error(error.message);
    else {
      toast.success("Clube atualizado!");
      load();
    }
  };

  const toggleSale = async (playerId: string, value: boolean) => {
    const { error } = await supabase.from("players").update({ a_venda: value }).eq("id", playerId);

    if (error) return toast.error(error.message);
    // só atualiza o estado local após confirmar o save
    setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, a_venda: value } : p)));
    toast.success(value ? "Jogador colocado à venda" : "Jogador removido da vitrine");
  };

  const toggleBlockProposals = async (playerId: string, value: boolean) => {
    const { error } = await supabase
      .from("players")
      .update({ bloquear_propostas: value } as any)
      .eq("id", playerId);
    if (error) return toast.error(error.message);
    setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, bloquear_propostas: value } : p)));
    toast.success(value ? "Propostas bloqueadas para esse jogador" : "Propostas liberadas");
  };

  // Agregados financeiros por temporada (para gráficos) — devem ficar ANTES de qualquer early return
  const seasonAggregates = useMemo(() => {
    const map = new Map<number, { receitas: number; despesas: number }>();
    for (const t of allTransactions) {
      const sea =
        typeof t.temporada === "number" && t.temporada > 0 ? t.temporada : new Date(t.created_at).getFullYear();
      if (!map.has(sea)) map.set(sea, { receitas: 0, despesas: 0 });
      const cur = map.get(sea)!;
      const v = Math.abs(Number(t.valor || 0));
      if (t.tipo === "entrada") cur.receitas += v;
      else cur.despesas += v;
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([temporada, x]) => ({
        temporada,
        receitas: Math.round(x.receitas),
        despesas: Math.round(x.despesas),
        lucro: Math.round(x.receitas - x.despesas),
      }));
  }, [allTransactions]);

  const despesasAtuaisPorCategoria = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of allTransactions) {
      const sea =
        typeof t.temporada === "number" && t.temporada > 0 ? t.temporada : new Date(t.created_at).getFullYear();
      if (sea !== temporadaAtual) continue;
      if (t.tipo !== "saida") continue;
      const cat = String(t.categoria || "outros");
      map.set(cat, (map.get(cat) || 0) + Math.abs(Number(t.valor || 0)));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [allTransactions, temporadaAtual]);

  const transactionsBySeason = useMemo(() => {
    const map = new Map<number, any[]>();
    for (const t of recentTransactions) {
      const sea =
        typeof t.temporada === "number" && t.temporada > 0 ? t.temporada : new Date(t.created_at).getFullYear();
      if (!map.has(sea)) map.set(sea, []);
      map.get(sea)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [recentTransactions]);

  const CHART_COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--destructive))",
    "hsl(var(--success))",
    "hsl(var(--accent))",
    "hsl(var(--muted-foreground))",
    "#f59e0b",
    "#8b5cf6",
    "#06b6d4",
    "#ec4899",
    "#10b981",
  ];
  const catLabelMap: Record<string, string> = {
    transferencia: "Compras",
    transferencia_externa: "Compras (exterior)",
    upgrade_estadio: "Upgrade estádio",
    upgrade_academia: "Upgrade base",
    salario: "Salários",
    manutencao: "Manutenção",
    manutencao_estadio: "Manut. estádio",
    operacional: "Operacional",
    direitos_imagem: "Direitos de imagem",
    folha: "Folha salarial",
    emprestimo: "Empréstimos",
    outros: "Outros",
  };
  const formatCat = (k: string) => catLabelMap[k] ?? k;

  if (!club) return <div className="text-center py-20 text-muted-foreground">Clube não encontrado.</div>;

  const folhaSalarial = players.reduce((s, p) => s + Number(p.salario_atual || 0), 0);
  const valorBaseFolha = players.reduce((s, p) => s + Number(p.valor_base_calculado || 0), 0);
  const premiacaoPorPosicao = (pos: number | null | undefined) => {
    if (!pos) return 0;
    if (pos === 1) return 20_000_000;
    if (pos === 2) return 12_000_000;
    if (pos === 3) return 8_000_000;
    if (pos === 4) return 5_000_000;
    if (pos <= 8) return 3_000_000;
    if (pos <= 12) return 1_500_000;
    if (pos <= 16) return 750_000;
    if (pos <= 20) return 300_000;
    return 0;
  };
  const premiacao = premiacaoPorPosicao(club.posicao_ultima_temporada);
  const manutencao = (club.nivel_base || 1) * econParams.manut_base;
  const manutencaoEstadio =
    (club.nivel_estadio || 1) * econParams.manut_estadio * (Number(club.stadium_capacity || 0) / 10000);
  // Direitos de imagem
  const direitosImagemCusto = valorBaseFolha * imgSettings.custo_pct;
  const direitosImagemReceita = direitosImagemCusto * imgSettings.receita_pct;
  // Bilheteria estimada (mantém fórmula simples para o resumo)
  const cap = Number(club.stadium_capacity || 0);
  const ocNac = Math.max(0.3, Math.min(1, 1 - ((Number(club.preco_ingresso_nacional || 15) - 5) / 25) * 0.5));
  const ocInt = Math.max(0.3, Math.min(1, 1 - ((Number(club.preco_ingresso_internacional || 25) - 10) / 40) * 0.5));
  const recPorJogo =
    (cap * ocNac * Number(club.preco_ingresso_nacional || 15) +
      cap * ocInt * Number(club.preco_ingresso_internacional || 25)) /
    2;
  const bilheteria = recPorJogo * Number(club.jogos_por_temporada || 38);
  const custosOperacionais = (contratosTotal + direitosTv + bilheteria) * econParams.operacionais_pct;
  const entradasAnuais = contratosTotal + direitosTv + direitosImagemReceita + premiacao + bilheteria;
  const saidasAnuais = folhaSalarial + manutencao + manutencaoEstadio + direitosImagemCusto + custosOperacionais;
  const saldoPrevisto = entradasAnuais - saidasAnuais;
  const entradasMensais = entradasAnuais / 12;
  const saidasMensais = saidasAnuais / 12;
  const exigClube = club.rate; // usado na fórmula calcStars

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Hero */}
      <Card className="p-4 sm:p-6 md:p-8 bg-gradient-card border-border/50 overflow-hidden relative">
        <div
          className="absolute inset-0 opacity-20"
          style={
            club.primary_color
              ? { background: `radial-gradient(circle at top right, ${club.primary_color}, transparent 100%)` }
              : undefined
          }
        />
        <div className="relative flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-center">
          <div className="flex items-start gap-4 w-full md:w-auto">
            <div className="h-16 w-16 sm:h-20 sm:w-20 md:h-32 md:w-32 flex items-center justify-center shrink-0">
              {club.crest_url ? (
                <img
                  src={club.crest_url}
                  alt={club.name}
                  className="h-full w-full object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
                />
              ) : (
                <Shield className="h-10 w-10 md:h-14 md:w-14 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0 md:hidden">
              <h1 className="text-xl sm:text-2xl font-bold leading-tight break-words">{club.name}</h1>
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider mt-2">Caixa Atual</div>
              <div className="text-xl font-display font-bold gold-text">{formatCurrency(Number(club.budget))}</div>
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-2 w-full">
            <div className="flex items-center gap-2 flex-wrap">
              {club.owner_id ? (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary/60 border border-border/50 pl-1 pr-2.5 py-0.5">
                  <Avatar className="h-5 w-5 ring-1 ring-primary/30">
                    <AvatarImage src={ownerInfo?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[9px] bg-secondary">
                      {(ownerInfo?.display_name ?? "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[10px] font-semibold text-foreground/90 max-w-[140px] truncate">
                    {ownerInfo?.display_name ?? "Dono"}
                  </span>
                </div>
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Sem dono
                </Badge>
              )}
              {club.founded_year && (
                <Badge variant="outline" className="text-[10px]">
                  Fundado em {club.founded_year}
                </Badge>
              )}
              {club.reputacao && (
                <Badge variant="outline" className="capitalize text-[10px]">
                  {club.reputacao}
                </Badge>
              )}
              <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
                Rate {Number(club.rate ?? 2.8).toFixed(2)}
              </Badge>
            </div>
            <h1 className="hidden md:block text-3xl md:text-5xl font-bold break-words">{club.name}</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {club.city && (
                <span className="flex items-center gap-1 min-w-0">
                  <MapPin className="h-3 w-3 shrink-0 text-primary" /> <span className="truncate">{club.city}</span>
                </span>
              )}
              {club.stadium_name && (
                <span className="flex items-center gap-1 min-w-0">
                  <Building2 className="h-3 w-3 shrink-0 text-primary" />{" "}
                  <span className="truncate">{club.stadium_name}</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3 shrink-0 text-primary" /> {players.length}/35 jogadores ·{" "}
                {players.filter((p: any) => (p.nationality || "") !== "Solara").length}/10 estrangeiros
              </span>
            </div>
          </div>
          <div className="hidden md:block text-right shrink-0">
            <div className="text-xs uppercase text-muted-foreground tracking-wider">Caixa Atual</div>
            <div className="text-3xl md:text-4xl font-display font-bold gold-text">
              {formatCurrency(Number(club.budget))}
            </div>
          </div>
        </div>
      </Card>

      <div className="stat-grid">
        <StatCard icon={Wallet} label="Entradas / mês" value={formatCurrency(entradasMensais)} positive />
        <StatCard
          icon={TrendingDown}
          label="Saídas / mês"
          value={formatCurrency(saidasMensais)}
          iconClassName="text-destructive"
        />
        <StatCard
          icon={TrendingUp}
          label="Lucro/Prejuízo previsto"
          value={formatCurrency(saldoPrevisto)}
          positive={saldoPrevisto >= 0}
        />
        <StatCard
          icon={Users}
          label="Folha salarial"
          value={formatCurrency(folhaSalarial)}
          iconClassName="text-destructive"
        />
      </div>

      <Tabs
        value={initialTab}
        onValueChange={(v) => {
          const sp = new URLSearchParams(searchParams);
          if (v === "elenco") sp.delete("tab");
          else sp.set("tab", v);
          setSearchParams(sp, { replace: true });
        }}
        className="w-full"
      >
        <div className="-mx-3 sm:-mx-4 md:mx-0 overflow-x-auto scrollbar-thin">
          <TabsList className="bg-secondary/50 mx-3 sm:mx-4 md:mx-0 w-max">
            <TabsTrigger value="elenco">Elenco</TabsTrigger>
            <TabsTrigger value="escalacao">Escalação</TabsTrigger>
            {canEdit && <TabsTrigger value="evolucao">Evolução</TabsTrigger>}
            {canEdit && <TabsTrigger value="treinos">Treinos</TabsTrigger>}
            <TabsTrigger value="financas">Finanças</TabsTrigger>
            <TabsTrigger value="base">Base</TabsTrigger>
            {canEdit && <TabsTrigger value="olheiros">Olheiros</TabsTrigger>}
            <TabsTrigger value="estadio">Estádio</TabsTrigger>
            <TabsTrigger value="camisas">Camisas</TabsTrigger>
            <TabsTrigger value="wiki">Wiki</TabsTrigger>
            {canEdit && <TabsTrigger value="config">Configurações</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="elenco" className="mt-4">
          {players.length === 0 ? (
            <Card className="p-8 text-center bg-gradient-card border-border/50 text-muted-foreground">
              Sem jogadores no elenco.
            </Card>
          ) : (
            <SquadTable
              players={players}
              club={club}
              canEdit={canEdit}
              isAdmin={isAdmin}
              temporadaAtual={temporadaAtual}
              toggleSale={toggleSale}
              toggleBlockProposals={toggleBlockProposals}
              setRenewPlayer={setRenewPlayer}
              setShirtPlayer={setShirtPlayer}
              setMultaPlayer={setMultaPlayer}
              myClub={myClub}
              scoutReports={scoutReports}
              onOpenProfile={(id) => setProfilePlayerId(id)}
            />
          )}
        </TabsContent>

        <TabsContent value="escalacao" className="mt-4">
          <LineupManager
            players={players}
            club={club}
            canEdit={canEdit}
            initialLineup={
              club.lineup
                ? {
                    formation: (club.lineup as any).formation,
                    mentality: (club.lineup as any).mentality,
                    pitchIds: (club.lineup as any).pitchIds,
                    benchIds: (club.lineup as any).benchIds,
                    playStyle: (club.lineup as any).playStyle,
                    pressing: (club.lineup as any).pressing,
                    aerial: (club.lineup as any).aerial,
                  }
                : null
            }
            onSave={async ({ pitchIds, benchIds, formation, mentality, playStyle, pressing, aerial }) => {
              const { error } = await supabase
                .from("clubs")
                .update({
                  lineup: { formation, mentality, pitchIds, benchIds, playStyle, pressing, aerial } as any,
                })
                .eq("id", id!);
              if (error) throw error;
              await load();
            }}
          />
        </TabsContent>

        {canEdit && (
          <TabsContent value="olheiros" className="mt-4">
            <ScoutsManager
              targetClub={club}
              players={players}
              myClub={myClub}
              scoutReports={scoutReports}
              onReportCreated={handleScoutReportCreated}
            />
          </TabsContent>
        )}

        <TabsContent value="financas" className="space-y-4 mt-4">
          {/* Cards-resumo */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4 bg-gradient-card border-border/50">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Entradas mensais</div>
              <div className="font-display font-bold text-success mt-1">{formatCurrency(entradasMensais)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{formatCurrency(entradasAnuais)} / ano</div>
            </Card>
            <Card className="p-4 bg-gradient-card border-border/50">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Saídas mensais</div>
              <div className="font-display font-bold text-destructive mt-1">{formatCurrency(saidasMensais)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{formatCurrency(saidasAnuais)} / ano</div>
            </Card>
            <Card className="p-4 bg-gradient-card border-border/50">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Lucro/Prejuízo previsto</div>
              <div
                className={`font-display font-bold mt-1 ${saldoPrevisto >= 0 ? "text-success" : "text-destructive"}`}
              >
                {formatCurrency(saldoPrevisto)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">por temporada</div>
            </Card>
            <Card className="p-4 bg-gradient-card border-border/50">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Caixa atual</div>
              <div className="font-display font-bold gold-text mt-1">{formatCurrency(Number(club.budget))}</div>
            </Card>
          </div>

          {/* Detalhamento de receitas e despesas */}
          <div className="grid md:grid-cols-2 gap-3">
            <Card className="p-4 bg-gradient-card border-border/50 space-y-2">
              <h4 className="font-display font-bold text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" /> Receitas anuais
              </h4>
              <div className="text-sm space-y-1">
                <Row label="Patrocínios" value={contratosTotal} positive />
                <Row label="Direitos de TV" value={direitosTv} positive />
                <Row label="Direitos de imagem" value={direitosImagemReceita} positive />
                <Row label="Bilheteria estimada" value={bilheteria} positive />
                <Row label="Premiação por posição" value={premiacao} positive />
                <hr className="border-border/40" />
                <Row label="Total" value={entradasAnuais} positive bold />
              </div>
            </Card>
            <Card className="p-4 bg-gradient-card border-border/50 space-y-2">
              <h4 className="font-display font-bold text-sm flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" /> Despesas anuais
              </h4>
              <div className="text-sm space-y-1">
                <Row label="Folha salarial" value={folhaSalarial} />
                <Row label="Direitos de imagem (custo)" value={direitosImagemCusto} />
                <Row label="Manutenção da base" value={manutencao} />
                <Row label="Manutenção do estádio" value={manutencaoEstadio} />
                <Row
                  label={`Custos operacionais (${Math.round(econParams.operacionais_pct * 100)}%)`}
                  value={custosOperacionais}
                />
                <hr className="border-border/40" />
                <Row label="Total" value={saidasAnuais} bold />
              </div>
            </Card>
          </div>

          {/* Contratos: patrocínios + TV + imagem */}
          <ContractsManager
            clubId={id!}
            canEdit={canEdit}
            reputacao={club.reputacao}
            valorBaseFolha={valorBaseFolha}
            onChange={load}
          />

          {/* Empréstimos bancários */}
          <LoanManager club={club} canEdit={canEdit} onChange={load} />

          {/* Gráficos financeiros */}
          <div className="grid lg:grid-cols-2 gap-3">
            <Card className="p-4 bg-gradient-card border-border/50">
              <h4 className="font-display font-bold text-sm flex items-center gap-2 mb-3">
                <LineChart className="h-4 w-4 text-primary" /> Receitas, despesas e lucro por temporada
              </h4>
              {seasonAggregates.length === 0 ? (
                <div className="text-xs text-muted-foreground py-8 text-center">Sem dados ainda.</div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RLineChart data={seasonAggregates} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis dataKey="temporada" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickFormatter={(v) => `${(Number(v) / 1_000_000).toFixed(1)}M`}
                      />
                      <RTooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(v: any, n: any) => [formatCurrency(Number(v)), n]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line
                        type="monotone"
                        dataKey="receitas"
                        name="Receitas"
                        stroke="hsl(var(--success))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="despesas"
                        name="Despesas"
                        stroke="hsl(var(--destructive))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="lucro"
                        name="Lucro"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </RLineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card className="p-4 bg-gradient-card border-border/50">
              <h4 className="font-display font-bold text-sm flex items-center gap-2 mb-3">
                <TrendingDown className="h-4 w-4 text-destructive" /> Despesas da temporada {temporadaAtual} por
                categoria
              </h4>
              {despesasAtuaisPorCategoria.length === 0 ? (
                <div className="text-xs text-muted-foreground py-8 text-center">
                  Sem despesas registradas nesta temporada.
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={despesasAtuaisPorCategoria}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={2}
                      >
                        {despesasAtuaisPorCategoria.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RTooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(v: any, n: any) => [formatCurrency(Number(v)), formatCat(String(n))]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} formatter={(n) => formatCat(String(n))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          {/* Transferências e investimentos em infraestrutura */}
          <Card className="p-4 bg-gradient-card border-border/50">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h4 className="font-display font-bold text-sm flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-primary" /> Transferências e investimentos
              </h4>
              <div className="flex items-center gap-2 text-[10px]">
                <Badge variant="outline" className="text-[10px]">
                  ↓ Compras: {transferStats.c}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  ↑ Vendas: {transferStats.v}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  🌍 Exterior: {transferStats.e}
                </Badge>
              </div>
            </div>
            {recentTransactions.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">
                Nenhuma transferência ou upgrade registrado.
              </div>
            ) : (
              <div className="space-y-5">
                {transactionsBySeason.map(([season, items]) => {
                  const totalIn = items
                    .filter((t) => t.tipo === "entrada")
                    .reduce((s, t) => s + Number(t.valor || 0), 0);
                  const totalOut = items
                    .filter((t) => t.tipo === "saida")
                    .reduce((s, t) => s + Number(t.valor || 0), 0);
                  return (
                    <div key={season} className="space-y-2">
                      <div className="flex items-center justify-between border-b border-border/40 pb-1">
                        <div className="font-display font-bold text-xs uppercase tracking-wider text-primary">
                          Temporada {season}
                        </div>
                        <div className="flex gap-2 text-[10px]">
                          <span className="text-success">+{formatCurrency(totalIn)}</span>
                          <span className="text-destructive">-{formatCurrency(totalOut)}</span>
                          <span className={totalIn - totalOut >= 0 ? "text-success" : "text-destructive"}>
                            ({formatCurrency(totalIn - totalOut)})
                          </span>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[10px]">Data</TableHead>
                              <TableHead className="text-[10px]">Categoria</TableHead>
                              <TableHead className="text-[10px]">Descrição</TableHead>
                              <TableHead className="text-[10px] text-right">Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((t) => {
                              const isIn = t.tipo === "entrada";
                              const catLabel =
                                t.categoria === "transferencia"
                                  ? isIn
                                    ? "Venda"
                                    : "Compra"
                                  : t.categoria === "transferencia_externa"
                                    ? "Venda (exterior)"
                                    : t.categoria === "upgrade_estadio"
                                      ? "Upgrade estádio"
                                      : t.categoria === "upgrade_academia"
                                        ? "Upgrade base"
                                        : t.categoria;
                              return (
                                <TableRow key={t.id} className="text-xs">
                                  <TableCell className="text-muted-foreground">
                                    {new Date(t.created_at).toLocaleDateString("pt-BR")}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-[10px]">
                                      {catLabel}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="max-w-[280px] truncate" title={t.descricao}>
                                    {t.descricao}
                                  </TableCell>
                                  <TableCell
                                    className={`text-right tabular-nums font-semibold ${isIn ? "text-success" : "text-destructive"}`}
                                  >
                                    {isIn ? "+" : "-"}
                                    {formatCurrency(Number(t.valor))}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        {canEdit && (
          <TabsContent value="evolucao" className="mt-4">
            <EvolutionTable players={players} />
          </TabsContent>
        )}

        <TabsContent value="estadio" className="mt-4">
          <StadiumManager club={club} canEdit={canEdit} onChange={load} />
        </TabsContent>

        <TabsContent value="base" className="mt-4">
          <AcademyManager club={club} canEdit={canEdit} onChange={load} myClub={myClub} />
        </TabsContent>

        {canEdit && (
          <TabsContent value="treinos" className="mt-4">
            <TrainingsManager
              club={club}
              players={players}
              canEdit={canEdit}
              temporadaAtual={temporadaAtual}
              onChange={load}
            />
          </TabsContent>
        )}

        <TabsContent value="wiki" className="mt-4">
          <div>
            <div className="float-right ml-6 mb-4 w-full md:w-[320px]">
              <ClubInfobox
                club={club}
                infobox={(wikiData.infobox as InfoboxData) || {}}
                canEdit={canEdit}
                onSave={saveInfobox}
              />
            </div>
            <WikiSectionsView wiki={wikiData} title={club.name} canEdit={canEdit} onSaveWiki={saveWiki} />
            <div className="clear-both" />
          </div>
        </TabsContent>

        <TabsContent value="camisas" className="mt-4">
          <KitsGallery clubId={id!} canEdit={canEdit} />
        </TabsContent>

        {canEdit && (
          <TabsContent value="config" className="mt-4">
            <Card className="p-5 bg-gradient-card border-border/50 space-y-3">
              <h3 className="font-display font-bold">Editar Informações</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={editingClub?.name || ""}
                    onChange={(e) => setEditingClub({ ...editingClub, name: e.target.value })}
                  />
                </div>
                <div className="md:col-span-1">
                  <Label>Escudo</Label>
                  <ImageUpload
                    value={editingClub?.crest_url}
                    onChange={(url) => setEditingClub({ ...editingClub, crest_url: url })}
                    folder={id}
                  />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input
                    value={editingClub?.city || ""}
                    onChange={(e) => setEditingClub({ ...editingClub, city: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Estádio</Label>
                  <Input
                    value={editingClub?.stadium_name || ""}
                    onChange={(e) => setEditingClub({ ...editingClub, stadium_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Cor primária (hex)</Label>
                  <Input
                    value={editingClub?.primary_color || ""}
                    onChange={(e) => setEditingClub({ ...editingClub, primary_color: e.target.value })}
                    placeholder="#ffbe1a"
                  />
                </div>
                <div>
                  <Label>Ano de fundação</Label>
                  <Input
                    type="number"
                    value={editingClub?.founded_year || ""}
                    onChange={(e) => setEditingClub({ ...editingClub, founded_year: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={saveClubInfo} className="bg-gradient-gold text-primary-foreground hover:opacity-90">
                <Save className="h-4 w-4" /> Salvar
              </Button>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {renewPlayer && (
        <ContractRenewalDialog
          player={renewPlayer}
          open={!!renewPlayer}
          onOpenChange={(v) => !v && setRenewPlayer(null)}
          onRenewed={() => {
            setRenewPlayer(null);
            load();
          }}
        />
      )}
      <ShirtNumberDialog
        player={shirtPlayer}
        open={!!shirtPlayer}
        onOpenChange={(v) => !v && setShirtPlayer(null)}
        onSaved={load}
      />
      <MultaRescisoriaDialog
        player={multaPlayer}
        open={!!multaPlayer}
        onOpenChange={(v) => !v && setMultaPlayer(null)}
        myClubId={user ? (club?.owner_id === user.id ? club.id : null) : null}
        isAdmin={isAdmin}
        onDone={load}
      />
      <PlayerProfileDialog
        playerId={profilePlayerId}
        open={!!profilePlayerId}
        onOpenChange={(v) => !v && setProfilePlayerId(null)}
      />
    </div>
  );
};

export default ClubDetail;
