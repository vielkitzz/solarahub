import { useEffect, useMemo, useState } from "react";
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, POSITIONS } from "@/lib/format";
import { FlagImg } from "./Filters";

interface ForeignMarketTabProps {
  activeClubId: string;
  hasClub: boolean;
  onNegotiate: (player: any) => void;
}

type SortKey = "overall" | "age" | "market_value" | "salary_demand";
type SortDir = "asc" | "desc";

const SortIcon = ({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) => {
  if (col !== sortKey) return <ArrowUpDown className="inline ml-1 h-3 w-3 opacity-40" />;
  return sortDir === "asc" ? (
    <ArrowUp className="inline ml-1 h-3 w-3 text-primary" />
  ) : (
    <ArrowDown className="inline ml-1 h-3 w-3 text-primary" />
  );
};

export const ForeignMarketTab = ({ activeClubId, hasClub, onNegotiate }: ForeignMarketTabProps) => {
  const [rows, setRows] = useState<any[]>([]);
  const [externalClubs, setExternalClubs] = useState<Record<string, { name: string; crest: string | null }>>({});
  const [pos, setPos] = useState<string>("all");
  const [temp, setTemp] = useState<string>("all");
  const [q, setQ] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    supabase
      .from("foreign_market_players")
      .select("*")
      .then(({ data }) => setRows(data || []));
    supabase
      .from("external_clubs")
      .select("id, name, crest")
      .then(({ data }) => {
        const map: Record<string, { name: string; crest: string | null }> = {};
        (data || []).forEach((c: any) => {
          map[String(c.name).trim().toLowerCase()] = { name: c.name, crest: c.crest };
        });
        setExternalClubs(map);
      });
  }, []);

  const temporadas = useMemo(
    () => Array.from(new Set(rows.map((r) => r.temporada).filter(Boolean))).sort((a, b) => b - a),
    [rows],
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const filtered = useMemo(() => {
    const base = rows.filter(
      (r) =>
        (pos === "all" || r.position === pos) &&
        (temp === "all" || String(r.temporada) === temp) &&
        (!q || r.name.toLowerCase().includes(q.toLowerCase())),
    );

    return [...base].sort((a, b) => {
      const va = Number(a[sortKey]) || 0;
      const vb = Number(b[sortKey]) || 0;
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [rows, pos, temp, q, sortKey, sortDir]);

  const buildForeignPlayer = (r: any) => ({
    id: r.id,
    name: r.name,
    position: r.position,
    age: r.age,
    nationality: r.nationality,
    valor_base_calculado: Number(r.market_value) || 0,
    market_value: Number(r.market_value) || 0,
    salary_demand: Number(r.salary_demand) || 0,
    overall: Number(r.overall) || 70,
    club_id: null,
    club_origin: r.club_origin,
    a_venda: true,
    _isForeign: true,
  });

  const SortableHead = ({ col, label, className = "" }: { col: SortKey; label: string; className?: string }) => (
    <TableHead className={`cursor-pointer select-none whitespace-nowrap ${className}`} onClick={() => toggleSort(col)}>
      {label}
      <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
    </TableHead>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar jogador..." className="pl-10" />
        </div>
        <div className="flex gap-2">
          <Select value={pos} onValueChange={setPos}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Posição" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas posições</SelectItem>
              {POSITIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={temp} onValueChange={setTemp}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Temporada" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas temporadas</SelectItem>
              {temporadas.map((t) => (
                <SelectItem key={t} value={String(t)}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="bg-gradient-card border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16">Posição</TableHead>
              <TableHead>Jogador</TableHead>
              <TableHead className="hidden sm:table-cell w-20"></TableHead>
              <TableHead>Clube de Origem</TableHead>
              <SortableHead col="overall" label="HAB" className="text-center w-16" />
              <SortableHead col="age" label="Idade" className="text-center hidden sm:table-cell w-16" />
              <SortableHead col="market_value" label="Valor" className="text-right" />
              <SortableHead col="salary_demand" label="Salário" className="text-right" />
              {hasClub && <TableHead className="w-24"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => {
              const ext = r.club_origin
                ? externalClubs[String(r.club_origin).trim().toLowerCase()]
                : undefined;
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      {r.position}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="hidden sm:table-cell py-2">
                    {r.nationality && <FlagImg nationality={r.nationality} />}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      {ext?.crest ? (
                        <img src={ext.crest} alt={ext.name} className="h-5 w-5 object-contain" />
                      ) : null}
                      <span>{ext?.name || r.club_origin || "—"}</span>
                    </div>
                  </TableCell>
                <TableCell className="text-center">
                  <Badge className="bg-primary/10 text-primary border-primary/30 font-bold">{r.overall ?? "—"}</Badge>
                </TableCell>
                <TableCell className="text-center hidden sm:table-cell text-sm">{r.age ?? "—"}</TableCell>
                <TableCell className="text-right font-display font-bold text-primary">
                  {formatCurrency(r.market_value)}
                </TableCell>
                <TableCell className="text-right text-sm">{formatCurrency(r.salary_demand)}</TableCell>
                {hasClub && (
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => onNegotiate(buildForeignPlayer(r))}
                      className="bg-gradient-gold text-primary-foreground hover:opacity-90"
                    >
                      Negociar
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={hasClub ? 9 : 8} className="text-center text-muted-foreground py-10">
                  Nenhum jogador encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};
