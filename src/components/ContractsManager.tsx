import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  // FÓRMULA DE CÁLCULO DE PATROCÍNIOS (LÓGICA NOVA DO MANUS)
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

    const rateExigido = Math.max(0.1, clubRate - 0.5).toFixed(2);

    return baseBrands.map((b) => {
      const multSetor = isFornecedora ? 1.5 : getMultiplicadorSetor(b.setor);
      const prestígio = getPrestígio(b.name, (b as any).prestige);

      const entusiasmo = b.setor === "Casa de Apostas" ? prestígio : Math.pow(multRep, prestígio);

      // CÁLCULO FINAL DA FÓRMULA MANUS
      const valorFinal = valorBaseRate * multSetor * multCamisa * entusiasmo * prestígio;

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

  const empresasDisponiveis = useMemo(() => {
    let filtered = PATROCINIO_CATEGORIAS.flatMap((cat) => {
      const contratosAtivos = contratosPorCategoria[cat.value] || [];
      if (contratosAtivos.length >= cat.max) return [];
      return empresasDaCategoria(cat.value).map((emp) => ({ ...emp, categoria: cat.value }));
    });

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (emp) =>
          emp.nome.toLowerCase().includes(term) ||
          emp.setor?.toLowerCase().includes(term) ||
          emp.exigencias?.toLowerCase().includes(term),
      );
    }

    if (searchCategoria) {
      filtered = filtered.filter((emp) => emp.categoria === searchCategoria);
    }

    if (sortOrder === "valor") {
      filtered.sort((a, b) => b.valor_anual_sugerido - a.valor_anual_sugerido);
    } else {
      filtered.sort((a, b) => a.nome.localeCompare(b.nome));
    }

    return filtered;
  }, [contratosPorCategoria, empresasDaCategoria, searchTerm, searchCategoria, sortOrder]);

  // LÓGICA DE ASSINATURA (SISTEMA NOVO)
  const handleAddContrato = async (empresa: Empresa) => {
    if (!clubId) return toast.error("ID do clube não encontrado.");
    setIsSubmitting(true);

    const anos = Math.max(1, Math.min(10, parseInt(duracao) || 3));
    const fim = temporadaAtual + anos;

    // Valor anual efetivo com depreciação de 5% por ano adicional (Lógica Manus)
    const valorAnualEfetivo = Math.round(Number(empresa.valor_anual_sugerido) * Math.pow(0.95, anos - 1));

    // 1. Garante que a marca existe na tabela empresas do banco (Lógica Manus)
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
      categoria: empresa.categoria,
      valor_anual: valorAnualEfetivo || 0,
      inicio_temporada: temporadaAtual,
      fim_temporada: fim,
      anos_duracao: anos,
      multa_rescisao: Math.round(valorAnualEfetivo * 0.7), // Multa de 70% (Lógica Manus)
      ativo: true,
    });

    setIsSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(`Contrato com ${empresa.nome} assinado!`);
    load();
    onChange?.();
    setEmpresaParaConfirmar(null);
  };

  // LÓGICA DE RESCISÃO COM DÉBITO DO CAIXA (SISTEMA NOVO)
  const handleRemoveContrato = async (id: string, multaMultaPrevista: number, nomeEmpresa: string) => {
    if (
      !confirm(
        `Tem certeza que deseja rescindir este contrato com ${nomeEmpresa}? A multa de ${formatCurrency(multaMultaPrevista)} será debitada do caixa.`,
      )
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

    if (Number(club.budget) < multaMultaPrevista) {
      toast.error("Caixa insuficiente para pagar a multa rescisória");
      return;
    }

    const { error: e1 } = await supabase
      .from("clubs")
      .update({ budget: Number(club.budget) - multaMultaPrevista })
      .eq("id", clubId);

    if (e1) return toast.error(e1.message);

    const { error: e2 } = await supabase.from("contratos_clube").update({ ativo: false }).eq("id", id);
    if (e2) return toast.error(e2.message);

    toast.success("Contrato rescindido.");
    load();
    onChange?.();
  };

  const totalPatrocinios = useMemo(() => {
    return contratos.reduce((sum, c) => sum + c.valor_anual, 0);
  }, [contratos]);

  const totalFolhaSalarial = valorBaseFolha;

  return (
    <Card className="p-5 bg-gradient-card border-border/50 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold flex items-center gap-2">
          <Handshake className="h-5 w-5 text-primary" /> Gerenciar Contratos
        </h3>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="p-3 bg-secondary/30 border-border/30">
          <div className="text-[10px] uppercase text-muted-foreground">Total Patrocínios Anuais</div>
          <div className="font-display font-bold text-lg text-success">{formatCurrency(totalPatrocinios)}</div>
        </Card>
        <Card className="p-3 bg-secondary/30 border-border/30">
          <div className="text-[10px] uppercase text-muted-foreground">Folha Salarial Anual</div>
          <div className="font-display font-bold text-lg text-destructive">{formatCurrency(totalFolhaSalarial)}</div>
        </Card>
      </section>

      <section className="space-y-4">
        <h4 className="text-sm font-bold text-foreground">Contratos Ativos</h4>
        {contratos.length === 0 && <p className="text-muted-foreground text-sm">Nenhum contrato ativo no momento.</p>}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {contratos.map((contrato) => (
            <Card key={contrato.id} className="p-3 flex items-center gap-3 bg-card/50 border-border/50">
              {contrato.empresa?.logo_url && (
                <img src={contrato.empresa.logo_url} alt={contrato.empresa.nome} className="h-10 w-10 object-contain" />
              )}
              <div className="flex-1">
                <p className="font-semibold text-sm">{contrato.empresa?.nome || "Empresa Desconhecida"}</p>
                <p className="text-xs text-muted-foreground capitalize">{contrato.categoria.replace(/_/g, " ")}</p>
                <p className="text-xs text-success font-medium">{formatCurrency(contrato.valor_anual)} / ano</p>
              </div>
              {canEdit && (
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() =>
                    handleRemoveContrato(
                      contrato.id,
                      Number(contrato.multa_rescisao || contrato.valor_anual * 0.7),
                      contrato.empresa?.nome || "Empresa Desconhecida",
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </Card>
          ))}
        </div>
      </section>

      {canEdit && (
        <section className="space-y-4">
          <h4 className="text-sm font-bold text-foreground">Patrocinadores Disponíveis</h4>
          <div className="flex gap-2 items-center">
            <Input
              placeholder="Buscar patrocinador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select
              value={searchCategoria || "all"}
              onValueChange={(v) => setSearchCategoria(v === "all" ? null : (v as PatrocinioCategoria))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Categorias</SelectItem>
                {PATROCINIO_CATEGORIAS.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "valor" | "az")}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="valor">Valor</SelectItem>
                <SelectItem value="az">A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {empresasDisponiveis.map((empresa) => (
              <Card key={empresa.id} className="p-3 flex items-center gap-3 bg-card/50 border-border/50">
                {empresa.logo_url && (
                  <img src={empresa.logo_url} alt={empresa.nome} className="h-10 w-10 object-contain" />
                )}
                <div className="flex-1">
                  <p className="font-semibold text-sm">{empresa.nome}</p>
                  <p className="text-xs text-muted-foreground capitalize">{empresa.categoria.replace(/_/g, " ")}</p>
                  <p className="text-xs text-success font-medium">
                    {formatCurrency(empresa.valor_anual_sugerido)} / ano
                  </p>
                  {empresa.exigencias && (
                    <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> {empresa.exigencias}
                    </p>
                  )}
                </div>
                <Button onClick={() => setEmpresaParaConfirmar(empresa)} disabled={isSubmitting}>
                  <Plus className="h-4 w-4" /> Assinar
                </Button>
              </Card>
            ))}
          </div>
        </section>
      )}

      <Dialog open={!!empresaParaConfirmar} onOpenChange={() => setEmpresaParaConfirmar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assinar contrato com {empresaParaConfirmar?.nome}?</DialogTitle>
          </DialogHeader>
          {empresaParaConfirmar &&
            (() => {
              const anosSelecionados = Math.max(1, Math.min(10, parseInt(duracao) || 3));
              const valorEfetivo = Math.round(
                Number(empresaParaConfirmar.valor_anual_sugerido) * Math.pow(0.95, anosSelecionados - 1),
              );

              return (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Você está prestes a assinar um contrato de patrocínio de{" "}
                    <span className="font-bold text-primary">{formatCurrency(valorEfetivo)}</span> por ano com a{" "}
                    <span className="font-bold text-primary">{empresaParaConfirmar.nome}</span>.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Duração (anos)</Label>
                      <Input
                        type="number"
                        value={duracao}
                        onChange={(e) => setDuracao(e.target.value)}
                        min={1}
                        max={5}
                      />
                    </div>
                    <div>
                      <Label>Valor Anual</Label>
                      <Input type="text" value={formatCurrency(valorEfetivo)} disabled />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A multa rescisória (70%) será de {formatCurrency(Math.round(valorEfetivo * 0.7))}.
                  </p>
                </div>
              );
            })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmpresaParaConfirmar(null)}>
              Cancelar
            </Button>
            <Button onClick={() => handleAddContrato(empresaParaConfirmar!)} disabled={isSubmitting}>
              {isSubmitting ? "Assinando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
