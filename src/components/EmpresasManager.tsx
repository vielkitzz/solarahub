import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ImageUpload } from "@/components/ImageUpload";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Building2, Download } from "lucide-react";
import { KIT_SUPPLIERS, SPONSORS, getBrandLogoUrl } from "@/lib/brands";

const CATEGORIAS = [
  { value: "fornecedora", label: "Fornecedora (material)" },
  { value: "master", label: "Patrocínio Máster" },
  { value: "secundario_central", label: "Secundário central" },
  { value: "omoplata", label: "Omoplata" },
  { value: "barra_frontal", label: "Barra frontal" },
  { value: "barra_traseira", label: "Barra traseira" },
  { value: "costas_superior", label: "Costas superior" },
  { value: "manga", label: "Manga" },
  { value: "lateral", label: "Lateral" },
];

const empty = {
  id: "",
  nome: "",
  categoria: "master",
  valor_anual_sugerido: 0,
  logo_url: "",
  exigencias: "",
  ativa: true,
};

export const EmpresasManager = () => {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(empty);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("empresas").select("*").order("nome");
    if (error) toast.error(error.message);
    setEmpresas(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(empty);
    setOpen(true);
  };

  const openEdit = (e: any) => {
    setEditing(e);
    setOpen(true);
  };

  const save = async () => {
    if (!editing.nome.trim()) return toast.error("Nome obrigatório");
    const payload = {
      nome: editing.nome.trim(),
      categoria: editing.categoria,
      valor_anual_sugerido: Number(editing.valor_anual_sugerido) || 0,
      logo_url: editing.logo_url || null,
      exigencias: editing.exigencias || null,
      ativa: !!editing.ativa,
    };
    const { error } = editing.id
      ? await supabase.from("empresas").update(payload).eq("id", editing.id)
      : await supabase.from("empresas").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "Empresa atualizada" : "Empresa criada");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir essa empresa?")) return;
    const { error } = await supabase.from("empresas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Empresa excluída");
    load();
  };

  // Importar todas as marcas do brands.ts (KIT_SUPPLIERS + SPONSORS) para o banco
  const [importing, setImporting] = useState(false);
  const importBrands = async () => {
    if (!confirm(`Importar ${KIT_SUPPLIERS.length + SPONSORS.length} marcas do catálogo brands.ts? Duplicatas (mesmo nome) serão ignoradas.`)) return;
    setImporting(true);
    try {
      const existingNames = new Set(empresas.map((e) => e.nome.toLowerCase()));

      const fromKit = KIT_SUPPLIERS
        .filter((b) => !existingNames.has(b.name.toLowerCase()))
        .map((b) => ({
          nome: b.name,
          categoria: "fornecedora" as const,
          valor_anual_sugerido: Math.round(8_000_000 * (b.prestige ?? 1)),
          logo_url: getBrandLogoUrl(b.domain),
          exigencias: `Marca ${b.setor} (prestígio ${b.prestige ?? 1})`,
          ativa: true,
        }));

      const fromSponsors = SPONSORS
        .filter((b) => !existingNames.has(b.name.toLowerCase()))
        .map((b) => ({
          nome: b.name,
          categoria: "master" as const,
          valor_anual_sugerido: Math.round(5_000_000 * (b.prestige ?? 1)),
          logo_url: getBrandLogoUrl(b.domain),
          exigencias: `Marca ${b.setor} (prestígio ${b.prestige ?? 1})`,
          ativa: true,
        }));

      const rows = [...fromKit, ...fromSponsors];
      if (rows.length === 0) {
        toast.info("Todas as marcas do catálogo já existem no banco.");
        return;
      }
      const { error } = await supabase.from("empresas").insert(rows);
      if (error) return toast.error(error.message);
      toast.success(`${rows.length} marcas importadas!`);
      load();
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card className="p-5 bg-gradient-card border-border/50 space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h3 className="font-display font-bold flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" /> Empresas patrocinadoras
        </h3>
        <div className="flex gap-2">
          <Button onClick={importBrands} disabled={importing} variant="outline" className="border-primary/40 text-primary hover:bg-primary/10">
            <Download className="h-4 w-4" /> {importing ? "Importando..." : `Importar catálogo (${KIT_SUPPLIERS.length + SPONSORS.length})`}
          </Button>
          <Button onClick={openNew} className="bg-gradient-gold text-primary-foreground">
            <Plus className="h-4 w-4" /> Nova empresa
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : empresas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma empresa cadastrada.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead className="w-12"></TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Valor sugerido/ano</TableHead>
              <TableHead className="w-20 text-center">Ativa</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {empresas.map((e) => (
              <TableRow key={e.id} className="border-border/50">
                <TableCell>
                  {e.logo_url ? (
                    <img src={e.logo_url} alt={e.nome} className="h-7 w-7 object-contain rounded" />
                  ) : (
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell className="font-bold">{e.nome}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {CATEGORIAS.find((c) => c.value === e.categoria)?.label || e.categoria}
                </TableCell>
                <TableCell className="text-right font-mono text-primary">
                  {formatCurrency(Number(e.valor_anual_sugerido))}
                </TableCell>
                <TableCell className="text-center">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${e.ativa ? "bg-success" : "bg-muted-foreground"}`}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(e)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(e.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Editar empresa" : "Nova empresa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={editing.categoria} onValueChange={(v) => setEditing({ ...editing, categoria: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor anual sugerido (R$)</Label>
              <Input
                type="number"
                value={editing.valor_anual_sugerido}
                onChange={(e) => setEditing({ ...editing, valor_anual_sugerido: e.target.value })}
              />
            </div>
            <div>
              <Label>Logo</Label>
              <ImageUpload
                value={editing.logo_url}
                onChange={(url) => setEditing({ ...editing, logo_url: url })}
                folder="empresas"
                bucket="empresas-logos"
              />
            </div>
            <div>
              <Label>Exigências (opcional)</Label>
              <Textarea
                rows={3}
                value={editing.exigencias || ""}
                onChange={(e) => setEditing({ ...editing, exigencias: e.target.value })}
                placeholder="Ex: clube com reputação nacional ou superior"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={!!editing.ativa}
                onCheckedChange={(v) => setEditing({ ...editing, ativa: v })}
              />
              <Label className="!m-0">Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} className="bg-gradient-gold text-primary-foreground">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
