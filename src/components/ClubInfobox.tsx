import { Shield, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";

export interface InfoboxData {
  alcunhas?: string;
  torcedor?: string;
  rival?: string;
  presidente?: string;
  patrocinador?: string;
  material?: string;
  competicao?: string;
}

interface Club {
  id: string;
  name: string;
  crest_url?: string | null;
  city?: string | null;
  founded_year?: number | null;
  stadium_name?: string | null;
  stadium_capacity?: number | null;
  primary_color?: string | null;
}

interface Props {
  club: Club;
  infobox: InfoboxData;
  canEdit: boolean;
  onSave: (next: InfoboxData) => Promise<void> | void;
}

const Row = ({ label, value, readOnly }: { label: string; value?: string | number | null; readOnly?: boolean }) => {
  if (value === null || value === undefined || value === "") return null;
  return (
    <tr className="border-b border-border/40 last:border-0">
      <th
        className="text-left align-top py-1.5 pr-3 text-xs uppercase tracking-wider text-muted-foreground font-medium w-1/2"
        title={readOnly ? "Sincronizado automaticamente" : undefined}
      >
        {label}
      </th>
      <td className="py-1.5 text-sm font-serif text-foreground">{value}</td>
    </tr>
  );
};

export function ClubInfobox({ club, infobox, canEdit, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<InfoboxData>(infobox);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setOpen(false);
  };

  return (
    <aside className="wiki-surface w-full md:w-[300px] lg:w-[340px] shrink-0 overflow-hidden">
      {/* header */}
      <div
        className="px-4 py-3 border-b border-border/60 text-center"
        style={
          club.primary_color
            ? { background: `linear-gradient(180deg, ${club.primary_color}30, transparent)` }
            : undefined
        }
      >
        <h2 className="font-serif text-lg font-semibold leading-tight">{club.name}</h2>
      </div>

      {/* crest */}
      <div className="flex items-center justify-center py-5 bg-card/30 border-b border-border/40">
        <div className="h-32 w-32 flex items-center justify-center">
          {club.crest_url ? (
            <img src={club.crest_url} alt={club.name} className="h-full w-full object-contain drop-shadow-md" />
          ) : (
            <Shield className="h-16 w-16 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* data */}
      <div className="px-4 py-3">
        <table className="w-full">
          <tbody>
            <Row label="Alcunhas" value={infobox.alcunhas} />
            <Row label="Torcedor(a)" value={infobox.torcedor} />
            <Row label="Rival" value={infobox.rival} />
            <Row label="Fundação" value={club.founded_year ?? undefined} />
            <Row label="Estádio" value={club.stadium_name ?? undefined} />
            <Row
              label="Capacidade"
              value={club.stadium_capacity ? club.stadium_capacity.toLocaleString("pt-BR") : undefined}
            />
            <Row label="Cidade" value={club.city ?? undefined} />
            <Row label="Presidente" value={infobox.presidente} />
            <Row label="Patrocinador" value={infobox.patrocinador} readOnly />
            <Row label="Material" value={infobox.material} readOnly />
            <Row label="Competição" value={infobox.competicao} />
          </tbody>
        </table>

        {canEdit && (
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (v) setDraft(infobox);
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full mt-3 gap-2">
                <Pencil className="h-3.5 w-3.5" /> Editar infobox
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-serif">Editar infobox</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                {(
                  [
                    ["alcunhas", "Alcunhas (apelidos do clube)"],
                    ["torcedor", "Torcedor(a) / Adepto(a)"],
                    ["rival", "Rival principal"],
                    ["presidente", "Presidente"],
                    ["competicao", "Competição"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <Input value={draft[key] ?? ""} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Nome, escudo, fundação, estádio, capacidade e cidade são puxados do cadastro do clube. Patrocinador e
                  material são sincronizados automaticamente com os contratos ativos.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving} className="bg-gradient-gold text-primary-foreground">
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </aside>
  );
}
