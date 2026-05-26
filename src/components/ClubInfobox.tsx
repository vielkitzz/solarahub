import { Shield, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  onEditClick?: () => void;
}

const Row = ({ label, value, readOnly }: { label: string; value?: string | number | null; readOnly?: boolean }) => {
  if (value === null || value === undefined || value === "") return null;
  const lines = String(value)
    .split("\n")
    .filter((l) => l.trim() !== "");
  return (
    <tr className="border-b border-border/40 last:border-0">
      <th
        className="text-left align-top py-1.5 pr-3 text-xs uppercase tracking-wider text-muted-foreground font-medium w-1/2"
        title={readOnly ? "Sincronizado automaticamente" : undefined}
      >
        {label}
      </th>
      <td className="py-1.5 text-sm font-serif text-foreground">
        {lines.length > 1 ? (
          <ul className="space-y-0.5 list-none">
            {lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : (
          String(value)
        )}
      </td>
    </tr>
  );
};

export function ClubInfobox({ club, infobox, canEdit, onEditClick }: Props) {
  const [patrocinadorAtivo, setPatrocinadorAtivo] = useState<string | null>(null);
  const [materialAtivo, setMaterialAtivo] = useState<string | null>(null);

  useEffect(() => {
    if (!club.id) return;
    supabase
      .from("contratos_clube")
      .select("categoria, empresa:empresas(nome)")
      .eq("club_id", club.id)
      .eq("ativo", true)
      .then(({ data, error }) => {
        if (error || !data) return;
        const fornecedora = data.find((c) => c.categoria === "fornecedora");
        const master = data.find((c) => c.categoria === "master");
        setMaterialAtivo((fornecedora?.empresa as any)?.nome ?? null);
        setPatrocinadorAtivo((master?.empresa as any)?.nome ?? null);
      });
  }, [club.id]);

  return (
    <aside className="wiki-surface w-full md:w-[300px] lg:w-[340px] shrink-0 overflow-hidden">
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

      <div className="flex items-center justify-center py-5 bg-card/30 border-b border-border/40">
        <div className="h-32 w-32 flex items-center justify-center">
          {club.crest_url ? (
            <img src={club.crest_url} alt={club.name} className="h-full w-full object-contain drop-shadow-md" />
          ) : (
            <Shield className="h-16 w-16 text-muted-foreground" />
          )}
        </div>
      </div>

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
            <Row label="Patrocinador" value={patrocinadorAtivo} readOnly />
            <Row label="Material" value={materialAtivo} readOnly />
            <Row label="Competição" value={infobox.competicao} />
          </tbody>
        </table>

        {canEdit && (
          <Button variant="outline" size="sm" className="w-full mt-3 gap-2" onClick={onEditClick}>
            <Pencil className="h-3.5 w-3.5" /> Editar infobox
          </Button>
        )}
      </div>
    </aside>
  );
}
