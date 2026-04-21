import { Card } from "@/components/ui/card";
import { RichEditor } from "./RichEditor";
import { Palette, Shield, PawPrint, Trophy, BookOpen, Sparkles, LucideIcon } from "lucide-react";

export interface WikiData {
  content?: string; // legado
  sections?: Partial<Record<WikiSectionKey, string>>;
}

export type WikiSectionKey = "colors" | "crests" | "mascots" | "titles" | "history" | "extras";

interface SectionMeta {
  key: WikiSectionKey;
  title: string;
  icon: LucideIcon;
  placeholder: string;
}

export const WIKI_SECTIONS: SectionMeta[] = [
  { key: "colors", title: "Cores", icon: Palette, placeholder: "Descreva as cores oficiais, alternativas e seu significado..." },
  { key: "crests", title: "Escudos", icon: Shield, placeholder: "História dos escudos do clube ao longo do tempo..." },
  { key: "mascots", title: "Mascotes", icon: PawPrint, placeholder: "Mascotes oficiais e símbolos do clube..." },
  { key: "titles", title: "Títulos", icon: Trophy, placeholder: "Liste as conquistas: estaduais, nacionais, continentais, mundiais..." },
  { key: "history", title: "História", icon: BookOpen, placeholder: "Conte a trajetória, fundação e marcos do clube..." },
  { key: "extras", title: "Curiosidades", icon: Sparkles, placeholder: "Fatos, lendas, ídolos e curiosidades..." },
];

export function getSection(wiki: WikiData | null | undefined, key: WikiSectionKey): string {
  return wiki?.sections?.[key] ?? "";
}

export function hasAnyContent(wiki: WikiData | null | undefined): boolean {
  if (!wiki) return false;
  if (wiki.content?.trim()) return true;
  return WIKI_SECTIONS.some((s) => (wiki.sections?.[s.key] ?? "").trim());
}

interface ViewProps {
  wiki: WikiData | null | undefined;
}

export function WikiSectionsView({ wiki }: ViewProps) {
  const filled = WIKI_SECTIONS.filter((s) => getSection(wiki, s.key).trim());

  if (filled.length === 0 && !wiki?.content?.trim()) {
    return (
      <Card className="p-10 text-center bg-gradient-card border-border/50 text-muted-foreground italic">
        Sem conteúdo na wiki ainda.
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {filled.map((s) => (
        <Card key={s.key} className="p-5 bg-gradient-card border-border/50 hover:border-primary/40 transition-colors">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/50">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <s.icon className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-display font-bold">{s.title}</h3>
          </div>
          <div className="prose-solara" dangerouslySetInnerHTML={{ __html: getSection(wiki, s.key) }} />
        </Card>
      ))}
      {wiki?.content?.trim() && filled.length === 0 && (
        <Card className="p-5 bg-gradient-card border-border/50 md:col-span-2">
          <div className="prose-solara" dangerouslySetInnerHTML={{ __html: wiki.content }} />
        </Card>
      )}
    </div>
  );
}

interface EditorProps {
  wiki: WikiData;
  onChange: (next: WikiData) => void;
}

export function WikiSectionsEditor({ wiki, onChange }: EditorProps) {
  const setSection = (key: WikiSectionKey, html: string) => {
    onChange({
      ...wiki,
      sections: { ...(wiki.sections ?? {}), [key]: html },
    });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {WIKI_SECTIONS.map((s) => (
        <Card key={s.key} className="p-4 bg-gradient-card border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <s.icon className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-display font-bold">{s.title}</h3>
          </div>
          <RichEditor
            content={getSection(wiki, s.key)}
            onChange={(html) => setSection(s.key, html)}
            placeholder={s.placeholder}
          />
        </Card>
      ))}
    </div>
  );
}
