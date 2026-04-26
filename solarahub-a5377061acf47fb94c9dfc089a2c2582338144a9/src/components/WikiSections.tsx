import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RichEditor } from "./RichEditor";
import { Pencil } from "lucide-react";
import type { InfoboxData } from "./ClubInfobox";

export interface WikiData {
  content?: string;
  sections?: Partial<Record<WikiSectionKey, string>>;
  infobox?: InfoboxData;
}

export type WikiSectionKey = "historia" | "titulos" | "cores" | "escudos" | "mascotes" | "extras";

interface SectionMeta {
  key: WikiSectionKey;
  title: string;
  placeholder: string;
}

export const WIKI_SECTIONS: SectionMeta[] = [
  { key: "historia", title: "História", placeholder: "Conte a trajetória, fundação e marcos do clube..." },
  {
    key: "titulos",
    title: "Títulos",
    placeholder: "Liste as conquistas: estaduais, nacionais, continentais, mundiais...",
  },
  {
    key: "cores",
    title: "Cores e uniformes",
    placeholder: "Descreva as cores oficiais, alternativas e seu significado...",
  },
  { key: "escudos", title: "Escudos", placeholder: "História dos escudos do clube ao longo do tempo..." },
  { key: "mascotes", title: "Mascotes e símbolos", placeholder: "Mascotes oficiais e símbolos do clube..." },
  { key: "extras", title: "Curiosidades", placeholder: "Fatos, lendas, ídolos e curiosidades..." },
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
  canEdit?: boolean;
  onSaveSection?: (key: WikiSectionKey, html: string) => Promise<void> | void;
  title?: string;
}

interface SectionProps {
  meta: SectionMeta;
  html: string;
  canEdit: boolean;
  onSave?: (key: WikiSectionKey, html: string) => Promise<void> | void;
}

function Section({ meta, html, canEdit, onSave }: SectionProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(html);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    await onSave(meta.key, draft);
    setSaving(false);
    setOpen(false);
  };

  const empty = !html.trim();

  return (
    <section className="scroll-mt-20 mb-10" id={`wiki-${meta.key}`}>
      {/* Header da seção com separador visual */}
      <div className="wiki-section-heading flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h2 className="font-serif text-xl md:text-2xl font-semibold text-foreground m-0 p-0 leading-tight shrink-0">
            {meta.title}
          </h2>
          <div className="h-px flex-1 bg-gradient-to-r from-border/60 to-transparent" />
        </div>
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-primary hover:text-primary shrink-0"
            onClick={() => {
              setDraft(html);
              setOpen(true);
            }}
          >
            <Pencil className="h-3 w-3 mr-1" /> editar
          </Button>
        )}
      </div>

      {empty ? (
        <p className="text-sm italic text-muted-foreground">
          Sem conteúdo nesta seção{canEdit ? " — clique em editar para adicionar." : "."}
        </p>
      ) : (
        <div className="wiki-prose" dangerouslySetInnerHTML={{ __html: html }} />
      )}

      {canEdit && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="font-serif">Editar — {meta.title}</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <RichEditor content={draft} onChange={setDraft} placeholder={meta.placeholder} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-gradient-gold text-primary-foreground">
                {saving ? "Salvando..." : "Salvar seção"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}

export function WikiSectionsView({ wiki, canEdit = false, onSaveSection, title }: ViewProps) {
  return (
    <article className="wiki-surface px-5 md:px-8 py-6 md:py-8">
      {title && (
        <header className="mb-8">
          <h1 className="font-serif text-3xl md:text-4xl font-semibold border-b border-border/60 pb-3 m-0">{title}</h1>
          <p className="text-xs text-muted-foreground mt-2 italic">Origem: Solara Hub — wiki colaborativa do clube.</p>
        </header>
      )}

      {WIKI_SECTIONS.map((s) => (
        <Section key={s.key} meta={s} html={getSection(wiki, s.key)} canEdit={canEdit} onSave={onSaveSection} />
      ))}

      {wiki?.content?.trim() && (
        <section className="mb-10">
          <div className="wiki-section-heading flex items-center gap-3 mb-4">
            <h2 className="font-serif text-xl md:text-2xl font-semibold text-foreground m-0 p-0 leading-tight shrink-0">
              Conteúdo legado
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-border/60 to-transparent" />
          </div>
          <div className="wiki-prose" dangerouslySetInnerHTML={{ __html: wiki.content }} />
        </section>
      )}
    </article>
  );
}
