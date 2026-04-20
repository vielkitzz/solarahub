import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Shield, Search } from "lucide-react";
import { formatCurrency } from "@/lib/format";

const ClubsList = () => {
  const [clubs, setClubs] = useState<any[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    document.title = "Clubes — Solara Hub";
    supabase.from("clubs").select("*").order("name").then(({ data }) => setClubs(data || []));
  }, []);

  const filtered = clubs.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || (c.city || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold">Todos os Clubes</h1>
        <p className="text-muted-foreground">Explore cada elenco da liga.</p>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar clube ou cidade..." className="pl-10" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((club) => (
          <Link key={club.id} to={`/clubes/${club.id}`}>
            <Card className="p-5 bg-gradient-card border-border/50 hover:border-primary/50 hover:shadow-gold transition-all h-full group">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-14 w-14 rounded-lg bg-secondary flex items-center justify-center overflow-hidden ring-1 ring-border">
                  {club.crest_url ? <img src={club.crest_url} alt={club.name} className="h-full w-full object-cover" /> : <Shield className="h-7 w-7 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <div className="font-display font-bold text-lg truncate group-hover:text-primary transition-colors">{club.name}</div>
                  <div className="text-xs text-muted-foreground">{club.city || "Cidade não definida"}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-secondary/40 rounded px-2 py-1.5">
                  <div className="text-muted-foreground">Orçamento</div>
                  <div className="font-bold text-primary">{formatCurrency(Number(club.budget))}</div>
                </div>
                <div className="bg-secondary/40 rounded px-2 py-1.5">
                  <div className="text-muted-foreground">Estádio</div>
                  <div className="font-bold">{(club.stadium_capacity || 0).toLocaleString("pt-BR")}</div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
        {filtered.length === 0 && (
          <Card className="p-12 text-center col-span-full bg-gradient-card border-border/50">
            <p className="text-muted-foreground">Nenhum clube encontrado.</p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ClubsList;
