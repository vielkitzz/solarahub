import { useEffect, useState } from "react";
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

interface FreeAgentsTabProps {
  activeClubId: string;
  hasClub: boolean;
  onProfileOpen: (id: string) => void;
  onNegotiate: (player: any) => void;
}

export const FreeAgentsTab = ({ activeClubId, hasClub, onProfileOpen, onNegotiate }: FreeAgentsTabProps) => {
  const [rows, setRows] = useState<any[]>([]);
  const [pos, setPos] = useState<string>("all");
  const [q, setQ] = useState<string>("");

  useEffect(() => {
    (async () => {
      const [{ data: fa }, { data: pls }] = await Promise.all([
        supabase.from("free_agents").select("*"),
        supabase
          .from("players")
          .select("id,name,position,age,nationality,habilidade,salario_atual,valor_base_calculado")
          .is("club_id", null)
          .filter("external_club_id", "is", null),
      ]);
      const merged = [
        ...(fa || []).map((r: any) => ({ ...r, _src: "free_agents" })),
        ...(pls || []).map((p: any) => ({
          id: "p_" + p.id,
          _realId: p.id,
          name: p.name,
          position: p.position,
          age: p.age,
          nationality: p.nationality,
          overall: p.habilidade,
          salary_demand: p.salario_atual,
          valor_base_calculado: p.valor_base_calculado,
          last_club: null,
          _src: "players",
        })),
      ];
      const seen = new Set((fa || []).map((r: any) => r.source_player_id).filter(Boolean));
      setRows(merged.filter((r: any) => !(r._src === "players" && seen.has(r.id.replace("p_", "")))));
    })();
  }, []);

  const filtered = rows
    .filter((r) => pos === "all" || r.position === pos)
    .filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(b.overall || 0) - Number(a.overall || 0));

  const buildFreeAgentPlayer = (r: any) => ({
    id: r._src === "players" ? r._realId : r.id,
    name: r.name,
    position: r.position,
    age: r.age,
    nationality: r.nationality,
    valor_base_calculado: Number(r.valor_base_calculado) || Number(r.salary_demand) || 0,
    market_value: Number(r.valor_base_calculado) || Number(r.salary_demand) || 0,
    club_id: null,
    a_venda: true,
    _isFreeAgent: r._src !== "players",
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar jogador..." className="pl-10" />
        </div>
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
      </div>
      <Card className="bg-gradient-card border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16">Posição</TableHead>
              <TableHead>Jogador</TableHead>
              <TableHead className="hidden sm:table-cell w-20"></TableHead>
              <TableHead className="text-center w-16 hidden sm:table-cell">Idade</TableHead>
              <TableHead>Último clube</TableHead>
              <TableHead className="text-right">OVR</TableHead>
              <TableHead className="text-right">Salário pedido</TableHead>
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
                <TableCell className="font-medium">
                  {r._src === "players" ? (
                    <button
                      onClick={() => onProfileOpen(r._realId)}
                      className="hover:text-primary transition-colors text-left"
                    >
                      {r.name}
                    </button>
                  ) : (
                    r.name
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell py-2">
                  {r.nationality && <FlagImg nationality={r.nationality} />}
                </TableCell>
                <TableCell className="text-center hidden sm:table-cell text-sm">{r.age ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.last_club || "—"}</TableCell>
                <TableCell className="text-right font-bold">{r.overall ?? "—"}</TableCell>
                <TableCell className="text-right font-display font-bold text-primary">
                  {formatCurrency(r.salary_demand || 0)}
                </TableCell>
                {hasClub && (
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => onNegotiate(buildFreeAgentPlayer(r))}
                      className="bg-gradient-gold text-primary-foreground hover:opacity-90"
                    >
                      Contratar
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
