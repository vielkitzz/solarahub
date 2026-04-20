import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { BookOpen, Shield } from "lucide-react";

const WikiGlobal = () => {
  const [clubs, setClubs] = useState<any[]>([]);

  useEffect(() => {
    document.title = "Wiki Global — Solara Hub";
    supabase.from("clubs").select("id, name, crest_url, city, wiki").order("name").then(({ data }) => setClubs(data || []));
  }, []);

  const withWiki = clubs.filter((c) => (c.wiki as any)?.content?.trim());

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-primary" /> Wiki Global
        </h1>
        <p className="text-muted-foreground">A enciclopédia viva do RPG. Histórias, lendas e tradições de cada clube.</p>
      </header>

      {withWiki.length === 0 ? (
        <Card className="p-12 text-center bg-gradient-card border-border/50 text-muted-foreground">
          Nenhum clube tem wiki publicada ainda.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {withWiki.map((c) => {
            const text = ((c.wiki as any)?.content || "").replace(/<[^>]+>/g, " ").trim().slice(0, 200);
            return (
              <Link key={c.id} to={`/clubes/${c.id}`}>
                <Card className="p-5 bg-gradient-card border-border/50 hover:border-primary/50 transition-all h-full">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center overflow-hidden ring-1 ring-border">
                      {c.crest_url ? <img src={c.crest_url} className="h-full w-full object-cover" /> : <Shield className="h-6 w-6 text-muted-foreground" />}
                    </div>
                    <div>
                      <div className="font-display font-bold">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.city || "—"}</div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">{text}…</p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WikiGlobal;
