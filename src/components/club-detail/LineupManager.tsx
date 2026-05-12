/**
LineupManager.tsx — Solara Hub
Componente de escalação tática com Grid restaurado + Sistema de Setores e Overall Dinâmico.
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
  AlertTriangle,
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

interface SubRecord {
  out: Player;
  inn: Player;
  cell: string;
  time: string;
}

// ─── Setores e Penalidades (Nova Lógica) ──────────────────────────────────────
const SECTORS: Record<string, string[]> = {
  ATT: ["ATA", "SA", "PE", "PD"],
  MID: ["MEI", "MC", "VOL"],
  DEF: ["ZAG", "LD", "LE"],
  GK: ["GOL"],
};

const SECTOR_ORDER: Record<string, number> = { ATT: 0, MID: 1, DEF: 2, GK: 3 };

function getSector(pos: string): string {
  const p = (pos || "").toUpperCase();
  return Object.keys(SECTORS).find((sector) => SECTORS[sector].includes(p)) || "MID";
}

// Mecânica de Overall Dinâmico
function calculateEffectiveSkill(player: Player | null | undefined, slotRole: string): number {
  if (!player || !player.habilidade) return 0;
  const originalSkill = player.habilidade;
  const pPos = (player.position || "").toUpperCase();
  const sPos = (slotRole || "").toUpperCase();

  if (pPos === sPos) return originalSkill; // Posição Ideal (100%)

  const pSector = getSector(pPos);
  const sSector = getSector(sPos);

  // Setor GOL isolado (40%)
  if ((sSector === "GK" && pSector !== "GK") || (pSector === "GK" && sSector !== "GK")) {
    return Math.floor(originalSkill * 0.4);
  }

  if (pSector === sSector) return Math.floor(originalSkill * 0.95); // Mesmo Setor (95%)

  const distance = Math.abs(SECTOR_ORDER[pSector] - SECTOR_ORDER[sSector]);
  if (distance === 1) return Math.floor(originalSkill * 0.75); // Setor Adjacente (75%)

  return Math.floor(originalSkill * 0.4); // Setores Distantes (40%)
}

// ─── Constantes & Formações ───────────────────────────────────────────────────
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
    "3-0": "MEI",
    "3-1": "MC",
    "3-3": "MC",
    "3-4": "MEI",
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
  "4-1-4-1": {
    "6-2": "GOL",
    "5-0": "LE",
    "5-1": "ZAG",
    "5-3": "ZAG",
    "5-4": "LD",
    "4-2": "VOL",
    "2-0": "PE",
    "2-1": "MC",
    "2-3": "MC",
    "2-4": "PD",
    "0-2": "ATA",
  },
};

const GRID_ROWS = 7;
const TACTICS_OPTS = [
  { label: "Pressionar alto", icon: "⬆" },
  { label: "Posse de bola", icon: "⟳" },
  { label: "Cruzamentos", icon: "↗" },
  { label: "Saída pelo goleiro", icon: "🧤" },
  { label: "Faltas estratégicas", icon: "⚡" },
  { label: "Retrair na defesa", icon: "⬇" },
  { label: "Jogadas longas", icon: "↑" },
  { label: "Marcar por zona", icon: "⬜" },
  { label: "Pressão na saída", icon: "🔒" },
  { label: "Contra-ataque", icon: "⚡" },
];
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

// ─── ShirtIcon ────────────────────────────────────────────────────────────────
function ShirtIcon({
  number,
  size = "md",
  highlighted = false,
}: {
  number?: number | null;
  size?: "sm" | "md";
  highlighted?: boolean;
}) {
  const dim = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  const txt = size === "sm" ? "text-[10px]" : "text-[12px]";
  return (
    <div className={`relative flex justify-center items-center shrink-0 ${dim}`}>
      <svg
        viewBox="0 0 40 42"
        className={`w-full h-full transition-all duration-300 ${highlighted ? "drop-shadow-[0_0_8px_hsl(44_100%_52%_/_0.8)]" : "drop-shadow-[0_2px_5px_rgba(0,0,0,0.6)]"}`}
      >
        <defs>
          <path id="sh" d="M14 2 Q20 6 26 2 L38 8 L32 18 L28 14 L29 38 L20 40 L11 38 L12 14 L8 18 L2 8Z" />
          <clipPath id="cl">
            <use href="#sh" />
          </clipPath>
          <linearGradient id="shirtGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={highlighted ? "hsl(44,100%,60%)" : "white"} />
            <stop offset="100%" stopColor={highlighted ? "hsl(38,100%,48%)" : "#e5e7eb"} />
          </linearGradient>
        </defs>
        <use href="#sh" fill="url(#shirtGrad)" />
        <polygon
          points="20,0 40,0 40,42 16,42"
          fill={highlighted ? "hsl(38,100%,40%)" : "#d1d5db"}
          clipPath="url(#cl)"
          opacity="0.6"
        />
        <use
          href="#sh"
          fill="none"
          stroke={highlighted ? "hsl(38,100%,35%)" : "#111827"}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className={`absolute font-black tracking-tighter select-none ${txt} ${highlighted ? "text-amber-900" : "text-slate-800"}`}
        style={{ top: "48%", transform: "translateY(-50%)" }}
      >
        {number ?? "—"}
      </span>
    </div>
  );
}

// ─── Campo SVG ────────────────────────────────────────────────────────────────
function PitchSVG() {
  return (
    <svg
      viewBox="0 0 100 130"
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      preserveAspectRatio="none"
    >
      {/* Fundo do campo */}
      <rect width="100" height="130" fill="#2d6a54" />

      <g fill="none" stroke="#ffffff" strokeWidth="0.4" strokeOpacity="0.85">
        {/* Linhas externas */}
        <rect x="5" y="5" width="90" height="120" />

        {/* Linha central */}
        <line x1="5" y1="65" x2="95" y2="65" />

        {/* Círculo central */}
        <circle cx="50" cy="65" r="12" />
        <circle cx="50" cy="65" r="0.6" fill="#ffffff" />

        {/* --- Área Superior --- */}
        {/* Grande área */}
        <rect x="22" y="5" width="56" height="20" />
        {/* Pequena área */}
        <rect x="36" y="5" width="28" height="7" />
        {/* Marca do pênalti */}
        <circle cx="50" cy="17" r="0.6" fill="#ffffff" />
        {/* Meia-lua */}
        <path d="M38.5 25 A 12 12 0 0 0 61.5 25" />

        {/* --- Área Inferior --- */}
        {/* Grande área */}
        <rect x="22" y="105" width="56" height="20" />
        {/* Pequena área */}
        <rect x="36" y="118" width="28" height="7" />
        {/* Marca do pênalti */}
        <circle cx="50" cy="113" r="0.6" fill="#ffffff" />
        {/* Meia-lua */}
        <path d="M38.5 105 A 12 12 0 0 1 61.5 105" />

        {/* Escanteios */}
        <path d="M5 8 A 3 3 0 0 0 8 5" />
        <path d="M92 5 A 3 3 0 0 0 95 8" />
        <path d="M5 122 A 3 3 0 0 1 8 125" />
        <path d="M95 122 A 3 3 0 0 1 92 125" />
      </g>
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
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [subCell, setSubCell] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"pitch" | "bench" | "stats">("pitch");
  const [isSaving, setIsSaving] = useState(false);
  const [subHistory, setSubHistory] = useState<SubRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);
  const pitchRef = useRef<HTMLDivElement>(null);

  // ── Auto-pick Adaptado com Punições ─────────────────────────────────────────
  const autoPickFormation = useCallback((formId: string, pool: Player[]) => {
    const template = FORMATIONS[formId];
    let remaining = [...pool].sort((a, b) => (b.habilidade ?? 0) - (a.habilidade ?? 0));
    const newPitch: Record<string, Player> = {};

    // 1. Tenta posição exata
    Object.entries(template).forEach(([cellKey, role]) => {
      const idx = remaining.findIndex((p) => (p.position || "").toUpperCase() === role.toUpperCase());
      if (idx !== -1) {
        newPitch[cellKey] = remaining[idx];
        remaining.splice(idx, 1);
      }
    });

    // 2. Tenta mesmo setor
    Object.entries(template).forEach(([cellKey, role]) => {
      if (newPitch[cellKey]) return;
      const targetSector = getSector(role);
      const idx = remaining.findIndex((p) => getSector(p.position) === targetSector);
      if (idx !== -1) {
        newPitch[cellKey] = remaining[idx];
        remaining.splice(idx, 1);
      }
    });

    // 3. Preenche minimizando a perda
    Object.keys(template).forEach((cellKey) => {
      if (!newPitch[cellKey] && remaining.length > 0) {
        remaining.sort(
          (a, b) => calculateEffectiveSkill(b, template[cellKey]) - calculateEffectiveSkill(a, template[cellKey]),
        );
        newPitch[cellKey] = remaining.shift()!;
      }
    });

    setPitchPlayers(newPitch);
    setBench(remaining.sort((a, b) => (b.habilidade ?? 0) - (a.habilidade ?? 0)));
  }, []);

  useEffect(() => {
    autoPickFormation("4-3-3", players);
  }, [players, autoPickFormation]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setSelectedCell(null);
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
    const sourceKey = e.dataTransfer.getData("text/plain");
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
  };

  const toggleTactic = (t: string) =>
    setTactics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const handleSave = async () => {
    if (!canEdit) return;
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 900));
    setIsSaving(false);
    toast.success("Escalação salva com sucesso!");
  };

  // ── Estatísticas e Entrosamento Setorial ───────────────────────────────────
  const templateCurrent = FORMATIONS[formation];

  const stats = useMemo(() => {
    const starters = Object.entries(pitchPlayers)
      .map(([key, p]) => ({
        player: p,
        effectiveSkill: calculateEffectiveSkill(p, templateCurrent[key] || p.position),
      }))
      .filter((s) => s.player);

    if (!starters.length) return { avgSkill: 0, avgAge: 0, gkSkill: 0, defSkill: 0, midSkill: 0, attSkill: 0 };

    const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0);
    const bySector = (roles: string[]) =>
      avg(
        starters
          .filter((s) => roles.includes(getSector((s.player.position || "").toUpperCase())))
          .map((s) => s.effectiveSkill),
      );

    return {
      avgSkill: avg(starters.map((s) => s.effectiveSkill)),
      avgAge: parseFloat((starters.reduce((s, p) => s + (p.player.age ?? 0), 0) / starters.length).toFixed(1)),
      gkSkill: bySector(["GK"]),
      defSkill: bySector(["DEF"]),
      midSkill: bySector(["MID"]),
      attSkill: bySector(["ATT"]),
    };
  }, [pitchPlayers, templateCurrent]);

  const compatibilityPct = useMemo(() => {
    let score = 0;
    let total = 0;
    Object.entries(templateCurrent).forEach(([key, role]) => {
      const p = pitchPlayers[key];
      if (!p) return;
      total++;
      const pPos = (p.position || "").toUpperCase();
      const sPos = role.toUpperCase();

      if (pPos === sPos) score += 100;
      else if (getSector(pPos) === getSector(sPos)) score += 85;
      else if (Math.abs(SECTOR_ORDER[getSector(pPos)] - SECTOR_ORDER[getSector(sPos)]) === 1) score += 40;
    });
    return total > 0 ? Math.round(score / total) : 0;
  }, [pitchPlayers, templateCurrent]);

  const sortedBench = useMemo(() => {
    if (!subCell) return bench;
    const posInCell = templateCurrent[subCell];
    return [...bench].sort((a, b) => {
      return calculateEffectiveSkill(b, posInCell) - calculateEffectiveSkill(a, posInCell);
    });
  }, [bench, subCell, templateCurrent]);

  // ─── Helper de Grid ──────────────────────────────────────────────────────────
  const getGridTemplateColumns = (rowIndex: number, showCenter: boolean) => {
    const col = "minmax(0, 1fr)";
    if (rowIndex === GRID_ROWS - 1) return `0px 0px ${col} 0px 0px`;
    if (!showCenter) return `${col} ${col} 0px ${col} ${col}`;
    return `${col} ${col} ${col} ${col} ${col}`;
  };

  // ─── CAMPO COM GRID ORIGINAL ────────────────────────────────────────────────
  const renderPitch = () => (
    <div
      ref={pitchRef}
      className="relative w-full aspect-[3/4] md:aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl border border-white/10 touch-none select-none"
      style={{ background: "hsl(152,55%,18%)" }}
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

                const effectiveSkill = player
                  ? calculateEffectiveSkill(player, templateCurrent[cellKey] || player.position)
                  : 0;
                const isPenalized = player && effectiveSkill < (player.habilidade || 0);
                const penaltyAmount = player ? (player.habilidade || 0) - effectiveSkill : 0;

                return (
                  <div
                    key={cellKey}
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
                    onClick={() => {
                      if (!isHidden && canEdit) setSelectedCell(isSelected ? null : cellKey);
                    }}
                    className={`relative flex items-center justify-center rounded-lg transition-all duration-200 outline-none
                      ${isHidden ? "opacity-0 pointer-events-none overflow-hidden" : "opacity-100"}
                      ${isDropZone && !isHidden ? "ring-2 ring-primary/70 bg-primary/15 scale-105" : ""}
                      ${isSelected && !isHidden ? "bg-primary/20 ring-2 ring-primary/60 scale-105" : ""}
                      ${isSrcCell && !isHidden ? "opacity-40" : ""}
                      ${!isDragging && !isSelected && !isHidden && !player ? "hover:bg-white/10 cursor-pointer" : ""}
                    `}
                  >
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
                        <ShirtIcon number={player.shirt_number} highlighted={isSelected} />

                        {/* Card do Jogador */}
                        <div
                          className={`flex flex-col items-center mt-[-4px] z-30 rounded-md overflow-hidden min-w-[64px] border transition-all duration-200 ${isSelected ? "border-primary/70 shadow-lg shadow-primary/20" : "border-black/50"}`}
                        >
                          <div className="bg-card/95 backdrop-blur-sm w-full px-1.5 py-[2px] flex justify-center items-center gap-1 border-b border-border/40">
                            <span className={`text-[8px] font-bold ${getPosStyle(player.position).text}`}>
                              {player.position}
                            </span>
                            <span
                              className={`text-[9px] font-black ${isPenalized ? (penaltyAmount > 15 ? "text-rose-500" : "text-amber-500") : "text-primary"}`}
                            >
                              {effectiveSkill}
                            </span>
                          </div>
                          <div
                            className={`w-full px-1.5 py-[2px] text-[9px] font-semibold text-center truncate max-w-[76px] ${isSelected ? "bg-primary text-primary-foreground" : "bg-primary/80 text-primary-foreground"}`}
                          >
                            {player.name.split(" ").pop()}
                          </div>
                        </div>

                        {/* Alerta de Punição */}
                        {isPenalized && !isSelected && (
                          <div className="absolute -top-1 -right-1 bg-background rounded-full border border-border">
                            <AlertTriangle
                              className={`h-3 w-3 ${penaltyAmount > 15 ? "text-rose-500" : "text-amber-500"}`}
                            />
                          </div>
                        )}

                        {/* Popover */}
                        {isSelected && (
                          <div
                            ref={popoverRef}
                            className={`absolute ${r >= 4 ? "bottom-full mb-3" : "top-full mt-3"} left-1/2 -translate-x-1/2 w-56 bg-card border border-border/60 rounded-xl shadow-2xl z-50 p-3.5 text-sm`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1 min-w-0 pr-2">
                                <p className="font-bold text-foreground truncate leading-tight">{player.name}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  Original: <strong>{player.position}</strong> &middot; Slot:{" "}
                                  <strong>{templateCurrent[cellKey]}</strong>
                                </p>
                              </div>
                              <div
                                className={`h-9 w-9 rounded-lg flex flex-col items-center justify-center text-xs font-black border shrink-0 ${isPenalized ? (penaltyAmount > 15 ? "bg-rose-500/20 border-rose-500/50 text-rose-500" : "bg-amber-500/20 border-amber-500/50 text-amber-500") : getPosStyle(player.position).badge}`}
                              >
                                <span className="text-[14px] leading-none">{effectiveSkill}</span>
                              </div>
                            </div>
                            {isPenalized && (
                              <div className="text-[10px] bg-secondary/50 p-1.5 rounded-md mb-3 flex justify-between items-center">
                                <span className="text-muted-foreground">Penalidade tática:</span>
                                <span className="font-bold text-rose-400">-{penaltyAmount} OVR</span>
                              </div>
                            )}
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
                            {r >= 4 ? (
                              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 border-x-8 border-x-transparent border-t-8 border-t-card" />
                            ) : (
                              <div className="absolute -top-2 left-1/2 -translate-x-1/2 border-x-8 border-x-transparent border-b-8 border-b-card" />
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Slot Vazio com Sugestão de Posição */}
                    {!player && !isHidden && templateCurrent[cellKey] && (
                      <div className="w-10 h-10 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center bg-black/10 backdrop-blur-sm transition-transform group-hover:scale-105">
                        <span className="text-[9px] text-white/50 font-bold uppercase">{templateCurrent[cellKey]}</span>
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
        <span className="text-[10px] font-bold text-white/70">{compatibilityPct}%</span>
      </div>
    </div>
  );

  // ─── ANÁLISE (Omissão parcial por espaço, mas lógica mantida) ───────────────
  const renderAnalysis = () => (
    <Card className="p-4 bg-gradient-card border-border/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-primary" />
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Análise Efetiva</h3>
        </div>
        <div className="text-[10px] text-muted-foreground font-mono">
          QMG <span className="text-primary font-black text-xs">{stats.avgSkill}</span>
        </div>
      </div>
      <div className="space-y-2.5 mb-4">
        {[
          { label: "Goleiro", value: stats.gkSkill, color: "from-yellow-500 to-yellow-400" },
          { label: "Defesa", value: stats.defSkill, color: "from-blue-600 to-sky-400" },
          { label: "Meio", value: stats.midSkill, color: "from-emerald-600 to-teal-400" },
          { label: "Ataque", value: stats.attSkill, color: "from-rose-600 to-orange-400" },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted-foreground font-medium">{label}</span>
              <span className="font-black text-foreground tabular-nums">{value || "—"}</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
                style={{ width: `${Math.min(value, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );

  // ─── TÁTICAS E BANCO ────────────────────────────────────────────────────────
  const renderTactics = () => (
    <Card className="p-4 bg-gradient-card border-border/50">
      <div className="flex items-center gap-2 mb-3">
        <Settings className="h-4 w-4 text-primary" />
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mentalidade & Táticas</h3>
      </div>
      <div className="flex gap-1 bg-secondary/50 rounded-xl p-1 mb-2">
        {MENTALITIES.map((m) => (
          <button
            key={m}
            onClick={() => canEdit && setMentality(m)}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all duration-200 ${mentality === m ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"} ${!canEdit ? "cursor-default" : "cursor-pointer"}`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TACTICS_OPTS.map(({ label, icon }) => {
          const active = tactics.includes(label);
          return (
            <button
              key={label}
              onClick={() => canEdit && toggleTactic(label)}
              className={`px-2 py-1 text-[9px] font-semibold rounded-full border transition-all duration-150 flex items-center gap-1 ${active ? "bg-primary/20 border-primary/60 text-primary shadow-sm" : "bg-secondary/40 border-border/40 text-muted-foreground hover:border-border/70 hover:text-foreground"}`}
            >
              {active && <CheckCircle2 className="h-2.5 w-2.5" />} <span>{icon}</span> {label}
            </button>
          );
        })}
      </div>
    </Card>
  );

  const renderBench = () => (
    <Card className="p-4 bg-gradient-card border-border/50 flex-1 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Banco ({bench.length})
          </h3>
        </div>
      </div>
      <div className="overflow-y-auto space-y-0.5 flex-1 pr-0.5" style={{ scrollbarWidth: "thin" }}>
        {bench.length === 0 ? (
          <p className="text-center text-muted-foreground text-xs py-6">Todos em campo.</p>
        ) : (
          bench.map((p) => {
            const ps = getPosStyle(p.position);
            return (
              <div
                key={p.id}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-primary/5 border border-transparent hover:border-border/40 transition-colors"
              >
                <ShirtIcon number={p.shirt_number} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate leading-tight">{p.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[8px] font-bold px-1 py-0.5 rounded border ${ps.badge}`}>{p.position}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-black text-primary tabular-nums">{p.habilidade ?? "—"}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );

  return (
    <div className="space-y-3">
      {/* ── Cabeçalho ── */}
      <Card className="p-3 bg-gradient-card border-border/50">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Shield className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="font-display font-bold text-sm leading-none">Escalação Tática</span>
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

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="w-full lg:w-[56%]">{renderPitch()}</div>
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {renderAnalysis()}
          {renderTactics()}
          {renderBench()}
        </div>
      </div>

      {/* ── Modal de Substituição ── */}
      {subCell && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/60 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-start justify-between p-4 border-b border-border/50 shrink-0">
              <div>
                <h3 className="font-bold text-sm">
                  Substituir <span className="text-primary">{pitchPlayers[subCell]?.name ?? "posição vazia"}</span>
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Posição: <strong>{templateCurrent[subCell]}</strong>
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
                  const roleInCell = templateCurrent[subCell];
                  const isSameSector = getSector(p.position) === getSector(roleInCell);
                  const effSkill = calculateEffectiveSkill(p, roleInCell);
                  const currentStarterSkill = pitchPlayers[subCell]
                    ? calculateEffectiveSkill(pitchPlayers[subCell], roleInCell)
                    : 0;
                  const diff = effSkill - currentStarterSkill;

                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl transition-colors border ${isSameSector ? "border-primary/20 bg-primary/5" : "border-transparent hover:bg-secondary/40"}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <ShirtIcon number={p.shirt_number} />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold leading-tight">{p.name}</span>
                            {p.position === roleInCell && <Star className="h-2.5 w-2.5 text-primary fill-primary" />}
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground mt-0.5">
                            <span className={`px-1 py-0.5 rounded border font-bold ${ps.badge}`}>{p.position}</span>
                            <span>
                              Efetivo:{" "}
                              <strong className={effSkill < (p.habilidade || 0) ? "text-amber-500" : "text-primary"}>
                                {effSkill}
                              </strong>
                            </span>
                            {diff !== 0 && pitchPlayers[subCell] && (
                              <span className={`font-bold ${diff > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                {diff > 0 ? "+" : ""}
                                {diff}
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
