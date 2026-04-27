import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Row = {
  club_id: string;
  club_name: string;
  reputacao: string | null;
  receita_base: number;
  bilheteria: number;
  contratos: number;
  premiacao: number;
  manutencao: number;
  folha: number;
  delta: number;
  novo_caixa: number;
};

export const SeasonPreview = () => {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("preview_season_turnover");
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data as any) || []);
  };

  const totalDelta = rows?.reduce((s, r) => s + Number(r.delta), 0) ?? 0;
  const positivos = rows?.filter((r) => r.delta >= 0).length ?? 0;
  const negativos = rows?.filter((r) => r.delta < 0).length ?? 0;

  return (
    <Card className="p-5 bg-gradient-card border-border/50 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-display font-bold flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" /> Pré-visualização da virada
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Calcula o impacto SEM aplicar. Use antes de executar a virada real.
          </p>
        </div>
        <Button onClick={run} disabled={loading} variant="outline" className="border-primary/40 text-primary hover:bg-primary/10">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
          {rows ? "Recalcular" : "Calcular prévia"}
        </Button>
      </div>

      {rows && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 bg-secondary/30 border-border/30">
              <div className="text-[10px] uppercase text-muted-foreground">Delta total da liga</div>
              <div className={`font-display font-bold text-lg ${totalDelta >= 0 ? "text-success" : "text-destructive"}`}>
                {totalDelta >= 0 ? "+" : ""}{formatCurrency(totalDelta)}
              </div>
            </Card>
            <Card className="p-3 bg-secondary/30 border-border/30">
              <div className="text-[10px] uppercase text-muted-foreground">Clubes lucrando</div>
              <div className="font-display font-bold text-lg text-success">{positivos}</div>
            </Card>
            <Card className="p-3 bg-secondary/30 border-border/30">
              <div className="text-[10px] uppercase text-muted-foreground">Clubes no prejuízo</div>
              <div className="font-display font-bold text-lg text-destructive">{negativos}</div>
            </Card>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border/40">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                  <TableHead>Clube</TableHead>
                  <TableHead className="text-right">Receita base</TableHead>
                  <TableHead className="text-right">Bilheteria</TableHead>
                  <TableHead className="text-right">Patroc.</TableHead>
                  <TableHead className="text-right">Premiação</TableHead>
                  <TableHead className="text-right text-destructive">Manut.</TableHead>
                  <TableHead className="text-right text-destructive">Folha</TableHead>
                  <TableHead className="text-right font-bold">Δ</TableHead>
                  <TableHead className="text-right">Novo caixa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.club_id}>
                    <TableCell className="font-medium">{r.club_name}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{formatCurrency(Number(r.receita_base))}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{formatCurrency(Number(r.bilheteria))}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{formatCurrency(Number(r.contratos))}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{formatCurrency(Number(r.premiacao))}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-destructive">−{formatCurrency(Number(r.manutencao))}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-destructive">−{formatCurrency(Number(r.folha))}</TableCell>
                    <TableCell className={`text-right font-bold tabular-nums ${Number(r.delta) >= 0 ? "text-success" : "text-destructive"}`}>
                      {Number(r.delta) >= 0 ? "+" : ""}{formatCurrency(Number(r.delta))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(Number(r.novo_caixa))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </Card>
  );
};
