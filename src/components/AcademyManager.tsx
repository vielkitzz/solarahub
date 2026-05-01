import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  GraduationCap,
  Search,
  ArrowUp,
  X,
  AlertTriangle,
  Sparkles,
  Star,
  ArrowUpCircle,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Telescope,
} from "lucide-react";
import { POSITIONS, formatCurrency, calcStars } from "@/lib/format";
import { COUNTRIES_DATA, getFlagUrl } from "@/lib/countries";
import { StarRating } from "@/components/StarRating";
import { generateRandomName } from "@/lib/scouting-names";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import type { ScoutReport } from "@/lib/scout"; // Certifique-se de que essa exportação exista

interface Props {
  club: any;
  canEdit: boolean;
  onChange: () => void;
}

interface AcademyPlayer {
  id: string;
  club_id: string;
  name: string;
  position: string;
  age: number;
  nationality: string | null;
  skill: number;
  potential_min: number;
  potential_max: number;
  development_progress: number;
  seasons_in_academy: number;
  free_agent: boolean;
  created_at: string;
}

interface ScoutResult {
  scout_id: string;
  scout_name: string;
  scout_position: string;
  scout_age: number;
  scout_nationality: string | null;
  scout_skill: number;
  scout_potential_min: number;
  scout_potential_max: number;
}

const NIVEL_LABELS = ["—", "Modesto", "Regional", "Profissional", "Premium", "Elite"];

// Custos de upgrade da base
const BASE_UPGRADE_CUSTOS: Record<string, number> = {
  "1_2": 800_000,
  "2_3": 4_000_000,
  "3_4": 18_000_000,
  "4_5": 35_000_000,
};

// ─── Estilos da Tabela ────────────────────────────────────────────────────────
const POSITION_COLORS: Record<string, { color: string; bg: string }> = {
  GOL: { color: "text-yellow-300", bg: "bg-yellow-400/20 border-yellow-400/50" },
  ZAG: { color: "text-blue-300", bg: "bg-blue-500/20 border-blue-400/50" },
  LD: { color: "text-sky-300", bg: "bg-sky-500/20 border-sky-400/50" },
  LE: { color: "text-sky-300", bg: "bg-sky-500/20 border-sky-400/50" },
  VOL: { color: "text-teal-300", bg: "bg-teal-500/20 border-teal-400/50" },
  MC: { color: "text-emerald-300", bg: "bg-emerald-500/20 border-emerald-400/50" },
  MEI: { color: "text-lime-300", bg: "bg-lime-500/20 border-lime-400/50" },
  PD: { color: "text-orange-300", bg: "bg-orange-500/20 border-orange-400/50" },
  PE: { color: "text-orange-300", bg: "bg-orange-500/20 border-orange-400/50" },
  SA: { color: "text-red-300", bg: "bg-red-500/20 border-red-400/50" },
  ATA: { color: "text-rose-300", bg: "bg-rose-500/20 border-rose-400/50" },
};

function getPositionStyle(position: string) {
  return (
    POSITION_COLORS[(position || "").toUpperCase()] ?? {
      color: "text-muted-foreground",
      bg: "bg-secondary/30 border-border/30",
    }
  );
}

function FlagImg({ nationality }: { nationality: string }) {
  const url = getFlagUrl(nationality);
  if (!url) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <img
      src={url}
      alt={nationality}
      title={nationality}
      className="h-6 w-8 object-cover rounded-sm"
      style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.1)" }}
    />
  );
}

// ─── Componente da Tabela da Base ─────────────────────────────────────────────
function AcademyTable({
  players,
  club,
  canEdit,
  promover,
  dispensar,
  pronto,
  scoutReports,
  pesquisar,
  scoutingId,
  searchesRestantes,
}: {
  players: AcademyPlayer[];
  club: any;
  canEdit: boolean;
  promover: (p: AcademyPlayer) => void;
  dispensar: (p: AcademyPlayer) => void;
  pronto: (p: AcademyPlayer) => boolean;
  scoutReports: Record<string, any>;
  pesquisar: (playerId: string) => void;
  scoutingId: string | null;
  searchesRestantes: number;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState("todas");
  const [statusFilter, setStatusFilter] = useState("todos");

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>({
    key: "desenvolvimento",
    direction: "desc",
  });

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) return <ArrowUpDown className="h-3 w-3 opacity-20 shrink-0" />;
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="h-3 w-3 shrink-0" />
    ) : (
      <ChevronDown className="h-3 w-3 shrink-0" />
    );
  };

  const filteredAndSorted = useMemo(() => {
    return players
      .filter((p) => {
        if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (positionFilter !== "todas" && p.position !== positionFilter) return false;
        if (statusFilter === "pronto" && !pronto(p)) return false;
        if (statusFilter === "desenvolvimento" && pronto(p)) return false;
        return true;
      })
      .sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        const modifier = direction === "asc" ? 1 : -1;

        switch (key) {
          case "posicao":
            const ai = POSITIONS.indexOf(a.position);
            const bi = POSITIONS.indexOf(b.position);
            const av = ai === -1 ? 999 : ai;
            const bv = bi === -1 ? 999 : bi;
            if (av !== bv) return (av - bv) * modifier;
            return (Number(b.development_progress || 0) - Number(a.development_progress || 0)) * modifier;
          case "nome":
            return a.name.localeCompare(b.name) * modifier;
          case "nacionalidade":
            return (a.nationality || "").localeCompare(b.nationality || "") * modifier;
          case "idade":
            return (Number(a.age || 0) - Number(b.age || 0)) * modifier;
          case "qualidade":
            return (Number(a.skill || 0) - Number(b.skill || 0)) * modifier;
          case "potencial":
            const repA = scoutReports[a.id];
            const repB = scoutReports[b.id];
            const valA = repA ? repA.potential_max_revelado : 0;
            const valB = repB ? repB.potential_max_revelado : 0;
            return (valA - valB) * modifier;
          case "desenvolvimento":
            return (Number(a.development_progress || 0) - Number(b.development_progress || 0)) * modifier;
          default:
            return 0;
        }
      });
  }, [players, searchTerm, positionFilter, statusFilter, sortConfig, scoutReports]);

  return (
    <div className="space-y-0 rounded-lg overflow-hidden border border-border/50 bg-gradient-card mt-4">
      <div className="flex items-center gap-4 px-4 py-2.5 bg-secondary/40 border-b border-border/50 text-xs text-muted-foreground flex-wrap">
        <span className="font-semibold text-foreground">{filteredAndSorted.length} jogadores na base</span>
        <div className="ml-auto flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
            <Telescope className="h-3.5 w-3.5" />
            <span className="font-bold">{searchesRestantes}</span> pesquisas de olheiro restantes
          </span>
        </div>
      </div>

      <div className="p-3 bg-secondary/10 border-b border-border/50 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pelo nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs bg-background/50"
          />
        </div>

        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger className="h-9 text-xs bg-background/50">
            <SelectValue placeholder="Todas as posições" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as posições</SelectItem>
            {POSITIONS.map((pos) => (
              <SelectItem key={pos} value={pos}>
                {pos}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 text-xs bg-background/50">
            <SelectValue placeholder="Qualquer status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Qualquer status</SelectItem>
            <SelectItem value="pronto">Prontos para promover</SelectItem>
            <SelectItem value="desenvolvimento">Em desenvolvimento</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50 bg-secondary/20">
              <TableHead
                className="w-16 cursor-pointer select-none hover:bg-secondary/40 transition-colors"
                onClick={() => handleSort("posicao")}
              >
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  Posição <SortIcon columnKey="posicao" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none hover:bg-secondary/40 transition-colors"
                onClick={() => handleSort("nome")}
              >
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  Nome <SortIcon columnKey="nome" />
                </div>
              </TableHead>

              <TableHead
                className="w-20 hidden sm:table-cell cursor-pointer select-none hover:bg-secondary/40 transition-colors"
                onClick={() => handleSort("nacionalidade")}
              >
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  Nacionalidade <SortIcon columnKey="nacionalidade" />
                </div>
              </TableHead>

              <TableHead
                className="w-16 cursor-pointer select-none hover:bg-secondary/40 transition-colors"
                onClick={() => handleSort("idade")}
              >
                <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  Idade <SortIcon columnKey="idade" />
                </div>
              </TableHead>

              <TableHead
                className="w-28 cursor-pointer select-none hover:bg-secondary/40 transition-colors"
                onClick={() => handleSort("qualidade")}
              >
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  Qualidade <SortIcon columnKey="qualidade" />
                </div>
              </TableHead>

              <TableHead
                className="w-44 cursor-pointer select-none hover:bg-secondary/40 transition-colors"
                onClick={() => handleSort("potencial")}
              >
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  Potencial <SortIcon columnKey="potencial" />
                </div>
              </TableHead>

              <TableHead
                className="w-32 cursor-pointer select-none hover:bg-secondary/40 transition-colors"
                onClick={() => handleSort("desenvolvimento")}
              >
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  Desenvolvimento <SortIcon columnKey="desenvolvimento" />
                </div>
              </TableHead>

              {canEdit && <TableHead className="w-24 text-right" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 8 : 7} className="text-center py-8 text-muted-foreground">
                  Nenhum jogador encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSorted.map((p) => {
                const finalizado = pronto(p);
                const stars = calcStars(p.skill, club.rate);
                const ps = getPositionStyle(p.position);

                // Relatório do Olheiro
                const rep = scoutReports[p.id];
                const potStarsMin = rep ? calcStars(rep.potential_min_revelado, club.rate) : null;
                const potStarsMax = rep ? calcStars(rep.potential_max_revelado, club.rate) : null;

                return (
                  <TableRow
                    key={p.id}
                    className={`border-border/30 hover:bg-primary/5 transition-colors text-sm ${finalizado ? "bg-primary/5" : ""}`}
                  >
                    <TableCell className="py-2">
                      <span
                        className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${ps.bg} ${ps.color}`}
                      >
                        {p.position || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate max-w-[160px]">{p.name}</span>
                        {finalizado && (
                          <span title="Pronto para promover">
                            <Sparkles className="h-3 w-3 text-primary shrink-0" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 hidden sm:table-cell">
                      <FlagImg nationality={p.nationality || ""} />
                    </TableCell>
                    <TableCell className="py-2 text-center text-xs text-muted-foreground tabular-nums">
                      {p.age ?? "—"}
                    </TableCell>
                    <TableCell className="py-2">
                      <StarRating value={stars} />
                    </TableCell>

                    <TableCell className="py-2">
                      {rep ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground w-7">min</span>
                            <StarRating value={potStarsMin || 0} />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground w-7">máx</span>
                            <StarRating value={potStarsMax || 0} />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-0.5 text-muted-foreground/40">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} style={{ width: 14, height: 14 }} />
                            ))}
                            <span className="text-[10px] ml-1.5">desconhecido</span>
                          </div>
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={searchesRestantes <= 0 || scoutingId === p.id}
                              onClick={() => pesquisar(p.id)}
                              className="h-6 text-[10px] px-2"
                              title="Usar Olheiro para descobrir o potencial"
                            >
                              <Telescope className="h-3 w-3 mr-1" />
                              {scoutingId === p.id ? "..." : "Analisar"}
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="py-2">
                      <div className="flex flex-col gap-1 w-24">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>{Math.round(p.development_progress)}%</span>
                        </div>
                        <Progress value={p.development_progress} className="h-1.5" />
                      </div>
                    </TableCell>
                    {canEdit && (
                      <TableCell className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {finalizado ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Promover"
                              onClick={() => promover(p)}
                              className="h-7 w-7 text-primary hover:text-primary/80"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Promover já (Aplica penalidade)"
                              onClick={() => promover(p)}
                              className="h-7 w-7 text-amber-400 hover:text-amber-500"
                            >
                              <AlertTriangle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Dispensar"
                            onClick={() => dispensar(p)}
                            className="h-7 w-7 text-destructive hover:text-destructive/80"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Gerenciador Principal ────────────────────────────────────────────────────
export const AcademyManager = ({ club, canEdit, onChange }: Props) => {
  const [players, setPlayers] = useState<AcademyPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  // Scout e Peneira
  const [scoutOpen, setScoutOpen] = useState(false);
  const [scoutPositions, setScoutPositions] = useState<string[]>([]);
  const [scoutAgeMin, setScoutAgeMin] = useState(14);
  const [scoutAgeMax, setScoutAgeMax] = useState(23);
  const [scoutNat, setScoutNat] = useState<string>("__any__");
  const [scoutLoading, setScoutLoading] = useState(false);
  const [scoutResults, setScoutResults] = useState<ScoutResult[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [savingScout, setSavingScout] = useState(false);

  // Olheiro
  const [scoutReports, setScoutReports] = useState<Record<string, any>>({});
  const [scoutingId, setScoutingId] = useState<string | null>(null);
  const [searchesUsed, setSearchesUsed] = useState<number>(club?.scout_searches_used ?? 0);

  const [upgradingBase, setUpgradingBase] = useState(false);

  const peneirasUsadas = club.academy_scouting_count ?? 0;
  const peneirasRestantes = Math.max(0, 2 - peneirasUsadas);
  const pesquisasRestantes = Math.max(0, 10 - searchesUsed);

  const load = async () => {
    setLoading(true);

    // Carregar jogadores da base
    const { data: playersData, error: playersError } = await supabase
      .from("academy_players")
      .select("*")
      .eq("club_id", club.id)
      .order("development_progress", { ascending: false });

    if (playersError) toast.error(playersError.message);
    setPlayers((playersData as AcademyPlayer[]) || []);

    // Carregar relatórios de olheiro já feitos (opcional, dependendo do seu backend)
    try {
      const { data: reportsData } = await supabase
        .from("scout_reports") // Substitua pelo nome correto da sua tabela de relatórios
        .select("*")
        .eq("scouter_club_id", club.id);

      if (reportsData) {
        const reportsMap: Record<string, any> = {};
        reportsData.forEach((r) => {
          reportsMap[r.target_player_id] = {
            potential_min_revelado: r.potential_min_revelado,
            potential_max_revelado: r.potential_max_revelado,
            margem_aplicada: r.margem_aplicada,
          };
        });
        setScoutReports(reportsMap);
      }
    } catch (e) {
      console.warn("Não foi possível carregar relatórios prévios (pode ignorar se não usar persistência).");
    }

    setLoading(false);
  };

  useEffect(() => {
    setSearchesUsed(club?.scout_searches_used ?? 0);
  }, [club?.id, club?.scout_searches_used]);

  useEffect(() => {
    load();
  }, [club.id]);

  const proximoNivel = (club.nivel_base || 1) < 5 ? (club.nivel_base || 1) + 1 : null;
  const custoUpgrade = proximoNivel ? BASE_UPGRADE_CUSTOS[`${club.nivel_base}_${proximoNivel}`] || 0 : 0;

  const upgradeBase = async () => {
    if (!proximoNivel) return;
    if (Number(club.budget) < custoUpgrade) {
      return toast.error(`Caixa insuficiente. Necessário ${formatCurrency(custoUpgrade)}`);
    }
    if (!confirm(`Subir a base para nível ${proximoNivel} por ${formatCurrency(custoUpgrade)}?`)) return;
    setUpgradingBase(true);
    const { error } = await supabase
      .from("clubs")
      .update({ nivel_base: proximoNivel, budget: Number(club.budget) - custoUpgrade })
      .eq("id", club.id);
    setUpgradingBase(false);
    if (error) return toast.error(error.message);
    toast.success(`Base evoluiu para nível ${proximoNivel}!`);
    onChange();
  };

  const realizarPeneira = async () => {
    if (peneirasRestantes <= 0) return toast.error("Limite de peneiras desta temporada atingido");
    setScoutLoading(true);
    setScoutResults(null);
    setPicked(new Set());
    const { data, error } = await supabase.rpc("realizar_peneira_v2" as any, {
      _club_id: club.id,
      _positions: scoutPositions.length > 0 ? scoutPositions : null,
      _age_min: scoutAgeMin,
      _age_max: scoutAgeMax,
      _nationality: scoutNat === "__any__" ? null : scoutNat,
    });
    setScoutLoading(false);
    if (error) return toast.error(error.message);

    const enriched = await Promise.all(
      (data as ScoutResult[]).map(async (p) => {
        const finalNationality =
          p.scout_nationality || COUNTRIES_DATA[Math.floor(Math.random() * COUNTRIES_DATA.length)].name;

        return {
          ...p,
          scout_nationality: finalNationality,
          scout_name: await generateRandomName(finalNationality),
        };
      }),
    );

    setScoutResults(enriched);
    onChange();
  };

  const togglePick = (id: string) => {
    const next = new Set(picked);
    next.has(id) ? next.delete(id) : next.add(id);
    setPicked(next);
  };

  const confirmarPicks = async () => {
    if (!scoutResults) return;
    const escolhidos = scoutResults.filter((p) => picked.has(p.scout_id));
    if (escolhidos.length === 0) {
      setScoutOpen(false);
      setScoutResults(null);
      return;
    }
    setSavingScout(true);
    const rows = escolhidos.map((p) => ({
      club_id: club.id,
      name: p.scout_name,
      position: p.scout_position,
      age: p.scout_age,
      nationality: p.scout_nationality,
      skill: p.scout_skill,
      potential_min: p.scout_potential_min,
      potential_max: p.scout_potential_max,
    }));
    const { error } = await supabase.from("academy_players").insert(rows);
    setSavingScout(false);
    if (error) return toast.error(error.message);
    toast.success(`${escolhidos.length} jogador(es) adicionado(s) à base!`);
    setScoutOpen(false);
    setScoutResults(null);
    setPicked(new Set());
    load();
  };

  const dispensar = async (p: AcademyPlayer) => {
    if (!confirm(`Dispensar ${p.name}? Esta ação é permanente.`)) return;
    const { error } = await supabase.from("academy_players").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Jogador dispensado");
    load();
  };

  const promover = async (p: AcademyPlayer) => {
    const aviso =
      p.development_progress < 100
        ? `Promover ${p.name} antes do desenvolvimento completo (${Math.round(p.development_progress)}%)?\n\nEle subirá com habilidade atual e terá uma penalidade no potencial proporcional ao quanto faltou.`
        : `Promover ${p.name} ao elenco principal?`;
    if (!confirm(aviso)) return;
    const { error } = await supabase.rpc("promover_academia" as any, {
      _academy_player_id: p.id,
    });
    if (error) return toast.error(error.message);
    toast.success(`${p.name} foi promovido ao elenco principal!`);
    load();
    onChange();
  };

  // Função que usa o olheiro para revelar potencial do jogador da base
  const pesquisarJogadorBase = async (playerId: string) => {
    if (!club) return;
    setScoutingId(playerId);
    try {
      const { data, error } = await supabase.rpc("scout_academy_player" as any, {
        _scouter_club_id: club.id,
        _target_player_id: playerId,
      });
      if (error) throw error;

      const res: any = data;

      setScoutReports((prev) => ({
        ...prev,
        [playerId]: {
          potential_min_revelado: res.potential_min,
          potential_max_revelado: res.potential_max,
          margem_aplicada: res.margem,
        },
      }));

      setSearchesUsed(res.searches_used);

      if (res.ja_existia) {
        toast.info("Relatório já existia — não consumiu pesquisa.");
      } else {
        toast.success(`Olheiro analisou o jogador (margem ±${res.margem}).`);
      }

      onChange(); // Atualiza contador do clube globalmente
    } catch (e: any) {
      toast.error(e.message || "Erro ao pesquisar jogador");
    } finally {
      setScoutingId(null);
    }
  };

  const pronto = (p: AcademyPlayer) => p.development_progress >= 100;

  return (
    <div className="space-y-4">
      {/* Visão geral da base */}
      <Card className="p-5 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-5 w-5 text-primary" />
            <div>
              <div className="font-display font-bold text-lg">Categoria de Base</div>
              <div className="text-xs text-muted-foreground">
                {NIVEL_LABELS[club.nivel_base] || "—"} · {players.length} jogador(es) na academia
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-5 w-5 ${i < (club.nivel_base || 0) ? "text-primary fill-primary" : "text-primary/25"}`}
              />
            ))}
          </div>
        </div>

        {canEdit && proximoNivel && (
          <div className="flex items-center justify-between gap-3 bg-background/40 rounded p-3 mt-4">
            <div>
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider">
                Próximo nível ({NIVEL_LABELS[proximoNivel]})
              </div>
              <div className="font-display font-bold gold-text text-lg">{formatCurrency(custoUpgrade)}</div>
              <div className="text-[10px] text-muted-foreground">
                Aumenta a chance de encontrar talentos raros nas peneiras
              </div>
            </div>
            <Button
              size="sm"
              onClick={upgradeBase}
              disabled={upgradingBase || Number(club.budget) < custoUpgrade}
              className="bg-gradient-gold text-primary-foreground hover:opacity-90"
            >
              <ArrowUpCircle className="h-4 w-4" />
              Evoluir base
            </Button>
          </div>
        )}
      </Card>

      {/* Peneira */}
      <Card className="p-5 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Search className="h-5 w-5 text-primary" />
            <div>
              <div className="font-display font-bold">Peneira</div>
              <div className="text-xs text-muted-foreground">
                {peneirasRestantes} de 2 peneiras restantes nesta temporada
              </div>
            </div>
          </div>
          {canEdit && (
            <Button
              onClick={() => {
                setScoutOpen(true);
                setScoutResults(null);
                setPicked(new Set());
              }}
              disabled={peneirasRestantes <= 0}
              className="bg-gradient-gold text-primary-foreground hover:opacity-90"
            >
              <Search className="h-4 w-4" />
              Realizar peneira
            </Button>
          )}
        </div>
      </Card>

      {/* Lista da academia em formato de tabela */}
      {loading ? (
        <Card className="p-6 bg-gradient-card border-border/50 text-muted-foreground text-sm">Carregando...</Card>
      ) : players.length === 0 ? (
        <Card className="p-8 bg-gradient-card border-border/50 text-center text-sm text-muted-foreground mt-4">
          Nenhum jogador na base. Realize uma peneira para começar.
        </Card>
      ) : (
        <AcademyTable
          players={players}
          club={club}
          canEdit={canEdit}
          promover={promover}
          dispensar={dispensar}
          pronto={pronto}
          scoutReports={scoutReports}
          pesquisar={pesquisarJogadorBase}
          scoutingId={scoutingId}
          searchesRestantes={pesquisasRestantes}
        />
      )}

      {/* Dialog peneira */}
      <Dialog
        open={scoutOpen}
        onOpenChange={(o) => {
          if (!o) {
            setScoutOpen(false);
            setScoutResults(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" /> Nova peneira
            </DialogTitle>
          </DialogHeader>

          {!scoutResults ? (
            <>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Posições (opcional — múltipla seleção)</Label>
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-border/50 bg-secondary/20">
                    {POSITIONS.map((p) => {
                      const active = scoutPositions.includes(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() =>
                            setScoutPositions((prev) => (active ? prev.filter((x) => x !== p) : [...prev, p]))
                          }
                          className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground"
                              : "bg-background/40 text-muted-foreground hover:text-foreground border border-border/40"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {scoutPositions.length === 0
                      ? "Nenhuma escolhida → posições aleatórias"
                      : `${scoutPositions.length} posição(ões) selecionada(s)`}
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="space-y-1 sm:col-span-1">
                    <Label className="text-xs">Nacionalidade</Label>
                    <Select value={scoutNat} onValueChange={setScoutNat}>
                      <SelectTrigger>
                        <SelectValue placeholder="Qualquer" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="__any__">Qualquer</SelectItem>
                        {COUNTRIES_DATA.map((c) => (
                          <SelectItem key={c.code} value={c.name}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Idade mín. (14–23)</Label>
                    <Input
                      type="number"
                      min={14}
                      max={23}
                      value={scoutAgeMin}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isNaN(v)) return;
                        setScoutAgeMin(Math.max(14, Math.min(23, v)));
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Idade máx. (14–23)</Label>
                    <Input
                      type="number"
                      min={14}
                      max={23}
                      value={scoutAgeMax}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isNaN(v)) return;
                        setScoutAgeMax(Math.max(14, Math.min(23, v)));
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground bg-secondary/30 rounded p-3 mt-2">
                A peneira gera entre 3 e 8 jogadores. A chance de talentos raros depende do nível da sua base (
                {club.nivel_base}). Esta operação consome 1 das 2 peneiras desta temporada.
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setScoutOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={realizarPeneira}
                  disabled={scoutLoading || peneirasRestantes <= 0}
                  className="bg-gradient-gold text-primary-foreground hover:opacity-90"
                >
                  {scoutLoading ? "Buscando..." : "Iniciar peneira"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="text-xs text-muted-foreground mb-2">
                {scoutResults.length} jogador(es) encontrado(s). Marque os que deseja levar para a base.
              </div>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {scoutResults.map((p) => {
                  const stars = calcStars(p.scout_skill, club.rate);
                  const potStars = calcStars(p.scout_potential_max, club.rate);
                  return (
                    <Card key={p.scout_id} className="p-3 bg-card/40 border-border/50">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={picked.has(p.scout_id)}
                          onCheckedChange={() => togglePick(p.scout_id)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div>
                              <div className="font-bold">{p.scout_name}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {p.scout_position} · {p.scout_age} anos · {p.scout_nationality || "—"}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[10px]">
                              Pot. {p.scout_potential_min}–{p.scout_potential_max}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center mt-2 text-[10px]">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Hab.</span>
                              <StarRating value={stars} />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Pot.</span>
                              <StarRating value={potStars} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
              <DialogFooter className="flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setScoutOpen(false);
                    setScoutResults(null);
                  }}
                >
                  Descartar todos
                </Button>
                <Button
                  onClick={confirmarPicks}
                  disabled={savingScout}
                  className="bg-gradient-gold text-primary-foreground hover:opacity-90"
                >
                  {savingScout ? "Salvando..." : `Adicionar ${picked.size} à base`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
