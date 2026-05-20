import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Upload, FileJson } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";

type Row = {
  id?: string;
  name: string;
  position: string;
  age: number | null;
  nationality: string | null;
  overall: number;
  potential_min: number;
  potential_max: number;
  market_value: number;
  salary_demand: number;
  club_origin: string | null;
  league_origin: string | null;
  temporada: number | null;
};

type ExternalClub = { id: string; name: string; crest: string | null; country: string | null };

const empty: Row = {
  name: "",
  position: "ATA",
  age: 25,
  nationality: "",
  overall: 75,
  potential_min: 75,
  potential_max: 85,
  market_value: 0,
  salary_demand: 0,
  club_origin: "",
  league_origin: null,
  temporada: new Date().getFullYear(),
};

export const ForeignPlayersManager = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [externalClubs, setExternalClubs] = useState<ExternalClub[]>([]);
  const [editing, setEditing] = useState<Row | null>(null);
  const [importPreview, setImportPreview] = useState<Row[] | null>(null);
  const [importing, setImporting] = useState(false);

  const load = async () => {
    const [{ data }, { data: ec }] = await Promise.all([
      supabase.from("foreign_market_players").select("*").order("overall", { ascending: false }),
      supabase.from("external_clubs").select("id, name, crest, country").eq("active", true).order("name"),
    ]);
    setRows((data as any) || []);
    setExternalClubs((ec as any) || []);
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!editing) return;
    const payload = { ...editing };
    delete (payload as any).id;

    // Adicionamos "as any" no payload para ignorar a trava do TS do Supabase
    const { error } = editing.id
      ? await supabase
          .from("foreign_market_players")
          .update(payload as any)
          .eq("id", editing.id)
      : await supabase.from("foreign_market_players").insert(payload as any);

    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover jogador?")) return;
    const { error } = await supabase.from("foreign_market_players").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const arr = JSON.parse(String(reader.result));
        if (!Array.isArray(arr)) throw new Error("Esperado array");
        const parsed: Row[] = arr.map((r: any) => ({
          name: String(r.name),
          position: String(r.position || "ATA").toUpperCase(),
          age: r.age != null ? Number(r.age) : null,
          nationality: r.nationality || null,
          overall: Number(r.overall || 70),
          // Novos campos mapeados aqui:
          potential_min: Number(r.potential_min || r.overall || 70),
          potential_max: Number(r.potential_max || r.overall || 80),
          market_value: Number(r.market_value || 0),
          salary_demand: Number(r.salary_demand || 0),
          club_origin: r.club_origin || null,
          league_origin: r.league_origin || null,
          temporada: r.temporada != null ? Number(r.temporada) : null,
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

    // Forçamos o tipo para ignorar a restrição de colunas inexistentes no database.types.ts
    const { error } = await supabase.from("foreign_market_players").insert(importPreview as any);

    setImporting(false);
    if (error) return toast.error(error.message);
    toast.success(`${importPreview.length} jogadores importados`);
    setImportPreview(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <h3 className="font-semibold">Jogadores Estrangeiros ({rows.length})</h3>
        <div className="flex gap-2">
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
              <TableHead>Nome</TableHead>
              <TableHead>Pos</TableHead>
              <TableHead>OVR</TableHead>
              <TableHead>Idade</TableHead>
              <TableHead>Nac.</TableHead>
              <TableHead>Clube/Liga</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Salário</TableHead>
              <TableHead>Temp.</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.position}</TableCell>
                <TableCell>{r.overall}</TableCell>
                <TableCell>{r.age ?? "-"}</TableCell>
                <TableCell>{r.nationality}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.club_origin}
                  {r.league_origin ? ` / ${r.league_origin}` : ""}
                </TableCell>
                <TableCell>{formatCurrency(r.market_value)}</TableCell>
                <TableCell>{formatCurrency(r.salary_demand)}</TableCell>
                <TableCell>{r.temporada}</TableCell>
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

      {/* Editor */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar" : "Novo"} jogador estrangeiro</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Posição</Label>
                <Input
                  value={editing.position}
                  onChange={(e) => setEditing({ ...editing, position: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <Label>Overall</Label>
                <Input
                  type="number"
                  value={editing.overall}
                  onChange={(e) => setEditing({ ...editing, overall: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Potencial Mín</Label>
                <Input
                  type="number"
                  value={editing.potential_min}
                  onChange={(e) => setEditing({ ...editing, potential_min: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Potencial Máx</Label>
                <Input
                  type="number"
                  value={editing.potential_max}
                  onChange={(e) => setEditing({ ...editing, potential_max: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Idade</Label>
                <Input
                  type="number"
                  value={editing.age ?? ""}
                  onChange={(e) => setEditing({ ...editing, age: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              <div>
                <Label>Nacionalidade</Label>
                <Input
                  value={editing.nationality ?? ""}
                  onChange={(e) => setEditing({ ...editing, nationality: e.target.value })}
                />
              </div>
              <div>
                <Label>Clube origem</Label>
                <Input
                  value={editing.club_origin ?? ""}
                  onChange={(e) => setEditing({ ...editing, club_origin: e.target.value })}
                />
              </div>
              <div>
                <Label>Liga origem</Label>
                <Input
                  value={editing.league_origin ?? ""}
                  onChange={(e) => setEditing({ ...editing, league_origin: e.target.value })}
                />
              </div>
              <div>
                <Label>Valor de mercado</Label>
                <Input
                  type="number"
                  value={editing.market_value}
                  onChange={(e) => setEditing({ ...editing, market_value: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Salário pedido</Label>
                <Input
                  type="number"
                  value={editing.salary_demand}
                  onChange={(e) => setEditing({ ...editing, salary_demand: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Temporada</Label>
                <Input
                  type="number"
                  value={editing.temporada ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, temporada: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview importação */}
      <Dialog open={!!importPreview} onOpenChange={(o) => !o && setImportPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Prévia da importação ({importPreview?.length ?? 0})</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Pos</TableHead>
                  <TableHead>OVR</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Salário</TableHead>
                  <TableHead>Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importPreview?.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.position}</TableCell>
                    <TableCell>{r.overall}</TableCell>
                    <TableCell>{formatCurrency(r.market_value)}</TableCell>
                    <TableCell>{formatCurrency(r.salary_demand)}</TableCell>
                    <TableCell className="text-xs">{r.club_origin}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportPreview(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmImport} disabled={importing}>
              <Upload className="h-4 w-4 mr-2" />
              Confirmar importação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
