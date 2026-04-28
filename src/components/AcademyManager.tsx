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
  GraduationCap, Search, ArrowUp, X, AlertTriangle, Sparkles, Star, ArrowUpCircle,
} from "lucide-react";
import { POSITIONS, formatCurrency, calcStars } from "@/lib/format";
import { COUNTRIES_DATA } from "@/lib/countries";
import { StarRating } from "@/components/StarRating";
import { generateRandomName } from "@/lib/scouting-names";
import { toast } from "sonner";

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

// Custos de upgrade da base (estrutura simétrica ao estádio)
const BASE_UPGRADE_CUSTOS: Record<string, number> = {
  "1_2": 800_000,
  "2_3": 4_000_000,
  "3_4": 18_000_000,
  "4_5": 35_000_000,
};

export const AcademyManager = ({ club, canEdit, onChange }: Props) => {
  const [players, setPlayers] = useState<AcademyPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoutOpen, setScoutOpen] = useState(false);
  const [scoutPositions, setScoutPositions] = useState<string[]>([]);
  const [scoutAgeMin, setScoutAgeMin] = useState(14);
  const [scoutAgeMax, setScoutAgeMax] = useState(23);
  const [scoutNat, setScoutNat] = useState<string>("__any__");
  const [scoutLoading, setScoutLoading] = useState(false);
  const [scoutResults, setScoutResults] = useState<ScoutResult[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [savingScout, setSavingScout] = useState(false);
  const [upgradingBase, setUpgradingBase] = useState(false);

  const peneirasUsadas = club.academy_scouting_count ?? 0;
  const peneirasRestantes = Math.max(0, 2 - peneirasUsadas);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("academy_players")
      .select("*")
      .eq("club_id", club.id)
      .order("development_progress", { ascending: false });
    if (error) toast.error(error.message);
    setPlayers((data as AcademyPlayer[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [club.id]);

  const proximoNivel = (club.nivel_base || 1) < 5 ? (club.nivel_base || 1) + 1 : null;
  const custoUpgrade = proximoNivel
    ? BASE_UPGRADE_CUSTOS[`${club.nivel_base}_${proximoNivel}`] || 0
    : 0;

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
    const { data, error } = await supabase.rpc("realizar_peneira" as any, {
      _club_id: club.id,
      _position: scoutPos || null,
      _age_min: scoutAgeMin,
      _age_max: scoutAgeMax,
      _nationality: scoutNat === "__any__" ? null : scoutNat,
    });
    setScoutLoading(false);
    if (error) return toast.error(error.message);
    // Substitui nomes genéricos pelo banco local de nomes
    const enriched = (data as ScoutResult[]).map((p) => ({
      ...p,
      scout_name: generateRandomName(p.scout_nationality),
    }));
    setScoutResults(enriched);
    onChange(); // atualizar contador de peneiras
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
      // mesmo sem escolha, fechamos (peneira já foi consumida)
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

      {/* Lista da academia */}
      {loading ? (
        <Card className="p-6 bg-gradient-card border-border/50 text-muted-foreground text-sm">Carregando...</Card>
      ) : players.length === 0 ? (
        <Card className="p-8 bg-gradient-card border-border/50 text-center text-sm text-muted-foreground">
          Nenhum jogador na base. Realize uma peneira para começar.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {players.map((p) => {
            const finalizado = pronto(p);
            const stars = calcStars(p.skill, club.rate);
            const potStars = calcStars(p.potential_max, club.rate);
            return (
              <Card
                key={p.id}
                className={`p-4 bg-gradient-card border-border/50 space-y-3 ${
                  finalizado ? "ring-2 ring-primary/60 shadow-gold" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-display font-bold truncate">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {p.position} · {p.age} anos · {p.nationality || "—"}
                    </div>
                  </div>
                  {finalizado && (
                    <Badge className="bg-primary text-primary-foreground gap-1">
                      <Sparkles className="h-3 w-3" /> Pronto
                    </Badge>
                  )}
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Habilidade</span>
                    <StarRating value={stars} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Potencial</span>
                    <div className="flex items-center gap-1">
                      <StarRating value={potStars} />
                      <span className="text-[10px] text-muted-foreground">
                        ({p.potential_min}–{p.potential_max})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Desenvolvimento</span>
                    <span>{Math.round(p.development_progress)}%</span>
                  </div>
                  <Progress value={p.development_progress} className="h-2" />
                </div>

                {canEdit && (
                  <div className="flex gap-2 pt-1">
                    {finalizado ? (
                      <>
                        <Button
                          size="sm"
                          className="flex-1 bg-gradient-gold text-primary-foreground hover:opacity-90"
                          onClick={() => promover(p)}
                        >
                          <ArrowUp className="h-3.5 w-3.5" /> Promover
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/30"
                          onClick={() => dispensar(p)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-amber-400 border-amber-400/30"
                          onClick={() => promover(p)}
                          title="Promover antes do desenvolvimento completo aplica penalidade"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" /> Promover já
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/30"
                          onClick={() => dispensar(p)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog peneira */}
      <Dialog open={scoutOpen} onOpenChange={(o) => { if (!o) { setScoutOpen(false); setScoutResults(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" /> Nova peneira
            </DialogTitle>
          </DialogHeader>

          {!scoutResults ? (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Posição (opcional)</Label>
                  <Select value={scoutPos || "__any__"} onValueChange={(v) => setScoutPos(v === "__any__" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Qualquer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any__">Qualquer</SelectItem>
                      {POSITIONS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Nacionalidade (opcional)</Label>
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
                  <Label className="text-xs">Idade mínima (14–23)</Label>
                  <Input
                    type="number"
                    min={14}
                    max={23}
                    value={scoutAgeMin}
                    onChange={(e) =>
                      setScoutAgeMin(Math.max(14, Math.min(23, Number(e.target.value) || 14)))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Idade máxima (14–23)</Label>
                  <Input
                    type="number"
                    min={14}
                    max={23}
                    value={scoutAgeMax}
                    onChange={(e) =>
                      setScoutAgeMax(Math.max(14, Math.min(23, Number(e.target.value) || 23)))
                    }
                  />
                </div>
              </div>

              <div className="text-xs text-muted-foreground bg-secondary/30 rounded p-3 mt-2">
                A peneira gera entre 3 e 8 jogadores. A chance de talentos raros depende do nível
                da sua base ({club.nivel_base}). Esta operação consome 1 das 2 peneiras desta temporada.
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setScoutOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={realizarPeneira}
                  disabled={scoutLoading || !scoutPos || peneirasRestantes <= 0}
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
