import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";

type Row = {
  id?: string;
  name: string;
  country: string | null;
  league: string | null;
  region: "europeu" | "brasileiro" | "arabe";
  budget_tier: "baixo" | "medio" | "alto" | "elite";
  prestige: number;
  active: boolean;
  crest: string | null;
};

const empty: Row = {
  name: "",
  country: "",
  league: "",
  region: "europeu",
  budget_tier: "medio",
  prestige: 5,
  active: true,
  crest: null,
};

export const ExternalClubsManager = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("external_clubs").select("*").order("name");
    setRows((data as any) || []);
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!editing) return;
    const payload = { ...editing };
    delete (payload as any).id;
    const { error } = editing.id
      ? await supabase.from("external_clubs").update(payload).eq("id", editing.id)
      : await supabase.from("external_clubs").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover clube?")) return;
    const { error } = await supabase.from("external_clubs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const toggleActive = async (r: Row) => {
    const { error } = await supabase.from("external_clubs").update({ active: !r.active }).eq("id", r.id!);
    if (error) return toast.error(error.message);
    load();
  };

  const gerarPropostas = async () => {
    if (!confirm("Gerar propostas automáticas para todos os clubes ativos?")) return;
    setGenerating(true);
    const { data, error } = await supabase.rpc("gerar_propostas_externas");
    setGenerating(false);
    if (error) return toast.error(error.message);
    toast.success(`${data ?? 0} propostas geradas`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <h3 className="font-semibold">Clubes Externos ({rows.length})</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={gerarPropostas} disabled={generating}>
            <Send className="h-4 w-4 mr-1" /> Gerar propostas da janela
          </Button>
          <Button size="sm" onClick={() => setEditing({ ...empty })}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>País / Liga</TableHead>
              <TableHead>Região</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Prestígio</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  {r.crest && <img src={r.crest} alt={r.name} className="h-8 w-8 object-contain" />}
                </TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.country}
                  {r.league ? ` / ${r.league}` : ""}
                </TableCell>
                <TableCell>{r.region}</TableCell>
                <TableCell>{r.budget_tier}</TableCell>
                <TableCell>{r.prestige}</TableCell>
                <TableCell>
                  <Switch checked={r.active} onCheckedChange={() => toggleActive(r)} />
                </TableCell>
                <TableCell className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(r)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(r.id!)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar" : "Novo"} clube externo</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>País</Label>
                <Input value={editing.country ?? ""} onChange={(e) => setEditing({ ...editing, country: e.target.value })} />
              </div>
              <div>
                <Label>Liga</Label>
                <Input value={editing.league ?? ""} onChange={(e) => setEditing({ ...editing, league: e.target.value })} />
              </div>
              <div>
                <Label>Região</Label>
                <Select value={editing.region} onValueChange={(v: any) => setEditing({ ...editing, region: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="europeu">Europeu</SelectItem>
                    <SelectItem value="brasileiro">Brasileiro</SelectItem>
                    <SelectItem value="arabe">Árabe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tier de orçamento</Label>
                <Select value={editing.budget_tier} onValueChange={(v: any) => setEditing({ ...editing, budget_tier: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixo">Baixo</SelectItem>
                    <SelectItem value="medio">Médio</SelectItem>
                    <SelectItem value="alto">Alto</SelectItem>
                    <SelectItem value="elite">Elite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prestígio (1-10)</Label>
                <Input type="number" min={1} max={10} value={editing.prestige}
                  onChange={(e) => setEditing({ ...editing, prestige: Math.min(10, Math.max(1, Number(e.target.value))) })} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                <Label>Ativo</Label>
              </div>
              <div className="col-span-2">
                <Label>Escudo</Label>
                <ImageUpload value={editing.crest ?? ""} onChange={(url) => setEditing({ ...editing, crest: url })} bucket="crests" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
