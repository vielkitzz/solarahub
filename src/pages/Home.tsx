import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Shield, Users, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

interface ClubRow {
  id: string;
  name: string;
  crest_url: string | null;
  budget: number;
  stadium_capacity: number;
  city: string | null;
  primary_color: string | null;
  player_count?: number;
}

const Home = () => {
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Solara Hub — Ranking dos Clubes";
    const load = async () => {
      const { data: clubsData } = await supabase.from("clubs").select("*").order("budget", { ascending: false });
      const { data: playersData } = await supabase.from("players").select("club_id");
      const counts = new Map<string, number>();
      playersData?.forEach((p) => { if (p.club_id) counts.set(p.club_id, (counts.get(p.club_id) || 0) + 1); });
      setClubs((clubsData || []).map((c: any) => ({ ...c, player_count: counts.get(c.id) || 0 })));
      setLoading(false);
    };
    load();
  }, []);

  const totalBudget = clubs.reduce((s, c) => s + Number(c.budget), 0);
  const totalCapacity = clubs.reduce((s, c) => s + (c.stadium_capacity || 0), 0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <header className="space-y-3">
        <Badge variant="outline" className="border-primary/40 text-primary">Temporada Ativa</Badge>
        <h1 className="text-4xl md:text-5xl font-bold">
          Bem-vindo ao <span className="gold-text">Solara Hub</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          O hub central do RPG de futebol. Acompanhe o ranking, gerencie seu clube e conheça a história de cada elenco.
        </p>
      </header>

      <div className="stat-grid">
        <StatCard icon={Shield} label="Clubes" value={formatNumber(clubs.length)} />
        <StatCard icon={Users} label="Capacidade Total" value={formatNumber(totalCapacity)} />
        <StatCard icon={TrendingUp} label="Capital em Jogo" value={formatCurrency(totalBudget)} />
        <StatCard icon={Trophy} label="Líder" value={clubs[0]?.name || "—"} />
      </div>

      <section>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" /> Ranking por Orçamento
        </h2>
        {loading ? (
          <div className="grid gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : clubs.length === 0 ? (
          <Card className="p-12 text-center bg-gradient-card border-border/50">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum clube cadastrado ainda. Aguarde o admin criar os primeiros clubes!</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {clubs.map((club, idx) => (
              <Link key={club.id} to={`/clubes/${club.id}`}>
                <Card className="p-4 bg-gradient-card border-border/50 hover:border-primary/50 hover:shadow-gold transition-all hover:translate-x-1 cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div className={`text-2xl font-display font-bold w-10 text-center ${idx < 3 ? "gold-text" : "text-muted-foreground"}`}>
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                    <div
                      className="h-14 w-14 rounded-lg bg-secondary flex items-center justify-center overflow-hidden ring-1 ring-border shrink-0"
                      style={club.primary_color ? { boxShadow: `0 0 0 2px ${club.primary_color}40` } : undefined}
                    >
                      {club.crest_url ? (
                        <img src={club.crest_url} alt={club.name} className="h-full w-full object-cover" />
                      ) : (
                        <Shield className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold text-lg truncate group-hover:text-primary transition-colors">{club.name}</div>
                      <div className="text-xs text-muted-foreground">{club.city || "—"} · {club.player_count} jogadores</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Orçamento</div>
                      <div className="font-display font-bold text-primary">{formatCurrency(Number(club.budget))}</div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <Card className="p-5 bg-gradient-card border-border/50">
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-display font-bold text-lg truncate">{value}</div>
      </div>
    </div>
  </Card>
);

export default Home;
