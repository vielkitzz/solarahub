import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Shield } from "lucide-react";
import { WIKI_SECTIONS, WikiData, hasAnyContent, getSection } from "@/components/WikiSections";

const WikiGlobal = () => {
  const [clubs, setClubs] = useState<any[]>([]);

  useEffect(() => {
    document.title = "Wiki Global — Solara Hub";
    supabase
      .from("clubs")
      .select("id, name, crest_url, city, wiki")
      .order("name")
      .then(({ data }) => setClubs(data || []));
  }, []);

  const withWiki = clubs.filter((c) => hasAnyContent(c.wiki as WikiData));

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-primary" /> Wiki Global
        </h1>
        <p className="text-muted-foreground">
          A enciclopédia viva do RPG. Cores, escudos, mascotes, títulos e história de cada clube.
        </p>
      </header>

      {withWiki.length === 0 ? (
        <Card className="p-12 text-center bg-gradient-card border-border/50 text-muted-foreground">
          Nenhum clube tem wiki publicada ainda.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {withWiki.map((c) => {
            const wiki = (c.wiki as WikiData) || {};
            const filledSections = WIKI_SECTIONS.filter((s) => getSection(wiki, s.key).trim());
            const previewSection = filledSections[0];
            const previewText = previewSection
              ? getSection(wiki, previewSection.key).replace(/<[^>]+>/g, " ").trim().slice(0, 140)
              : (wiki.content || "").replace(/<[^>]+>/g, " ").trim().slice(0, 140);

            return (
              <Link key={c.id} to={`/clubes/${c.id}?tab=wiki`}>
                <Card className="p-5 bg-gradient-card border-border/50 hover:border-primary/50 transition-all h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-12 w-12 flex items-center justify-center shrink-0">
                      {c.crest_url ? (
                        <img src={c.crest_url} alt={c.name} className="h-full w-full object-contain" />
                      ) : (
                        <Shield className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-serif font-semibold truncate text-lg">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.city || "—"}</div>
                    </div>
                  </div>

                  {filledSections.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {filledSections.map((s) => (
                        <Badge key={s.key} variant="outline" className="text-[10px] border-primary/30">
                          {s.title}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {previewText && (
                    <p className="text-sm text-muted-foreground line-clamp-3 mt-auto font-serif italic">
                      {previewText}…
                    </p>
                  )}
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
