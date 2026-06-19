import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Shirt, Star, Trophy } from "lucide-react";

interface ClubRow {
  id: string;
  name: string;
  crest_url: string | null;
  primary_color: string | null;
  kit_count: number;
}

interface KitRankRow {
  kit_id: string;
  club_id: string;
  club_name: string;
  club_crest: string | null;
  image_url: string;
  ano: number;
  tipo: string;
  fabricante: string | null;
  avg_rating: number;
  votes: number;
}

const HistoricoCamisas = () => {
  const [rows, setRows] = useState<ClubRow[]>([]);
  const [ranking, setRanking] = useState<KitRankRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Histórico de Camisas — Solara Hub";
    (async () => {
      const [{ data: clubs }, { data: kits }, { data: ratings }] = await Promise.all([
        supabase.from("clubs").select("id,name,crest_url,primary_color").order("name"),
        supabase.from("club_kits" as any).select("id, club_id, image_url, ano, tipo, fabricante"),
        supabase.from("kit_ratings" as any).select("kit_id, rating"),
      ]);

      // Por clube
      const counts: Record<string, number> = {};
      ((kits as any) || []).forEach((k: any) => {
        counts[k.club_id] = (counts[k.club_id] || 0) + 1;
      });
      setRows((clubs || []).map((c: any) => ({ ...c, kit_count: counts[c.id] || 0 })));

      // Ranking
      const ratingsMap: Record<string, { sum: number; n: number }> = {};
      ((ratings as any) || []).forEach((r: any) => {
        if (!ratingsMap[r.kit_id]) ratingsMap[r.kit_id] = { sum: 0, n: 0 };
        ratingsMap[r.kit_id].sum += Number(r.rating || 0);
        ratingsMap[r.kit_id].n += 1;
      });
      const clubMap = new Map((clubs || []).map((c: any) => [c.id, c]));
      const rank: KitRankRow[] = ((kits as any) || [])
        .map((k: any) => {
          const r = ratingsMap[k.id];
          const club = clubMap.get(k.club_id) as any;
          return {
            kit_id: k.id,
            club_id: k.club_id,
            club_name: club?.name ?? "—",
            club_crest: club?.crest_url ?? null,
            image_url: k.image_url,
            ano: k.ano,
            tipo: k.tipo,
            fabricante: k.fabricante,
            avg_rating: r ? r.sum / r.n : 0,
            votes: r?.n ?? 0,
          };
        })
        .filter((k) => k.votes > 0)
        .sort((a, b) => {
          if (b.avg_rating !== a.avg_rating) return b.avg_rating - a.avg_rating;
          return b.votes - a.votes;
        })
        .slice(0, 50);
      setRanking(rank);

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
          Acervo de uniformes de cada clube ao longo da história e ranking das camisas mais bem avaliadas.
        </p>
      </div>

      <Tabs defaultValue="clubes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="clubes">
            <Shirt className="h-4 w-4 mr-1.5" /> Clubes
          </TabsTrigger>
          <TabsTrigger value="ranking">
            <Trophy className="h-4 w-4 mr-1.5" /> Ranking de camisas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clubes">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {rows.map((c) => (
                <Link key={c.id} to={`/clubes/${c.id}?tab=camisas`}>
                  <Card className="p-4 bg-gradient-card border-border/50 hover:border-primary/40 transition-all flex flex-col items-center text-center gap-2 h-full">
                    <div className="h-16 w-16 flex items-center justify-center">
                      {c.crest_url ? (
                        <img
                          src={c.crest_url}
                          alt={c.name}
                          className="max-h-full max-w-full object-contain"
                          loading="lazy"
                        />
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
        </TabsContent>

        <TabsContent value="ranking">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : ranking.length === 0 ? (
            <Card className="p-8 text-center bg-gradient-card border-border/50 text-muted-foreground">
              Nenhuma camisa avaliada ainda.
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {ranking.map((k, idx) => (
                <Link key={k.kit_id} to={`/clubes/${k.club_id}?tab=camisas`}>
                  <Card className="p-3 bg-gradient-card border-border/50 hover:border-primary/40 transition-all flex flex-col gap-2 h-full relative">
                    <div
                      className={`absolute top-2 left-2 z-10 inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 rounded text-[11px] font-bold ${
                        idx === 0
                          ? "bg-yellow-400 text-black"
                          : idx === 1
                            ? "bg-gray-300 text-black"
                            : idx === 2
                              ? "bg-amber-700 text-white"
                              : "bg-secondary text-foreground"
                      }`}
                    >
                      #{idx + 1}
                    </div>
                    <div className="aspect-square rounded bg-secondary/30 flex items-center justify-center overflow-hidden">
                      {k.image_url ? (
                        <img src={k.image_url} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                      ) : (
                        <Shirt className="h-12 w-12 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {k.club_crest ? (
                        <img src={k.club_crest} alt="" className="h-5 w-5 object-contain" loading="lazy" />
                      ) : (
                        <Shield className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="text-xs font-semibold truncate">{k.club_name}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="capitalize">
                        {k.tipo} · {k.ano}
                      </span>
                      <span className="flex items-center gap-0.5 text-primary font-semibold">
                        <Star className="h-3 w-3 fill-current" />
                        {k.avg_rating.toFixed(1)}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground/70 -mt-1">
                      {k.votes} {k.votes === 1 ? "voto" : "votos"}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HistoricoCamisas;
