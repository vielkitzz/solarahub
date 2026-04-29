import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RichEditor } from "./RichEditor";
import { Pencil, Plus, ChevronUp } from "lucide-react";
import type { InfoboxData } from "./ClubInfobox";

// --- EXPORTS RESTAURADOS PARA COMPATIBILIDADE ---
export type WikiSectionKey = string;

export interface WikiData {
  content?: string;
  sections?: Record<string, string>;
  sectionOrder?: string[];
  infobox?: InfoboxData;
}

export interface SectionMeta {
  key: string;
  title: string;
  placeholder: string;
  isSystem?: boolean;
}

export const WIKI_SECTIONS: SectionMeta[] = [
  { key: "introducao", title: "", placeholder: "Introdução e visão geral do artigo...", isSystem: true },
  { key: "historia", title: "História", placeholder: "Conte a trajetória, fundação e marcos do clube..." },
  { key: "titulos", title: "Títulos", placeholder: "Liste as conquistas..." },
  { key: "cores", title: "Cores e uniformes", placeholder: "Significado das cores e mantos..." },
  { key: "escudos", title: "Escudos", placeholder: "Evolução visual ao longo do tempo..." },
  { key: "mascotes", title: "Mascotes e símbolos", placeholder: "Mascotes oficiais e simbologias..." },
  { key: "extras", title: "Curiosidades", placeholder: "Fatos, lendas e ídolos..." },
];

// Funções auxiliares restauradas para o WikiGlobal.tsx
export function getSection(wiki: WikiData | null | undefined, key: string): string {
  return wiki?.sections?.[key] ?? "";
}

export function hasAnyContent(wiki: WikiData | null | undefined): boolean {
  if (!wiki) return false;
  return Object.values(wiki.sections ?? {}).some((content) => content.trim().length > 0);
}

// --- COMPONENTE PRINCIPAL ---

interface ViewProps {
  wiki: WikiData | null | undefined;
  canEdit?: boolean;
  onSaveWiki?: (updatedWiki: WikiData) => Promise<void> | void;
  // Adicionado onSaveSection para manter compatibilidade com ClubDetail.tsx
  onSaveSection?: (key: string, html: string) => Promise<void> | void;
  title?: string;
}

export function WikiSectionsView({ wiki, canEdit = false, onSaveWiki, onSaveSection, title }: ViewProps) {
  const [sections, setSections] = useState<SectionMeta[]>([]);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");

  useEffect(() => {
    if (wiki?.sectionOrder && wiki.sectionOrder.length > 0) {
      const ordered = wiki.sectionOrder.map((key) => {
        const existing = WIKI_SECTIONS.find((s) => s.key === key);
        return existing || { key, title: key, placeholder: "Escreva aqui..." };
      });
      setSections(ordered);
    } else {
      setSections(WIKI_SECTIONS);
    }
  }, [wiki]);

  const handleInternalSave = async (key: string, html: string) => {
    // Tenta usar a nova função onSaveWiki, senão usa a antiga onSaveSection
    if (onSaveWiki) {
      const newWiki = {
        ...wiki,
        sections: { ...wiki?.sections, [key]: html },
        sectionOrder: sections.map((s) => s.key),
      };
      await onSaveWiki(newWiki);
    } else if (onSaveSection) {
      await onSaveSection(key, html);
    }
  };

  const addNewSection = () => {
    if (!newSectionTitle.trim()) return;
    const key = `custom-${Date.now()}`; // Chave única para evitar conflitos
    const newMeta: SectionMeta = { key, title: newSectionTitle, placeholder: "Conteúdo..." };
    setSections([...sections, newMeta]);
    setNewSectionTitle("");
    setIsAddingSection(false);
  };

  const moveSection = (index: number, direction: "up" | "down") => {
    const newSections = [...sections];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSections.length) return;
    [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
    setSections(newSections);
  };

  return (
    <article className="wiki-surface px-5 md:px-8 py-6 md:py-8">
      {title && (
        <header className="mb-8">
          <h1 className="font-serif text-3xl md:text-4xl font-semibold border-b border-border/60 pb-3 m-0">{title}</h1>
          <p className="text-xs text-muted-foreground mt-2 italic">Origem: Solara Hub</p>
        </header>
      )}

      <div className="space-y-2">
        {sections.map((meta, index) => (
          <div key={meta.key} className="group relative">
            {canEdit && !meta.isSystem && (
              <div className="absolute -left-10 top-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveSection(index, "up")}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveSection(index, "down")}>
                  <ChevronUp className="h-4 w-4 rotate-180" />
                </Button>
              </div>
            )}
            <Section meta={meta} html={getSection(wiki, meta.key)} canEdit={canEdit} onSave={handleInternalSave} />
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="mt-8 pt-6 border-t border-dashed border-border flex justify-center">
          <Button variant="outline" onClick={() => setIsAddingSection(true)} className="gap-2 text-primary">
            <Plus className="h-4 w-4" /> Adicionar nova seção
          </Button>
        </div>
      )}

      <Dialog open={isAddingSection} onOpenChange={setIsAddingSection}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar nova seção</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <input
              className="w-full p-2 border rounded-md"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              placeholder="Título da seção (ex: Rivalidades)"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingSection(false)}>
              Cancelar
            </Button>
            <Button onClick={addNewSection} className="bg-gradient-gold">
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}

// Subcomponente Section (ajustado para aceitar onSave)
function Section({
  meta,
  html,
  canEdit,
  onSave,
}: {
  meta: SectionMeta;
  html: string;
  canEdit: boolean;
  onSave: (key: string, html: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(html);
  const [saving, setSaving] = useState(false);

  return (
    <section className="scroll-mt-20 mb-10" id={`wiki-${meta.key}`}>
      <div className="wiki-section-heading flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 flex-1">
          {meta.title && <h2 className="font-serif text-xl md:text-2xl font-semibold">{meta.title}</h2>}
          {meta.title && <div className="h-px flex-1 bg-gradient-to-r from-border/60 to-transparent" />}
        </div>
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-primary"
            onClick={() => {
              setDraft(html);
              setOpen(true);
            }}
          >
            <Pencil className="h-3 w-3 mr-1" /> editar
          </Button>
        )}
      </div>

      {!html.trim() ? (
        <p className="text-sm italic text-muted-foreground">Sem conteúdo.</p>
      ) : (
        <div className="wiki-prose" dangerouslySetInnerHTML={{ __html: html }} />
      )}

      {canEdit && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Editar — {meta.title || "Introdução"}</DialogTitle>
            </DialogHeader>
            <RichEditor content={draft} onChange={setDraft} placeholder={meta.placeholder} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  setSaving(true);
                  await onSave(meta.key, draft);
                  setSaving(false);
                  setOpen(false);
                }}
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
