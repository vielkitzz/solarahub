/**
LineupManager.tsx — Solara Hub
Componente de escalação tática reformulado.
Como usar em ClubDetail.tsx:
import { LineupManager } from "@/components/club-detail/LineupManager";
<TabsTrigger value="escalacao">Escalação</TabsTrigger>
<TabsContent value="escalacao" className="mt-4">
<LineupManager players={players} club={club} canEdit={canEdit} />
</TabsContent>
*/
import { useState, useMemo, useRef, useCallback, useEffect, KeyboardEvent } from "react";
import {
  ArrowRightLeft,
  Save,
  Activity,
  CheckCircle2,
  Settings,
  Users,
  X,
  Shield,
  BarChart2,
  Zap,
  History,
  ChevronRight,
  Star,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShirtIcon } from "@/components/club-detail/ShirtIcon";
import { createPortal } from "react-dom";
import {
  FORMATIONS,
  POS_SECTOR,
  GRID_LABELS,
  getAdaptation,
  PLAY_STYLES,
  PRESSINGS,
  AERIALS,
  PLAY_STYLE_META,
  PRESSING_META,
  AERIAL_META,
  type PlayStyle,
  type Pressing,
  type Aerial,
  type LineupPlayer as Player,
} from "@/components/club-detail/lineup-utils";

interface LineupManagerProps {
  players: Player[];
  club: any;
  canEdit?: boolean;
  initialLineup?: {
    formation?: string;
    mentality?: string;
    pitchIds?: Record<string, string>;
    benchIds?: string[];
    playStyle?: PlayStyle;
    pressing?: Pressing;
    aerial?: Aerial;
  } | null;
  onSave?: (data: {
    pitchIds: Record<string, string>;
    benchIds: string[];
    formation: string;
    mentality: string;
    playStyle: PlayStyle;
    pressing: Pressing;
    aerial: Aerial;
  }) => Promise<void> | void;
}

interface SubRecord {
  out: Player;
  inn: Player;
  cell: string;
  time: string;
}

const GRID_ROWS = 7;

const MENTALITIES = ["Defensivo", "Equilibrado", "Ofensivo"] as const;
type Mentality = (typeof MENTALITIES)[number];
const MENTALITY_META: Record<Mentality, { color: string; desc: string }> = {
  Defensivo: { color: "text-sky-400", desc: "Bloco baixo, saída rápida" },
  Equilibrado: { color: "text-amber-400", desc: "Adaptável ao jogo" },
  Ofensivo: { color: "text-rose-400", desc: "Alta linha, pressão total" },
};

// ─── Estilos por posição ───────────────────────────────────────────────────────
const POS_STYLE: Record<string, { text: string; badge: string; glow: string }> = {
  GOL: {
    text: "text-yellow-300",
    badge: "bg-yellow-400/20 border-yellow-400/50 text-yellow-300",
    glow: "shadow-yellow-500/30",
  },
  ZAG: { text: "text-blue-300", badge: "bg-blue-500/20 border-blue-400/50 text-blue-300", glow: "shadow-blue-500/30" },
  LD: { text: "text-sky-300", badge: "bg-sky-500/20 border-sky-400/50 text-sky-300", glow: "shadow-sky-500/30" },
  LE: { text: "text-sky-300", badge: "bg-sky-500/20 border-sky-400/50 text-sky-300", glow: "shadow-sky-500/30" },
  VOL: { text: "text-teal-300", badge: "bg-teal-500/20 border-teal-400/50 text-teal-300", glow: "shadow-teal-500/30" },
  MC: {
    text: "text-emerald-300",
    badge: "bg-emerald-500/20 border-emerald-400/50 text-emerald-300",
    glow: "shadow-emerald-500/30",
  },
  MEI: { text: "text-lime-300", badge: "bg-lime-500/20 border-lime-400/50 text-lime-300", glow: "shadow-lime-500/30" },
  PD: {
    text: "text-orange-300",
    badge: "bg-orange-500/20 border-orange-400/50 text-orange-300",
    glow: "shadow-orange-500/30",
  },
  PE: {
    text: "text-orange-300",
    badge: "bg-orange-500/20 border-orange-400/50 text-orange-300",
    glow: "shadow-orange-500/30",
  },
  SA: { text: "text-red-300", badge: "bg-red-500/20 border-red-400/50 text-red-300", glow: "shadow-red-500/30" },
  ATA: { text: "text-rose-300", badge: "bg-rose-500/20 border-rose-400/50 text-rose-300", glow: "shadow-rose-500/30" },
};

function getPosStyle(pos: string) {
  return (
    POS_STYLE[(pos || "").toUpperCase()] ?? {
      text: "text-muted-foreground",
      badge: "bg-secondary/30 border-border/30 text-muted-foreground",
      glow: "shadow-black/20",
    }
  );
}

function ratingLabel(skill: number) {
  if (skill >= 90) return { label: "Elite", color: "text-amber-300" };
  if (skill >= 80) return { label: "Estrela", color: "text-yellow-300" };
  if (skill >= 70) return { label: "Regular", color: "text-emerald-300" };
  if (skill >= 60) return { label: "Reserva", color: "text-sky-300" };
  return { label: "Cria", color: "text-slate-400" };
}

function overallColor(skill: number): string {
  const MIN = 45,
    MID = 72,
    MAX = 99;
  const s = Math.max(MIN, Math.min(MAX, skill));
  const red = { r: 224, g: 49, b: 49 }; // #E03131
  const yellow = { r: 252, g: 196, b: 25 }; // #FCC419
  const green = { r: 43, g: 138, b: 62 }; // #2B8A3E
  let r: number, g: number, b: number;
  if (s <= MID) {
    const t = (s - MIN) / (MID - MIN);
    r = Math.round(red.r + (yellow.r - red.r) * t);
    g = Math.round(red.g + (yellow.g - red.g) * t);
    b = Math.round(red.b + (yellow.b - red.b) * t);
  } else {
    const t = (s - MID) / (MAX - MID);
    r = Math.round(yellow.r + (green.r - yellow.r) * t);
    g = Math.round(yellow.g + (green.g - yellow.g) * t);
    b = Math.round(yellow.b + (green.b - yellow.b) * t);
  }
  return `rgb(${r},${g},${b})`;
}

// ─── Campo SVG ────────────────────────────────────────────────────────────────
function PitchSVG() {
  return (
    <img
      src="/Campo.svg"
      alt="Campo"
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      style={{ objectFit: "fill" }}
    />
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function LineupManager({ players, club, canEdit = false, initialLineup, onSave }: LineupManagerProps) {
  const [formation, setFormation] = useState(initialLineup?.formation || "4-3-3");
  const [pitchPlayers, setPitchPlayers] = useState<Record<string, Player>>({});
  const [bench, setBench] = useState<Player[]>([]);
  const [tactics, setTactics] = useState<string[]>([]);
  const [mentality, setMentality] = useState<Mentality>((initialLineup?.mentality as Mentality) || "Equilibrado");
  const [playStyle, setPlayStyle] = useState<PlayStyle>(initialLineup?.playStyle || "Posse de Bola");
  const [pressing, setPressing] = useState<Pressing>(initialLineup?.pressing || "Média");
  const [aerial, setAerial] = useState<Aerial>(initialLineup?.aerial || "Evitar");
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [subCell, setSubCell] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"pitch" | "bench" | "stats">("pitch");
  const [isSaving, setIsSaving] = useState(false);
  const [subHistory, setSubHistory] = useState<SubRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [pitchHeight, setPitchHeight] = useState<number | null>(null);
  const hydratedKey = useRef<string | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);
  const pitchRef = useRef<HTMLDivElement>(null);

  // Mede altura do campo p/ alinhar a coluna direita (banco)
  useEffect(() => {
    if (!pitchRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const h = entry.contentRect.height;
      if (h > 0) setPitchHeight(h);
    });
    ro.observe(pitchRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Auto-pick ───────────────────────────────────────────────────────────────
  const autoPickFormation = useCallback((formId: string, pool: Player[]) => {
    const template = FORMATIONS[formId];
    let remaining = [...pool].sort((a, b) => (b.habilidade ?? 0) - (a.habilidade ?? 0));
    const newPitch: Record<string, Player> = {};

    Object.entries(template).forEach(([cellKey, role]) => {
      const idx = remaining.findIndex((p) => (p.position || "").toUpperCase() === role.toUpperCase());
      if (idx !== -1) {
        newPitch[cellKey] = remaining[idx];
        remaining.splice(idx, 1);
      }
    });

    Object.entries(template).forEach(([cellKey, role]) => {
      if (newPitch[cellKey]) return;
      const sector = POS_SECTOR[role];
      const idx = remaining.findIndex((p) => POS_SECTOR[(p.position || "").toUpperCase()] === sector);
      if (idx !== -1) {
        newPitch[cellKey] = remaining[idx];
        remaining.splice(idx, 1);
      }
    });

    Object.keys(template).forEach((cellKey) => {
      if (!newPitch[cellKey] && remaining.length > 0) {
        newPitch[cellKey] = remaining.shift()!;
      }
    });

    setPitchPlayers(newPitch);
    setBench(remaining);
  }, []);

  useEffect(() => {
    if (!players?.length) return;

    // Cria uma chave única baseada no initialLineup para detectar mudanças
    const key = JSON.stringify(initialLineup?.pitchIds ?? null);

    // Já hidratou com essa mesma escalação — não faz nada
    if (hydratedKey.current === key) return;
    hydratedKey.current = key;

    if (initialLineup?.pitchIds && Object.keys(initialLineup.pitchIds).length > 0) {
      const byId = new Map(players.map((p) => [p.id, p]));
      const newPitch: Record<string, Player> = {};
      Object.entries(initialLineup.pitchIds).forEach(([cell, pid]) => {
        const p = byId.get(pid);
        if (p) newPitch[cell] = p;
      });
      const usedIds = new Set(Object.values(newPitch).map((p) => p.id));
      const benchOrdered: Player[] = [];
      (initialLineup.benchIds || []).forEach((pid) => {
        const p = byId.get(pid);
        if (p && !usedIds.has(p.id)) {
          benchOrdered.push(p);
          usedIds.add(p.id);
        }
      });
      players.forEach((p) => {
        if (!usedIds.has(p.id)) benchOrdered.push(p);
      });
      setPitchPlayers(newPitch);
      setBench(benchOrdered);
    } else {
      autoPickFormation(initialLineup?.formation || "4-3-3", players);
    }
  }, [players, initialLineup, autoPickFormation]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // Se o clique foi dentro do popover, ignora
      if (popoverRef.current && popoverRef.current.contains(e.target as Node)) return;

      // Se o clique foi em QUALQUER quadrado do campo, ignora (o onClick do quadrado resolve)
      if ((e.target as Element).closest("[data-cell]")) return;

      // Se clicou no fundo, fora de tudo, aí sim limpa a seleção
      setSelectedCell(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleFormationChange = (val: string) => {
    setFormation(val);
    const all = [...Object.values(pitchPlayers).filter(Boolean), ...bench];
    autoPickFormation(val, all);
    setSelectedCell(null);
    setSubHistory([]);
  };

  const handleDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    setIsDragging(false);
    setDropTarget(null);

    const benchPlayerId = e.dataTransfer.getData("bench-player-id");
    const sourceKey = e.dataTransfer.getData("text/plain");

    // Drag do banco para o campo
    if (benchPlayerId) {
      const benchIdx = bench.findIndex((p) => p.id === benchPlayerId);
      if (benchIdx === -1) return;
      const benchIn = bench[benchIdx];
      const starterOut = pitchPlayers[targetKey];

      // Impede mais de 11 se a célula alvo está vazia
      const currentStarters = Object.values(pitchPlayers).filter(Boolean).length;
      if (!starterOut && currentStarters >= 11) {
        toast.error("Já há 11 jogadores em campo.");
        return;
      }

      const newPitch = { ...pitchPlayers, [targetKey]: benchIn };
      const newBench = [...bench];
      if (starterOut) newBench[benchIdx] = starterOut;
      else newBench.splice(benchIdx, 1);

      setPitchPlayers(newPitch);
      setBench(newBench.sort((a, b) => (b.habilidade ?? 0) - (a.habilidade ?? 0)));

      if (starterOut) {
        setSubHistory((prev) => [
          {
            out: starterOut,
            inn: benchIn,
            cell: targetKey,
            time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          },
          ...prev,
        ]);
        toast.success(`${benchIn.name} entrou, ${starterOut.name} saiu`);
      } else {
        toast.success(`${benchIn.name} escalado`);
      }
      return;
    }

    // Drag de célula para célula (lógica original)
    if (!sourceKey || sourceKey === targetKey) return;
    if (!pitchPlayers[sourceKey]) return;

    setPitchPlayers((prev) => {
      const next = { ...prev };
      const src = next[sourceKey];
      const tgt = next[targetKey];
      if (tgt) next[sourceKey] = tgt;
      else delete next[sourceKey];
      next[targetKey] = src;
      return next;
    });
    setSelectedCell(null);
  };

  const handleSub = (benchPlayerId: string) => {
    if (!subCell) return;
    const benchIdx = bench.findIndex((p) => p.id === benchPlayerId);
    const starterOut = pitchPlayers[subCell];
    const benchIn = bench[benchIdx];
    const newPitch = { ...pitchPlayers, [subCell]: benchIn };
    const newBench = [...bench];
    if (starterOut) newBench[benchIdx] = starterOut;
    else newBench.splice(benchIdx, 1);

    setPitchPlayers(newPitch);
    setBench(newBench.sort((a, b) => (b.habilidade ?? 0) - (a.habilidade ?? 0)));

    if (starterOut) {
      setSubHistory((prev) => [
        {
          out: starterOut,
          inn: benchIn,
          cell: subCell,
          time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        },
        ...prev,
      ]);
    }

    setSubCell(null);
    setSelectedCell(null);
    toast.success(`${benchIn.name} entrou, ${starterOut?.name ?? "posição"} saiu`);
  };

  const toggleTactic = (t: string) =>
    setTactics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const handleSave = async () => {
    if (!canEdit) return;
    setIsSaving(true);
    try {
      const pitchIds: Record<string, string> = {};
      Object.entries(pitchPlayers).forEach(([cell, p]) => {
        if (p) pitchIds[cell] = p.id;
      });
      const benchIds = bench.map((p) => p.id);
      if (onSave) {
        await onSave({ pitchIds, benchIds, formation, mentality, playStyle, pressing, aerial });
      } else {
        await new Promise((r) => setTimeout(r, 600));
      }
      toast.success("Escalação salva com sucesso!", {
        description: `${formation} · ${mentality}`,
      });
    } catch {
      toast.error("Erro ao salvar a escalação.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Estatísticas com Punição de Posição ───────────────────────────────────
  const template = FORMATIONS[formation];

  const stats = useMemo(() => {
    const starters = Object.entries(pitchPlayers).filter(([_, p]) => Boolean(p));
    if (!starters.length)
      return { avgSkill: 0, avgAge: 0, foreigners: 0, gkSkill: 0, defSkill: 0, midSkill: 0, attSkill: 0 };

    const getEff = (p: Player, cell: string) => (p.habilidade ?? 0) - getAdaptation(p, cell, template[cell]).loss;

    const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0);
    const byRole = (roles: string[]) =>
      avg(
        starters
          .filter(([_, p]) => roles.includes((p.position || " ").toUpperCase()))
          .map(([cell, p]) => getEff(p, cell)),
      );

    return {
      avgSkill: avg(starters.map(([cell, p]) => getEff(p, cell))),
      avgAge: parseFloat((starters.reduce((s, [_, p]) => s + (p.age ?? 0), 0) / starters.length).toFixed(1)),
      foreigners: starters.filter(([_, p]) => p.nationality && p.nationality !== "Solara").length,
      gkSkill: byRole(["GOL"]),
      defSkill: byRole(["ZAG", "LD", "LE"]),
      midSkill: byRole(["VOL", "MC", "MEI"]),
      attSkill: byRole(["PD", "PE", "SA", "ATA"]),
    };
  }, [pitchPlayers, template]);

  const compatibilityPct = useMemo(() => {
    let correct = 0;
    let total = 0;
    Object.entries(pitchPlayers).forEach(([key, p]) => {
      if (!p) return;
      total++;
      const { loss } = getAdaptation(p, key, template[key]);
      if (loss === 0) correct += 1;
      else if (loss <= 5) correct += 0.5; // Ganha metade dos pontos se for compatível
    });
    return total > 0 ? Math.round((correct / total) * 100) : 0;
  }, [pitchPlayers, template]);

  const sortedBench = useMemo(() => {
    if (!subCell) return bench;
    const posInCell = template[subCell];
    return [...bench].sort((a, b) => {
      const aLoss = getAdaptation(a, subCell, posInCell).loss;
      const bLoss = getAdaptation(b, subCell, posInCell).loss;
      if (aLoss !== bLoss) return aLoss - bLoss; // Prefere menor perda
      return (b.habilidade ?? 0) - (a.habilidade ?? 0);
    });
  }, [bench, subCell, template]);

  // ─── Helper de Grid ───────────────────────────────────────────────────────
  const getGridTemplateColumns = (rowIndex: number, showCenter: boolean) => {
    const col = "minmax(0, 1fr)";
    // Mantém as 5 colunas iguais também para a linha do goleiro (para manter o tamanho do quadrado)
    if (rowIndex === GRID_ROWS - 1) return `${col} ${col} ${col} ${col} ${col}`;
    if (!showCenter) return `${col} ${col} 0px ${col} ${col}`;
    return `${col} ${col} ${col} ${col} ${col}`;
  };

  // ─── CAMPO ────────────────────────────────────────────────────────────────
  const renderPitch = () => (
    <div
      ref={pitchRef}
      className="relative w-full aspect-[3/4] md:aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl border border-white/10 touch-none select-none"
      style={{ background: "hsl(171,45%,31%)" }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/25 pointer-events-none z-[1]" />
      <PitchSVG />

      <div className="absolute inset-0 flex flex-col p-2 gap-0.5 z-10">
        {Array.from({ length: GRID_ROWS }).map((_, r) => {
          const hasCenter = !!pitchPlayers[`${r}-2`];
          const showCenter = hasCenter || isDragging;
          const gridConfig = getGridTemplateColumns(r, showCenter);

          return (
            <div
              key={r}
              className="flex-1 grid gap-0.5 transition-[grid-template-columns] duration-300 ease-in-out"
              style={{ gridTemplateColumns: gridConfig }}
            >
              {[0, 1, 2, 3, 4].map((c) => {
                const cellKey = `${r}-${c}`;
                const player = pitchPlayers[cellKey];
                const isSelected = selectedCell === cellKey;
                const isDropZone = dropTarget === cellKey;
                const isSrcCell = dragSource === cellKey;
                const isHidden = (r === GRID_ROWS - 1 && c !== 2) || (r !== GRID_ROWS - 1 && c === 2 && !showCenter);

                const gridLabel = GRID_LABELS[cellKey];
                const { loss, color, badge, bg: adaptBg } = getAdaptation(player, cellKey, template[cellKey]);
                const effSkill = player ? (player.habilidade ?? 0) - loss : 0;

                return (
                  <div
                    key={cellKey}
                    data-cell={cellKey}
                    onDragOver={(e) => {
                      if (!isHidden && canEdit) {
                        e.preventDefault();
                        setDropTarget(cellKey);
                      }
                    }}
                    onDragLeave={() => !isHidden && setDropTarget(null)}
                    onDrop={(e) => {
                      if (!isHidden && canEdit) handleDrop(e, cellKey);
                    }}
                    // Adicionado "&& player" para só permitir clique se houver jogador
                    onClick={() => {
                      if (!isHidden && canEdit && player) setSelectedCell(isSelected ? null : cellKey);
                    }}
                    className={`relative flex items-center justify-center rounded-lg transition-all duration-200 outline-none
                      ${isHidden ? "opacity-0 pointer-events-none overflow-hidden" : "opacity-100"}
                      ${isDropZone && !isHidden ? "ring-2 ring-primary/70 bg-primary/15 scale-105" : ""}
                      ${isSelected && !isHidden ? "bg-primary/20 ring-2 ring-primary/60 scale-105" : ""}
                      ${isSrcCell && !isHidden ? "opacity-40" : ""}
                      ${!isDragging && !isSelected && !isHidden && player ? "hover:bg-white/10 cursor-pointer" : ""}
                    `}
                  >
                    {/* Slot vazio — visível apenas ao arrastar ou selecionar */}
                    {!player &&
                      !isHidden &&
                      (isDragging || selectedCell !== null) &&
                      (gridLabel || template[cellKey]) && (
                        <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/40 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                          <span className="text-[8px] text-white/80 font-bold uppercase">
                            {gridLabel || template[cellKey]}
                          </span>
                        </div>
                      )}

                    {player && (
                      <div
                        draggable={canEdit}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData("text/plain", cellKey);
                          setDragSource(cellKey);
                          setTimeout(() => setIsDragging(true), 10);
                        }}
                        onDragEnd={() => {
                          setIsDragging(false);
                          setDragSource(null);
                          setDropTarget(null);
                        }}
                        className={`relative flex flex-col items-center z-10 ${canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-default"} transition-transform duration-200 ${isSelected ? "scale-110 z-20" : "hover:scale-105"}`}
                      >
                        <ShirtIcon
                          clubId={club?.id}
                          number={player.shirt_number}
                          size="w-12 h-12"
                          isGK={player.position === "GOL"}
                          numberSize="clamp(18px, 75%, 38px)"
                          numberPaddingBottom="18%"
                        />

                        {/* Cores fiéis ao SVG (Você pode colocar isso fora do componente depois se preferir) */}
                        {(() => {
                          const POS_COLORS: Record<string, { bg: string; text: string }> = {
                            GOL: { bg: "#423A17", text: "#F3CA4E" },
                            ZAG: { bg: "#36455D", text: "#85A9E1" },
                            LD: { bg: "#2B4B5C", text: "#71BCE2" },
                            LE: { bg: "#2B4B5C", text: "#71BCE2" },
                            VOL: { bg: "#264E4C", text: "#4EBDB5" },
                            MC: { bg: "#2D513E", text: "#66C79E" },
                            MEI: { bg: "#4D5A25", text: "#B4E15D" },
                            PD: { bg: "#5F4127", text: "#D49A5E" },
                            PE: { bg: "#5F4127", text: "#D49A5E" },
                            SA: { bg: "#683A45", text: "#DB8A9B" },
                            ATA: { bg: "#683A45", text: "#DB8A9B" },
                          };

                          const pColor = POS_COLORS[(player.position || "").toUpperCase()] || {
                            bg: "#333333",
                            text: "#FFFFFF",
                          };

                          return (
                            <div className="flex flex-col items-center mt-1 z-30 font-sans">
                              <div
                                className="rounded-sm overflow-hidden shadow-lg flex flex-col"
                                style={{
                                  background: "#131516",
                                  width: 80,
                                  height: 40,
                                  outline: isSelected
                                    ? "1.5px solid var(--primary)"
                                    : "1.5px solid rgba(255,255,255,0.07)",
                                }}
                              >
                                {/* ── Header (18px de altura) ── */}
                                <div className="flex w-full" style={{ height: 20 }}>
                                  {/* Metade esquerda — Posição com cores corretas */}
                                  <div
                                    className="flex items-center justify-center"
                                    style={{ width: "50%", background: pColor.bg }}
                                  >
                                    <span
                                      className="font-bold uppercase tracking-wider leading-none"
                                      style={{ fontSize: 11, color: pColor.text }}
                                    >
                                      {player.position}
                                    </span>
                                  </div>

                                  {/* Metade direita — Overall */}
                                  <div
                                    className="relative flex items-center justify-center"
                                    style={{ width: "50%", background: overallColor(effSkill) }}
                                  >
                                    <span
                                      className="font-bold text-white leading-none tracking-tight"
                                      style={{ fontSize: 12 }}
                                    >
                                      {effSkill}
                                    </span>
                                  </div>
                                </div>

                                {/* ── Inferior — Sobrenome (27px de altura) ── */}
                                <div
                                  className="flex items-center justify-center px-1.5 w-full"
                                  style={{ height: 30, background: "#131516" }}
                                >
                                  <span
                                    className="font-medium text-white/95 truncate text-center leading-none tracking-wide"
                                    style={{ fontSize: 11 }}
                                  >
                                    {player.name.split(" ").pop()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Popover */}
                        {isSelected &&
                          createPortal(
                            <div
                              ref={popoverRef}
                              className="fixed z-[9999] w-56 bg-card border border-border/60 rounded-xl shadow-2xl p-3.5 text-sm"
                              style={{
                                top: (() => {
                                  const el = pitchRef.current?.querySelector(`[data-cell="${cellKey}"]`);
                                  if (!el) return 0;
                                  const rect = el.getBoundingClientRect();
                                  return r >= 4 ? rect.top - 220 : rect.bottom + 8;
                                })(),
                                left: (() => {
                                  const el = pitchRef.current?.querySelector(`[data-cell="${cellKey}"]`);
                                  if (!el) return 0;
                                  const rect = el.getBoundingClientRect();
                                  return Math.max(
                                    8,
                                    Math.min(rect.left + rect.width / 2 - 112, window.innerWidth - 232),
                                  );
                                })(),
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 min-w-0 pr-2">
                                  <p className="font-bold text-foreground truncate leading-tight">{player.name}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    #{player.shirt_number ?? "—"} &middot; {player.age ?? "—"} anos
                                    {player.nationality ? ` · ${player.nationality}` : ""}
                                  </p>
                                </div>
                                <div
                                  className={`h-10 w-10 rounded-lg flex flex-col items-center justify-center text-xs font-black border shrink-0 ${badge}`}
                                >
                                  <span className="text-[14px] leading-none">{effSkill}</span>
                                  <span className="text-[7px] opacity-80 leading-none mt-1 uppercase tracking-wider">
                                    {loss === 0 ? "Ideal" : `-${loss} Hab`}
                                  </span>
                                </div>
                              </div>
                              <div className="mb-3">
                                <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-primary to-amber-400 transition-all duration-500"
                                    style={{ width: `${Math.min(effSkill, 100)}%` }}
                                  />
                                </div>
                              </div>
                              {canEdit && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full text-xs h-8 border-primary/40 hover:bg-primary/10 hover:border-primary/60"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSubCell(cellKey);
                                    setSelectedCell(null);
                                  }}
                                >
                                  <ArrowRightLeft className="h-3 w-3 mr-1.5" /> Substituir
                                </Button>
                              )}
                            </div>,
                            document.body,
                          )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-white/10">
        <span className="text-[11px] font-black text-primary tracking-widest">{formation}</span>
        <span className="text-[9px] text-white/50 font-medium">{mentality}</span>
      </div>

      <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-white/10">
        <div
          className={`w-1.5 h-1.5 rounded-full ${compatibilityPct >= 80 ? "bg-emerald-400" : compatibilityPct >= 60 ? "bg-amber-400" : "bg-rose-400"}`}
        />
        <span className="text-[10px] font-bold text-white/70">{compatibilityPct}% Adapt</span>
      </div>
    </div>
  );

  // ─── ANÁLISE ──────────────────────────────────────────────────────────────
  const renderAnalysis = () => (
    <Card className="p-4 bg-gradient-card border-border/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-primary" />
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Análise do Time</h3>
        </div>
        <div className="text-[10px] text-muted-foreground font-mono">
          Overall Médio <span className="text-primary font-black text-xs">{stats.avgSkill}</span>
        </div>
      </div>
      <div className="space-y-2.5 mb-4">
        {[
          { label: "Goleiro", value: stats.gkSkill },
          { label: "Defesa", value: stats.defSkill },
          { label: "Meio", value: stats.midSkill },
          { label: "Ataque", value: stats.attSkill },
        ].map(({ label, value }) => {
          // Gradiente vermelho (pior) -> amarelo (bom), proporcional ao value (0-100)
          const v = Math.max(0, Math.min(100, value));
          // hue 0 (vermelho) -> 50 (amarelo)
          const hue = Math.round((v / 100) * 50);
          const barColor = `hsl(${hue}, 85%, 50%)`;
          return (
            <div key={label}>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-muted-foreground font-medium">{label}</span>
                <span className="font-black text-foreground tabular-nums">{value || "—"}</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${v}%`, backgroundColor: barColor }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          {
            label: "Idade Média",
            value: `${stats.avgAge} anos`,
            sub: stats.avgAge > 27 ? "Experiente" : "Jovem",
            ok: stats.avgAge <= 27,
          },
          {
            label: "Estrangeiros",
            value: `${stats.foreigners}/10`,
            sub: stats.foreigners > 5 ? "Limite próx." : "Regular",
            ok: stats.foreigners <= 5,
          },
          {
            label: "Adaptação",
            value: `${compatibilityPct}%`,
            sub: compatibilityPct >= 80 ? "Ideal" : compatibilityPct >= 60 ? "OK" : "Baixa",
            ok: compatibilityPct >= 80,
          },
        ].map(({ label, value, sub, ok }) => (
          <div key={label} className="bg-secondary/40 rounded-lg p-2 border border-border/40 text-center">
            <div className="text-[9px] text-muted-foreground mb-0.5 leading-tight">{label}</div>
            <div className="font-black text-sm leading-none">{value}</div>
            <div className={`text-[9px] mt-0.5 font-medium ${ok ? "text-emerald-400" : "text-amber-400"}`}>{sub}</div>
          </div>
        ))}
      </div>
    </Card>
  );

  // ─── TÁTICAS ──────────────────────────────────────────────────────────────
  const renderToggleRow = <T extends string>(
    title: string,
    options: readonly T[],
    value: T,
    setValue: (v: T) => void,
    meta: Record<T, { color: string; desc: string }>,
  ) => (
    <div>
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{title}</h4>
      <div className="flex gap-1 bg-secondary/50 rounded-xl p-1 mb-1">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => canEdit && setValue(opt)}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all duration-200 ${value === opt ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"} ${!canEdit ? "cursor-default" : "cursor-pointer"}`}
          >
            {opt}
          </button>
        ))}
      </div>
      <p className={`text-[9px] text-center font-medium ${meta[value].color}`}>{meta[value].desc}</p>
    </div>
  );

  const renderTactics = () => (
    <Card className="p-4 bg-gradient-card border-border/50 space-y-3">
      <div className="flex items-center gap-2">
        <Settings className="h-4 w-4 text-primary" />
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Tática</h3>
      </div>
      {renderToggleRow("Mentalidade", MENTALITIES, mentality, setMentality, MENTALITY_META)}
      {renderToggleRow("Estilo de Jogo", PLAY_STYLES, playStyle, setPlayStyle, PLAY_STYLE_META)}
      {renderToggleRow("Pressão", PRESSINGS, pressing, setPressing, PRESSING_META)}
      {renderToggleRow("Bola Aérea", AERIALS, aerial, setAerial, AERIAL_META)}
    </Card>
  );

  // ─── BANCO ────────────────────────────────────────────────────────────────
  const POS_ORDER: Record<string, number> = {
    GOL: 0,
    ZAG: 1,
    LD: 2,
    LE: 3,
    VOL: 4,
    MC: 5,
    MEI: 6,
    PD: 7,
    PE: 8,
    SA: 9,
    ATA: 10,
  };
  const benchByPosition = useMemo(
    () =>
      [...bench].sort((a, b) => {
        const ao = POS_ORDER[(a.position || "").toUpperCase()] ?? 99;
        const bo = POS_ORDER[(b.position || "").toUpperCase()] ?? 99;
        if (ao !== bo) return ao - bo;
        return (b.habilidade ?? 0) - (a.habilidade ?? 0);
      }),
    [bench],
  );

  // ─── BANCO ────────────────────────────────────────────────────────────────
  const renderBench = () => {
    const dropProps = canEdit
      ? {
          onDragOver: (e: React.DragEvent) => e.preventDefault(),
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            const sourceKey = e.dataTransfer.getData("text/plain");
            if (!sourceKey || !pitchPlayers[sourceKey]) return;
            const playerOut = pitchPlayers[sourceKey];
            setPitchPlayers((prev) => {
              const next = { ...prev };
              delete next[sourceKey];
              return next;
            });
            setBench((prev) => {
              const already = prev.find((p) => p.id === playerOut.id);
              if (already) return prev;
              return [...prev, playerOut].sort((a, b) => (b.habilidade ?? 0) - (a.habilidade ?? 0));
            });
            toast.success(`${playerOut.name} movido para o banco`);
          },
        }
      : {};

    return (
      <Card className="p-4 bg-gradient-card border-border/50 flex-1 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Banco <span className="text-foreground">({bench.length})</span>
            </h3>
          </div>
          {subHistory.length > 0 && (
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <History className="h-3 w-3" /> {subHistory.length} subs
            </button>
          )}
        </div>
        {showHistory ? (
          <div className="space-y-1 overflow-y-auto flex-1">
            {subHistory.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-lg bg-secondary/20 border border-border/30 text-[10px]"
              >
                <ArrowRightLeft className="h-3 w-3 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-emerald-400 font-bold truncate">{s.inn.name}</span>
                  <span className="text-muted-foreground"> ↔ </span>
                  <span className="text-rose-400 font-bold truncate">{s.out.name}</span>
                </div>
                <span className="text-muted-foreground shrink-0">{s.time}</span>
              </div>
            ))}
            <button
              onClick={() => setShowHistory(false)}
              className="w-full text-[9px] text-muted-foreground hover:text-foreground py-1 transition-colors"
            >
              ← Voltar ao banco
            </button>
          </div>
        ) : (
          <div
            className="overflow-y-auto space-y-0.5 flex-1 pr-0.5"
            style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--border)) transparent" }}
            {...dropProps}
          >
            {benchByPosition.length === 0 ? (
              <p className="text-center text-muted-foreground text-xs py-6">Todos em campo.</p>
            ) : (
              benchByPosition.map((p) => {
                const ps = getPosStyle(p.position);
                const rl = ratingLabel(p.habilidade ?? 0);
                return (
                  <div
                    key={p.id}
                    draggable={canEdit}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("bench-player-id", p.id);
                      setTimeout(() => setIsDragging(true), 10);
                    }}
                    onDragEnd={() => {
                      setIsDragging(false);
                      setDropTarget(null);
                    }}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-primary/5 border border-transparent hover:border-border/40 transition-colors group ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}`}
                  >
                    <ShirtIcon
                      clubId={club?.id}
                      number={p.shirt_number}
                      size="w-8 h-8"
                      isGK={p.position === "GOL"}
                      numberSize="clamp(12px, 60%, 28px)"
                      numberPaddingBottom="13%"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-foreground truncate leading-tight">{p.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[8px] font-bold px-1 py-0.5 rounded border ${ps.badge}`}>
                          {p.position}
                        </span>
                        <span className="text-[9px] text-muted-foreground">{p.age ? `${p.age}a` : "—"}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-primary tabular-nums">{p.habilidade ?? "—"}</div>
                      <div className={`text-[8px] font-medium ${rl.color}`}>{rl.label}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </Card>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* ── Cabeçalho ── */}
      <Card className="p-3 bg-gradient-card border-border/50">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Shield className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <span className="font-display font-bold text-sm leading-none">Escalação Tática</span>
              <div className="text-[9px] text-muted-foreground mt-0.5">
                {Object.values(pitchPlayers).filter(Boolean).length} titulares · {bench.length} reservas
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Select value={formation} onValueChange={handleFormationChange}>
              <SelectTrigger className="h-8 text-xs w-[7rem] bg-background/50 border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(FORMATIONS).map((f) => (
                  <SelectItem key={f} value={f} className="text-xs">
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-border/60 hover:bg-secondary/40"
                onClick={() => {
                  const all = [...Object.values(pitchPlayers).filter(Boolean), ...bench];
                  autoPickFormation(formation, all);
                  toast.success("Escalação otimizada automaticamente!");
                }}
              >
                <Zap className="h-3 w-3 mr-1" /> Auto
              </Button>
            )}
            {canEdit && (
              <Button
                size="sm"
                className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? <Activity className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}{" "}
                {isSaving ? "Salvando…" : "Salvar"}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* ── Tabs mobile ── */}
      <div className="flex md:hidden bg-secondary/40 rounded-xl overflow-hidden border border-border/50 p-0.5 gap-0.5">
        {(["pitch", "bench", "stats"] as const).map((tab) => {
          const labels = { pitch: "Campo", bench: `Banco (${bench.length})`, stats: "Análise" };
          return (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all duration-200 ${mobileTab === tab ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* ── Layout principal ── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className={`w-full lg:w-[60%] ${mobileTab !== "pitch" ? "hidden md:block" : ""}`}>
            {renderPitch()}
          </div>
          <div
            className={`flex-1 flex flex-col gap-3 min-w-0 ${mobileTab === "pitch" ? "hidden md:flex" : "flex"}`}
          >
            <div className={mobileTab === "bench" ? "hidden md:block" : ""}>{renderAnalysis()}</div>
            <div className={mobileTab === "bench" ? "hidden md:block" : ""}>{renderTactics()}</div>
          </div>
        </div>
        <div className={`w-full ${mobileTab === "stats" ? "hidden md:block" : ""}`}>{renderBench()}</div>
      </div>

      {/* ── Modal de substituição ── */}
      {subCell && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/60 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-start justify-between p-4 border-b border-border/50 shrink-0">
              <div>
                <h3 className="font-bold text-sm">
                  Substituir <span className="text-primary">{pitchPlayers[subCell]?.name ?? "posição vazia"}</span>
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Posição Requisitada:{" "}
                  <strong className={getPosStyle(FORMATIONS[formation][subCell] ?? " ").text}>
                    {FORMATIONS[formation][subCell] ?? GRID_LABELS[subCell] ?? "—"}
                  </strong>
                </p>
              </div>
              <button
                onClick={() => setSubCell(null)}
                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-2 space-y-1">
              {sortedBench.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Banco vazio.</p>
              ) : (
                sortedBench.map((p) => {
                  const ps = getPosStyle(p.position);
                  const posInCell = FORMATIONS[formation][subCell];

                  // Calcular punições e eficiências
                  const starter = pitchPlayers[subCell];
                  const starterEffSkill = starter
                    ? (starter.habilidade ?? 0) - getAdaptation(starter, subCell, posInCell).loss
                    : 0;

                  const { loss: newLoss, color: newColor } = getAdaptation(p, subCell, posInCell);
                  const newEffSkill = (p.habilidade ?? 0) - newLoss;
                  const diff = newEffSkill - starterEffSkill;

                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl transition-colors border ${newLoss === 0 ? "border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10" : "border-transparent hover:bg-secondary/40 hover:border-border/40"}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <ShirtIcon
                          clubId={club?.id}
                          number={p.shirt_number}
                          size="w-8 h-8"
                          isGK={p.position === "GOL"}
                          numberSize="clamp(12px, 60%, 28px)"
                          numberPaddingBottom="13%"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold leading-tight">{p.name}</span>
                            {newLoss === 0 && <Star className="h-2.5 w-2.5 text-emerald-500 fill-emerald-500" />}
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground mt-0.5">
                            <span className={`px-1 py-0.5 rounded border font-bold ${ps.badge}`}>{p.position}</span>
                            <span>
                              Hab:{" "}
                              <strong className={newColor}>
                                {newEffSkill} {newLoss > 0 && `(-${newLoss})`}
                              </strong>
                            </span>
                            {diff !== 0 && starter && (
                              <span className={`font-bold ${diff > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                ({diff > 0 ? "+" : ""}
                                {diff})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 shrink-0 border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={() => handleSub(p.id)}
                      >
                        Escalar <ChevronRight className="h-3 w-3 ml-0.5" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
