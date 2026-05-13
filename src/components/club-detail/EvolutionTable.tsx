import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronsUp, ChevronsDown, Equal, LineChart } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export const StatCard = ({ icon: Icon, label, value, positive, iconClassName }: any) => (
  <Card className="p-4 bg-gradient-card border-border/50">
    <div className="flex items-center gap-3">
      <div
        className={`h-9 w-9 rounded-lg flex items-center justify-center ${iconClassName ? "bg-destructive/20 " + iconClassName : positive ? "bg-success/20 text-success" : "bg-primary/10 text-primary"}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-display font-bold truncate">{value}</div>
      </div>
    </div>
  </Card>
);

export const Row = ({
  label,
  value,
  positive,
  bold,
}: {
  label: string;
  value: number;
  positive?: boolean;
  bold?: boolean;
}) => (
  <div className={`flex items-center justify-between ${bold ? "font-display font-bold" : ""}`}>
    <span className="text-muted-foreground">{label}</span>
    <span className={positive ? "text-success" : "text-destructive"}>{formatCurrency(value)}</span>
  </div>
);

export const EvolutionTable = ({ players }: { players: any[] }) => {
  const sorted = [...players].sort((a, b) => {
    const da = (a.habilidade ?? 0) - (a.habilidade_anterior ?? a.habilidade ?? 0);
    const db = (b.habilidade ?? 0) - (b.habilidade_anterior ?? b.habilidade ?? 0);
    return db - da;
  });

  if (sorted.length === 0) {
    return (
      <Card className="p-8 text-center bg-gradient-card border-border/50 text-muted-foreground">
        Sem jogadores no elenco.
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-card border-border/50 overflow-hidden">
      <div className="p-4 border-b border-border/50 flex items-center gap-2">
        <LineChart className="h-4 w-4 text-primary" />
        <h3 className="font-display font-bold">Evolução do Elenco</h3>
        <span className="text-[11px] text-muted-foreground ml-auto">Comparativo da habilidade entre temporadas</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Jogador</TableHead>
            <TableHead>Posição</TableHead>
            <TableHead className="text-center">Idade</TableHead>
            <TableHead className="text-center">Anterior</TableHead>
            <TableHead className="text-center">Atual</TableHead>
            <TableHead className="text-center">Ganho / Perda</TableHead>
            <TableHead className="text-center">Tendência</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((p) => {
            const atual = p.habilidade ?? 0;
            const anterior = p.habilidade_anterior ?? atual;
            const delta = atual - anterior;
            const tipo = delta > 0 ? "up" : delta < 0 ? "down" : "eq";

            const cls = tipo === "up" ? "text-success" : tipo === "down" ? "text-destructive" : "text-muted-foreground";

            const Icon = tipo === "up" ? ChevronsUp : tipo === "down" ? ChevronsDown : Equal;
            const bgCls = tipo === "up" ? "bg-success/10" : tipo === "down" ? "bg-destructive/10" : "bg-muted/30";

            return (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">
                    {p.position}
                  </Badge>
                </TableCell>
                <TableCell className="text-center text-xs text-muted-foreground">{p.age ?? "—"}</TableCell>
                <TableCell className="text-center text-xs text-muted-foreground">{anterior}</TableCell>
                <TableCell className="text-center font-display font-bold">{atual}</TableCell>
                <TableCell className={`text-center font-bold ${cls}`}>{delta > 0 ? `+${delta}` : delta}</TableCell>
                <TableCell>
                  <div className="flex justify-center">
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${bgCls} ${cls}`}>
                      <Icon className="h-4 w-4" />
                      <span className="text-[11px] font-bold uppercase">
                        {tipo === "up" ? "Ganho" : tipo === "down" ? "Perda" : "Estável"}
                      </span>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
};
