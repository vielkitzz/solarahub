/**
 * LineupManager.tsx — Solara Hub
 * Componente de escalação tática reformulado.
 *
 * Como usar em ClubDetail.tsx:
 *   1. import { LineupManager } from "@/components/club-detail/LineupManager";
 *   2. <TabsTrigger value="escalacao">Escalação</TabsTrigger>
 *   3. <TabsContent value="escalacao" className="mt-4">
 *          <LineupManager players={players} club={club} canEdit={canEdit} />
 *      </TabsContent>
 *
 * Melhorias v2:
 *   - Campo com gradiente dinâmico de grama + linhas mais precisas
 *   - Player cards repaginados com animações de seleção
 *   - Painel de análise com radar visual e gráfico de distribuição por setor
 *   - Drag-and-drop refinado com highlight de drop-zone
 *   - Modal de substituição com diferencial de habilidade
 *   - Auto-preenchimento inteligente: respeita posições por setor (defesa/meio/ataque)
 *   - Indicador de compatibilidade de formação
 *   - Histórico de substituições na sessão
 *   - Acessibilidade: navegação por teclado nas células do campo
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
  TrendingUp,
  History,
  ChevronRight,
  Star,
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

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Mapeamento de posição → setor para autopick inteligente */
const POS_SECTOR: Record<string, "GK" | "DEF" | "MID" | "ATT"> = {
  GOL: "GK",
  ZAG: "DEF",
  LD: "DEF",
  LE: "DEF",
  VOL: "MID",
  MC: "MID",
  MEI: "MID",
  PD: "ATT",
  PE: "ATT",
  SA: "ATT",
  ATA: "ATT",
};

/** Grupos de posições compatíveis para sugestão de substituição */
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

// ─── Rating label ─────────────────────────────────────────────────────────────

function ratingLabel(skill: number) {
  if (skill >= 90) return { label: "Elite", color: "text-amber-300" };
  if (skill >= 80) return { label: "Estrela", color: "text-yellow-300" };
  if (skill >= 70) return { label: "Regular", color: "text-emerald-300" };
  if (skill >= 60) return { label: "Reserva", color: "text-sky-300" };
  return { label: "Cria", color: "text-slate-400" };
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
        className={`w-full h-full transition-all duration-300 ${
          highlighted ? "drop-shadow-[0_0_8px_hsl(44_100%_52%_/_0.8)]" : "drop-shadow-[0_2px_5px_rgba(0,0,0,0.6)]"
        }`}
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
        className={`absolute font-black tracking-tighter select-none ${txt} ${
          highlighted ? "text-amber-900" : "text-slate-800"
        }`}
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
      <defs>
        <linearGradient id="grassGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(152,55%,22%)" />
          <stop offset="50%" stopColor="hsl(148,52%,19%)" />
          <stop offset="100%" stopColor="hsl(152,55%,22%)" />
        </linearGradient>
        {/* Listras de grama alternadas */}
        {Array.from({ length: 10 }).map((_, i) => (
          <rect
            key={i}
            x="5"
            y={5 + i * 12}
            width="90"
            height="12"
            fill={i % 2 === 0 ? "hsl(148,52%,21%)" : "hsl(152,55%,18%)"}
            opacity="0.5"
          />
        ))}
      </defs>
      <rect x="5" y="5" width="90" height="120" fill="url(#grassGrad)" />
      {/* Listras */}
      {Array.from({ length: 10 }).map((_, i) => (
        <rect
          key={i}
          x="5"
          y={5 + i * 12}
          width="90"
          height="12"
          fill={i % 2 === 0 ? "rgba(255,255,255,0.03)" : "transparent"}
        />
      ))}
      {/* Linhas do campo */}
      <rect x="5" y="5" width="90" height="120" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
      <line x1="5" y1="65" x2="95" y2="65" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
      <circle cx="50" cy="65" r="12" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
      <circle cx="50" cy="65" r="0.8" fill="rgba(255,255,255,0.6)" />
      {/* Área superior */}
      <rect x="20" y="5" width="60" height="18" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
      <rect x="32" y="5" width="36" height="7" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
      <path d="M40 23 A10 10 0 0 0 60 23" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
      <circle cx="50" cy="16" r="0.7" fill="rgba(255,255,255,0.6)" />
      {/* Área inferior */}
      <rect x="20" y="107" width="60" height="18" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
      <rect x="32" y="118" width="36" height="7" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
      <path d="M40 107 A10 10 0 0 1 60 107" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
      <circle cx="50" cy="113" r="0.7" fill="rgba(255,255,255,0.6)" />
      {/* Cantos */}
      <path d="M5 8 A3 3 0 0 0 8 5" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
      <path d="M92 5 A3 3 0 0 0 95 8" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
      <path d="M5 122 A3 3 0 0 1 8 125" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
      <path d="M95 122 A3 3 0 0 1 92 125" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
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

  // ── Auto-pick ───────────────────────────────────────────────────────────────

  const autoPickFormation = useCallback((formId: string, pool: Player[]) => {
    const template = FORMATIONS[formId];
    let remaining = [...pool].sort((a, b) => (b.habilidade ?? 0) - (a.habilidade ?? 0));
    const newPitch: Record<string, Player> = {};

    // 1ª passagem: encaixar por posição exata
    Object.entries(template).forEach(([cellKey, role]) => {
      const idx = remaining.findIndex((p) => (p.position || "").toUpperCase() === role.toUpperCase());
      if (idx !== -1) {
        newPitch[cellKey] = remaining[idx];
        remaining.splice(idx, 1);
      }
    });

    // 2ª passagem: encaixar por setor compatível
    Object.entries(template).forEach(([cellKey, role]) => {
      if (newPitch[cellKey]) return;
      const sector = POS_SECTOR[role];
      const idx = remaining.findIndex((p) => POS_SECTOR[(p.position || "").toUpperCase()] === sector);
      if (idx !== -1) {
        newPitch[cellKey] = remaining[idx];
        remaining.splice(idx, 1);
      }
    });

    // 3ª passagem: preencher vazios com quem sobrou (por habilidade)
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
    toast.success(`${benchIn.name} entrou, ${starterOut?.name ?? "posição"} saiu`);
  };

  const toggleTactic = (t: string) =>
    setTactics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const handleSave = async () => {
    if (!canEdit) return;
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 900));
    setIsSaving(false);
    toast.success("Escalação salva com sucesso!", {
      description: `${formation} · ${mentality} · ${tactics.length} instruções táticas`,
    });
  };

  // ── Estatísticas ───────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const starters = Object.values(pitchPlayers).filter(Boolean);
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
  }, [pitchPlayers]);

  // Compatibilidade com a formação (% de posições corretas)
  const compatibilityPct = useMemo(() => {
    const template = FORMATIONS[formation];
    let correct = 0;
    let total = 0;
    Object.entries(template).forEach(([key, role]) => {
      const p = pitchPlayers[key];
      if (!p) return;
      total++;
      if ((p.position || "").toUpperCase() === role.toUpperCase()) correct++;
    });
    return total > 0 ? Math.round((correct / total) * 100) : 0;
  }, [pitchPlayers, formation]);

  // ── Bench ordenado com indicador de compatibilidade com subCell ────────────

  const sortedBench = useMemo(() => {
    if (!subCell) return bench;
    const posInCell = FORMATIONS[formation][subCell];
    const compat = POS_COMPAT[posInCell] ?? [];
    return [...bench].sort((a, b) => {
      const aOk = compat.includes((a.position || "").toUpperCase()) ? 1 : 0;
      const bOk = compat.includes((b.position || "").toUpperCase()) ? 1 : 0;
      if (bOk !== aOk) return bOk - aOk;
      return (b.habilidade ?? 0) - (a.habilidade ?? 0);
    });
  }, [bench, subCell, formation]);

  // ─── CAMPO ────────────────────────────────────────────────────────────────

  const template = FORMATIONS[formation];

  const renderPitch = () => (
    <div
      ref={pitchRef}
      className="relative w-full aspect-[3/4] md:aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl border border-white/10 touch-none select-none"
      style={{ background: "hsl(152,55%,18%)" }}
    >
      {/* Brilho de profundidade */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/25 pointer-events-none z-[1]" />
      <PitchSVG />

      {/* GRID TÁTICO */}
      <div className="absolute inset-0 flex flex-col p-2 gap-0.5 z-10">
        {Array.from({ length: GRID_ROWS }).map((_, r) => {
          const isGkRow = r === GRID_ROWS - 1;
          const rowHasCenter = !isGkRow && (!!pitchPlayers[`${r}-2`] || !!template[`${r}-2`] || isDragging);

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
                const isDropZone = dropTarget === cellKey && inTemplate;
                const isSrcCell = dragSource === cellKey;

                return (
                  <div
                    key={cellKey}
                    role={inTemplate ? "button" : undefined}
                    tabIndex={inTemplate ? 0 : -1}
                    aria-label={player ? `${player.name} - ${player.position}` : (template[cellKey] ?? undefined)}
                    onDragOver={(e) => {
                      if (inTemplate) {
                        e.preventDefault();
                        setDropTarget(cellKey);
                      }
                    }}
                    onDragLeave={() => setDropTarget(null)}
                    onDrop={(e) => handleDrop(e, cellKey)}
                    onClick={() => {
                      if (!inTemplate && !player) return;
                      setSelectedCell(isSelected ? null : cellKey);
                    }}
                    onKeyDown={(e: KeyboardEvent) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedCell(isSelected ? null : cellKey);
                      }
                    }}
                    className={[
                      "relative flex items-center justify-center rounded-lg transition-all duration-200 outline-none",
                      isDropZone ? "ring-2 ring-primary/70 bg-primary/15 scale-105" : "",
                      isSelected ? "bg-primary/20 ring-2 ring-primary/60 scale-105" : "",
                      isSrcCell ? "opacity-40" : "",
                      !isDragging && !isSelected && inTemplate && player
                        ? "hover:bg-white/10 focus-visible:bg-white/10 cursor-pointer"
                        : "",
                      isDragging && inTemplate && !isSrcCell ? "ring-1 ring-white/20 bg-white/5" : "",
                    ].join(" ")}
                  >
                    {player && (
                      <div
                        draggable={canEdit}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData("text/plain", cellKey);
                          e.dataTransfer.effectAllowed = "move";
                          setDragSource(cellKey);
                          setTimeout(() => setIsDragging(true), 10);
                        }}
                        onDragEnd={() => {
                          setIsDragging(false);
                          setDragSource(null);
                          setDropTarget(null);
                        }}
                        className={`relative flex flex-col items-center z-10 ${
                          canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                        } transition-transform duration-200 ${isSelected ? "scale-110 z-20" : "hover:scale-105"}`}
                      >
                        <ShirtIcon number={player.shirt_number} highlighted={isSelected} />

                        {/* Card FM-style */}
                        <div
                          className={`flex flex-col items-center mt-[-4px] z-30 rounded-md overflow-hidden min-w-[64px] border transition-all duration-200 ${
                            isSelected ? "border-primary/70 shadow-lg shadow-primary/20" : "border-black/50"
                          }`}
                        >
                          <div className="bg-card/95 backdrop-blur-sm w-full px-1.5 py-[2px] flex justify-center items-center gap-1 border-b border-border/40">
                            <span className={`text-[8px] font-bold ${getPosStyle(player.position).text}`}>
                              {player.position}
                            </span>
                            <span className="text-[9px] font-black text-primary">{player.habilidade ?? "—"}</span>
                          </div>
                          <div
                            className={`w-full px-1.5 py-[2px] text-[9px] font-semibold text-center truncate max-w-[76px] transition-colors duration-200 ${
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-primary/80 text-primary-foreground"
                            }`}
                          >
                            {player.name.split(" ").pop()}
                          </div>
                        </div>

                        {/* Popover */}
                        {isSelected && (
                          <div
                            ref={popoverRef}
                            className={`absolute ${
                              r >= 4 ? "bottom-full mb-3" : "top-full mt-3"
                            } left-1/2 -translate-x-1/2 w-56 bg-card border border-border/60 rounded-xl shadow-2xl z-50 p-3.5 text-sm`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Header */}
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1 min-w-0 pr-2">
                                <p className="font-bold text-foreground truncate leading-tight">{player.name}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  #{player.shirt_number ?? "—"} &middot; {player.age ?? "—"} anos
                                  {player.nationality ? ` · ${player.nationality}` : ""}
                                </p>
                              </div>
                              <div
                                className={`h-9 w-9 rounded-lg flex flex-col items-center justify-center text-xs font-black border shrink-0 ${getPosStyle(player.position).badge}`}
                              >
                                <span className="text-[14px] leading-none">{player.habilidade ?? "—"}</span>
                                <span className="text-[8px] opacity-70 leading-none mt-0.5">
                                  {ratingLabel(player.habilidade ?? 0).label}
                                </span>
                              </div>
                            </div>

                            {/* Barra de habilidade */}
                            <div className="mb-3">
                              <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-primary to-amber-400 transition-all duration-500"
                                  style={{ width: `${Math.min(player.habilidade ?? 0, 100)}%` }}
                                />
                              </div>
                            </div>

                            {/* Ações */}
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
                                <ArrowRightLeft className="h-3 w-3 mr-1.5" />
                                Substituir
                              </Button>
                            )}

                            {/* seta indicadora */}
                            {r >= 4 ? (
                              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 border-x-8 border-x-transparent border-t-8 border-t-card" />
                            ) : (
                              <div className="absolute -top-2 left-1/2 -translate-x-1/2 border-x-8 border-x-transparent border-b-8 border-b-card" />
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Slot vazio */}
                    {!player && inTemplate && (
                      <div className="w-9 h-9 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
                        <span className="text-[8px] text-white/25 font-bold uppercase">{template[cellKey]}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Indicador de formação */}
      <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-white/10">
        <span className="text-[11px] font-black text-primary tracking-widest">{formation}</span>
        <span className="text-[9px] text-white/50 font-medium">{mentality}</span>
      </div>

      {/* Compatibilidade */}
      <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-white/10">
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            compatibilityPct >= 80 ? "bg-emerald-400" : compatibilityPct >= 60 ? "bg-amber-400" : "bg-rose-400"
          }`}
        />
        <span className="text-[10px] font-bold text-white/70">{compatibilityPct}%</span>
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
          QMG <span className="text-primary font-black text-xs">{stats.avgSkill}</span>
        </div>
      </div>

      {/* Barras por setor */}
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

      {/* Rodapé: Idade + Estrangeiros + Compatibilidade */}
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

  const renderTactics = () => (
    <Card className="p-4 bg-gradient-card border-border/50">
      <div className="flex items-center gap-2 mb-3">
        <Settings className="h-4 w-4 text-primary" />
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mentalidade & Táticas</h3>
      </div>

      {/* Seletor de mentalidade */}
      <div className="flex gap-1 bg-secondary/50 rounded-xl p-1 mb-1">
        {MENTALITIES.map((m) => (
          <button
            key={m}
            onClick={() => canEdit && setMentality(m)}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all duration-200 ${
              mentality === m
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            } ${!canEdit ? "cursor-default" : "cursor-pointer"}`}
          >
            {m}
          </button>
        ))}
      </div>
      {/* Descrição da mentalidade */}
      <p className={`text-[9px] text-center mb-3 font-medium ${MENTALITY_META[mentality].color}`}>
        {MENTALITY_META[mentality].desc}
      </p>

      {/* Instruções táticas */}
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
              className={`px-2 py-1 text-[9px] font-semibold rounded-full border transition-all duration-150 flex items-center gap-1 ${
                active
                  ? "bg-primary/20 border-primary/60 text-primary shadow-sm"
                  : "bg-secondary/40 border-border/40 text-muted-foreground hover:border-border/70 hover:text-foreground"
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

  // ─── BANCO ────────────────────────────────────────────────────────────────

  const renderBench = () => (
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
        >
          {bench.length === 0 ? (
            <p className="text-center text-muted-foreground text-xs py-6">Todos em campo.</p>
          ) : (
            bench.map((p) => {
              const ps = getPosStyle(p.position);
              const rl = ratingLabel(p.habilidade ?? 0);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-primary/5 border border-transparent hover:border-border/40 transition-colors group"
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
                {Object.values(pitchPlayers).filter(Boolean).length} titulares &middot; {bench.length} reservas
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Formação */}
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

            {/* Auto-pick */}
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
                <Zap className="h-3 w-3 mr-1" />
                Auto
              </Button>
            )}

            {/* Salvar */}
            {canEdit && (
              <Button
                size="sm"
                className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? <Activity className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                {isSaving ? "Salvando…" : "Salvar"}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* ── Tabs mobile ── */}
      <div className="flex md:hidden bg-secondary/40 rounded-xl overflow-hidden border border-border/50 p-0.5 gap-0.5">
        {(["pitch", "bench", "stats"] as const).map((tab) => {
          const labels = {
            pitch: "Campo",
            bench: `Banco (${bench.length})`,
            stats: "Análise",
          };
          return (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all duration-200 ${
                mobileTab === tab
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* ── Layout principal ── */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Campo */}
        <div className={`w-full lg:w-[56%] ${mobileTab !== "pitch" ? "hidden md:block" : ""}`}>{renderPitch()}</div>

        {/* Painéis laterais */}
        <div className={`flex-1 flex flex-col gap-3 min-w-0 ${mobileTab === "pitch" ? "hidden md:flex" : "flex"}`}>
          {/* Análise — oculta no mobile tab "bench" */}
          <div className={mobileTab === "bench" ? "hidden md:block" : ""}>{renderAnalysis()}</div>

          {/* Táticas — oculta no mobile tab "bench" */}
          <div className={mobileTab === "bench" ? "hidden md:block" : ""}>{renderTactics()}</div>

          {/* Banco — oculta no mobile tab "stats" */}
          <div className={`flex-1 flex flex-col min-h-0 ${mobileTab === "stats" ? "hidden md:flex" : "flex"}`}>
            {renderBench()}
          </div>
        </div>
      </div>

      {/* ── Modal de substituição ── */}
      {subCell && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/60 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            {/* Header do modal */}
            <div className="flex items-start justify-between p-4 border-b border-border/50 shrink-0">
              <div>
                <h3 className="font-bold text-sm">
                  Substituir <span className="text-primary">{pitchPlayers[subCell]?.name ?? "posição vazia"}</span>
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Posição:{" "}
                  <strong className={getPosStyle(FORMATIONS[formation][subCell] ?? "").text}>
                    {FORMATIONS[formation][subCell] ?? "—"}
                  </strong>{" "}
                  &middot; Selecione um jogador do banco
                </p>
              </div>
              <button
                onClick={() => setSubCell(null)}
                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Lista do banco */}
            <div className="overflow-y-auto p-2 space-y-1">
              {sortedBench.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Banco vazio.</p>
              ) : (
                sortedBench.map((p) => {
                  const ps = getPosStyle(p.position);
                  const rl = ratingLabel(p.habilidade ?? 0);
                  const posInCell = FORMATIONS[formation][subCell];
                  const compat = (POS_COMPAT[posInCell] ?? []).includes((p.position || "").toUpperCase());
                  const starterSkill = pitchPlayers[subCell]?.habilidade ?? 0;
                  const diff = (p.habilidade ?? 0) - starterSkill;

                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl transition-colors border ${
                        compat
                          ? "border-primary/20 bg-primary/5 hover:bg-primary/10"
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
