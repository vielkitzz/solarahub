import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
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

export const ForeignMarketTab = ({ activeClubId, hasClub, onNegotiate }: ForeignMarketTabProps) => {
  const [rows, setRows] = useState<any[]>([]);
  const [pos, setPos] = useState<string>("all");
  const [temp, setTemp] = useState<string>("all");
  const [q, setQ] = useState<string>("");

  useEffect(() => {
    supabase
      .from("foreign_market_players")
      .select("*")
      .order("overall", { ascending: false })
      .then(({ data }) => setRows(data || []));
  }, []);

  const temporadas = useMemo(
    () => Array.from(new Set(rows.map((r) => r.temporada).filter(Boolean))).sort((a, b) => b - a),
    [rows],
  );

  const filtered = rows.filter(
    (r) =>
      (pos === "all" || r.position === pos) &&
      (temp === "all" || String(r.temporada) === temp) &&
      (!q || r.name.toLowerCase().includes(q.toLowerCase())),
  );

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
              <TableHead>Clube / Liga</TableHead>
              <TableHead className="text-center w-16 hidden sm:table-cell">Idade</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Salário</TableHead>
              {hasClub && <TableHead className="w-24"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
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
                  {r.club_origin}
                  {r.league_origin ? ` / ${r.league_origin}` : ""}
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
                <TableCell colSpan={hasClub ? 8 : 7} className="text-center text-muted-foreground py-10">
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
