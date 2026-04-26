import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Shield, Users, BookOpen, ArrowRightLeft, MapPin, Sparkles, ArrowRight } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { useSeason } from "@/contexts/SeasonContext";

const Home = () => {
  const { user, signInWithDiscord } = useAuth();
  const { currentSeason } = useSeason();
  const [stats, setStats] = useState({ clubs: 0, players: 0, capital: 0, forSale: 0 });
  const [topClubs, setTopClubs] = useState<any[]>([]);

  useEffect(() => {
    document.title = "Solara Hub — RPG de Futebol";
    (async () => {
      const [{ data: cs }, { data: ps }] = await Promise.all([
        supabase.from("clubs").select("id,name,crest_url,budget,city,primary_color").order("budget", { ascending: false }),
        supabase.from("players").select("id,a_venda"),
      ]);
      const capital = (cs || []).reduce((s, c) => s + Number(c.budget), 0);
      const forSale = (ps || []).filter((p: any) => p.a_venda).length;
      setStats({ clubs: cs?.length || 0, players: ps?.length || 0, capital, forSale });
      setTopClubs((cs || []).slice(0, 5));
    })();
  }, []);

  const sections: { to: string; icon: any; title: string; desc: string }[] = [
    { to: "/ranking", icon: Trophy, title: "Ranking", desc: "Veja a classificação por orçamento da temporada." },
    { to: "/clubes", icon: Shield, title: "Clubes", desc: "Explore todos os clubes da liga." },
    { to: "/mapa", icon: MapPin, title: "Mapa", desc: "Localização geográfica de cada clube." },
    { to: "/mercado", icon: Users, title: "Mercado", desc: "Todos os jogadores da liga e os à venda." },
    { to: "/transferencias", icon: ArrowRightLeft, title: "Transferências", desc: "Compre, empreste ou troque jogadores." },
    { to: "/wiki", icon: BookOpen, title: "Wiki Global", desc: "História, escudos, mascotes e títulos." },
  ];

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-card border border-border/50 p-8 md:p-12">
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: "radial-gradient(circle at 80% 20%, hsl(var(--primary) / 0.4), transparent 50%)" }} />
        <div className="relative space-y-5 max-w-3xl">
          <Badge variant="outline" className="border-primary/40 text-primary">
            <Sparkles className="h-3 w-3 mr-1" /> {currentSeason || "Temporada Ativa"}
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            Bem-vindo ao <span className="gold-text">Solara Hub</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            O hub central do RPG de futebol da Solara. Gerencie o seu clube, negocie no mercado, acompanhe o ranking e construa a história do seu elenco.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            {user ? (
              <>
                <Button asChild className="bg-gradient-gold text-primary-foreground hover:opacity-90">
                  <Link to="/meu-clube">Meu Clube <ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/ranking">Ver Ranking</Link>
                </Button>
              </>
            ) : (
              <>
                <Button onClick={signInWithDiscord} className="bg-[#5865F2] hover:bg-[#4752c4] text-white">
                  Entrar com Discord
                </Button>
                <Button asChild variant="outline">
                  <Link to="/clubes">Explorar clubes</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="stat-grid">
        <StatCard icon={Shield} label="Clubes" value={formatNumber(stats.clubs)} />
        <StatCard icon={Users} label="Jogadores" value={formatNumber(stats.players)} />
        <StatCard icon={Trophy} label="Capital em jogo" value={formatCurrency(stats.capital)} />
        <StatCard icon={ArrowRightLeft} label="À venda" value={formatNumber(stats.forSale)} />
      </section>

      {/* QUICK NAV */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Por onde começar</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sections.map((s) => (
            <Link key={s.to} to={s.to}>
              <Card className="p-5 bg-gradient-card border-border/50 hover:border-primary/50 hover:shadow-gold transition-all h-full group">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <s.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-display font-bold group-hover:text-primary transition-colors">{s.title}</div>
                    <p className="text-sm text-muted-foreground">{s.desc}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* TOP 5 */}
      {topClubs.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-2xl font-bold flex items-center gap-2"><Trophy className="h-6 w-6 text-primary" /> Top 5</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/ranking">Ver ranking completo <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>
          <div className="grid gap-2">
            {topClubs.map((c, idx) => (
              <Link key={c.id} to={`/clubes/${c.id}`}>
                <Card className="p-3 bg-gradient-card border-border/50 hover:border-primary/40 transition-all flex items-center gap-3">
                  <div className={`text-xl font-display font-bold w-8 text-center ${idx < 3 ? "gold-text" : "text-muted-foreground"}`}>
                    {idx + 1}
                  </div>
                  <div className="h-10 w-10 flex items-center justify-center shrink-0">
                    {c.crest_url ? <img src={c.crest_url} alt={c.name} className="h-full w-full object-contain" /> : <Shield className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.city || "—"}</div>
                  </div>
                  <div className="font-display font-bold text-primary">{formatCurrency(Number(c.budget))}</div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
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
