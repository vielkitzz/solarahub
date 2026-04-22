import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Club {
  id: string;
  name: string;
  city: string | null;
  crest_url: string | null;
  primary_color: string | null;
  budget: number;
}

const Mapa = () => {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Mapa de Clubes — Solara Hub";
    (async () => {
      const { data } = await supabase.from("clubs").select("id,name,city,crest_url,primary_color,budget").order("name");
      setClubs(data || []);
      setLoading(false);
    })();
  }, []);

  // Agrupa por cidade
  const byCity = useMemo(() => {
    const map = new Map<string, Club[]>();
    clubs.forEach((c) => {
      const key = c.city?.trim() || "Sem cidade";
      const list = map.get(key) || [];
      list.push(c);
      map.set(key, list);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [clubs]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
          <MapPin className="h-8 w-8 text-primary" /> Mapa de Clubes
        </h1>
        <p className="text-muted-foreground">Clubes agrupados pela cidade-sede.</p>
      </header>

      {loading ? (
        <div className="grid gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : byCity.length === 0 ? (
        <Card className="p-12 text-center bg-gradient-card border-border/50 text-muted-foreground">
          Nenhum clube cadastrado.
        </Card>
      ) : (
        <div className="space-y-5">
          {byCity.map(([city, list]) => (
            <section key={city} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-display font-bold text-lg">{city}</h2>
                <Badge variant="outline" className="border-border/50">{list.length} {list.length === 1 ? "clube" : "clubes"}</Badge>
                <div className="flex-1 h-px bg-border/50" />
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.map((c) => (
                  <Link key={c.id} to={`/clubes/${c.id}`}>
                    <Card className="p-4 bg-gradient-card border-border/50 hover:border-primary/50 hover:shadow-gold transition-all h-full flex items-center gap-3 relative overflow-hidden">
                      {c.primary_color && (
                        <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at top right, ${c.primary_color}, transparent 60%)` }} />
                      )}
                      <div className="relative h-14 w-14 flex items-center justify-center shrink-0">
                        {c.crest_url ? <img src={c.crest_url} alt={c.name} className="h-full w-full object-contain" /> : <Shield className="h-6 w-6 text-muted-foreground" />}
                      </div>
                      <div className="relative min-w-0 flex-1">
                        <div className="font-bold truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{city}</div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default Mapa;
