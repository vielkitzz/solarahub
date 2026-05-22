import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dumbbell, GraduationCap, Ban, Clock, AlertTriangle, Sparkles } from "lucide-react";
import { POS_COMPAT } from "@/components/club-detail/lineup-utils";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  club: any;
  players: any[];
  canEdit: boolean;
  temporadaAtual: number;
  onChange: () => void;
}

const MAX_ACTIVE_TRAININGS = 5;
const ALL_POSITIONS = Object.keys(POS_COMPAT);

/** BFS distance through POS_COMPAT (undirected). Returns Infinity if disconnected. */
function distanceBetween(from: string, to: string): number {
  if (!from || !to || from === to) return 0;
  const visited = new Set<string>([from]);
  let frontier = [from];
  let depth = 0;
  while (frontier.length) {
    depth++;
    const next: string[] = [];
    for (const node of frontier) {
      const neighbors = POS_COMPAT[node] || [];
      for (const n of neighbors) {
        if (n === to) return depth;
        if (!visited.has(n)) {
          visited.add(n);
          next.push(n);
        }
      }
    }
    frontier = next;
    if (depth > 6) break;
  }
  return Infinity;
}

/** Duration in seasons based on graph distance + age modifier. */
function seasonsForTraining(from: string, to: string, age?: number): number {
  const d = distanceBetween(from, to);
  let base: number;
  if (d <= 1) base = 1;
  else if (d === 2) base = 2;
  else if (d === 3) base = 3;
  else base = 4;
  if ((age ?? 0) >= 31) base += 1;
  return base;
}

/** Cost: scales with player skill and difficulty. */
function costForTraining(from: string, to: string, habilidade: number, age?: number): number {
  const seasons = seasonsForTraining(from, to, age);
  const skillFactor = Math.max(0.6, (habilidade || 50) / 50);
  const base = 400_000 * seasons * skillFactor;
  return Math.round(base / 10_000) * 10_000;
}

/** Initial penalty (what player loses on the new position when scaled) — same scale used by getAdaptation. */
function basePenalty(from: string, to: string): number {
  const d = distanceBetween(from, to);
  if (d === 0) return 0;
  if (d === 1) return 5;
  return 15;
}

/** Current penalty given progress (decreases linearly to 0 on completion). */
function currentPenalty(initial: number, completed: number, total: number) {
  if (total <= 0) return 0;
  const remaining = Math.max(0, 1 - completed / total);
  return Math.round(initial * remaining);
}

interface Training {
  id: string;
  club_id: string;
  player_id: string;
  target_position: string;
  seasons_total: number;
  seasons_completed: number;
  starting_season: number;
  penalty_initial: number;
  cost: number;
  active: boolean;
}

export const TrainingsManager = ({ club, players, canEdit, temporadaAtual, onChange }: Props) => {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("player_trainings")
      .select("*")
      .eq("club_id", club.id)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    setTrainings((data as Training[]) || []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club.id]);

  const activeTrainings = useMemo(() => trainings.filter((t) => t.active), [trainings]);
  const activeByPlayer = useMemo(() => {
    const m = new Map<string, Training>();
    for (const t of activeTrainings) m.set(t.player_id, t);
    return m;
  }, [activeTrainings]);

  const slotsLivres = MAX_ACTIVE_TRAININGS - activeTrainings.length;

  const eligibility = (p: any): { ok: boolean; reason?: string } => {
    if (activeByPlayer.has(p.id)) return { ok: false, reason: "Já está em treino" };
    if (p.secondary_position) return { ok: false, reason: "Já possui posição secundária" };
    if (slotsLivres <= 0) return { ok: false, reason: "Limite de 5 treinos simultâneos atingido" };
    return { ok: true };
  };

  const iniciarTreino = async (player: any, target: string) => {
    if (!canEdit) return;
    const elig = eligibility(player);
    if (!elig.ok) return toast.error(elig.reason || "Inelegível");
    if (!target) return toast.error("Selecione uma posição");

    const seasons = seasonsForTraining(player.position, target, player.age);
    const cost = costForTraining(player.position, target, player.habilidade ?? 50, player.age);
    const penalty = basePenalty(player.position, target);

    if (Number(club.budget) < cost) {
      return toast.error(`Caixa insuficiente. Necessário ${formatCurrency(cost)}`);
    }

    if (!confirm(`Treinar ${player.name} para ${target}?\nCusto: ${formatCurrency(cost)}\nDuração: ${seasons} temporada(s)`)) return;

    setSaving(player.id);
    const { error: insErr } = await supabase.from("player_trainings").insert({
      club_id: club.id,
      player_id: player.id,
      target_position: target,
      seasons_total: seasons,
      seasons_completed: 0,
      starting_season: temporadaAtual,
      penalty_initial: penalty,
      cost,
      active: true,
    });
    if (insErr) {
      setSaving(null);
      return toast.error(insErr.message);
    }

    const { error: updErr } = await supabase
      .from("clubs")
      .update({ budget: Number(club.budget) - cost })
      .eq("id", club.id);
    if (updErr) toast.error(updErr.message);

    await supabase.from("transactions").insert({
      club_id: club.id,
      tipo: "saida",
      categoria: "treinos",
      valor: cost,
      descricao: `Treino de adaptação: ${player.name} → ${target}`,
      temporada: temporadaAtual,
      related_player_id: player.id,
    });

    setSaving(null);
    toast.success("Treino iniciado!");
    setSelected((s) => ({ ...s, [player.id]: "" }));
    await load();
    onChange();
  };

  const cancelarTreino = async (training: Training) => {
    if (!canEdit) return;
    if (!confirm("Cancelar o treino? O progresso será perdido e o valor investido não será reembolsado.")) return;
    setSaving(training.id);
    const { error } = await supabase
      .from("player_trainings")
      .update({ active: false })
      .eq("id", training.id);
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success("Treino cancelado");
    await load();
    onChange();
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-5 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Dumbbell className="h-6 w-6 text-primary" />
            <div>
              <h2 className="font-display font-bold text-xl">Treinos de Adaptação</h2>
              <p className="text-sm text-muted-foreground">
                Ensine uma posição secundária aos seus jogadores e torne o elenco mais versátil.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {activeTrainings.length}/{MAX_ACTIVE_TRAININGS} treinos ativos
          </Badge>
        </div>
      </Card>

      {/* Treinos em andamento */}
      <Card className="p-5 bg-gradient-card border-border/50 space-y-3">
        <h3 className="font-display font-bold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Em andamento
        </h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : activeTrainings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum treino em andamento.</p>
        ) : (
          <div className="grid gap-3">
            {activeTrainings.map((t) => {
              const p = players.find((x) => x.id === t.player_id);
              const pct = Math.min(100, Math.round((t.seasons_completed / t.seasons_total) * 100));
              const pen = currentPenalty(t.penalty_initial, t.seasons_completed, t.seasons_total);
              return (
                <div
                  key={t.id}
                  className="p-4 bg-secondary/20 rounded-xl border border-border/40 space-y-2"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-semibold">{p?.name || "Jogador"}</p>
                      <p className="text-xs text-muted-foreground">
                        {p?.position || "?"} → <span className="text-primary font-medium">{t.target_position}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {t.seasons_completed}/{t.seasons_total} temporadas
                      </Badge>
                      <Badge variant="outline" className="text-rose-400 border-rose-500/40">
                        Penalidade atual: -{pen}
                      </Badge>
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-destructive border-destructive/40 hover:bg-destructive/10"
                          onClick={() => cancelarTreino(t)}
                          disabled={saving === t.id}
                        >
                          <Ban className="h-3 w-3" /> Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Elenco / Iniciar */}
      <Card className="p-5 bg-gradient-card border-border/50 space-y-3">
        <h3 className="font-display font-bold flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-primary" /> Elenco
        </h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jogador</TableHead>
                <TableHead>Posições</TableHead>
                <TableHead>Idade</TableHead>
                <TableHead>Nova posição</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Custo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((p) => {
                const elig = eligibility(p);
                const target = selected[p.id] || "";
                const seasons = target ? seasonsForTraining(p.position, target, p.age) : 0;
                const cost = target ? costForTraining(p.position, target, p.habilidade ?? 50, p.age) : 0;
                const options = ALL_POSITIONS.filter(
                  (pos) => pos !== (p.position || "").toUpperCase() && pos !== (p.secondary_position || "").toUpperCase(),
                );
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-[10px]">{p.position}</Badge>
                        {p.secondary_position && (
                          <Badge className="text-[10px] bg-primary/20 text-primary border-primary/40">
                            {p.secondary_position}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.age ?? "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={target}
                        onValueChange={(v) => setSelected((s) => ({ ...s, [p.id]: v }))}
                        disabled={!canEdit || !elig.ok}
                      >
                        <SelectTrigger className="h-8 w-[110px]">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((pos) => (
                            <SelectItem key={pos} value={pos}>
                              {pos}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs">
                      {target ? `${seasons} temp.` : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{target ? formatCurrency(cost) : "—"}</TableCell>
                    <TableCell>
                      {elig.ok ? (
                        <Badge variant="outline" className="text-emerald-400 border-emerald-500/40 text-[10px]">
                          Elegível
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] gap-1 text-amber-400 border-amber-500/40")}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {elig.reason}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        className="h-8 bg-gradient-gold text-primary-foreground"
                        disabled={!canEdit || !elig.ok || !target || saving === p.id}
                        onClick={() => iniciarTreino(p, target)}
                      >
                        Treinar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};
