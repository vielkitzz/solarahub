import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ImageUpload } from "@/components/ImageUpload";
import { Plus, Pencil, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";

export interface ClubCrest {
  id: string;
  club_id: string;
  ano: number;
  descricao: string | null;
  image_url: string;
}

interface Props {
  clubId: string;
  canEdit: boolean;
}

export const CrestsGallery = ({ clubId, canEdit }: Props) => {
  const [crests, setCrests] = useState<ClubCrest[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<ClubCrest> | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("club_crests" as any)
      .select("*")
      .eq("club_id", clubId)
      .order("ano", { ascending: false });
    if (error) toast.error(error.message);
    else setCrests(((data as any) || []) as ClubCrest[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [clubId]);

  const grouped = crests.reduce<Record<number, ClubCrest[]>>((acc, c) => {
    (acc[c.ano] ||= []).push(c);
    return acc;
  }, {});

  const anos = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => b - a);

  const save = async () => {
    if (!editing) return;
    if (!editing.image_url || !editing.ano) {
      toast.error("Imagem e ano são obrigatórios");
      return;
    }
    const payload = {
      club_id: clubId,
      ano: editing.ano,
      descricao: editing.descricao || null,
      image_url: editing.image_url,
    };
    const { error } = editing.id
      ? await supabase.from("club_crests" as any).update(payload).eq("id", editing.id)
      : await supabase.from("club_crests" as any).insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "Escudo atualizado!" : "Escudo adicionado!");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este escudo?")) return;
    const { error } = await supabase.from("club_crests" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Escudo removido.");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display font-bold text-2xl flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" /> Histórico de Escudos
        </h2>
        {canEdit && (
          <Button
            onClick={() => setEditing({ ano: new Date().getFullYear(), image_url: "" })}
            className="bg-gradient-gold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Adicionar escudo
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : crests.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground bg-gradient-card border-border/50">
          Nenhum escudo cadastrado ainda.
        </Card>
      ) : (
        anos.map((ano) => (
          <section key={ano} className="space-y-3">
            <div className="flex items-center gap-3">
              <h3 className="font-display font-bold text-3xl tracking-tight gold-text">{ano}</h3>
              <div className="h-px flex-1 bg-border/40" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {grouped[ano].map((c) => (
                <Card key={c.id} className="overflow-hidden bg-secondary/20 border-border/50 group">
                  <div className="aspect-square bg-gradient-to-br from-secondary/40 to-background/40 flex items-center justify-center p-6">
                    <img
                      src={c.image_url}
                      alt={`Escudo ${c.ano}`}
                      className="max-h-full max-w-full object-contain drop-shadow-lg"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3 space-y-2">
                    {c.descricao && <p className="text-xs text-muted-foreground line-clamp-2">{c.descricao}</p>}
                    {canEdit && (
                      <div className="flex gap-1 pt-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2 flex-1" onClick={() => setEditing(c)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-destructive"
                          onClick={() => remove(c.id)}
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
            <DialogTitle>{editing?.id ? "Editar escudo" : "Novo escudo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Imagem</Label>
              <ImageUpload
                value={editing?.image_url}
                onChange={(url) => setEditing((p) => ({ ...p!, image_url: url }))}
                folder={`${clubId}/historico`}
                bucket="crests"
              />
            </div>
            <div>
              <Label>Ano</Label>
              <Input
                type="number"
                value={editing?.ano ?? ""}
                onChange={(e) => setEditing((p) => ({ ...p!, ano: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={editing?.descricao ?? ""}
                onChange={(e) => setEditing((p) => ({ ...p!, descricao: e.target.value }))}
                rows={2}
                placeholder="Mudança de identidade visual, comemorativo..."
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
