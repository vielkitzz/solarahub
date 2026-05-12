/**
 * LineupManager.tsx — Solara Hub v3
 *
 * Sistema de grid tático:
 *  - 7 linhas  (row 0 = ataque … row 6 = goleiro)
 *  - 4 colunas padrão  (cols 0-3: esq, c-esq, c-dir, dir)
 *  - 5 colunas quando a formação usa a coluna central pura (col 2 de 0-4)
 *  - Linha 6 (goleiro) → sempre 1 célula central
 *  - Grid (linhas/divisórias) visível APENAS ao arrastar ou selecionar jogador
 *  - Drag & drop entre qualquer célula do campo
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
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

// ─── Tipos ─────────────────────────────────────────────────────────────────────

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
  cellKey: string;
  time: string;
}

// ─── Constantes ────────────────────────────────────────────────────────────────

const GK_ROW = 6;
const GK_CELL = `${GK_ROW}-gk`; // chave especial do goleiro

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

// ─── Definição de formações ────────────────────────────────────────────────────
//
// Chave: "row-col"   row 0..5 (campo) | GK_CELL (goleiro)
// Colunas usam escala 0-4 (5 colunas) ou 0-3 (4 colunas).
// Se uma formação usar col 2 junto com cols 0,1,3,4 → modo 5 colunas.
// Se nunca usar col 2 → modo 4 colunas (0,1,3,4 mapeadas para 0,1,2,3).
//
// Regra de leitura das colunas:
//   Modo 4: 0→esq, 1→c-esq, 3→c-dir, 4→dir  (col 2 não existe)
//   Modo 5: 0→esq, 1→s-esq, 2→centro, 3→s-dir, 4→dir

type FormationDef = Record<string, string>; // cellKey → role

const FORMATIONS: Record<string, FormationDef> = {
  "4-3-3": {
    [GK_CELL]: "GOL",
    "5-0": "LE",
    "5-1": "ZAG",
    "5-3": "ZAG",
    "5-4": "LD",
    "3-1": "MC",
    "4-2": "VOL",
    "3-3": "MC", // VOL na col central → 5 colunas
    "1-0": "PE",
    "1-2": "ATA",
    "1-4": "PD",
  },
  "4-4-2": {
    [GK_CELL]: "GOL",
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
    [GK_CELL]: "GOL",
    "5-0": "LE",
    "5-1": "ZAG",
    "5-3": "ZAG",
    "5-4": "LD",
    "4-1": "VOL",
    "4-3": "VOL",
    "2-0": "PE",
    "2-2": "MEI",
    "2-4": "PD", // MEI no centro → 5 colunas
    "0-2": "ATA",
  },
  "3-5-2": {
    [GK_CELL]: "GOL",
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
    [GK_CELL]: "GOL",
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
    [GK_CELL]: "GOL",
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
    [GK_CELL]: "GOL",
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

// ─── Táticas / Mentalidades ────────────────────────────────────────────────────

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
function ratingLabel(skill: number) {
  if (skill >= 90) return { label: "Elite", color: "text-amber-300" };
  if (skill >= 80) return { label: "Estrela", color: "text-yellow-300" };
  if (skill >= 70) return { label: "Regular", color: "text-emerald-300" };
  if (skill >= 60) return { label: "Reserva", color: "text-sky-300" };
  return { label: "Cria", color: "text-slate-400" };
}

// ─── ShirtIcon ─────────────────────────────────────────────────────────────────

function ShirtIcon({
  number,
  size = "md",
  highlighted = false,
}: {
  number?: number | null;
  size?: "sm" | "md";
  highlighted?: boolean;
}) {
  const dim = size === "sm" ? "w-8 h-8" : "w-9 h-9";
  const txt = size === "sm" ? "text-[10px]" : "text-[11px]";
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
          <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={highlighted ? "hsl(44,100%,60%)" : "white"} />
            <stop offset="100%" stopColor={highlighted ? "hsl(38,100%,48%)" : "#e5e7eb"} />
          </linearGradient>
        </defs>
        <use href="#sh" fill="url(#sg)" />
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

// ─── PitchSVG ──────────────────────────────────────────────────────────────────

function PitchSVG() {
  return (
    <svg
      viewBox="0 0 100 130"
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="gg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(152,55%,22%)" />
          <stop offset="50%" stopColor="hsl(148,52%,19%)" />
          <stop offset="100%" stopColor="hsl(152,55%,22%)" />
        </linearGradient>
      </defs>
      <rect x="5" y="5" width="90" height="120" fill="url(#gg)" />
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
      <rect x="5" y="5" width="90" height="120" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
      <line x1="5" y1="65" x2="95" y2="65" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
      <circle cx="50" cy="65" r="12" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
      <circle cx="50" cy="65" r="0.8" fill="rgba(255,255,255,0.6)" />
      <rect x="20" y="5" width="60" height="18" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
      <rect x="32" y="5" width="36" height="7" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
      <path d="M40 23 A10 10 0 0 0 60 23" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
      <circle cx="50" cy="16" r="0.7" fill="rgba(255,255,255,0.6)" />
      <rect x="20" y="107" width="60" height="18" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
      <rect x="32" y="118" width="36" height="7" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
      <path d="M40 107 A10 10 0 0 1 60 107" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
      <circle cx="50" cy="113" r="0.7" fill="rgba(255,255,255,0.6)" />
      <path d="M5 8 A3 3 0 0 0 8 5" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
      <path d="M92 5 A3 3 0 0 0 95 8" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
      <path d="M5 122 A3 3 0 0 1 8 125" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
      <path d="M95 122 A3 3 0 0 1 92 125" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
    </svg>
  );
}

// ─── Helpers de layout do grid ─────────────────────────────────────────────────

/**
 * Detecta se a formação precisa de 5 colunas.
 * Condição: a formação usa explicitamente col 2 *e* tem colunas em 0,1,3,4 também.
 */
function detectTotalCols(formDef: FormationDef): number {
  const cols = new Set<number>();
  Object.keys(formDef).forEach((k) => {
    if (k === GK_CELL) return;
    const c = parseInt(k.split("-")[1]);
    if (!isNaN(c)) cols.add(c);
  });
  // Se tem col 2 junto com pelo menos uma das extremas (0 ou 4) → 5 colunas
  return cols.has(2) && (cols.has(0) || cols.has(4)) ? 5 : 4;
}

/**
 * Mapeia coluna lógica (0-4) para percentual left.
 * Em modo 4 colunas: cols 0,1,3,4 → 0,1,2,3 uniformes (col 2 não existe).
 * Em modo 5 colunas: cols 0-4 distribuídas uniformemente.
 * Margem lateral: 8% de cada lado.
 */
function colToLeft(col: number, totalCols: number): string {
  let idx: number;
  if (totalCols === 4) {
    // 0→0, 1→1, 3→2, 4→3  (col 2 nunca ocorre neste modo)
    idx = col <= 1 ? col : col - 1;
  } else {
    idx = col;
  }
  const step = 84 / (totalCols - 1); // distribui em 84% (margem 8% de cada lado)
  return `${8 + idx * step}%`;
}

/**
 * Converte row (0=ataque, GK_ROW=goleiro) para top%.
 * Ataque ≈ 8%, linha 5 ≈ 72%, goleiro = 88%.
 */
function rowToTop(row: number): string {
  if (row === GK_ROW) return "88%";
  return `${8 + (row / 5) * 64}%`;
}

// ─── TacticalPitch ─────────────────────────────────────────────────────────────

interface TacticalPitchProps {
  formation: string;
  pitchPlayers: Record<string, Player>;
  canEdit: boolean;
  selectedCell: string | null;
  onSelectCell: (k: string | null) => void;
  onMovePlayer: (from: string, to: string) => void;
  onSubRequest: (k: string) => void;
  compatPct: number;
  mentality: string;
}

function TacticalPitch({
  formation,
  pitchPlayers,
  canEdit,
  selectedCell,
  onSelectCell,
  onMovePlayer,
  onSubRequest,
  compatPct,
  mentality,
}: TacticalPitchProps) {
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const formDef = FORMATIONS[formation] ?? {};
  const totalCols = detectTotalCols(formDef);

  // Grid visível apenas quando há drag ativo ou célula selecionada
  const gridVisible = dragSource !== null || selectedCell !== null;

  // Gera todas as células do campo (rows 0-5, todas as colunas do modo atual)
  const fieldCells = useMemo(() => {
    const cells: Array<{ key: string; row: number; col: number }> = [];
    for (let r = 0; r < GK_ROW; r++) {
      const numCols = totalCols;
      for (let c = 0; c < numCols; c++) {
        // Em modo 4 colunas, pulamos a col lógica 2 (nunca usada)
        if (totalCols === 4 && c === 2) continue;
        cells.push({ key: `${r}-${c}`, row: r, col: c });
      }
    }
    return cells;
  }, [totalCols]);

  const handleDragStart = (e: React.DragEvent, key: string) => {
    e.dataTransfer.setData("text/plain", key);
    setDragSource(key);
  };
  const handleDragEnd = () => {
    setDragSource(null);
    setDropTarget(null);
  };
  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    setDropTarget(key);
  };
  const handleDrop = (e: React.DragEvent, toKey: string) => {
    e.preventDefault();
    const fromKey = e.dataTransfer.getData("text/plain");
    setDropTarget(null);
    setDragSource(null);
    if (fromKey && fromKey !== toKey) onMovePlayer(fromKey, toKey);
  };

  const renderSlot = (key: string, row: number, col: number) => {
    const isGK = key === GK_CELL;
    const player = pitchPlayers[key];
    const isSel = selectedCell === key;
    const isDrop = dropTarget === key;
    const isDragging = dragSource === key;
    const isFormPos = !!formDef[key];
    const role = formDef[key] ?? "";

    const top = isGK ? "88%" : rowToTop(row);
    const left = isGK ? "50%" : colToLeft(col, totalCols);

    return (
      <div
        key={key}
        style={{
          position: "absolute",
          top,
          left,
          transform: "translate(-50%,-50%)",
          zIndex: isSel ? 50 : isDrop ? 40 : 20,
          transition: "all 0.25s ease",
        }}
      >
        {/* Drop zone — cobre a célula inteira, sempre presente */}
        <div
          onDragOver={(e) => handleDragOver(e, key)}
          onDragLeave={() => setDropTarget(null)}
          onDrop={(e) => handleDrop(e, key)}
          style={{
            position: "absolute",
            // goleiro tem zona maior
            inset: isGK ? "-20px -40px" : "-16px -12px",
            borderRadius: 10,
            pointerEvents: gridVisible ? "auto" : "none",
            transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
            background: isDrop
              ? "rgba(var(--primary-rgb, 99,102,241)/0.2)"
              : gridVisible && isFormPos
                ? "rgba(255,255,255,0.03)"
                : "transparent",
            border: isDrop
              ? "1.5px solid hsl(var(--primary))"
              : gridVisible && isFormPos
                ? "1px dashed rgba(255,255,255,0.2)"
                : "1px dashed transparent",
            boxShadow: isDrop ? "inset 0 0 14px hsl(var(--primary)/0.3)" : "none",
          }}
        />

        {/* Conteúdo */}
        {player ? (
          <div
            draggable={canEdit}
            onDragStart={(e) => handleDragStart(e, key)}
            onDragEnd={handleDragEnd}
            onClick={() => onSelectCell(isSel ? null : key)}
            className={`
              relative flex flex-col items-center select-none
              ${canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-default"}
              transition-all duration-200
              ${isDragging ? "opacity-35 scale-90" : ""}
              ${isSel ? "scale-110" : "hover:scale-105"}
            `}
          >
            <ShirtIcon number={player.shirt_number} highlighted={isSel} />

            <div
              className={`
              mt-[-5px] px-1.5 py-0.5 rounded border backdrop-blur-md
              transition-all duration-200 whitespace-nowrap
              ${
                isSel
                  ? "bg-primary border-primary shadow-[0_0_12px_hsl(var(--primary)/0.5)]"
                  : "bg-black/65 border-white/20"
              }
            `}
            >
              <div className="flex items-center gap-1">
                <span className={`text-[7px] font-bold ${getPosStyle(player.position).text}`}>{player.position}</span>
                <span className="text-[9px] font-black text-white">{player.habilidade}</span>
              </div>
              <div className="text-[8px] text-white font-semibold truncate max-w-[58px] leading-tight">
                {player.name.split(" ").pop()}
              </div>
            </div>

            {/* Popover de ações */}
            {isSel && canEdit && (
              <div
                className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-44 bg-card border border-border/70 rounded-xl shadow-2xl p-3 z-[60]"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="font-bold text-xs truncate mb-1 text-foreground">{player.name}</p>
                <p className="text-[9px] text-muted-foreground mb-2 leading-tight">Arraste para reposicionar, ou:</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-[10px] border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground"
                  onClick={() => {
                    onSubRequest(key);
                    onSelectCell(null);
                  }}
                >
                  <ArrowRightLeft className="h-3 w-3 mr-1" /> Substituir
                </Button>
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-card border-r border-b border-border/70 rotate-45" />
              </div>
            )}
          </div>
        ) : /* Slot vazio — aparece só quando grid está ativo e é posição da formação */
        gridVisible && isFormPos ? (
          <div
            className={`
              flex items-center justify-center rounded-full border-2 border-dashed
              transition-all duration-150
              ${isGK ? "w-12 h-12" : "w-8 h-8"}
              ${
                isDrop
                  ? "border-primary bg-primary/20 scale-125 shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
                  : "border-white/25 bg-black/10"
              }
            `}
          >
            <span className="text-[8px] text-white/50 font-bold leading-none text-center">{role || "·"}</span>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="relative w-full aspect-[3/4] md:aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl border border-white/10 touch-none bg-[#113d2b]">
      <PitchSVG />

      {/* Overlay do grid tático — só visível durante interação */}
      <div
        className="absolute inset-0 z-[5] pointer-events-none"
        style={{ opacity: gridVisible ? 1 : 0, transition: "opacity 0.25s" }}
      >
        {/* Linhas horizontais (uma por row, exceto goleiro) */}
        {Array.from({ length: GK_ROW }).map((_, r) => (
          <div
            key={r}
            style={{
              position: "absolute",
              top: rowToTop(r),
              left: "5%",
              right: "5%",
              height: "1px",
              background: "rgba(255,255,255,0.08)",
              transform: "translateY(-50%)",
            }}
          />
        ))}

        {/* Linhas verticais por coluna ativa */}
        {(totalCols === 5 ? [0, 1, 2, 3, 4] : [0, 1, 3, 4]) // modo 4 cols: pula col lógica 2
          .map((c) => (
            <div
              key={c}
              style={{
                position: "absolute",
                left: colToLeft(c, totalCols),
                top: "3%",
                bottom: "10%",
                width: "1px",
                background: "rgba(255,255,255,0.08)",
                transform: "translateX(-50%)",
              }}
            />
          ))}

        {/* Divisória visual da linha do goleiro */}
        <div
          style={{
            position: "absolute",
            top: rowToTop(GK_ROW - 1),
            left: "5%",
            right: "5%",
            height: "1px",
            background: "rgba(255,255,255,0.15)",
            transform: "translateY(-50%)",
          }}
        />
      </div>

      {/* Jogadores */}
      <div className="absolute inset-0 z-10">
        {fieldCells.map(({ key, row, col }) => renderSlot(key, row, col))}
        {renderSlot(GK_CELL, GK_ROW, 2)}
      </div>

      {/* Rodapé */}
      <div className="absolute bottom-3 inset-x-3 flex justify-between items-end z-30 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/10">
          <div className="text-[10px] font-black text-primary tracking-tighter uppercase">{formation}</div>
          <div className="text-[8px] text-white/60">{mentality}</div>
        </div>
        <div className="bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/10 text-right">
          <div className="text-[8px] text-white/50 uppercase">Entros.</div>
          <div className="text-[10px] font-black text-emerald-400">{compatPct}%</div>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────

export function LineupManager({ players, club, canEdit = false }: LineupManagerProps) {
  const [formation, setFormation] = useState("4-3-3");
  const [pitchPlayers, setPitchPlayers] = useState<Record<string, Player>>({});
  const [bench, setBench] = useState<Player[]>([]);
  const [tactics, setTactics] = useState<string[]>(["Posse de bola", "Saída pelo goleiro"]);
  const [mentality, setMentality] = useState<Mentality>("Equilibrado");
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [subCell, setSubCell] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"pitch" | "bench" | "stats">("pitch");
  const [isSaving, setIsSaving] = useState(false);
  const [subHistory, setSubHistory] = useState<SubRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // ── Auto-pick ──────────────────────────────────────────────────────────────

  const autoPickFormation = useCallback((formId: string, pool: Player[]) => {
    const def = FORMATIONS[formId];
    if (!def) return;
    let remaining = [...pool].sort((a, b) => (b.habilidade ?? 0) - (a.habilidade ?? 0));
    const newPitch: Record<string, Player> = {};

    // 1ª: posição exata
    Object.entries(def).forEach(([k, role]) => {
      const idx = remaining.findIndex((p) => (p.position || "").toUpperCase() === role);
      if (idx !== -1) {
        newPitch[k] = remaining[idx];
        remaining.splice(idx, 1);
      }
    });
    // 2ª: setor compatível
    Object.entries(def).forEach(([k, role]) => {
      if (newPitch[k]) return;
      const sector = POS_SECTOR[role];
      const idx = remaining.findIndex((p) => POS_SECTOR[(p.position || "").toUpperCase()] === sector);
      if (idx !== -1) {
        newPitch[k] = remaining[idx];
        remaining.splice(idx, 1);
      }
    });
    // 3ª: overflow
    Object.keys(def).forEach((k) => {
      if (!newPitch[k] && remaining.length > 0) newPitch[k] = remaining.shift()!;
    });

    setPitchPlayers(newPitch);
    setBench(remaining);
  }, []);

  useEffect(() => {
    autoPickFormation("4-3-3", players);
  }, [players, autoPickFormation]);

  // ── Mover jogador no campo ─────────────────────────────────────────────────

  const handleMovePlayer = useCallback((from: string, to: string) => {
    setPitchPlayers((prev) => {
      const next = { ...prev };
      const src = next[from];
      const tgt = next[to];
      if (tgt) next[from] = tgt;
      else delete next[from];
      next[to] = src;
      return next;
    });
    setSelectedCell(null);
  }, []);

  // ── Substituição ───────────────────────────────────────────────────────────

  const handleSub = (benchPlayerId: string) => {
    if (!subCell) return;
    const benchIdx = bench.findIndex((p) => p.id === benchPlayerId);
    const starterOut = pitchPlayers[subCell];
    const benchIn = bench[benchIdx];
    const newBench = [...bench];
    if (starterOut) newBench[benchIdx] = starterOut;
    else newBench.splice(benchIdx, 1);
    setPitchPlayers({ ...pitchPlayers, [subCell]: benchIn });
    setBench(newBench.sort((a, b) => (b.habilidade ?? 0) - (a.habilidade ?? 0)));
    if (starterOut)
      setSubHistory((prev) => [
        {
          out: starterOut,
          inn: benchIn,
          cellKey: subCell,
          time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        },
        ...prev,
      ]);
    setSubCell(null);
    setSelectedCell(null);
    toast.success(`${benchIn.name} entrou${starterOut ? `, ${starterOut.name} saiu` : ""}`);
  };

  // ── Compatibilidade ────────────────────────────────────────────────────────

  const compatPct = useMemo(() => {
    const def = FORMATIONS[formation] ?? {};
    let correct = 0,
      total = 0;
    Object.entries(def).forEach(([k, role]) => {
      const p = pitchPlayers[k];
      if (!p) return;
      total++;
      if ((p.position || "").toUpperCase() === role) correct++;
    });
    return total > 0 ? Math.round((correct / total) * 100) : 0;
  }, [pitchPlayers, formation]);

  // ── Stats ──────────────────────────────────────────────────────────────────

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

  const sortedBench = useMemo(() => {
    if (!subCell) return bench;
    const role = (FORMATIONS[formation] ?? {})[subCell] ?? "";
    const compat = POS_COMPAT[role] ?? [];
    return [...bench].sort((a, b) => {
      const aOk = compat.includes((a.position || "").toUpperCase()) ? 1 : 0;
      const bOk = compat.includes((b.position || "").toUpperCase()) ? 1 : 0;
      if (bOk !== aOk) return bOk - aOk;
      return (b.habilidade ?? 0) - (a.habilidade ?? 0);
    });
  }, [bench, subCell, formation]);

  const handleFormationChange = (val: string) => {
    setFormation(val);
    const all = [...Object.values(pitchPlayers).filter(Boolean), ...bench];
    autoPickFormation(val, all);
    setSelectedCell(null);
    setSubHistory([]);
  };
  const toggleTactic = (t: string) =>
    setTactics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  const handleSave = async () => {
    if (!canEdit) return;
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 900));
    setIsSaving(false);
    toast.success("Escalação salva!", { description: `${formation} · ${mentality} · ${tactics.length} instruções` });
  };

  // ── Painéis laterais ───────────────────────────────────────────────────────

  const renderAnalysis = () => (
    <Card className="p-4 bg-gradient-card border-border/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-primary" />
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Análise</h3>
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
              <span className="text-muted-foreground">{label}</span>
              <span className="font-black tabular-nums">{value || "—"}</span>
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
            sub: stats.foreigners > 5 ? "Limite" : "Regular",
            ok: stats.foreigners <= 5,
          },
          {
            label: "Formação",
            value: `${compatPct}%`,
            sub: compatPct >= 80 ? "Ideal" : compatPct >= 60 ? "OK" : "Baixa",
            ok: compatPct >= 80,
          },
        ].map(({ label, value, sub, ok }) => (
          <div key={label} className="bg-secondary/40 rounded-lg p-2 border border-border/40 text-center">
            <div className="text-[9px] text-muted-foreground mb-0.5">{label}</div>
            <div className="font-black text-sm leading-none">{value}</div>
            <div className={`text-[9px] mt-0.5 font-medium ${ok ? "text-emerald-400" : "text-amber-400"}`}>{sub}</div>
          </div>
        ))}
      </div>
    </Card>
  );

  const renderTactics = () => (
    <Card className="p-4 bg-gradient-card border-border/50">
      <div className="flex items-center gap-2 mb-3">
        <Settings className="h-4 w-4 text-primary" />
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mentalidade & Táticas</h3>
      </div>
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
                  ? "bg-primary/20 border-primary/60 text-primary"
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
                <span className="text-emerald-400 font-bold">{s.inn.name}</span>
                <span className="text-muted-foreground"> ↔ </span>
                <span className="text-rose-400 font-bold">{s.out.name}</span>
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
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-primary/5 border border-transparent hover:border-border/40 transition-colors"
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

  // ── Layout ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Cabeçalho */}
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
                  toast.success("Escalação otimizada!");
                }}
              >
                <Zap className="h-3 w-3 mr-1" />
                Auto
              </Button>
            )}
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

      {/* Tabs mobile */}
      <div className="flex md:hidden bg-secondary/40 rounded-xl overflow-hidden border border-border/50 p-0.5 gap-0.5">
        {(["pitch", "bench", "stats"] as const).map((tab) => {
          const labels = { pitch: "Campo", bench: `Banco (${bench.length})`, stats: "Análise" };
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

      {/* Layout principal */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className={`w-full lg:w-[56%] ${mobileTab !== "pitch" ? "hidden md:block" : ""}`}>
          <TacticalPitch
            formation={formation}
            pitchPlayers={pitchPlayers}
            canEdit={canEdit}
            selectedCell={selectedCell}
            onSelectCell={setSelectedCell}
            onMovePlayer={handleMovePlayer}
            onSubRequest={setSubCell}
            compatPct={compatPct}
            mentality={mentality}
          />
        </div>
        <div className={`flex-1 flex flex-col gap-3 min-w-0 ${mobileTab === "pitch" ? "hidden md:flex" : "flex"}`}>
          <div className={mobileTab === "bench" ? "hidden md:block" : ""}>{renderAnalysis()}</div>
          <div className={mobileTab === "bench" ? "hidden md:block" : ""}>{renderTactics()}</div>
          <div className={`flex-1 flex flex-col min-h-0 ${mobileTab === "stats" ? "hidden md:flex" : "flex"}`}>
            {renderBench()}
          </div>
        </div>
      </div>

      {/* Modal de substituição */}
      {subCell && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/60 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-start justify-between p-4 border-b border-border/50 shrink-0">
              <div>
                <h3 className="font-bold text-sm">
                  Substituir <span className="text-primary">{pitchPlayers[subCell]?.name ?? "posição vazia"}</span>
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Role:{" "}
                  <strong className={getPosStyle((FORMATIONS[formation] ?? {})[subCell] ?? "").text}>
                    {(FORMATIONS[formation] ?? {})[subCell] ?? "—"}
                  </strong>{" "}
                  · Selecione do banco
                </p>
              </div>
              <button
                onClick={() => setSubCell(null)}
                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground shrink-0"
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
                  const rl = ratingLabel(p.habilidade ?? 0);
                  const role = (FORMATIONS[formation] ?? {})[subCell] ?? "";
                  const compat = (POS_COMPAT[role] ?? []).includes((p.position || "").toUpperCase());
                  const diff = (p.habilidade ?? 0) - (pitchPlayers[subCell]?.habilidade ?? 0);
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
                        className="text-xs h-7 shrink-0 border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground"
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
