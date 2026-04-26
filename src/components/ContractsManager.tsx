import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Building2, Handshake, Plus, Trash2, Tv, Camera, AlertTriangle, Search } from "lucide-react";
import { formatCurrency } from "@/lib/format";

// IMPORTANDO O CATÁLOGO DO BRANDS.TS
import { KIT_SUPPLIERS, SPONSORS, getBrandLogoUrl } from "@/lib/brands";

export type PatrocinioCategoria =
  | "fornecedora"
  | "master"
  | "secundario_central"
  | "omoplata"
  | "barra_frontal"
  | "barra_traseira"
  | "costas_superior"
  | "manga"
  | "lateral";

export const PATROCINIO_CATEGORIAS: Array<{
  value: PatrocinioCategoria;
  label: string;
  max: number;
  semExigencia?: boolean;
}> = [
  { value: "fornecedora", label: "Fornecedora", max: 1, semExigencia: true },
  { value: "master", label: "Máster", max: 1 },
  { value: "secundario_central", label: "Secundário central", max: 1 },
  { value: "omoplata", label: "Omoplata", max: 2 },
  { value: "barra_frontal", label: "Barra frontal", max: 2 },
  { value: "barra_traseira", label: "Barra traseira", max: 2 },
  { value: "costas_superior", label: "Costas superior", max: 1 },
  { value: "manga", label: "Manga", max: 2 },
  { value: "lateral", label: "Lateral", max: 1 },
];

interface Contrato {
  id: string;
  club_id: string;
  empresa_id: string | null;
  categoria: string;
  valor_anual: number;
  inicio_temporada: number | null;
  fim_temporada: number | null;
  anos_duracao: number;
  multa_rescisao: number;
  ativo: boolean;
  empresa?: { id: string; nome: string; logo_url: string | null; exigencias: string | null };
}

// Interface adaptada para uso interno dinâmico
interface Empresa {
  id: string;
  nome: string;
  logo_url: string | null;
  categoria: PatrocinioCategoria;
  valor_anual_sugerido: number;
  exigencias: string | null;
  setor: string | null;
  ativa: boolean;
}

interface Props {
  clubId: string;
  canEdit: boolean;
  reputacao?: string | null;
  valorBaseFolha?: number;
  rate?: number;
  onChange?: () => void;
}

export function ContractsManager({ clubId, canEdit, reputacao, valorBaseFolha = 0, rate, onChange }: Props) {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [temporadaAtual, setTemporadaAtual] = useState<number>(2020);
  const [loading, setLoading] = useState(true);
  const [searchCategoria, setSearchCategoria] = useState<PatrocinioCategoria | null>(null);
  const [duracao, setDuracao] = useState("3");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [empresaParaConfirmar, setEmpresaParaConfirmar] = useState<Empresa | null>(null);

  const [logoApiKey, setLogoApiKey] = useState("");
  const [searchTerm, setSearchTerm] = useState(""); // Estado do buscador
  const [sortOrder, setSortOrder] = useState<"valor" | "az">("valor");

  const load = async () => {
    setLoading(true);
    // Busca contratos ativos e configurações (temporada e chave da API)
    const [{ data: c, error: contratosError }, { data: settings, error: settingsError }] = await Promise.all([
      supabase
        .from("contratos_clube")
        .select("*, empresa:empresas(id, nome, logo_url, exigencias)")
        .eq("club_id", clubId)
        .eq("ativo", true)
        .order("created_at", { ascending: false }),
      supabase.from("settings").select("key, value").in("key", ["temporada_atual", "logo_dev_key"]),
    ]);

    if (contratosError) {
      console.error("Erro ao carregar contratos:", contratosError);
    } else {
      setContratos((c as any) || []);
    }

    settings?.forEach((s) => {
      if (s.key === "temporada_atual") {
        const val = s.value as any;
        if (val?.ano) setTemporadaAtual(Number(val.ano));
      }
      if (s.key === "logo_dev_key") {
        const val = s.value as any;
        setLogoApiKey(typeof val === "string" ? val : val?.token || val?.key || "");
      }
    });

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [clubId]);

  const contratosPorCategoria = useMemo(() => {
    const map: Record<string, Contrato[]> = {};
    contratos.forEach((c) => {
      if (!map[c.categoria]) map[c.categoria] = [];
      map[c.categoria].push(c);
    });
    return map;
  }, [contratos]);

  // FÓRMULA DE CÁLCULO DE PATROCÍNIOS
  const empresasDaCategoria = (cat: PatrocinioCategoria): Empresa[] => {
    const isFornecedora = cat === "fornecedora";
    const baseBrands = isFornecedora ? KIT_SUPPLIERS : SPONSORS;

    // 1. VALOR BASE PELO RATE DO CLUBE (0.01 – 8.00)
    const clubRate = rate || 1.0;
    const valorBaseRate = Math.pow(clubRate, 2) * 250000 + 500000;

    // 2. MULTIPLICADOR DE REPUTAÇÃO DO CLUBE
    const getMultRep = (rep: string | null | undefined) => {
      switch (rep?.toLowerCase()) {
        case "local":
          return 0.5;
        case "estadual":
          return 0.8;
        case "nacional":
          return 1.0;
        case "continental":
          return 1.35;
        case "mundial":
          return 1.75;
        default:
          return 0.7;
      }
    };
    const multRep = getMultRep(reputacao);

    // 3. MULTIPLICADOR DE SETOR DA EMPRESA
    const getMultiplicadorSetor = (setor?: string) => {
      switch (setor) {
        case "Casa de Apostas":
          return 2.5;
        case "Banco":
        case "Finanças":
          return 2.0;
        case "Tecnologia":
        case "Multinacional":
          return 1.8;
        case "Companhias Aéreas":
          return 1.6;
        case "Automóveis":
          return 1.5;
        case "Telecomunicações":
          return 1.5;
        case "Energia":
          return 1.4;
        case "Serviços":
        case "Seguros":
          return 1.2;
        case "Alimentação":
        case "Varejista":
          return 1.0;
        default:
          return 1.1;
      }
    };

    // 4. PRESTÍGIO INDIVIDUAL DA MARCA (0.6 – 2.0)
    // Usa o campo `prestige` do brands.ts se definido; caso contrário, hash do nome como fallback
    const getPrestígio = (nome: string, prestige?: number) => {
      if (prestige !== undefined) return Math.min(2.0, Math.max(0.6, prestige));
      let h = 0;
      for (const c of nome) h = (h * 31 + c.charCodeAt(0)) % 10000;
      return 0.6 + (h / 10000) * 1.4;
    };

    // 5. DESCRIÇÃO CONTEXTUALIZADA POR SETOR
    const getDescricaoSetor = (setor?: string, rateExigido?: string) => {
      const rateText = `Rate mínimo exigido: ${rateExigido}`;
      switch (setor) {
        case "Casa de Apostas":
          return `Patrocinador de alto investimento no futebol. Busca visibilidade máxima e associação com clubes competitivos. ${rateText}.`;
        case "Banco":
        case "Finanças":
          return `Instituição financeira que valoriza imagem de solidez e prestígio. Prefere clubes com boa reputação e estabilidade. ${rateText}.`;
        case "Tecnologia":
        case "Multinacional":
          return `Empresa global focada em inovação e alcance de audiência jovem. Exige clubes com presença expressiva no mercado. ${rateText}.`;
        case "Automóveis":
          return `Montadora ou revendedora que usa o futebol para projetar sofisticação e performance da marca. ${rateText}.`;
        case "Energia":
          return `Empresa do setor energético que aposta no esporte como vetor de reconhecimento de marca em larga escala. ${rateText}.`;
        case "Serviços":
          return `Empresa de serviços que busca fidelização de clientes por meio da associação com o futebol. ${rateText}.`;
        case "Seguros":
          return `Seguradora que utiliza o patrocínio esportivo para transmitir confiança e proteção ao consumidor. ${rateText}.`;
        case "Alimentação":
          return `Marca do setor alimentício com foco em popularidade e alcance do público geral. ${rateText}.`;
        case "Varejista":
          return `Rede varejista que aposta no futebol para reforçar presença regional e nacional. ${rateText}.`;
        case "Companhias Aéreas":
          return `Companhia aérea que usa o patrocínio para destacar mobilidade, prestígio e cobertura internacional. ${rateText}.`;
        case "Telecomunicações":
          return `Operadora ou empresa de telecom que alia tecnologia e esporte para ampliar reconhecimento de marca. ${rateText}.`;
        default:
          return `Empresa interessada em visibilidade esportiva e expansão de mercado. ${rateText}.`;
      }
    };

    // 6. MULTIPLICADOR DE POSIÇÃO NA CAMISA
    let multCamisa = 1;
    if (cat === "master") multCamisa = 5.0;
    else if (cat === "secundario_central" || cat === "costas_superior") multCamisa = 2.5;
    else if (cat === "omoplata" || cat === "manga") multCamisa = 1.8;
    else if (cat === "lateral" || cat === "barra_frontal" || cat === "barra_traseira") multCamisa = 1.2;

    // Rate exigido (meio ponto abaixo do atual)
    const rateExigido = Math.max(0.1, clubRate - 0.5).toFixed(2);

    return baseBrands.map((b) => {
      const multSetor = isFornecedora ? 1.5 : getMultiplicadorSetor(b.setor);
      const prestígio = getPrestígio(b.name, (b as any).prestige);

      // CÁLCULO FINAL: rate × reputação × setor × posição × prestígio da marca
      const valorFinal = valorBaseRate * multRep * multSetor * multCamisa * prestígio;

      return {
        id: b.name,
        nome: b.name,
        logo_url: getBrandLogoUrl(b.domain, logoApiKey),
        categoria: cat,
        valor_anual_sugerido: Math.round(valorFinal),
        exigencias: isFornecedora ? null : getDescricaoSetor(b.setor, rateExigido),
        setor: b.setor || null,
        ativa: true,
      };
    });
  };

  const totalPatrocinios = contratos.reduce((s, c) => s + Number(c.valor_anual || 0), 0);

  const calcTVBase = (rep: string | null | undefined) => {
    switch (rep?.toLowerCase()) {
      case "estadual":
        return 1500000;
      case "nacional":
        return 4000000;
      case "continental":
        return 8000000;
      case "mundial":
        return 12000000;
      default:
        return 0;
    }
  };
  const tvBase = calcTVBase(reputacao);

  const direitosImagemCusto = valorBaseFolha * 0.03;
  const direitosImagemReceita = direitosImagemCusto * 0.5;

  const firmar = async (empresa: Empresa) => {
    if (!searchCategoria) {
      toast.error("Categoria não selecionada");
      return;
    }

    setIsSubmitting(true);
    const anos = Math.max(1, Math.min(10, parseInt(duracao) || 3));
    const fim = temporadaAtual + anos;
    // Valor anual efetivo com depreciação de 5% por ano adicional
    const valorAnualEfetivo = Math.round(Number(empresa.valor_anual_sugerido) * Math.pow(0.95, anos - 1));

    // 1. Garante que a marca existe na tabela empresas do banco
    let dbEmpresaId = "";
    const { data: ext, error: extError } = await supabase
      .from("empresas")
      .select("id")
      .eq("nome", empresa.nome)
      .maybeSingle();

    if (extError) {
      toast.error("Erro ao verificar empresa: " + extError.message);
      setIsSubmitting(false);
      return;
    }

    if (ext) {
      dbEmpresaId = ext.id;
    } else {
      // Cria a empresa no banco passando todos os campos obrigatórios
      const { data: newEmp, error: errEmp } = await supabase
        .from("empresas")
        .insert({
          nome: empresa.nome,
          logo_url: empresa.logo_url,
          ativa: true,
          categoria: empresa.categoria,
          valor_anual_sugerido: empresa.valor_anual_sugerido,
          exigencias: empresa.exigencias,
        })
        .select("id")
        .single();

      if (errEmp) {
        toast.error("Erro ao registar empresa no banco: " + errEmp.message);
        setIsSubmitting(false);
        return;
      }
      dbEmpresaId = newEmp.id;
    }

    // 2. Insere o contrato vinculado
    const { error } = await supabase.from("contratos_clube").insert({
      club_id: clubId,
      empresa_id: dbEmpresaId,
      categoria: searchCategoria,
      valor_anual: valorAnualEfetivo || 0,
      inicio_temporada: temporadaAtual,
      fim_temporada: fim,
      anos_duracao: anos,
      ativo: true,
    });

    setIsSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Contrato firmado com ${empresa.nome}!`);
    setEmpresaParaConfirmar(null);
    setSearchCategoria(null);
    setSearchTerm("");
    setDuracao("3");
    await load();
    onChange?.();
  };

  const rescindir = async (c: Contrato) => {
    const multa = Number(c.multa_rescisao || c.valor_anual * 0.7);
    if (
      !confirm(`Rescindir contrato com ${c.empresa?.nome}? Multa de ${formatCurrency(multa)} será debitada do caixa.`)
    )
      return;

    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select("budget")
      .eq("id", clubId)
      .maybeSingle();

    if (clubError || !club) {
      toast.error("Clube não encontrado");
      return;
    }

    if (Number(club.budget) < multa) {
      toast.error("Caixa insuficiente para pagar a multa");
      return;
    }

    const { error: e1 } = await supabase
      .from("clubs")
      .update({ budget: Number(club.budget) - multa })
      .eq("id", clubId);

    if (e1) {
      toast.error(e1.message);
      return;
    }

    const { error: e2 } = await supabase.from("contratos_clube").update({ ativo: false }).eq("id", c.id);

    if (e2) {
      toast.error(e2.message);
      return;
    }

    toast.success("Contrato rescindido");
    await load();
    onChange?.();
  };

  if (loading) {
    return <Card className="p-6 bg-gradient-card border-border/50 text-muted-foreground">A carregar contratos...</Card>;
  }

  return (
    <div className="space-y-6">
      {/* SEÇÃO 1: PATROCÍNIOS */}
      <Card className="p-5 bg-gradient-card border-border/50 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display font-bold flex items-center gap-2">
            <Handshake className="h-4 w-4 text-primary" /> Patrocínios
          </h3>
          <Badge variant="outline" className="border-primary/40 text-primary">
            Total: {formatCurrency(totalPatrocinios)} / ano
          </Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {PATROCINIO_CATEGORIAS.map((cat) => {
            const ativos = contratosPorCategoria[cat.value] || [];
            const cheio = ativos.length >= cat.max;
            return (
              <div key={cat.value} className="rounded-lg border border-border/50 bg-card/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-display font-bold">{cat.label}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {ativos.length} / {cat.max} {cat.semExigencia && "· sem exigências"}
                    </div>
                  </div>
                  {canEdit && !cheio && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-primary/40 text-primary h-7"
                      onClick={() => setSearchCategoria(cat.value)}
                    >
                      <Plus className="h-3 w-3" /> Buscar
                    </Button>
                  )}
                </div>
                {ativos.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic">Nenhum contrato ativo</div>
                ) : (
                  <div className="space-y-1.5">
                    {ativos.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 bg-background/40 rounded p-2">
                        <div className="h-7 w-7 rounded overflow-hidden shrink-0">
                          {c.empresa?.logo_url ? (
                            <img
                              src={c.empresa.logo_url}
                              alt={c.empresa.nome}
                              className="h-full w-full object-contain p-0.5"
                            />
                          ) : (
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold truncate">{c.empresa?.nome || "—"}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {formatCurrency(Number(c.valor_anual))}/ano · até {c.fim_temporada || "—"}
                          </div>
                        </div>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => rescindir(c)}
                            title={`Rescindir (multa ${formatCurrency(Number(c.multa_rescisao || c.valor_anual * 0.7))})`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* SEÇÃO 2: DIREITOS DE TRANSMISSÃO */}
      <Card className="p-5 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="font-display font-bold flex items-center gap-2">
            <Tv className="h-4 w-4 text-primary" /> Direitos de transmissão
          </h3>
          <Badge variant="outline" className="border-success/40 text-success capitalize">
            {reputacao || "—"}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground mb-2">Valor anual fixo baseado na reputação da sua equipa.</div>
        <div className="text-2xl font-display font-bold gold-text">
          {formatCurrency(tvBase)} <span className="text-sm font-normal text-muted-foreground">/ ano</span>
        </div>
      </Card>

      {/* SEÇÃO 3: DIREITOS DE IMAGEM */}
      <Card className="p-5 bg-gradient-card border-border/50">
        <h3 className="font-display font-bold flex items-center gap-2 mb-3">
          <Camera className="h-4 w-4 text-primary" /> Direitos de imagem
        </h3>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="bg-background/30 rounded p-3">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Custo</div>
            <div className="font-display font-bold text-destructive">{formatCurrency(direitosImagemCusto)}</div>
            <div className="text-[10px] text-muted-foreground">3% do Valor base do elenco</div>
          </div>
          <div className="bg-background/30 rounded p-3">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Receita</div>
            <div className="font-display font-bold text-success">{formatCurrency(direitosImagemReceita)}</div>
            <div className="text-[10px] text-muted-foreground">50% sobre os custos de imagem</div>
          </div>
        </div>
      </Card>

      {/* DIALOG: GALERIA DE EMPRESAS */}
      <Dialog
        open={!!searchCategoria}
        onOpenChange={(o) => {
          if (!o) {
            setSearchCategoria(null);
            setSearchTerm("");
            setSortOrder("valor");
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              Buscar contrato — {PATROCINIO_CATEGORIAS.find((c) => c.value === searchCategoria)?.label}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pb-2 shrink-0">
            {/* Buscador + Ordenação */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs mb-1 block">Pesquisar marca</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Digite o nome da empresa..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-secondary/20"
                  />
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  size="sm"
                  variant={sortOrder === "valor" ? "default" : "outline"}
                  className="h-9 text-xs"
                  onClick={() => setSortOrder("valor")}
                >
                  Maior valor
                </Button>
                <Button
                  size="sm"
                  variant={sortOrder === "az" ? "default" : "outline"}
                  className="h-9 text-xs"
                  onClick={() => setSortOrder("az")}
                >
                  A → Z
                </Button>
              </div>
            </div>
          </div>

          {/* Container com scroll para os cards */}
          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {searchCategoria &&
                empresasDaCategoria(searchCategoria)
                  .filter((e) => e.nome.toLowerCase().includes(searchTerm.toLowerCase()))
                  .sort((a, b) =>
                    sortOrder === "az" ? a.nome.localeCompare(b.nome) : b.valor_anual_sugerido - a.valor_anual_sugerido,
                  )
                  .map((e) => {
                    const semExig = PATROCINIO_CATEGORIAS.find((c) => c.value === searchCategoria)?.semExigencia;
                    return (
                      <Card key={e.id} className="p-3 bg-card/40 border-border/50 flex flex-col gap-2">
                        <div className="flex gap-2 items-start">
                          <div className="h-12 w-12 rounded overflow-hidden shrink-0 mt-0.5">
                            {e.logo_url ? (
                              <img src={e.logo_url} alt={e.nome} className="h-full w-full object-contain p-0" />
                            ) : (
                              <Building2 className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <div className="font-bold truncate">{e.nome}</div>
                              {e.setor && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] shrink-0 border-primary/30 text-primary/80 leading-tight"
                                >
                                  {e.setor}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-success font-display">
                              {formatCurrency(Number(e.valor_anual_sugerido))}/ano
                            </div>
                          </div>
                        </div>
                        {!semExig && e.exigencias && (
                          <div className="text-[11px] text-muted-foreground bg-background/40 rounded p-2 mt-1">
                            {e.exigencias}
                          </div>
                        )}
                        <Button
                          size="sm"
                          className="bg-gradient-gold text-primary-foreground hover:opacity-90 mt-auto"
                          onClick={() => {
                            setEmpresaParaConfirmar(e);
                            setDuracao("3");
                          }}
                          disabled={isSubmitting}
                        >
                          Negociar
                        </Button>
                      </Card>
                    );
                  })}
            </div>
          </div>

          <DialogFooter className="shrink-0 pt-4">
            <Button variant="outline" onClick={() => setSearchCategoria(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: CONFIRMAÇÃO DE CONTRATO */}
      <Dialog
        open={!!empresaParaConfirmar}
        onOpenChange={(o) => {
          if (!o) {
            setEmpresaParaConfirmar(null);
            setDuracao("3");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Handshake className="h-5 w-5 text-primary" /> Confirmar contrato
            </DialogTitle>
          </DialogHeader>

          {empresaParaConfirmar &&
            (() => {
              const anos = Math.max(1, Math.min(10, parseInt(duracao) || 3));
              const fimContrato = temporadaAtual + anos;
              const valorBase = Number(empresaParaConfirmar.valor_anual_sugerido);
              // Depreciação: cada ano adicional reduz 5% do valor anual
              // Ano 1 = 100%, Ano 2 = 95%, Ano 3 = 90%, etc.
              const valorAnualEfetivo = Math.round(valorBase * Math.pow(0.95, anos - 1));
              const multa = Math.round(valorAnualEfetivo * 0.7);
              // Total = soma da série geométrica: valorBase * (1 + 0.95 + 0.95² + ...)
              const totalContrato = Math.round(
                Array.from({ length: anos }, (_, i) => valorBase * Math.pow(0.95, i)).reduce((a, b) => a + b, 0),
              );
              const desconto = anos > 1 ? Math.round((1 - Math.pow(0.95, anos - 1)) * 100) : 0;
              return (
                <div className="space-y-4">
                  {/* Cabeçalho da empresa */}
                  <div className="flex items-center gap-3 bg-background/40 rounded-lg p-3">
                    <div className="h-14 w-14 rounded overflow-hidden shrink-0">
                      {empresaParaConfirmar.logo_url ? (
                        <img
                          src={empresaParaConfirmar.logo_url}
                          alt={empresaParaConfirmar.nome}
                          className="h-full w-full object-contain p-1"
                        />
                      ) : (
                        <Building2 className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-base truncate">{empresaParaConfirmar.nome}</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-xs text-success font-display font-bold">
                          {formatCurrency(valorBase)} / ano (base)
                        </div>
                        {empresaParaConfirmar.setor && (
                          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary/80">
                            {empresaParaConfirmar.setor}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Duração do contrato */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Duração do contrato (anos)</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={duracao}
                        onChange={(e) => setDuracao(e.target.value)}
                        className="w-24"
                      />
                      <span className="text-xs text-muted-foreground">
                        temporada {temporadaAtual} → {fimContrato}
                      </span>
                    </div>
                    {anos > 1 && (
                      <div className="text-[11px] text-amber-500/90 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        Cada ano adicional reduz o valor anual em 5% — no último ano pagarão{" "}
                        <strong>{formatCurrency(valorAnualEfetivo)}/ano</strong> ({desconto}% abaixo do valor base).
                      </div>
                    )}
                  </div>

                  {/* Resumo financeiro */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-background/40 rounded p-2.5">
                      <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Valor no 1º ano</div>
                      <div className="font-display font-bold text-success text-sm">{formatCurrency(valorBase)}</div>
                      <div className="text-[10px] text-muted-foreground">sem depreciação</div>
                    </div>
                    <div className="bg-background/40 rounded p-2.5">
                      <div className="text-[10px] uppercase text-muted-foreground tracking-wider">
                        Total do contrato
                      </div>
                      <div className="font-display font-bold text-success text-sm">{formatCurrency(totalContrato)}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {anos} ano{anos > 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="bg-background/40 rounded p-2.5">
                      <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Multa rescisória</div>
                      <div className="font-display font-bold text-destructive text-sm">{formatCurrency(multa)}</div>
                      <div className="text-[10px] text-muted-foreground">70% do ano atual</div>
                    </div>
                  </div>

                  {/* Aviso de irreversibilidade */}
                  <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div className="text-xs text-destructive/90 leading-relaxed">
                      <strong className="block text-destructive">Atenção — esta ação é irreversível!</strong>
                      Ao confirmar, o contrato será firmado imediatamente. A rescisão antecipada implicará uma multa de{" "}
                      <strong>{formatCurrency(multa)}</strong> debitada do seu caixa. Não será possível voltar atrás.
                    </div>
                  </div>
                </div>
              );
            })()}

          <DialogFooter className="pt-2 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEmpresaParaConfirmar(null);
                setDuracao("3");
              }}
            >
              Cancelar
            </Button>
            <Button
              className="bg-gradient-gold text-primary-foreground hover:opacity-90"
              onClick={() => empresaParaConfirmar && firmar(empresaParaConfirmar)}
              disabled={isSubmitting}
            >
              {isSubmitting ? "A processar..." : "Confirmar contrato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
