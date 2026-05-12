/**
 * LineupManager.tsx — Solara Hub v3
 *
 * Sistema de escala baseado em GRID:
 *   - 7 colunas × 4 ou 5 linhas (modo) + linha do GK (apenas col central).
 *   - Drag & drop livre: jogadores arrastados snap-am à célula mais próxima.
 *   - Grid visível só durante drag ou quando uma posição está selecionada.
 *   - Drop no centro vertical (faixa central do gramado) com mode=4 expande para 5.
 *   - Formações são presets do grid.
 *   - Visual gold/navy (chrome dourado, gramado verde sutil).
 */

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
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
  Grid3x3,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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

type GridMode = 4 | 5;

// ─── Config de grid ───────────────────────────────────────────────────────────

const COLS = 7;
// Faixa vertical reservada ao campo de linha (deixa GK ~88%)
const OUTFIELD_TOP = 14; // %
const OUTFIELD_BOTTOM = 80; // %
const GK_TOP = 90;
const GK_COL = 3; // coluna central (0..6)

const colCenters = Array.from({ length: COLS }, (_, c) => 7.14 + c * (85.72 / (COLS - 1)));

function rowCenters(mode: GridMode): number[] {
  const span = OUTFIELD_BOTTOM - OUTFIELD_TOP;
  const step = span / mode;
  return Array.from({ length: mode }, (_, r) => OUTFIELD_TOP + step * (r + 0.5));
}

// Faixa central (gatilho para expandir para mode 5) — entre as 2 linhas centrais do mode 4
const CENTER_BAND_MIN = OUTFIELD_TOP + (OUTFIELD_BOTTOM - OUTFIELD_TOP) * 0.42;
const CENTER_BAND_MAX = OUTFIELD_TOP + (OUTFIELD_BOTTOM - OUTFIELD_TOP) * 0.58;

// ─── Roles e estilos ──────────────────────────────────────────────────────────

const POS_COMPAT: Record<string, string[]> = {
  GOL: ["GOL"],
  ZAG: ["ZAG", "VOL"],
  LD: ["LD", "ZAG", "MC"],
  LE: ["LE", "ZAG", "MC"],
  VOL: ["VOL", "MC", "ZAG"],
  MC: ["MC", "VOL", "MEI"],
  MEI: ["MEI", "MC", "PE", "PD"],
  PD: ["PD", "MEI", "ATA"],
  PE: ["PE", "MEI", "ATA"],
  SA: ["SA", "ATA", "PD", "PE"],
  ATA: ["ATA", "SA", "PD", "PE"],
};

const POS_STYLE: Record<string, { text: string; badge: string }> = {
  GOL: { text: "text-amber-300", badge: "bg-amber-400/20 border-amber-400/50 text-amber-300" },
  ZAG: { text: "text-sky-300", badge: "bg-sky-500/20 border-sky-400/50 text-sky-300" },
  LD: { text: "text-cyan-300", badge: "bg-cyan-500/20 border-cyan-400/50 text-cyan-300" },
  LE: { text: "text-cyan-300", badge: "bg-cyan-500/20 border-cyan-400/50 text-cyan-300" },
  VOL: { text: "text-teal-300", badge: "bg-teal-500/20 border-teal-400/50 text-teal-300" },
  MC: { text: "text-emerald-300", badge: "bg-emerald-500/20 border-emerald-400/50 text-emerald-300" },
  MEI: { text: "text-lime-300", badge: "bg-lime-500/20 border-lime-400/50 text-lime-300" },
  PD: { text: "text-orange-300", badge: "bg-orange-500/20 border-orange-400/50 text-orange-300" },
  PE: { text: "text-orange-300", badge: "bg-orange-500/20 border-orange-400/50 text-orange-300" },
  SA: { text: "text-rose-300", badge: "bg-rose-500/20 border-rose-400/50 text-rose-300" },
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

function ratingLabel(skill: number) {
  if (skill >= 90) return { label: "Elite", color: "text-amber-300" };
  if (skill >= 80) return { label: "Estrela", color: "text-yellow-300" };
  if (skill >= 70) return { label: "Regular", color: "text-emerald-300" };
  if (skill >= 60) return { label: "Reserva", color: "text-sky-300" };
  return { label: "Cria", color: "text-slate-400" };
}

// ─── Slots e presets ──────────────────────────────────────────────────────────
// Cada slot: { id, role, row?, col? } — row/col definem posição inicial em modo padrão (4)

interface SlotDef {
  id: string;
  role: string;
  row: number; // 0..mode-1 (0 = ataque, mode-1 = defesa) ou -1 para GK
  col: number; // 0..6 (-1 ignorado para GK)
}

interface Preset {
  mode: GridMode;
  slots: SlotDef[];
}

const PRESETS: Record<string, Preset> = {
  "4-3-3": {
    mode: 4,
    slots: [
      { id: "gk", role: "GOL", row: -1, col: GK_COL },
      { id: "lb", role: "LE", row: 3, col: 0 },
      { id: "cb1", role: "ZAG", row: 3, col: 2 },
      { id: "cb2", role: "ZAG", row: 3, col: 4 },
      { id: "rb", role: "LD", row: 3, col: 6 },
      { id: "cm1", role: "MC", row: 2, col: 1 },
      { id: "cdm", role: "VOL", row: 2, col: 3 },
      { id: "cm2", role: "MC", row: 2, col: 5 },
      { id: "lw", role: "PE", row: 0, col: 1 },
      { id: "st", role: "ATA", row: 0, col: 3 },
      { id: "rw", role: "PD", row: 0, col: 5 },
    ],
  },
  "4-4-2": {
    mode: 4,
    slots: [
      { id: "gk", role: "GOL", row: -1, col: GK_COL },
      { id: "lb", role: "LE", row: 3, col: 0 },
      { id: "cb1", role: "ZAG", row: 3, col: 2 },
      { id: "cb2", role: "ZAG", row: 3, col: 4 },
      { id: "rb", role: "LD", row: 3, col: 6 },
      { id: "lm", role: "PE", row: 1, col: 0 },
      { id: "cm1", role: "MC", row: 1, col: 2 },
      { id: "cm2", role: "MC", row: 1, col: 4 },
      { id: "rm", role: "PD", row: 1, col: 6 },
      { id: "st1", role: "ATA", row: 0, col: 2 },
      { id: "st2", role: "ATA", row: 0, col: 4 },
    ],
  },
  "4-2-3-1": {
    mode: 5,
    slots: [
      { id: "gk", role: "GOL", row: -1, col: GK_COL },
      { id: "lb", role: "LE", row: 4, col: 0 },
      { id: "cb1", role: "ZAG", row: 4, col: 2 },
      { id: "cb2", role: "ZAG", row: 4, col: 4 },
      { id: "rb", role: "LD", row: 4, col: 6 },
      { id: "cdm1", role: "VOL", row: 3, col: 2 },
      { id: "cdm2", role: "VOL", row: 3, col: 4 },
      { id: "lam", role: "PE", row: 1, col: 1 },
      { id: "cam", role: "MEI", row: 1, col: 3 },
      { id: "ram", role: "PD", row: 1, col: 5 },
      { id: "st", role: "ATA", row: 0, col: 3 },
    ],
  },
  "3-5-2": {
    mode: 4,
    slots: [
      { id: "gk", role: "GOL", row: -1, col: GK_COL },
      { id: "cb1", role: "ZAG", row: 3, col: 1 },
      { id: "cb2", role: "ZAG", row: 3, col: 3 },
      { id: "cb3", role: "ZAG", row: 3, col: 5 },
      { id: "lwb", role: "LE", row: 2, col: 0 },
      { id: "cm1", role: "MC", row: 2, col: 2 },
      { id: "cdm", role: "VOL", row: 2, col: 3 },
      { id: "cm2", role: "MC", row: 2, col: 4 },
      { id: "rwb", role: "LD", row: 2, col: 6 },
      { id: "st1", role: "ATA", row: 0, col: 2 },
      { id: "st2", role: "ATA", row: 0, col: 4 },
    ],
  },
  "5-3-2": {
    mode: 4,
    slots: [
      { id: "gk", role: "GOL", row: -1, col: GK_COL },
      { id: "lwb", role: "LE", row: 3, col: 0 },
      { id: "cb1", role: "ZAG", row: 3, col: 2 },
      { id: "cb2", role: "ZAG", row: 3, col: 3 },
      { id: "cb3", role: "ZAG", row: 3, col: 4 },
      { id: "rwb", role: "LD", row: 3, col: 6 },
      { id: "cm1", role: "MC", row: 2, col: 2 },
      { id: "cdm", role: "VOL", row: 2, col: 3 },
      { id: "cm2", role: "MC", row: 2, col: 4 },
      { id: "st1", role: "ATA", row: 0, col: 2 },
      { id: "st2", role: "ATA", row: 0, col: 4 },
    ],
  },
  "3-4-3": {
    mode: 4,
    slots: [
      { id: "gk", role: "GOL", row: -1, col: GK_COL },
      { id: "cb1", role: "ZAG", row: 3, col: 1 },
      { id: "cb2", role: "ZAG", row: 3, col: 3 },
      { id: "cb3", role: "ZAG", row: 3, col: 5 },
      { id: "lm", role: "LE", row: 2, col: 0 },
      { id: "cm1", role: "MC", row: 2, col: 2 },
      { id: "cm2", role: "MC", row: 2, col: 4 },
      { id: "rm", role: "LD", row: 2, col: 6 },
      { id: "lw", role: "PE", row: 0, col: 1 },
      { id: "st", role: "ATA", row: 0, col: 3 },
      { id: "rw", role: "PD", row: 0, col: 5 },
    ],
  },
};

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

// ─── Estado de slot em jogo ───────────────────────────────────────────────────
// O slot tem id estável; pode ser posicionado em qualquer (row,col) do grid corrente.

interface PitchSlot {
  id: string;
  role: string;
  row: number; // -1 = GK
  col: number;
  player?: Player;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inferRoleFromPosition(player: Player, fallback: string): string {
  const p = (player.position || "").toUpperCase();
  if (POS_STYLE[p]) return p;
  return fallback;
}

function snapToCell(topPct: number, leftPct: number, mode: GridMode): { row: number; col: number } {
  // GK row?
  if (topPct > (OUTFIELD_BOTTOM + GK_TOP) / 2) return { row: -1, col: GK_COL };
  const rows = rowCenters(mode);
  let bestR = 0;
  let bestDr = Infinity;
  rows.forEach((rc, idx) => {
    const d = Math.abs(rc - topPct);
    if (d < bestDr) {
      bestDr = d;
      bestR = idx;
    }
  });
  let bestC = 0;
  let bestDc = Infinity;
  colCenters.forEach((cc, idx) => {
    const d = Math.abs(cc - leftPct);
    if (d < bestDc) {
      bestDc = d;
      bestC = idx;
    }
  });
  return { row: bestR, col: bestC };
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
  const dim = size === "sm" ? "w-8 h-8" : "w-11 h-11";
  const txt = size === "sm" ? "text-[10px]" : "text-[12px]";
  return (
    <div className={`relative flex justify-center items-center shrink-0 ${dim}`}>
      <svg
        viewBox="0 0 40 42"
        className={`w-full h-full transition-all duration-300 ${
          highlighted ? "drop-shadow-[0_0_10px_hsl(44_100%_60%_/_0.9)]" : "drop-shadow-[0_2px_5px_rgba(0,0,0,0.6)]"
        }`}
      >
        <defs>
          <path id="sh" d="M14 2 Q20 6 26 2 L38 8 L32 18 L28 14 L29 38 L20 40 L11 38 L12 14 L8 18 L2 8Z" />
          <linearGradient id="shirtGradGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={highlighted ? "hsl(44,100%,65%)" : "hsl(207,53%,28%)"} />
            <stop offset="100%" stopColor={highlighted ? "hsl(38,100%,48%)" : "hsl(207,67%,12%)"} />
          </linearGradient>
        </defs>
        <use href="#sh" fill="url(#shirtGradGold)" />
        <use
          href="#sh"
          fill="none"
          stroke={highlighted ? "hsl(38,100%,40%)" : "hsl(44,100%,52%)"}
          strokeWidth="1.6"
          strokeLinejoin="round"
          opacity={highlighted ? 1 : 0.65}
        />
      </svg>
      <span
        className={`absolute font-black tracking-tighter select-none ${txt} ${
          highlighted ? "text-amber-950" : "text-amber-300"
        }`}
        style={{ top: "48%", transform: "translateY(-50%)" }}
      >
        {number ?? "—"}
      </span>
    </div>
  );
}

// ─── Pitch SVG (gramado verde sutil + acentos gold) ───────────────────────────

function PitchSVG() {
  return (
    <svg
      viewBox="0 0 100 130"
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="grassGrad2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(165,30%,14%)" />
          <stop offset="50%" stopColor="hsl(168,32%,11%)" />
          <stop offset="100%" stopColor="hsl(165,30%,14%)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="130" fill="hsl(207,67%,8%)" />
      <rect x="5" y="5" width="90" height="120" fill="url(#grassGrad2)" rx="1.5" />
      {Array.from({ length: 10 }).map((_, i) => (
        <rect
          key={i}
          x="5"
          y={5 + i * 12}
          width="90"
          height="12"
          fill={i % 2 === 0 ? "hsl(44,100%,60% / 0.025)" : "transparent"}
        />
      ))}
      <g stroke="hsl(44,100%,60% / 0.55)" strokeWidth="0.4" fill="none">
        <rect x="5" y="5" width="90" height="120" rx="1.5" />
        <line x1="5" y1="65" x2="95" y2="65" />
        <circle cx="50" cy="65" r="12" />
        <circle cx="50" cy="65" r="0.8" fill="hsl(44,100%,70%)" />
        <rect x="20" y="5" width="60" height="18" />
        <rect x="32" y="5" width="36" height="7" />
        <path d="M40 23 A10 10 0 0 0 60 23" />
        <circle cx="50" cy="16" r="0.7" fill="hsl(44,100%,70%)" />
        <rect x="20" y="107" width="60" height="18" />
        <rect x="32" y="118" width="36" height="7" />
        <path d="M40 107 A10 10 0 0 1 60 107" />
        <circle cx="50" cy="113" r="0.7" fill="hsl(44,100%,70%)" />
      </g>
    </svg>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export function LineupManager({ players, club, canEdit = false }: LineupManagerProps) {
  const [formation, setFormation] = useState("4-3-3");
  const [mode, setMode] = useState<GridMode>(4);
  const [slots, setSlots] = useState<PitchSlot[]>([]);
  const [bench, setBench] = useState<Player[]>([]);

  const [tactics, setTactics] = useState<string[]>(["Posse de bola", "Saída pelo goleiro"]);
  const [mentality, setMentality] = useState<Mentality>("Equilibrado");
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null);
  const [subSlotId, setSubSlotId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"pitch" | "bench" | "stats">("pitch");
  const [isSaving, setIsSaving] = useState(false);
  const [subHistory, setSubHistory] = useState<SubRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const pitchRef = useRef<HTMLDivElement>(null);

  const gridVisible = isDragging || !!selectedSlotId || showGrid;

  // ── Auto-pick sobre preset ─────────────────────────────────────────────────

  const applyPreset = useCallback((formId: string, pool: Player[]) => {
    const preset = PRESETS[formId];
    if (!preset) return;

    const remaining = [...pool].sort((a, b) => (b.habilidade ?? 0) - (a.habilidade ?? 0));
    const newSlots: PitchSlot[] = preset.slots.map((s) => ({ ...s }));

    // 1ª passagem: posição exata
    newSlots.forEach((slot) => {
      if (slot.player) return;
      const idx = remaining.findIndex((p) => (p.position || "").toUpperCase() === slot.role.toUpperCase());
      if (idx !== -1) {
        slot.player = remaining[idx];
        remaining.splice(idx, 1);
      }
    });

    // 2ª passagem: compatíveis
    newSlots.forEach((slot) => {
      if (slot.player) return;
      const compat = POS_COMPAT[slot.role] ?? [slot.role];
      const idx = remaining.findIndex((p) => compat.includes((p.position || "").toUpperCase()));
      if (idx !== -1) {
        slot.player = remaining[idx];
        remaining.splice(idx, 1);
      }
    });

    // 3ª passagem: completar por habilidade
    newSlots.forEach((slot) => {
      if (slot.player) return;
      if (remaining.length > 0) slot.player = remaining.shift()!;
    });

    setMode(preset.mode);
    setSlots(newSlots);
    setBench(remaining);
  }, []);

  useEffect(() => {
    applyPreset("4-3-3", players);
  }, [players, applyPreset]);

  // fechar popover ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setSelectedSlotId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleFormationChange = (val: string) => {
    setFormation(val);
    const all = [...slots.map((s) => s.player).filter(Boolean) as Player[], ...bench];
    applyPreset(val, all);
    setSelectedSlotId(null);
    setSubHistory([]);
  };

  const computeDropCell = (e: React.DragEvent): { row: number; col: number } | null => {
    if (!pitchRef.current) return null;
    const rect = pitchRef.current.getBoundingClientRect();
    const topPct = ((e.clientY - rect.top) / rect.height) * 100;
    const leftPct = ((e.clientX - rect.left) / rect.width) * 100;

    // Se modo 4 e drop no centro vertical → muda para 5 antes de snap
    if (mode === 4 && topPct >= CENTER_BAND_MIN && topPct <= CENTER_BAND_MAX) {
      setMode(5);
      return snapToCell(topPct, leftPct, 5);
    }
    return snapToCell(topPct, leftPct, mode);
  };

  const handlePitchDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setHoverCell(null);
    if (!dragSourceId) return;
    const target = computeDropCell(e);
    setDragSourceId(null);
    if (!target) return;
    moveSlot(dragSourceId, target.row, target.col);
  };

  const moveSlot = (sourceId: string, row: number, col: number) => {
    setSlots((prev) => {
      const src = prev.find((s) => s.id === sourceId);
      if (!src) return prev;
      // Swap se houver outro slot na mesma célula
      const dest = prev.find((s) => s.id !== sourceId && s.row === row && s.col === col);
      return prev.map((s) => {
        if (s.id === sourceId) return { ...s, row, col };
        if (dest && s.id === dest.id) return { ...s, row: src.row, col: src.col };
        return s;
      });
    });
    setSelectedSlotId(null);
  };

  const handlePitchDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!pitchRef.current) return;
    const rect = pitchRef.current.getBoundingClientRect();
    const topPct = ((e.clientY - rect.top) / rect.height) * 100;
    const leftPct = ((e.clientX - rect.left) / rect.width) * 100;
    setHoverCell(snapToCell(topPct, leftPct, mode));
  };

  const handleSub = (benchPlayerId: string) => {
    if (!subSlotId) return;
    const benchIdx = bench.findIndex((p) => p.id === benchPlayerId);
    const slot = slots.find((s) => s.id === subSlotId);
    if (!slot) return;
    const starterOut = slot.player;
    const benchIn = bench[benchIdx];

    setSlots((prev) => prev.map((s) => (s.id === subSlotId ? { ...s, player: benchIn } : s)));
    setBench((prev) => {
      const next = [...prev];
      if (starterOut) next[benchIdx] = starterOut;
      else next.splice(benchIdx, 1);
      return next.sort((a, b) => (b.habilidade ?? 0) - (a.habilidade ?? 0));
    });

    if (starterOut) {
      setSubHistory((prev) => [
        {
          out: starterOut,
          inn: benchIn,
          cell: subSlotId,
          time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        },
        ...prev,
      ]);
    }

    setSubSlotId(null);
    setSelectedSlotId(null);
    toast.success(`${benchIn.name} entrou, ${starterOut?.name ?? "posição"} saiu`);
  };

  const toggleTactic = (t: string) =>
    setTactics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const handleSave = async () => {
    if (!canEdit) return;
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 700));
    setIsSaving(false);
    toast.success("Escalação salva!", {
      description: `${formation} · ${mentality} · grid ${mode === 5 ? "5×7" : "4×7"}`,
    });
  };

  const toggleMode = () => {
    setMode((m) => (m === 4 ? 5 : 4));
  };

  // ── Estatísticas ───────────────────────────────────────────────────────────

  const starters = useMemo(() => slots.map((s) => s.player).filter(Boolean) as Player[], [slots]);

  const stats = useMemo(() => {
    if (!starters.length)
      return { avgSkill: 0, avgAge: 0, foreigners: 0, gkSkill: 0, defSkill: 0, midSkill: 0, attSkill: 0 };
    const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0);
    const byRole = (roles: string[]) =>
      avg(starters.filter((p) => roles.includes((p.position || "").toUpperCase())).map((p) => p.habilidade ?? 0));
    return {
      avgSkill: avg(starters.map((p) => p.habilidade ?? 0)),
      avgAge: parseFloat((starters.reduce((s, p) => s + (p.age ?? 0), 0) / starters.length).toFixed(1)),
      foreigners: starters.filter((p) => p.nationality && p.nationality !== "Solara").length,
      gkSkill: byRole(["GOL"]),
      defSkill: byRole(["ZAG", "LD", "LE"]),
      midSkill: byRole(["VOL", "MC", "MEI"]),
      attSkill: byRole(["PD", "PE", "SA", "ATA"]),
    };
  }, [starters]);

  const compatibilityPct = useMemo(() => {
    let correct = 0;
    let total = 0;
    slots.forEach((s) => {
      if (!s.player) return;
      total++;
      if ((s.player.position || "").toUpperCase() === s.role.toUpperCase()) correct++;
    });
    return total > 0 ? Math.round((correct / total) * 100) : 0;
  }, [slots]);

  const sortedBench = useMemo(() => {
    if (!subSlotId) return bench;
    const slot = slots.find((s) => s.id === subSlotId);
    const role = slot?.role ?? "";
    const compat = POS_COMPAT[role] ?? [];
    return [...bench].sort((a, b) => {
      const aOk = compat.includes((a.position || "").toUpperCase()) ? 1 : 0;
      const bOk = compat.includes((b.position || "").toUpperCase()) ? 1 : 0;
      if (bOk !== aOk) return bOk - aOk;
      return (b.habilidade ?? 0) - (a.habilidade ?? 0);
    });
  }, [bench, subSlotId, slots]);

  // ─── Render do CAMPO ──────────────────────────────────────────────────────

  const renderPitch = () => {
    const rows = rowCenters(mode);

    return (
      <div
        ref={pitchRef}
        onDragOver={handlePitchDragOver}
        onDrop={handlePitchDrop}
        className="relative w-full aspect-[3/4] md:aspect-[4/5] rounded-2xl overflow-hidden border border-primary/30 touch-none select-none"
        style={{
          boxShadow: "var(--shadow-elevated), 0 0 0 1px hsl(44 100% 52% / 0.1) inset",
        }}
      >
        <PitchSVG />

        {/* Grid overlay (visível só durante drag/seleção) */}
        {gridVisible && (
          <div className="absolute inset-0 z-10 pointer-events-none">
            {/* Faixa central ativa (gatilho do mode 5) */}
            {mode === 4 && isDragging && (
              <div
                className="absolute left-[5%] right-[5%] border-y border-dashed border-primary/40 bg-primary/5"
                style={{
                  top: `${CENTER_BAND_MIN}%`,
                  height: `${CENTER_BAND_MAX - CENTER_BAND_MIN}%`,
                }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold text-primary/70 tracking-widest uppercase">
                  ↕ Centralizar (5×7)
                </div>
              </div>
            )}
            {/* Células do grid */}
            {rows.map((rTop, rIdx) =>
              colCenters.map((cLeft, cIdx) => {
                const isHover = hoverCell?.row === rIdx && hoverCell?.col === cIdx;
                return (
                  <div
                    key={`${rIdx}-${cIdx}`}
                    style={{
                      top: `${rTop}%`,
                      left: `${cLeft}%`,
                      width: `${85.72 / (COLS - 1) - 1.5}%`,
                      height: `${(OUTFIELD_BOTTOM - OUTFIELD_TOP) / mode - 1.5}%`,
                      transform: "translate(-50%, -50%)",
                      position: "absolute",
                    }}
                    className={`rounded-md border border-dashed transition-all ${
                      isHover ? "border-primary bg-primary/15 scale-105" : "border-primary/20 bg-primary/[0.03]"
                    }`}
                  />
                );
              }),
            )}
            {/* Célula do GK */}
            <div
              style={{
                top: `${GK_TOP}%`,
                left: `${colCenters[GK_COL]}%`,
                width: `${85.72 / (COLS - 1) - 1.5}%`,
                height: "10%",
                transform: "translate(-50%, -50%)",
                position: "absolute",
              }}
              className={`rounded-md border border-dashed transition-all ${
                hoverCell?.row === -1 ? "border-amber-400 bg-amber-400/15 scale-105" : "border-amber-400/30 bg-amber-400/5"
              }`}
            />
          </div>
        )}

        {/* Slots */}
        <div className="absolute inset-0 z-20">
          {slots.map((slot) => {
            const isGK = slot.row === -1;
            const top = isGK ? GK_TOP : rowCenters(mode)[Math.min(slot.row, mode - 1)];
            const left = colCenters[slot.col];
            const isSelected = selectedSlotId === slot.id;
            const player = slot.player;

            return (
              <div
                key={slot.id}
                style={{
                  top: `${top}%`,
                  left: `${left}%`,
                  transform: "translate(-50%, -50%)",
                  position: "absolute",
                }}
                className="transition-all duration-300 ease-out"
              >
                <div
                  onClick={() => setSelectedSlotId(isSelected ? null : slot.id)}
                  className={`relative flex flex-col items-center p-1 rounded-xl ${
                    isSelected ? "z-50 scale-110" : "hover:scale-105"
                  }`}
                >
                  {player ? (
                    <div
                      draggable={canEdit}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", slot.id);
                        setDragSourceId(slot.id);
                        setIsDragging(true);
                      }}
                      onDragEnd={() => {
                        setIsDragging(false);
                        setDragSourceId(null);
                        setHoverCell(null);
                      }}
                      className="flex flex-col items-center cursor-grab active:cursor-grabbing"
                    >
                      <ShirtIcon number={player.shirt_number} highlighted={isSelected} />
                      <div
                        className={`mt-[-6px] px-1.5 py-0.5 rounded border backdrop-blur-md ${
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "bg-card/85 border-primary/30"
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <span className={`text-[8px] font-bold ${isSelected ? "text-primary-foreground" : getPosStyle(player.position).text}`}>
                            {player.position}
                          </span>
                          <span className={`text-[10px] font-black ${isSelected ? "text-primary-foreground" : "text-foreground"}`}>
                            {player.habilidade}
                          </span>
                        </div>
                        <div className={`text-[9px] font-medium truncate max-w-[60px] ${isSelected ? "text-primary-foreground" : "text-foreground"}`}>
                          {player.name.split(" ").pop()}
                        </div>
                      </div>

                      {isSelected && (
                        <div
                          ref={popoverRef}
                          className="absolute bottom-full mb-3 w-48 glass-card p-3 z-[60]"
                        >
                          <p className="font-bold text-xs truncate text-foreground">{player.name}</p>
                          <p className="text-[10px] text-muted-foreground mb-2">
                            {player.position} · Hab {player.habilidade}
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-7 text-[10px] border-primary/40 text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSubSlotId(slot.id);
                              setSelectedSlotId(null);
                            }}
                          >
                            <ArrowRightLeft className="h-3 w-3 mr-1" /> Substituir
                          </Button>
                          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-card border-r border-b border-border rotate-45" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full border-2 border-dashed border-primary/30 flex items-center justify-center bg-card/30 backdrop-blur-sm">
                      <span className="text-[9px] text-primary/60 font-bold">{slot.role}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* HUD inferior */}
        <div className="absolute bottom-3 inset-x-3 flex justify-between items-end z-30 pointer-events-none">
          <div className="glass-card px-2.5 py-1.5 pointer-events-auto">
            <div className="text-[10px] font-black text-primary tracking-tighter uppercase">{formation}</div>
            <div className="text-[8px] text-muted-foreground">
              {mentality} · {mode}×{COLS}
            </div>
          </div>
          <div className="glass-card px-2.5 py-1.5 pointer-events-auto text-right">
            <div className="text-[8px] text-muted-foreground uppercase">Entrosamento</div>
            <div className="text-[10px] font-black text-primary">{compatibilityPct}%</div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Análise ──────────────────────────────────────────────────────────────

  const renderAnalysis = () => (
    <Card className="p-4 bg-gradient-card border-primary/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-primary" />
          <h3 className="text-[11px] font-display font-bold uppercase tracking-wider text-foreground">
            Análise do Time
          </h3>
        </div>
        <div className="text-[10px] text-muted-foreground font-mono">
          QMG <span className="gold-text font-black text-sm">{stats.avgSkill}</span>
        </div>
      </div>

      <div className="space-y-2.5 mb-4">
        {[
          { label: "Goleiro", value: stats.gkSkill },
          { label: "Defesa", value: stats.defSkill },
          { label: "Meio", value: stats.midSkill },
          { label: "Ataque", value: stats.attSkill },
        ].map(({ label, value }) => (
          <div key={label}>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted-foreground font-medium">{label}</span>
              <span className="font-black text-foreground tabular-nums">{value || "—"}</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-700"
                style={{ width: `${Math.min(value, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          {
            label: "Idade Média",
            value: `${stats.avgAge}a`,
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
            label: "Formação",
            value: `${compatibilityPct}%`,
            sub: compatibilityPct >= 80 ? "Ideal" : compatibilityPct >= 60 ? "OK" : "Baixa",
            ok: compatibilityPct >= 80,
          },
        ].map(({ label, value, sub, ok }) => (
          <div
            key={label}
            className="bg-secondary/40 rounded-lg p-2 border border-border/40 text-center"
          >
            <div className="text-[9px] text-muted-foreground mb-0.5 leading-tight">{label}</div>
            <div className="font-display font-black text-sm leading-none">{value}</div>
            <div className={`text-[9px] mt-0.5 font-medium ${ok ? "text-primary" : "text-amber-400"}`}>{sub}</div>
          </div>
        ))}
      </div>
    </Card>
  );

  // ─── Táticas ──────────────────────────────────────────────────────────────

  const renderTactics = () => (
    <Card className="p-4 bg-gradient-card border-primary/20">
      <div className="flex items-center gap-2 mb-3">
        <Settings className="h-4 w-4 text-primary" />
        <h3 className="text-[11px] font-display font-bold uppercase tracking-wider text-foreground">
          Mentalidade & Táticas
        </h3>
      </div>

      <div className="flex gap-1 bg-secondary/50 rounded-xl p-1 mb-1">
        {MENTALITIES.map((m) => (
          <button
            key={m}
            onClick={() => canEdit && setMentality(m)}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
              mentality === m
                ? "bg-gradient-gold text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            } ${!canEdit ? "cursor-default" : "cursor-pointer"}`}
          >
            {m}
          </button>
        ))}
      </div>
      <p className={`text-[9px] text-center mb-3 font-medium ${MENTALITY_META[mentality].color}`}>
        {MENTALITY_META[mentality].desc}
      </p>

      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
        Instruções ({tactics.length})
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TACTICS_OPTS.map(({ label, icon }) => {
          const active = tactics.includes(label);
          return (
            <button
              key={label}
              onClick={() => canEdit && toggleTactic(label)}
              className={`px-2 py-1 text-[9px] font-semibold rounded-full border transition-all flex items-center gap-1 ${
                active
                  ? "bg-primary/20 border-primary/60 text-primary shadow-sm"
                  : "bg-secondary/40 border-border/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"
              } ${!canEdit ? "cursor-default" : "cursor-pointer"}`}
            >
              {active && <CheckCircle2 className="h-2.5 w-2.5" />}
              <span>{icon}</span>
              {label}
            </button>
          );
        })}
      </div>
    </Card>
  );

  // ─── Banco ────────────────────────────────────────────────────────────────

  const renderBench = () => (
    <Card className="p-4 bg-gradient-card border-primary/20 flex-1 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-[11px] font-display font-bold uppercase tracking-wider text-foreground">
            Banco <span className="text-muted-foreground">({bench.length})</span>
          </h3>
        </div>
        {subHistory.length > 0 && (
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-primary transition-colors"
          >
            <History className="h-3 w-3" />
            {subHistory.length} subs
          </button>
        )}
      </div>

      {showHistory ? (
        <div className="space-y-1 overflow-y-auto flex-1">
          {subHistory.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-2 p-2 rounded-lg bg-secondary/20 border border-primary/20 text-[10px]"
            >
              <ArrowRightLeft className="h-3 w-3 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-primary font-bold truncate">{s.inn.name}</span>
                <span className="text-muted-foreground"> ↔ </span>
                <span className="text-rose-400 font-bold truncate">{s.out.name}</span>
              </div>
              <span className="text-muted-foreground shrink-0">{s.time}</span>
            </div>
          ))}
          <button
            onClick={() => setShowHistory(false)}
            className="w-full text-[9px] text-muted-foreground hover:text-primary py-1 transition-colors"
          >
            ← Voltar ao banco
          </button>
        </div>
      ) : (
        <div className="overflow-y-auto space-y-0.5 flex-1 pr-0.5 scrollbar-thin">
          {bench.length === 0 ? (
            <p className="text-center text-muted-foreground text-xs py-6">Todos em campo.</p>
          ) : (
            bench.map((p) => {
              const ps = getPosStyle(p.position);
              const rl = ratingLabel(p.habilidade ?? 0);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-primary/5 border border-transparent hover:border-primary/30 transition-colors"
                >
                  <ShirtIcon number={p.shirt_number} size="sm" />
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

  // ─── Cabeçalho gold/navy ─────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <Card
        className="p-3 bg-gradient-card border-primary/30"
        style={{ boxShadow: "0 0 0 1px hsl(44 100% 52% / 0.1) inset" }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-gold flex items-center justify-center shadow-[var(--shadow-gold)]">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <span className="font-display font-bold text-sm leading-none gold-text">Escalação Tática</span>
              <div className="text-[9px] text-muted-foreground mt-0.5">
                {starters.length} titulares · {bench.length} reservas
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Badge
              variant="outline"
              className="text-[9px] h-7 border-primary/40 text-primary font-bold uppercase tracking-wider"
            >
              <Grid3x3 className="h-3 w-3 mr-1" />
              {mode}×{COLS}
            </Badge>

            <Select value={formation} onValueChange={handleFormationChange}>
              <SelectTrigger className="h-8 text-xs w-[7rem] bg-background/50 border-primary/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(PRESETS).map((f) => (
                  <SelectItem key={f} value={f} className="text-xs">
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {canEdit && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-primary/30 hover:bg-primary/10"
                  onClick={toggleMode}
                  title="Alternar grid 4×7 / 5×7"
                >
                  <Grid3x3 className="h-3 w-3 mr-1" />
                  {mode === 4 ? "5×7" : "4×7"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-primary/30 hover:bg-primary/10"
                  onClick={() => {
                    const all = [...starters, ...bench];
                    applyPreset(formation, all);
                    toast.success("Escalação otimizada!");
                  }}
                >
                  <Zap className="h-3 w-3 mr-1" />
                  Auto
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-gradient-gold text-primary-foreground hover:opacity-90 shadow-[var(--shadow-gold)]"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Activity className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Save className="h-3 w-3 mr-1" />
                  )}
                  {isSaving ? "Salvando…" : "Salvar"}
                </Button>
              </>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            Arraste qualquer jogador no campo. Solte na faixa central para expandir o grid.
          </div>
        )}
      </Card>

      {/* Tabs mobile */}
      <div className="flex md:hidden bg-secondary/40 rounded-xl overflow-hidden border border-primary/20 p-0.5 gap-0.5">
        {(["pitch", "bench", "stats"] as const).map((tab) => {
          const labels = { pitch: "Campo", bench: `Banco (${bench.length})`, stats: "Análise" };
          return (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${
                mobileTab === tab
                  ? "bg-gradient-gold text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* Layout */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className={`w-full lg:w-[56%] ${mobileTab !== "pitch" ? "hidden md:block" : ""}`}>{renderPitch()}</div>

        <div className={`flex-1 flex flex-col gap-3 min-w-0 ${mobileTab === "pitch" ? "hidden md:flex" : "flex"}`}>
          <div className={mobileTab === "bench" ? "hidden md:block" : ""}>{renderAnalysis()}</div>
          <div className={mobileTab === "bench" ? "hidden md:block" : ""}>{renderTactics()}</div>
          <div className={`flex-1 flex flex-col min-h-0 ${mobileTab === "stats" ? "hidden md:flex" : "flex"}`}>
            {renderBench()}
          </div>
        </div>
      </div>

      {/* Modal de substituição */}
      {subSlotId && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="glass-card w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]"
            style={{ boxShadow: "var(--shadow-elevated)" }}
          >
            <div className="flex items-start justify-between p-4 border-b border-primary/20 shrink-0">
              <div>
                <h3 className="font-display font-bold text-sm">
                  Substituir{" "}
                  <span className="text-primary">
                    {slots.find((s) => s.id === subSlotId)?.player?.name ?? "posição vazia"}
                  </span>
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Posição:{" "}
                  <strong className={getPosStyle(slots.find((s) => s.id === subSlotId)?.role ?? "").text}>
                    {slots.find((s) => s.id === subSlotId)?.role ?? "—"}
                  </strong>{" "}
                  &middot; Selecione um jogador do banco
                </p>
              </div>
              <button
                onClick={() => setSubSlotId(null)}
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
                  const slot = slots.find((s) => s.id === subSlotId);
                  const role = slot?.role ?? "";
                  const compat = (POS_COMPAT[role] ?? []).includes((p.position || "").toUpperCase());
                  const starterSkill = slot?.player?.habilidade ?? 0;
                  const diff = (p.habilidade ?? 0) - starterSkill;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl transition-colors border ${
                        compat
                          ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
                          : "border-transparent hover:bg-secondary/40 hover:border-border/40"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <ShirtIcon number={p.shirt_number} />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold leading-tight">{p.name}</span>
                            {compat && <Star className="h-2.5 w-2.5 text-primary fill-primary" />}
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground mt-0.5">
                            <span className={`px-1 py-0.5 rounded border font-bold ${ps.badge}`}>{p.position}</span>
                            <span>
                              Hab: <strong className="text-primary">{p.habilidade ?? "—"}</strong>
                            </span>
                            {diff !== 0 && (
                              <span className={`font-bold ${diff > 0 ? "text-primary" : "text-rose-400"}`}>
                                {diff > 0 ? "+" : ""}
                                {diff}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="text-xs h-7 shrink-0 bg-gradient-gold text-primary-foreground hover:opacity-90"
                        onClick={() => handleSub(p.id)}
                      >
                        Escalar
                        <ChevronRight className="h-3 w-3 ml-0.5" />
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
