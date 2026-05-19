import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tag,
  AlertTriangle,
  FileSignature,
  Search,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Gavel,
  Star,
  Lock,
} from "lucide-react";
import { formatCurrency, POSITIONS, calcStars } from "@/lib/format";
import { getFlagUrl } from "@/lib/countries";
import { estimarPotencialOwn, type ScoutReport } from "@/lib/scout";
import { SkillDisplay } from "@/components/SkillDisplay";

// Cor individual por posição
export const POSITION_COLORS: Record<string, { color: string; bg: string }> = {
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

export function getPositionStyle(position: string) {
  return (
    POSITION_COLORS[(position || "").toUpperCase()] ?? {
      color: "text-muted-foreground",
      bg: "bg-secondary/30 border-border/30",
    }
  );
}

export function ContractBadge({
  contrato_ate,
  temporadaAtual,
}: {
  contrato_ate: number | null;
  temporadaAtual: number;
}) {
  if (!contrato_ate) return <span className="text-xs text-muted-foreground">—</span>;
  const anos = contrato_ate - temporadaAtual;
  const expirando = anos <= 1;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${
        expirando ? "border-destructive/50 text-destructive bg-destructive/5" : "border-border/40 text-muted-foreground"
      }`}
    >
      {expirando && <AlertTriangle className="h-2.5 w-2.5" />}
      {contrato_ate}
    </span>
  );
}

export function FlagImg({ nationality }: { nationality: string }) {
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

export function SquadTable({
  players,
  club,
  canEdit,
  isAdmin,
  temporadaAtual,
  toggleSale,
  toggleBlockProposals,
  setRenewPlayer,
  setShirtPlayer,
  setMultaPlayer,
  myClub,
  scoutReports,
  onOpenProfile,
}: {
  players: any[];
  club: any;
  canEdit: boolean;
  isAdmin: boolean;
  temporadaAtual: number;
  toggleSale: (id: string, v: boolean) => void;
  toggleBlockProposals?: (id: string, v: boolean) => void;
  setRenewPlayer: (p: any) => void;
  setShirtPlayer: (p: any) => void;
  setMultaPlayer: (p: any) => void;
  myClub: any | null;
  scoutReports: Record<string, ScoutReport>;
  onOpenProfile?: (id: string) => void;
}) {
  const isOwnClub = !!myClub && myClub.id === club.id;
  const anyPotKnown = isOwnClub || players.some((p) => scoutReports[p.id]);
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState("todas");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [confirmDialog, setConfirmDialog] = useState<{
    kind: "sale" | "block";
    player: any;
    nextValue: boolean;
  } | null>(null);

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>({
    key: "posicao",
    direction: "asc",
  });

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
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
        if (statusFilter === "venda" && !p.a_venda) return false;
        if (statusFilter === "expirando") {
          const expirando =
            p.contrato_ate !== null && p.contrato_ate !== undefined && p.contrato_ate - temporadaAtual <= 1;
          if (!expirando) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        const modifier = direction === "asc" ? 1 : -1;

        switch (key) {
          case "numero": {
            const an = Number(a.shirt_number ?? a.attributes?.shirtNumber ?? 999);
            const bn = Number(b.shirt_number ?? b.attributes?.shirtNumber ?? 999);
            return (an - bn) * modifier;
          }
          case "nome":
            return a.name.localeCompare(b.name) * modifier;
          case "posicao":
            const ai = POSITIONS.indexOf(a.position);
            const bi = POSITIONS.indexOf(b.position);
            const av = ai === -1 ? 999 : ai;
            const bv = bi === -1 ? 999 : bi;
            if (av !== bv) return (av - bv) * modifier;
            return (Number(b.market_value || 0) - Number(a.market_value || 0)) * modifier;
          case "nacionalidade":
            return (a.nationality || "").localeCompare(b.nationality || "") * modifier;
          case "idade":
            return (Number(a.age || 0) - Number(b.age || 0)) * modifier;
          case "qualidade":
            return (Number(a.habilidade || 0) - Number(b.habilidade || 0)) * modifier;
          case "potencial":
            return (Number(a.potential_max || 0) - Number(b.potential_max || 0)) * modifier;
          case "valor":
            return (Number(a.market_value || 0) - Number(b.market_value || 0)) * modifier;
          case "salario":
            return (Number(a.salario_atual || 0) - Number(b.salario_atual || 0)) * modifier;
          case "contrato":
            return (Number(a.contrato_ate || 0) - Number(b.contrato_ate || 0)) * modifier;
          default:
            return 0;
        }
      });
  }, [players, searchTerm, positionFilter, statusFilter, sortConfig, temporadaAtual]);

  return (
    <div className="space-y-0 rounded-lg overflow-hidden border border-border/50 bg-gradient-card">
      <div className="flex items-center gap-4 px-4 py-2.5 bg-secondary/40 border-b border-border/50 text-xs text-muted-foreground flex-wrap">
        <span className="font-semibold text-foreground">{filteredAndSorted.length} jogadores listados</span>
        <div className="ml-auto flex items-center gap-3 flex-wrap">
          <span>
            Folha:{" "}
            <span className="text-foreground">
              {formatCurrency(filteredAndSorted.reduce((s, p) => s + Number(p.salario_atual || 0), 0))}
            </span>
          </span>
          <span>
            Valor total:{" "}
            <span className="text-foreground">
              {formatCurrency(filteredAndSorted.reduce((s, p) => s + Number(p.market_value || 0), 0))}
            </span>
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
            <SelectItem value="venda">Apenas à venda</SelectItem>
            <SelectItem value="expirando">Contratos expirando</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50 bg-secondary/20">
              <TableHead
                className="w-12 cursor-pointer select-none hover:bg-secondary/40 transition-colors"
                onClick={() => handleSort("numero")}
              >
                <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  # <SortIcon columnKey="numero" />
                </div>
              </TableHead>

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
                className={`w-28 select-none transition-colors ${anyPotKnown ? "cursor-pointer hover:bg-secondary/40" : "cursor-default opacity-70"}`}
                onClick={() => anyPotKnown && handleSort("potencial")}
              >
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  Potencial {anyPotKnown && <SortIcon columnKey="potencial" />}
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none hover:bg-secondary/40 transition-colors"
                onClick={() => handleSort("valor")}
              >
                <div className="flex items-center justify-end gap-1 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  Valor <SortIcon columnKey="valor" />
                </div>
              </TableHead>

              <TableHead
                className="hidden md:table-cell cursor-pointer select-none hover:bg-secondary/40 transition-colors"
                onClick={() => handleSort("salario")}
              >
                <div className="flex items-center justify-end gap-1 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  Salário/ano <SortIcon columnKey="salario" />
                </div>
              </TableHead>

              <TableHead
                className="w-20 cursor-pointer select-none hover:bg-secondary/40 transition-colors"
                onClick={() => handleSort("contrato")}
              >
                <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  Contrato <SortIcon columnKey="contrato" />
                </div>
              </TableHead>

              {canEdit && (
                <TableHead className="text-center w-16 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  Venda
                </TableHead>
              )}
              {canEdit && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 12 : 10} className="text-center py-8 text-muted-foreground">
                  Nenhum jogador encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSorted.map((p: any) => {
                const shirt = p.shirt_number ?? p.attributes?.shirtNumber;
                const stars = calcStars(p.habilidade, club.rate);
                let potDisplay: { value: number; min: number; label: string; tooltip: string } | null = null;
                if (isOwnClub && myClub) {
                  const est = estimarPotencialOwn(p, myClub.id, myClub.nivel_base);
                  if (est) {
                    potDisplay = {
                      value: est.pmax,
                      min: est.pmin,
                      label: `${est.pmin}-${est.pmax}`,
                      tooltip: `Estimativa do seu olheiro (±${est.margem})`,
                    };
                  }
                }
                const expirando =
                  p.contrato_ate !== null && p.contrato_ate !== undefined && p.contrato_ate - temporadaAtual <= 1;
                const ps = getPositionStyle(p.position);

                return (
                  <TableRow
                    key={p.id}
                    className={`border-border/30 hover:bg-primary/5 transition-colors text-sm ${p.a_venda ? "bg-primary/5" : ""}`}
                  >
                    <TableCell className="text-[11px] text-center text-muted-foreground/60 py-2">
                      {canEdit ? (
                        <button
                          onClick={() => setShirtPlayer(p)}
                          className="hover:text-primary transition-colors font-semibold"
                          title="Alterar número da camisa"
                        >
                          {shirt ?? "—"}
                        </button>
                      ) : (
                        (shirt ?? "—")
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      <span
                        className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${ps.bg} ${ps.color}`}
                      >
                        {p.position || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 font-medium">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onOpenProfile?.(p.id)}
                          className="truncate max-w-[160px] text-left hover:text-primary transition-colors"
                        >
                          {p.name}
                        </button>
                        {p.a_venda && (
                          <span title="À venda">
                            <Tag className="h-3 w-3 text-primary/70 shrink-0" />
                          </span>
                        )}
                        {expirando && (
                          <span title="Contrato expirando">
                            <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
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
                      <SkillDisplay value={p.habilidade} rate={club.rate} kind="skill" />
                    </TableCell>
                    <TableCell className="py-2">
                      {potDisplay ? (
                        <div className="flex items-center gap-1.5" title={potDisplay.tooltip}>
                          <SkillDisplay
                            value={potDisplay.value}
                            valueMin={potDisplay.min}
                            rate={club.rate}
                            kind="potential"
                            numericLabel={potDisplay.label}
                          />
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-0.5 text-muted-foreground/30"
                          title="Use a aba Olheiros para descobrir"
                        >
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} style={{ width: 14, height: 14 }} />
                          ))}
                          <span className="text-[10px] ml-1.5"></span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-right text-xs font-semibold text-primary tabular-nums">
                      {formatCurrency(Number(p.market_value))}
                    </TableCell>
                    <TableCell className="py-2 text-right text-xs text-muted-foreground tabular-nums hidden md:table-cell">
                      {formatCurrency(Number(p.salario_atual || 0))}
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      <ContractBadge contrato_ate={p.contrato_ate ?? null} temporadaAtual={temporadaAtual} />
                    </TableCell>
                    {canEdit && (
                      <TableCell className="py-2 text-center">
                        <Switch
                          checked={!!p.a_venda}
                          onCheckedChange={(v) => {
                            if (v === !!p.a_venda) return;
                            toggleSale(p.id, v);
                          }}
                        />
                      </TableCell>
                    )}
                    {canEdit && (
                      <TableCell className="py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Renovar contrato"
                            onClick={() => setRenewPlayer(p)}
                            className="h-7 w-7"
                          >
                            <FileSignature className="h-3.5 w-3.5 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Pagar multa rescisória (liberar)"
                            onClick={() => setMultaPlayer(p)}
                            className="h-7 w-7"
                          >
                            <Gavel className="h-3.5 w-3.5 text-amber-400" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                    {!canEdit && isAdmin && (
                      <TableCell className="py-2 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Pagar multa (admin)"
                          onClick={() => setMultaPlayer(p)}
                          className="h-7 w-7"
                        >
                          <Gavel className="h-3.5 w-3.5 text-amber-400" />
                        </Button>
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
