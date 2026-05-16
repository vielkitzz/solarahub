import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Shield, Shirt } from "lucide-react";

interface ClubRow {
  id: string;
  name: string;
  crest_url: string | null;
  primary_color: string | null;
  kit_count: number;
}

const HistoricoCamisas = () => {
  const [rows, setRows] = useState<ClubRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Histórico de Camisas — Solara Hub";
    (async () => {
      const [{ data: clubs }, { data: kits }] = await Promise.all([
        supabase.from("clubs").select("id,name,crest_url,primary_color").order("name"),
        supabase.from("club_kits" as any).select("club_id"),
      ]);
      const counts: Record<string, number> = {};
      ((kits as any) || []).forEach((k: any) => {
        counts[k.club_id] = (counts[k.club_id] || 0) + 1;
      });
      setRows((clubs || []).map((c: any) => ({ ...c, kit_count: counts[c.id] || 0 })));
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-bold flex items-center gap-3">
          <Shirt className="h-7 w-7 text-primary" /> Histórico de Camisas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acervo de uniformes de cada clube ao longo da história. Clique em um clube para abrir sua galeria.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {rows.map((c) => (
            <Link key={c.id} to={`/clubes/${c.id}?tab=camisas`}>
              <Card className="p-4 bg-gradient-card border-border/50 hover:border-primary/40 transition-all flex flex-col items-center text-center gap-2 h-full">
                <div className="h-16 w-16 flex items-center justify-center">
                  {c.crest_url ? (
                    <img src={c.crest_url} alt={c.name} className="max-h-full max-w-full object-contain" loading="lazy" />
                  ) : (
                    <Shield className="h-10 w-10 text-muted-foreground" />
                  )}
                </div>
                <div className="font-display font-bold text-sm leading-tight line-clamp-2">{c.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {c.kit_count} {c.kit_count === 1 ? "camisa" : "camisas"}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoricoCamisas;
