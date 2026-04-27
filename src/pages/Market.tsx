import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Search, Tag, ArrowRightLeft } from "lucide-react";
import { formatCurrency, POSITIONS } from "@/lib/format";

const Market = () => {
  const [players, setPlayers] = useState<any[]>([]);
  const [clubs, setClubs] = useState<Record<string, any>>({});
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<string>("all");
  const [onlyForSale, setOnlyForSale] = useState(false);

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

  const filtered = useMemo(() => {
    return players
      .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
      .filter((p) => pos === "all" || p.position === pos)
      .filter((p) => !onlyForSale || p.a_venda)
      .sort((a, b) => {
        if (a.a_venda !== b.a_venda) return a.a_venda ? -1 : 1;
        return Number(b.market_value) - Number(a.market_value);
      });
  }, [players, q, pos, onlyForSale]);

  const forSaleCount = players.filter((p) => p.a_venda).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" /> Mercado da Bola
        </h1>
        <p className="text-muted-foreground">
          Todos os jogadores da liga. <Badge variant="outline" className="border-primary/40 text-primary ml-1"><Tag className="h-2.5 w-2.5 mr-1" />{forSaleCount} à venda</Badge>
        </p>
      </header>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar jogador..." className="pl-10" />
        </div>
        <div className="flex gap-3">
          <Select value={pos} onValueChange={setPos}>
            <SelectTrigger className="flex-1 md:w-48"><SelectValue placeholder="Posição" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas posições</SelectItem>
              {POSITIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant={onlyForSale ? "default" : "outline"}
            onClick={() => setOnlyForSale((v) => !v)}
            className={onlyForSale ? "bg-gradient-gold text-primary-foreground shrink-0" : "shrink-0"}
          >
            <Tag className="h-4 w-4" /> <span className="hidden sm:inline">{onlyForSale ? "Mostrando à venda" : "Só à venda"}</span>
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((p) => {
          const club = p.club_id ? clubs[p.club_id] : null;
          return (
            <Card key={p.id} className={`p-3 sm:p-4 bg-gradient-card border-border/50 transition-all ${p.a_venda ? "border-primary/40 shadow-gold/20" : ""}`}>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
                <Badge variant="outline" className="font-bold w-12 sm:w-14 justify-center border-primary/40 text-primary shrink-0 text-xs">{p.position}</Badge>
                <div className="flex-1 min-w-0 order-1 sm:order-none basis-full sm:basis-auto">
                  <div className="font-bold truncate flex items-center gap-2">
                    {p.name}
                    {p.a_venda && <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 shrink-0"><Tag className="h-2.5 w-2.5 mr-0.5" />À VENDA</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{p.age ? `${p.age}a` : ""} {p.nationality && `· ${p.nationality}`}</div>
                </div>
                {club ? (
                  <Link to={`/clubes/${club.id}`} className="flex items-center gap-2 text-xs hover:text-primary transition-colors shrink-0">
                    <div className="h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center">
                      {club.crest_url && <img src={club.crest_url} alt={club.name} className="w-full h-full object-contain" />}
                    </div>
                    <span className="hidden md:inline">{club.name}</span>
                  </Link>
                ) : (
                  <Badge variant="secondary" className="text-xs">Sem clube</Badge>
                )}
                <div className="text-right shrink-0 ml-auto sm:ml-0">
                  <div className="text-[10px] text-muted-foreground uppercase">Valor</div>
                  <div className="font-display font-bold text-primary text-sm sm:text-base">{formatCurrency(Number(p.market_value))}</div>
                </div>
                {p.a_venda && (
                  <Button asChild size="sm" className="bg-gradient-gold text-primary-foreground hover:opacity-90 shrink-0">
                    <Link to="/transferencias"><ArrowRightLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Negociar</span></Link>
                  </Button>
                )}
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
