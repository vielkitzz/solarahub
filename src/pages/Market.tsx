import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Search } from "lucide-react";
import { formatCurrency, POSITIONS } from "@/lib/format";

const Market = () => {
  const [players, setPlayers] = useState<any[]>([]);
  const [clubs, setClubs] = useState<Record<string, any>>({});
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<string>("all");

  useEffect(() => {
    document.title = "Mercado da Bola — Solara Hub";
    const load = async () => {
      const [{ data: pls }, { data: cls }] = await Promise.all([
        supabase.from("players").select("*").order("market_value", { ascending: false }),
        supabase.from("clubs").select("id, name, crest_url"),
      ]);
      setPlayers(pls || []);
      const map: Record<string, any> = {};
      (cls || []).forEach((c) => { map[c.id] = c; });
      setClubs(map);
    };
    load();
  }, []);

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(q.toLowerCase()) &&
    (pos === "all" || p.position === pos)
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" /> Mercado da Bola
        </h1>
        <p className="text-muted-foreground">Todos os jogadores da liga ordenados por valor de mercado.</p>
      </header>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar jogador..." className="pl-10" />
        </div>
        <Select value={pos} onValueChange={setPos}>
          <SelectTrigger className="md:w-48"><SelectValue placeholder="Posição" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas posições</SelectItem>
            {POSITIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.map((p) => {
          const club = p.club_id ? clubs[p.club_id] : null;
          return (
            <Card key={p.id} className="p-4 bg-gradient-card border-border/50 flex items-center gap-3">
              <Badge variant="outline" className="font-bold w-14 justify-center border-primary/40 text-primary shrink-0">{p.position}</Badge>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.age ? `${p.age}a` : ""} {p.nationality && `· ${p.nationality}`}</div>
              </div>
              {club ? (
                <Link to={`/clubes/${club.id}`} className="flex items-center gap-2 text-xs hover:text-primary transition-colors">
                  <div className="h-8 w-8 rounded bg-secondary overflow-hidden">
                    {club.crest_url && <img src={club.crest_url} alt={club.name} className="w-full h-full object-cover" />}
                  </div>
                  <span className="hidden md:inline">{club.name}</span>
                </Link>
              ) : (
                <Badge variant="secondary" className="text-xs">Sem clube</Badge>
              )}
              <div className="text-right shrink-0">
                <div className="text-[10px] text-muted-foreground uppercase">Valor</div>
                <div className="font-display font-bold text-primary">{formatCurrency(Number(p.market_value))}</div>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && <Card className="p-12 text-center bg-gradient-card border-border/50 text-muted-foreground">Nenhum jogador encontrado.</Card>}
      </div>
    </div>
  );
};

export default Market;
