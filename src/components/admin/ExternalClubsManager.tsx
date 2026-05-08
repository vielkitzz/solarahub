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
import { Plus, Pencil, Trash2, Send, FileJson, Upload } from "lucide-react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";

type Region = "america_sul" | "america_norte_central" | "europa" | "asia" | "africa" | "oceania";
type Tier = "baixo" | "medio" | "alto" | "elite";

const REGION_LABELS: Record<Region, string> = {
  america_sul: "América do Sul",
  america_norte_central: "América do Norte/Central",
  europa: "Europa",
  asia: "Ásia",
  africa: "África",
  oceania: "Oceania",
};

type Row = {
  id?: string;
  name: string;
  country: string | null;
  region: Region;
  budget_tier: Tier;
  prestige: number;
  active: boolean;
  crest: string | null;
};

const empty: Row = {
  name: "",
  country: "",
  region: "europa",
  budget_tier: "medio",
  prestige: 5,
  active: true,
  crest: null,
};

export const ExternalClubsManager = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row | null>(null);
  const [generating, setGenerating] = useState(false);
  const [importPreview, setImportPreview] = useState<Row[] | null>(null);
  const [importing, setImporting] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("external_clubs").select("*").order("name");
    setRows((data as any) || []);
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!editing) return;
    const payload: any = { ...editing };
    delete payload.id;
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

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const arr = JSON.parse(String(reader.result));
        if (!Array.isArray(arr)) throw new Error("Esperado array");
        const validRegions: Region[] = ["america_sul", "america_norte_central", "europa", "asia", "africa", "oceania"];
        const validTiers: Tier[] = ["baixo", "medio", "alto", "elite"];
        const parsed: Row[] = arr.map((r: any) => ({
          name: String(r.name),
          country: r.country ?? null,
          region: validRegions.includes(r.region) ? r.region : "europa",
          budget_tier: validTiers.includes(r.budget_tier) ? r.budget_tier : "medio",
          prestige: Math.min(10, Math.max(1, Number(r.prestige ?? 5))),
          active: r.active !== false,
          crest: r.crest ?? null,
        }));
        setImportPreview(parsed);
      } catch (err: any) {
        toast.error("JSON inválido: " + err.message);
      }
    };
    reader.readAsText(f);
    e.target.value = "";
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    setImporting(true);
    const { error } = await supabase.from("external_clubs").insert(importPreview as any);
    setImporting(false);
    if (error) return toast.error(error.message);
    toast.success(`${importPreview.length} clubes importados`);
    setImportPreview(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <h3 className="font-semibold">Clubes Externos ({rows.length})</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={gerarPropostas} disabled={generating}>
            <Send className="h-4 w-4 mr-1" /> Gerar propostas da janela
          </Button>
          <label className="cursor-pointer">
            <input type="file" accept=".json" hidden onChange={onFile} />
            <span className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-border hover:bg-secondary">
              <FileJson className="h-4 w-4" /> Importar JSON
            </span>
          </label>
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
              <TableHead>País</TableHead>
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
                <TableCell className="text-xs text-muted-foreground">{r.country}</TableCell>
                <TableCell>{REGION_LABELS[r.region]}</TableCell>
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
                <Label>Região</Label>
                <Select value={editing.region} onValueChange={(v: Region) => setEditing({ ...editing, region: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(REGION_LABELS) as Region[]).map((k) => (
                      <SelectItem key={k} value={k}>{REGION_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tier de orçamento</Label>
                <Select value={editing.budget_tier} onValueChange={(v: Tier) => setEditing({ ...editing, budget_tier: v })}>
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

      <Dialog open={!!importPreview} onOpenChange={(o) => !o && setImportPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Prévia ({importPreview?.length ?? 0})</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead><TableHead>País</TableHead>
                  <TableHead>Região</TableHead><TableHead>Tier</TableHead><TableHead>Prest.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importPreview?.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.country}</TableCell>
                    <TableCell>{REGION_LABELS[r.region]}</TableCell>
                    <TableCell>{r.budget_tier}</TableCell>
                    <TableCell>{r.prestige}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportPreview(null)}>Cancelar</Button>
            <Button onClick={confirmImport} disabled={importing}>
              <Upload className="h-4 w-4 mr-2" /> Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
