import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ImageUpload } from "@/components/ImageUpload";
import { Plus, Pencil, Trash2, Shirt } from "lucide-react";
import { toast } from "sonner";
import { KitRating } from "@/components/KitRating";

export type KitTipo = "titular" | "alternativo" | "terceiro" | "goleiro" | "especial";

export interface ClubKit {
  id: string;
  club_id: string;
  ano: number;
  tipo: KitTipo;
  fabricante: string | null;
  descricao: string | null;
  image_url: string;
}

const TIPO_LABEL: Record<KitTipo, string> = {
  titular: "Titular",
  alternativo: "Alternativo",
  terceiro: "Terceiro",
  goleiro: "Goleiro",
  especial: "Especial",
};

const TIPO_BADGE: Record<KitTipo, string> = {
  titular: "bg-primary/20 text-primary border-primary/40",
  alternativo: "bg-secondary text-secondary-foreground border-border",
  terceiro: "bg-accent/20 text-accent-foreground border-accent/40",
  goleiro: "bg-success/20 text-success border-success/40",
  especial: "bg-amber-500/20 text-amber-400 border-amber-500/40",
};

interface Props {
  clubId: string;
  canEdit: boolean;
}

export const KitsGallery = ({ clubId, canEdit }: Props) => {
  const [kits, setKits] = useState<ClubKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<ClubKit> | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("club_kits" as any)
      .select("*")
      .eq("club_id", clubId)
      .order("ano", { ascending: false });
    if (error) toast.error(error.message);
    else setKits(((data as any) || []) as ClubKit[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [clubId]);

  const TIPO_ORDER: Record<KitTipo, number> = {
    titular: 1,
    alternativo: 2,
    terceiro: 3,
    goleiro: 4,
    especial: 5,
  };

  const grouped = kits.reduce<Record<number, ClubKit[]>>((acc, k) => {
    (acc[k.ano] ||= []).push(k);
    return acc;
  }, {});

  Object.values(grouped).forEach((arr) => {
    arr.sort((a, b) => TIPO_ORDER[a.tipo] - TIPO_ORDER[b.tipo]);
  });

  const anos = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => b - a);

  const save = async () => {
    if (!editing) return;
    if (!editing.image_url || !editing.ano || !editing.tipo) {
      toast.error("Imagem, ano e tipo são obrigatórios");
      return;
    }
    const payload = {
      club_id: clubId,
      ano: editing.ano,
      tipo: editing.tipo,
      fabricante: editing.fabricante || null,
      descricao: editing.descricao || null,
      image_url: editing.image_url,
    };
    const { error } = editing.id
      ? await supabase
          .from("club_kits" as any)
          .update(payload)
          .eq("id", editing.id)
      : await supabase.from("club_kits" as any).insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "Camisa atualizada!" : "Camisa adicionada!");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta camisa?")) return;
    const { error } = await supabase
      .from("club_kits" as any)
      .delete()
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Camisa removida.");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display font-bold text-2xl flex items-center gap-2">
          <Shirt className="h-5 w-5 text-primary" /> Histórico de Camisas
        </h2>
        {canEdit && (
          <Button
            onClick={() => setEditing({ ano: new Date().getFullYear(), tipo: "titular", image_url: "" })}
            className="bg-gradient-gold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Adicionar camisa
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : kits.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground bg-gradient-card border-border/50">
          Nenhuma camisa cadastrada ainda.
        </Card>
      ) : (
        anos.map((ano) => (
          <section key={ano} className="space-y-3">
            <div className="flex items-center gap-3">
              <h3 className="font-display font-bold text-3xl tracking-tight gold-text">{ano}</h3>
              <div className="h-px flex-1 bg-border/40" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {grouped[ano].map((k) => (
                <Card key={k.id} className="overflow-hidden bg-secondary/20 border-border/50 group">
                  <div className="aspect-square bg-gradient-to-br from-secondary/40 to-background/40 flex items-center justify-center p-4">
                    <img
                      src={k.image_url}
                      alt={`${TIPO_LABEL[k.tipo]} ${k.ano}`}
                      className="max-h-full max-w-full object-contain drop-shadow-lg"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className={`text-[10px] ${TIPO_BADGE[k.tipo]}`}>
                        {TIPO_LABEL[k.tipo]}
                      </Badge>
                      {k.fabricante && (
                        <span className="text-[10px] text-muted-foreground truncate">{k.fabricante}</span>
                      )}
                    </div>
                    {k.descricao && <p className="text-xs text-muted-foreground line-clamp-2">{k.descricao}</p>}
                    {canEdit && (
                      <div className="flex gap-1 pt-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2 flex-1" onClick={() => setEditing(k)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-destructive"
                          onClick={() => remove(k.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar camisa" : "Nova camisa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Imagem</Label>
              <ImageUpload
                value={editing?.image_url}
                onChange={(url) => setEditing((p) => ({ ...p!, image_url: url }))}
                folder={clubId}
                bucket="kits"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ano</Label>
                <Input
                  type="number"
                  value={editing?.ano ?? ""}
                  onChange={(e) => setEditing((p) => ({ ...p!, ano: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={editing?.tipo} onValueChange={(v) => setEditing((p) => ({ ...p!, tipo: v as KitTipo }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TIPO_LABEL) as KitTipo[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {TIPO_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Fabricante</Label>
              <Input
                value={editing?.fabricante ?? ""}
                onChange={(e) => setEditing((p) => ({ ...p!, fabricante: e.target.value }))}
                placeholder="Nike, Adidas..."
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={editing?.descricao ?? ""}
                onChange={(e) => setEditing((p) => ({ ...p!, descricao: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={save} className="bg-gradient-gold text-primary-foreground">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
