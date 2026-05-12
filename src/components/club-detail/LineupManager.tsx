/**
 * LineupManager.tsx
 * Componente de escalação tática para o Solara Hub.
 *
 * Como usar em ClubDetail.tsx:
 *   1. Importe: import { LineupManager } from "@/components/club-detail/LineupManager";
 *   2. Adicione a aba na TabsList (se canEdit ou sempre visível, como preferir):
 *        <TabsTrigger value="escalacao">Escalação</TabsTrigger>
 *   3. Adicione o conteúdo:
 *        <TabsContent value="escalacao" className="mt-4">
 *          <LineupManager players={players} club={club} canEdit={canEdit} />
 *        </TabsContent>
 */

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  ArrowRightLeft,
  Save,
  Activity,
  CheckCircle2,
  TrendingUp,
  Settings,
  Users,
  X,
  Shield,
  BarChart2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Player {
  id: string;
  name: string;
  position: string;
  habilidade?: number;
  age?: number;
  nationality?: string;
  shirt_number?: number;
  market_value?: number;
}

interface LineupManagerProps {
  players: Player[];
  club: any;
  canEdit?: boolean;
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const FORMATIONS: Record<string, Record<string, string>> = {
  "4-3-3": {
    "6-2": "GOL",
    "5-0": "LE",
    "5-1": "ZAG",
    "5-3": "ZAG",
    "5-4": "LD",
    "3-1": "MC",
    "4-2": "VOL",
    "3-3": "MC",
    "1-0": "PE",
    "1-2": "ATA",
    "1-4": "PD",
  },
  "4-4-2": {
    "6-2": "GOL",
    "5-0": "LE",
    "5-1": "ZAG",
    "5-3": "ZAG",
    "5-4": "LD",
    "3-0": "PE",
    "3-1": "MC",
    "3-3": "MC",
    "3-4": "PD",
    "1-1": "ATA",
    "1-3": "ATA",
  },
  "4-2-3-1": {
    "6-2": "GOL",
    "5-0": "LE",
    "5-1": "ZAG",
    "5-3": "ZAG",
    "5-4": "LD",
    "4-1": "VOL",
    "4-3": "VOL",
    "2-0": "PE",
    "2-2": "MEI",
    "2-4": "PD",
    "0-2": "ATA",
  },
  "3-5-2": {
    "6-2": "GOL",
    "5-1": "ZAG",
    "5-2": "ZAG",
    "5-3": "ZAG",
    "3-0": "LE",
    "4-2": "VOL",
    "3-1": "MC",
    "3-3": "MC",
    "3-4": "LD",
    "1-1": "ATA",
    "1-3": "ATA",
  },
  "5-3-2": {
    "6-2": "GOL",
    "5-0": "LE",
    "5-1": "ZAG",
    "5-2": "ZAG",
    "5-3": "ZAG",
    "5-4": "LD",
    "3-1": "MC",
    "4-2": "VOL",
    "3-3": "MC",
    "1-1": "ATA",
    "1-3": "ATA",
  },
  "3-4-3": {
    "6-2": "GOL",
    "5-1": "ZAG",
    "5-2": "ZAG",
    "5-3": "ZAG",
    "3-0": "LE",
    "3-1": "MC",
    "3-3": "MC",
    "3-4": "LD",
    "1-0": "PE",
    "1-2": "ATA",
    "1-4": "PD",
  },
};

const GRID_ROWS = 7;

const TACTICS_OPTS = [
  "Pressionar alto",
  "Posse de bola",
  "Cruzamentos",
  "Saída pelo goleiro",
  "Faltas estratégicas",
  "Retrair na defesa",
  "Jogadas longas",
  "Marcar por zona",
];

const MENTALITIES = ["Defensivo", "Equilibrado", "Ofensivo"] as const;
type Mentality = (typeof MENTALITIES)[number];

// Cores por posição — alinhadas com POSITION_COLORS do SquadTable
const POS_STYLE: Record<string, { text: string; badge: string }> = {
  GOL: { text: "text-yellow-300", badge: "bg-yellow-400/20 border-yellow-400/50 text-yellow-300" },
  ZAG: { text: "text-blue-300", badge: "bg-blue-500/20 border-blue-400/50 text-blue-300" },
  LD: { text: "text-sky-300", badge: "bg-sky-500/20 border-sky-400/50 text-sky-300" },
  LE: { text: "text-sky-300", badge: "bg-sky-500/20 border-sky-400/50 text-sky-300" },
  VOL: { text: "text-teal-300", badge: "bg-teal-500/20 border-teal-400/50 text-teal-300" },
  MC: { text: "text-emerald-300", badge: "bg-emerald-500/20 border-emerald-400/50 text-emerald-300" },
  MEI: { text: "text-lime-300", badge: "bg-lime-500/20 border-lime-400/50 text-lime-300" },
  PD: { text: "text-orange-300", badge: "bg-orange-500/20 border-orange-400/50 text-orange-300" },
  PE: { text: "text-orange-300", badge: "bg-orange-500/20 border-orange-400/50 text-orange-300" },
  SA: { text: "text-red-300", badge: "bg-red-500/20 border-red-400/50 text-red-300" },
  ATA: { text: "text-rose-300", badge: "bg-rose-500/20 border-rose-400/50 text-rose-300" },
};

function getPosStyle(pos: string) {
  return (
    POS_STYLE[(pos || "").toUpperCase()] ?? {
      text: "text-muted-foreground",
      badge: "bg-secondary/30 border-border/30 text-muted-foreground",
    }
  );
}

// ─── Camisa FM-style ───────────────────────────────────────────────────────────
function ShirtIcon({ number, size = "md" }: { number?: number | null; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-8 h-8" : "w-11 h-11";
  const txt = size === "sm" ? "text-[10px]" : "text-[13px]";
  return (
    <div className={`relative flex justify-center items-center shrink-0 ${dim}`}>
      <svg viewBox="0 0 40 42" className="w-full h-full drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]">
        <defs>
          <path id="sh" d="M14 2 Q20 6 26 2 L38 8 L32 18 L28 14 L29 38 L20 40 L11 38 L12 14 L8 18 L2 8Z" />
          <clipPath id="cl">
            <use href="#sh" />
          </clipPath>
        </defs>
        <use href="#sh" fill="white" />
        <polygon points="20,0 40,0 40,42 16,42" fill="#d1d5db" clipPath="url(#cl)" opacity="0.75" />
        <use href="#sh" fill="none" stroke="#111827" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
      <span
        className={`absolute font-black text-slate-800 tracking-tighter select-none ${txt}`}
        style={{ top: "48%", transform: "translateY(-50%)" }}
      >
        {number ?? "—"}
      </span>
    </div>
  );
}

// ─── Campo SVG inline ──────────────────────────────────────────────────────────
function PitchSVG() {
  return (
    <svg
      viewBox="0 0 100 130"
      className="absolute inset-0 w-full h-full pointer-events-none opacity-70 z-0"
      preserveAspectRatio="none"
    >
      <rect x="5" y="5" width="90" height="120" fill="none" stroke="white" strokeWidth="0.5" />
      <line x1="5" y1="65" x2="95" y2="65" stroke="white" strokeWidth="0.5" />
      <circle cx="50" cy="65" r="12" fill="none" stroke="white" strokeWidth="0.5" />
      <circle cx="50" cy="65" r="0.7" fill="white" />
      {/* grande área superior */}
      <rect x="20" y="5" width="60" height="18" fill="none" stroke="white" strokeWidth="0.5" />
      <rect x="35" y="5" width="30" height="6" fill="none" stroke="white" strokeWidth="0.5" />
      <path d="M40 23 A10 10 0 0 0 60 23" fill="none" stroke="white" strokeWidth="0.5" />
      <circle cx="50" cy="17" r="0.7" fill="white" />
      {/* grande área inferior */}
      <rect x="20" y="107" width="60" height="18" fill="none" stroke="white" strokeWidth="0.5" />
      <rect x="35" y="119" width="30" height="6" fill="none" stroke="white" strokeWidth="0.5" />
      <path d="M40 107 A10 10 0 0 1 60 107" fill="none" stroke="white" strokeWidth="0.5" />
      <circle cx="50" cy="113" r="0.7" fill="white" />
      {/* cantos */}
      <path d="M5 8 A3 3 0 0 0 8 5" fill="none" stroke="white" strokeWidth="0.5" />
      <path d="M92 5 A3 3 0 0 0 95 8" fill="none" stroke="white" strokeWidth="0.5" />
      <path d="M5 122 A3 3 0 0 1 8 125" fill="none" stroke="white" strokeWidth="0.5" />
      <path d="M95 122 A3 3 0 0 1 92 125" fill="none" stroke="white" strokeWidth="0.5" />
    </svg>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function LineupManager({ players, club, canEdit = false }: LineupManagerProps) {
  const [formation, setFormation] = useState("4-3-3");
  const [pitchPlayers, setPitchPlayers] = useState<Record<string, Player>>({});
  const [bench, setBench] = useState<Player[]>([]);
  const [tactics, setTactics] = useState<string[]>(["Posse de bola", "Saída pelo goleiro"]);
  const [mentality, setMentality] = useState<Mentality>("Equilibrado");
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [subCell, setSubCell] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"pitch" | "bench" | "stats">("pitch");
  const [isSaving, setIsSaving] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // ── auto-pick inicial ───────────────────────────────────────────────────────
  const autoPickFormation = useCallback((formId: string, pool: Player[]) => {
    const template = FORMATIONS[formId];
    let remaining = [...pool].sort((a, b) => (b.habilidade ?? 0) - (a.habilidade ?? 0));
    const newPitch: Record<string, Player> = {};

    Object.entries(template).forEach(([cellKey, role]) => {
      const idx = remaining.findIndex((p) => p.position === role);
      if (idx !== -1) {
        newPitch[cellKey] = remaining[idx];
        remaining.splice(idx, 1);
      }
    });
    // preenche células vazias com quem sobrou
    Object.keys(template).forEach((cellKey) => {
      if (!newPitch[cellKey] && remaining.length > 0) {
        newPitch[cellKey] = remaining.shift()!;
      }
    });

    setPitchPlayers(newPitch);
    setBench(remaining);
  }, []);

  useEffect(() => {
    autoPickFormation("4-3-3", players);
  }, [players, autoPickFormation]);

  // fechar popover ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setSelectedCell(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── handlers ───────────────────────────────────────────────────────────────
  const handleFormationChange = (val: string) => {
    setFormation(val);
    const all = [...Object.values(pitchPlayers).filter(Boolean), ...bench];
    autoPickFormation(val, all);
    setSelectedCell(null);
  };

  const handleDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    setIsDragging(false);
    const sourceKey = e.dataTransfer.getData("text/plain");
    if (!sourceKey || sourceKey === targetKey) return;
    if (!pitchPlayers[sourceKey]) return; // source sem jogador
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
    setSubCell(null);
    setSelectedCell(null);
  };

  const toggleTactic = (t: string) =>
    setTactics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const handleSave = async () => {
    if (!canEdit) return;
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setIsSaving(false);
    toast.success("Escalação salva com sucesso!");
  };

  // ── estatísticas ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const starters = Object.values(pitchPlayers).filter(Boolean);
    if (!starters.length) return { avgSkill: 0, avgAge: "—", foreigners: 0 };
    const avgSkill = Math.round(starters.reduce((s, p) => s + (p.habilidade ?? 0), 0) / starters.length);
    const avgAge = (starters.reduce((s, p) => s + (p.age ?? 0), 0) / starters.length).toFixed(1);
    const foreigners = starters.filter((p) => p.nationality && p.nationality !== "Solara").length;
    return { avgSkill, avgAge, foreigners };
  }, [pitchPlayers]);

  // ── grade do campo ─────────────────────────────────────────────────────────
  const template = FORMATIONS[formation];

  const renderPitch = () => (
    <div className="relative w-full aspect-[3/4] md:aspect-[4/5] bg-[#1a5c45] rounded-xl overflow-hidden shadow-2xl border border-[#0f3d2c]/80 touch-none select-none">
      {/* sobreposição escura sutil */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20 z-0 pointer-events-none" />
      <PitchSVG />

      {/* GRID TÁTICO */}
      <div className="absolute inset-0 flex flex-col p-1.5 gap-0.5 z-10">
        {Array.from({ length: GRID_ROWS }).map((_, r) => {
          const isGkRow = r === GRID_ROWS - 1;
          const rowHasCenter = !isGkRow && (!!pitchPlayers[`${r}-2`] || !!template[`${r}-2`] || isDragging);

          // Linha do GOL: só coluna central. Outras linhas: 4 colunas reais ou 5 se tiver centro.
          const cols = isGkRow ? [2] : rowHasCenter ? [0, 1, 2, 3, 4] : [0, 1, 3, 4];
          const colConfig = isGkRow ? "1fr" : rowHasCenter ? "1fr 1fr 1fr 1fr 1fr" : "1fr 1fr 1fr 1fr";

          return (
            <div
              key={r}
              className="flex-1 grid gap-0.5 transition-[grid-template-columns] duration-300"
              style={{ gridTemplateColumns: colConfig }}
            >
              {cols.map((c) => {
                const cellKey = `${r}-${c}`;
                const player = pitchPlayers[cellKey];
                const inTemplate = !!template[cellKey];
                const isSelected = selectedCell === cellKey;

                return (
                  <div
                    key={cellKey}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, cellKey)}
                    onClick={() => setSelectedCell(isSelected ? null : cellKey)}
                    className={[
                      "relative flex items-center justify-center rounded transition-all duration-300",
                      isDragging && inTemplate ? "border border-white/20 bg-white/5" : "border border-transparent",
                      isSelected ? "bg-primary/30 border-primary/60" : "",
                      !isDragging && !isSelected && inTemplate ? "hover:bg-white/10" : "",
                    ].join(" ")}
                  >
                    {player && (
                      <div
                        draggable={canEdit}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData("text/plain", cellKey);
                          setTimeout(() => setIsDragging(true), 10);
                        }}
                        onDragEnd={() => setIsDragging(false)}
                        className={`relative flex flex-col items-center ${canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-default"} transition-transform ${isSelected ? "scale-110 z-20" : "hover:scale-105 z-10"}`}
                      >
                        <ShirtIcon number={player.shirt_number} />

                        {/* Label FM-style adaptada ao Solara */}
                        <div className="flex flex-col items-center mt-[-5px] z-30 shadow-lg rounded overflow-hidden min-w-[68px] border border-black/40">
                          <div className="bg-card/90 backdrop-blur-sm w-full px-1.5 py-[2px] text-[9px] font-bold flex justify-center items-center gap-1 border-b border-border/40">
                            <span className={getPosStyle(player.position).text}>{player.position}</span>
                            <span className="text-primary font-black">{player.habilidade ?? "—"}</span>
                          </div>
                          <div className="bg-primary/90 w-full px-1.5 py-[2px] text-[10px] font-semibold text-primary-foreground text-center truncate max-w-[80px]">
                            {player.name.split(" ").pop()}
                          </div>
                        </div>

                        {/* Popover ao selecionar */}
                        {isSelected && (
                          <div
                            ref={popoverRef}
                            className={`absolute ${r >= 4 ? "bottom-full mb-3" : "top-full mt-3"} left-1/2 -translate-x-1/2 w-52 bg-card border border-border/70 rounded-xl shadow-2xl z-50 p-3.5 text-sm`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex justify-between items-start mb-2.5">
                              <div>
                                <p className="font-bold text-foreground truncate w-32">{player.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  #{player.shirt_number ?? "—"} • {player.age ?? "—"} anos
                                </p>
                              </div>
                              <div
                                className={`h-8 w-8 rounded-lg flex items-center justify-center text-sm font-black border ${getPosStyle(player.position).badge}`}
                              >
                                {player.habilidade ?? "—"}
                              </div>
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground mb-3">
                              <span>
                                Posição:{" "}
                                <strong className={getPosStyle(player.position).text}>{player.position}</strong>
                              </span>
                              <span>{player.age ?? "—"} anos</span>
                            </div>
                            {canEdit && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full text-xs h-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSubCell(cellKey);
                                  setSelectedCell(null);
                                }}
                              >
                                <ArrowRightLeft className="h-3 w-3 mr-1.5" /> Substituir
                              </Button>
                            )}
                            {/* seta */}
                            {r >= 4 ? (
                              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 border-x-8 border-x-transparent border-t-8 border-t-card" />
                            ) : (
                              <div className="absolute -top-2 left-1/2 -translate-x-1/2 border-x-8 border-x-transparent border-b-8 border-b-card" />
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Célula vazia no template */}
                    {!player && inTemplate && (
                      <div className="w-10 h-10 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
                        <span className="text-[9px] text-white/30 font-bold uppercase">{template[cellKey]}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Cabeçalho da aba */}
      <Card className="p-3 bg-gradient-card border-border/50">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="font-display font-bold text-sm">Escalação Tática</span>
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Select value={formation} onValueChange={handleFormationChange}>
              <SelectTrigger className="h-8 text-xs w-28 bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(FORMATIONS).map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {canEdit && (
              <Button
                size="sm"
                className="h-8 text-xs bg-primary hover:bg-primary/90"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Activity className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1" />
                )}
                {isSaving ? "Salvando…" : "Salvar"}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Mobile tabs */}
      <div className="flex md:hidden bg-secondary/40 rounded-lg overflow-hidden border border-border/50">
        {(["pitch", "bench", "stats"] as const).map((tab) => {
          const labels = { pitch: "Campo", bench: `Banco (${bench.length})`, stats: "Análise" };
          return (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex-1 py-2.5 text-xs font-bold transition-colors ${mobileTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* Layout principal */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* ── CAMPO ── */}
        <div className={`w-full lg:w-[58%] ${mobileTab !== "pitch" ? "hidden md:block" : ""}`}>{renderPitch()}</div>

        {/* ── PAINÉIS DIREITOS ── */}
        <div className={`flex-1 flex flex-col gap-4 ${mobileTab === "pitch" ? "hidden md:flex" : "flex"}`}>
          {/* Análise */}
          <Card className={`p-4 bg-gradient-card border-border/50 ${mobileTab === "bench" ? "hidden md:block" : ""}`}>
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 className="h-4 w-4 text-primary" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Análise do Time</h3>
            </div>
            <div className="space-y-3">
              {/* Qualidade */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Qualidade Média</span>
                  <span className="font-bold text-primary">{stats.avgSkill}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.min(stats.avgSkill, 100)}%` }}
                  />
                </div>
              </div>
              {/* Idade */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Idade Média</span>
                  <span className="font-bold">{stats.avgAge} anos</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${Number(stats.avgAge) > 27 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.min((Number(stats.avgAge) / 40) * 100, 100)}%` }}
                  />
                </div>
              </div>
              {/* Estrangeiros */}
              <div className="bg-secondary/40 rounded-lg p-2.5 border border-border/40">
                <div className="text-[10px] text-muted-foreground mb-0.5">Estrangeiros</div>
                <div className="font-bold text-sm">
                  {stats.foreigners} <span className="text-muted-foreground text-xs font-normal">/ 10</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Mentalidade & Táticas */}
          <Card className={`p-4 bg-gradient-card border-border/50 ${mobileTab === "bench" ? "hidden md:block" : ""}`}>
            <div className="flex items-center gap-2 mb-3">
              <Settings className="h-4 w-4 text-primary" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mentalidade</h3>
            </div>
            <div className="flex gap-1 bg-secondary/50 rounded-lg p-1 mb-4">
              {MENTALITIES.map((m) => (
                <button
                  key={m}
                  onClick={() => canEdit && setMentality(m)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${mentality === m ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"} ${!canEdit ? "cursor-default" : "cursor-pointer"}`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Instruções Táticas
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TACTICS_OPTS.map((t) => {
                const active = tactics.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => canEdit && toggleTactic(t)}
                    className={`px-2.5 py-1 text-[10px] font-semibold rounded-full border transition-colors flex items-center gap-1
                      ${active ? "bg-primary/20 border-primary/60 text-primary" : "bg-secondary/40 border-border/50 text-muted-foreground hover:border-border"}
                      ${!canEdit ? "cursor-default" : "cursor-pointer"}`}
                  >
                    {active && <CheckCircle2 className="h-3 w-3" />}
                    {t}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Banco */}
          <Card
            className={`p-4 bg-gradient-card border-border/50 flex-1 overflow-hidden flex flex-col ${mobileTab === "stats" ? "hidden md:flex" : ""}`}
          >
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Banco de Reservas <span className="text-foreground">({bench.length})</span>
              </h3>
            </div>
            <div
              className="overflow-y-auto space-y-1 flex-1 pr-1"
              style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--border)) transparent" }}
            >
              {bench.length === 0 ? (
                <p className="text-center text-muted-foreground text-xs py-6">Nenhum jogador no banco.</p>
              ) : (
                bench.map((p) => {
                  const ps = getPosStyle(p.position);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-primary/5 border border-transparent hover:border-border/40 transition-colors group"
                    >
                      <ShirtIcon number={p.shirt_number} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-foreground truncate">{p.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${ps.badge}`}>
                            {p.position}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{p.age ? `${p.age}a` : "—"}</span>
                        </div>
                      </div>
                      <span className="text-xs font-black text-primary tabular-nums">{p.habilidade ?? "—"}</span>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Modal de substituição */}
      {subCell && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/70 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[75vh]">
            <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
              <div>
                <h3 className="font-bold text-sm">Substituir {pitchPlayers[subCell]?.name ?? "Posição vazia"}</h3>
                <p className="text-xs text-muted-foreground">Escolha um jogador do banco</p>
              </div>
              <button
                onClick={() => setSubCell(null)}
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-2 space-y-1">
              {bench.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Banco vazio.</p>
              ) : (
                bench.map((p) => {
                  const ps = getPosStyle(p.position);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/40 transition-colors border border-transparent hover:border-border/40"
                    >
                      <div className="flex items-center gap-3">
                        <ShirtIcon number={p.shirt_number} />
                        <div>
                          <div className="text-sm font-bold">{p.name}</div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                            <span className={`px-1 py-0.5 rounded border font-bold ${ps.badge}`}>{p.position}</span>
                            <span>
                              Hab: <strong className="text-primary">{p.habilidade ?? "—"}</strong>
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground"
                        onClick={() => handleSub(p.id)}
                      >
                        Escalar
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
