import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, LogIn } from "lucide-react";
import { formatCurrency } from "@/lib/format";

const MyClub = () => {
  const { user, loading, signInWithDiscord } = useAuth();
  const [clubs, setClubs] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    document.title = "Meu Clube — Solara Hub";
    if (!user) { setFetching(false); return; }
    supabase.from("clubs").select("*").eq("owner_id", user.id).then(({ data }) => {
      setClubs(data || []);
      setFetching(false);
    });
  }, [user]);

  if (loading) return null;
  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-4">
        <h1 className="text-3xl font-bold">Entre para ver seu clube</h1>
        <p className="text-muted-foreground">Faça login com Discord para gerenciar seu clube.</p>
        <Button onClick={signInWithDiscord} className="bg-[#5865F2] hover:bg-[#4752c4] text-white">
          <LogIn className="h-4 w-4" /> Entrar com Discord
        </Button>
      </div>
    );
  }

  if (fetching) return null;

  if (clubs.length === 0) {
    return (
      <Card className="max-w-lg mx-auto mt-20 p-8 text-center bg-gradient-card border-border/50">
        <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h2 className="font-display font-bold text-xl mb-2">Você ainda não tem um clube</h2>
        <p className="text-muted-foreground text-sm">Peça para um administrador atribuir um clube ao seu Discord ID.</p>
      </Card>
    );
  }

  if (clubs.length === 1) return <Navigate to={`/clubes/${clubs[0].id}`} replace />;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-3xl font-bold">Seus Clubes</h1>
      <div className="grid gap-3">
        {clubs.map((c) => (
          <Link key={c.id} to={`/clubes/${c.id}`}>
            <Card className="p-4 bg-gradient-card border-border/50 hover:border-primary/50 transition-all flex items-center gap-4">
              <div className="h-14 w-14 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
                {c.crest_url ? <img src={c.crest_url} className="h-full w-full object-cover" /> : <Shield className="h-6 w-6" />}
              </div>
              <div className="flex-1">
                <div className="font-bold">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.city}</div>
              </div>
              <div className="text-primary font-bold">{formatCurrency(Number(c.budget))}</div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default MyClub;
