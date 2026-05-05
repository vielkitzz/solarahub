import { useEffect, useMemo, useRef, useState, DragEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy, Upload, FileJson, Plus, Trash2, Check, X, Save } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";

const TORNEIOS = [
  { slug: "mundial_clubes_fifa", label: "Mundial de Clubes FIFA" },
  { slug: "mundial_intercontinental", label: "Mundial Intercontinental" },
  { slug: "libertadores", label: "Libertadores" },
  { slug: "recopa_sul_americana", label: "Recopa Sul-Americana" },
  { slug: "sul_americana", label: "Sul-Americana" },
  { slug: "superliga_solara", label: "Superliga Solara" },
  { slug: "liga_nacional", label: "Liga Nacional" },
  { slug: "copa_nacional", label: "Copa Nacional" },
  { slug: "supercopa_solara", label: "Supercopa Solara" },
] as const;

type TorneioSlug = (typeof TORNEIOS)[number]["slug"];

interface ParsedRow {
  clube_nome: string;
  fase: string | null;
  posicao: number | null;
}

interface PreviewRow extends ParsedRow {
  match_id: string | null;
  match_name: string | null;
}

interface PremioRow {
  id?: string;
  torneio: string;
  fase: string;
  valor: number;
  _new?: boolean;
  _dirty?: boolean;
}

const norm = (s: string) => s.trim().toLowerCase();

export const CampanhasManager = () => {
  const [clubs, setClubs] = useState<{ id: string; name: string }[]>([]);

  // Importação
  const [torneio, setTorneio] = useState<TorneioSlug>("superliga_solara");
  const [temporada, setTemporada] = useState<number>(new Date().getFullYear());
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Premiações
  const [premios, setPremios] = useState<PremioRow[]>([]);
  const [filtroTorneio, setFiltroTorneio] = useState<string>("all");
  const [savingAll, setSavingAll] = useState(false);

  const loadClubs = async () => {
    const { data } = await supabase.from("clubs").select("id, name").order("name");
    setClubs(data || []);
  };

  const loadPremios = async () => {
    const { data } = await supabase
      .from("premiacoes_torneio")
      .select("*")
      .order("torneio")
      .order("fase");
    setPremios((data || []).map((p: any) => ({ ...p })));
  };

  useEffect(() => {
    loadClubs();
    loadPremios();
  }, []);

  // Map para matching
  const clubByNorm = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    clubs.forEach((c) => m.set(norm(c.name), c));
    return m;
  }, [clubs]);

  const buildPreview = (rows: ParsedRow[]): PreviewRow[] =>
    rows.map((r) => {
      const found = clubByNorm.get(norm(r.clube_nome));
      return {
        ...r,
        match_id: found?.id ?? null,
        match_name: found?.name ?? null,
      };
    });

  const parseFile = async (file: File) => {
    if (!file.name.endsWith(".json")) {
      toast.error("Envie um arquivo .json");
      return;
    }
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // Aceita formato do Tournament Manager 2 ({ resultados: [...] }) ou array direto
      const arr: any[] = Array.isArray(json) ? json : json.resultados || json.results || [];
      if (!Array.isArray(arr) || arr.length === 0) {
        toast.error("Arquivo não contém 'resultados'");
        return;
      }

      const rows: ParsedRow[] = arr.map((r) => ({
        clube_nome: String(r.clube ?? r.clube_nome ?? r.club ?? "").trim(),
        fase: r.fase ?? r.phase ?? null,
        posicao: r.posicao != null ? Number(r.posicao) : r.position != null ? Number(r.position) : null,
      })).filter((r) => r.clube_nome);

      // Auto-detecta temporada do JSON se vier
      if (json.temporada) setTemporada(Number(json.temporada));

      setFileName(file.name);
      setPreview(buildPreview(rows));
      toast.success(`${rows.length} resultados carregados`);
    } catch (e: any) {
      toast.error("JSON inválido: " + e.message);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) parseFile(f);
  };

  const confirmImport = async () => {
    if (!preview || preview.length === 0) return;
    setImporting(true);

    const rows = preview.map((p) => ({
      temporada,
      torneio,
      fase: p.fase,
      clube_nome: p.clube_nome,
      clube_id: p.match_id,
      posicao: p.posicao,
    }));

    const { error } = await supabase
      .from("resultados_temporada")
      .upsert(rows, { onConflict: "temporada,torneio,clube_nome" });

    setImporting(false);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} resultados importados`);
    setPreview(null);
    setFileName("");
  };

  // Premiações
  const addPremio = () => {
    setPremios((prev) => [
      ...prev,
      { torneio: filtroTorneio !== "all" ? filtroTorneio : "superliga_solara", fase: "", valor: 0, _new: true, _dirty: true },
    ]);
  };

  const updatePremio = (idx: number, patch: Partial<PremioRow>) => {
    setPremios((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch, _dirty: true };
      return next;
    });
  };

  const removePremio = async (idx: number) => {
    const p = premios[idx];
    if (p.id) {
      if (!confirm(`Remover premiação ${p.torneio} / ${p.fase}?`)) return;
      const { error } = await supabase.from("premiacoes_torneio").delete().eq("id", p.id);
      if (error) return toast.error(error.message);
    }
    setPremios((prev) => prev.filter((_, i) => i !== idx));
    toast.success("Linha removida");
  };

  const saveAllPremios = async () => {
    const dirty = premios.filter((p) => p._dirty && p.torneio && p.fase);
    if (dirty.length === 0) return toast.info("Nada para salvar");
    setSavingAll(true);

    const payload = dirty.map(({ _new, _dirty, ...rest }) => ({
      ...(rest.id ? { id: rest.id } : {}),
      torneio: rest.torneio,
      fase: rest.fase,
      valor: Number(rest.valor) || 0,
    }));

    const { error } = await supabase
      .from("premiacoes_torneio")
      .upsert(payload, { onConflict: "torneio,fase" });

    setSavingAll(false);
    if (error) return toast.error(error.message);
    toast.success(`${payload.length} premiações salvas`);
    loadPremios();
  };

  const premiosFiltrados = useMemo(
    () => premios.filter((p) => filtroTorneio === "all" || p.torneio === filtroTorneio),
    [premios, filtroTorneio],
  );

  const matchedCount = preview?.filter((p) => p.match_id).length ?? 0;
  const unmatchedCount = preview ? preview.length - matchedCount : 0;

  return (
    <div className="space-y-8">
      {/* SEÇÃO 1 — Importar Resultados */}
      <Card className="p-5 bg-gradient-card border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-5 w-5 text-primary" />
          <h3 className="font-display font-bold text-lg">Importar Resultados</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div>
            <Label>Torneio</Label>
            <Select value={torneio} onValueChange={(v) => setTorneio(v as TorneioSlug)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TORNEIOS.map((t) => (
                  <SelectItem key={t.slug} value={t.slug}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Temporada</Label>
            <Input
              type="number"
              value={temporada}
              onChange={(e) => setTemporada(parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" /> Selecionar arquivo
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) parseFile(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border/60"
          }`}
        >
          <FileJson className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {fileName ? (
              <>Arquivo: <span className="text-foreground font-medium">{fileName}</span></>
            ) : (
              <>Arraste o .json exportado pelo Tournament Manager 2 aqui</>
            )}
          </p>
        </div>

        {preview && (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm flex gap-3">
                <span className="text-emerald-400">✓ {matchedCount} encontrados</span>
                {unmatchedCount > 0 && (
                  <span className="text-destructive">✗ {unmatchedCount} não encontrados</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => { setPreview(null); setFileName(""); }}>
                  Cancelar
                </Button>
                <Button
                  onClick={confirmImport}
                  disabled={importing}
                  className="bg-gradient-gold text-primary-foreground"
                >
                  <Check className="h-4 w-4 mr-2" />
                  {importing ? "Importando..." : "Confirmar importação"}
                </Button>
              </div>
            </div>

            <div className="border border-border/50 rounded-md max-h-[400px] overflow-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clube (JSON)</TableHead>
                    <TableHead>Fase</TableHead>
                    <TableHead className="text-center">Posição</TableHead>
                    <TableHead>Match</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.clube_nome}</TableCell>
                      <TableCell className="text-muted-foreground">{row.fase || "—"}</TableCell>
                      <TableCell className="text-center">{row.posicao ?? "—"}</TableCell>
                      <TableCell>
                        {row.match_id ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-400 text-xs">
                            <Check className="h-3.5 w-3.5" /> {row.match_name}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-destructive text-xs">
                            <X className="h-3.5 w-3.5" /> não encontrado
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </Card>

      {/* SEÇÃO 2 — Configurar Prêmios */}
      <Card className="p-5 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <h3 className="font-display font-bold text-lg">Configurar Prêmios</h3>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={filtroTorneio} onValueChange={setFiltroTorneio}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os torneios</SelectItem>
                {TORNEIOS.map((t) => (
                  <SelectItem key={t.slug} value={t.slug}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={addPremio}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar
            </Button>
            <Button
              onClick={saveAllPremios}
              disabled={savingAll}
              className="bg-gradient-gold text-primary-foreground"
            >
              <Save className="h-4 w-4 mr-2" />
              {savingAll ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>

        <div className="border border-border/50 rounded-md overflow-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[260px]">Torneio</TableHead>
                <TableHead>Fase / Posição</TableHead>
                <TableHead>Valor (R$)</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {premiosFiltrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Nenhuma premiação configurada
                  </TableCell>
                </TableRow>
              )}
              {premiosFiltrados.map((p) => {
                const idx = premios.indexOf(p);
                return (
                  <TableRow key={p.id ?? `new-${idx}`}>
                    <TableCell>
                      <Select
                        value={p.torneio}
                        onValueChange={(v) => updatePremio(idx, { torneio: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TORNEIOS.map((t) => (
                            <SelectItem key={t.slug} value={t.slug}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Ex: Campeão, Final, Oitavas, 1, 2-4..."
                        value={p.fase}
                        onChange={(e) => updatePremio(idx, { fase: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={p.valor}
                          onChange={(e) => updatePremio(idx, { valor: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[110px]">
                          {formatCurrency(p.valor)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => removePremio(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};
