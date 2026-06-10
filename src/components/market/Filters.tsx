import { Search, Tag, ArrowLeftRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { POSITIONS } from "@/lib/format";
import { getFlagUrl } from "@/lib/countries";

export function FlagImg({ nationality }: { nationality: string }) {
  const url = getFlagUrl(nationality);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={nationality}
      title={nationality}
      className="h-6 w-8 object-cover rounded-sm shrink-0"
      style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.1)" }}
    />
  );
}

interface FiltersProps {
  q: string;
  setQ: (s: string) => void;
  pos: string;
  setPos: (s: string) => void;
  onlyForSale: boolean;
  setOnlyForSale: (v: boolean | ((p: boolean) => boolean)) => void;
  onlyForLoan?: boolean;
  setOnlyForLoan?: (v: boolean | ((p: boolean) => boolean)) => void;
}

export const Filters = ({ q, setQ, pos, setPos, onlyForSale, setOnlyForSale, onlyForLoan, setOnlyForLoan }: FiltersProps) => (
  <div className="flex flex-col sm:flex-row gap-3">
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar jogador..." className="pl-10" />
    </div>
    <div className="flex gap-3 flex-wrap">
      <Select value={pos} onValueChange={setPos}>
        <SelectTrigger className="flex-1 sm:w-48">
          <SelectValue placeholder="Posição" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas posições</SelectItem>
          {POSITIONS.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant={onlyForSale ? "default" : "outline"}
        onClick={() => setOnlyForSale((v) => !v)}
        className={onlyForSale ? "bg-gradient-gold text-primary-foreground shrink-0" : "shrink-0"}
      >
        <Tag className="h-4 w-4" />
        <span className="hidden sm:inline">{onlyForSale ? "Mostrando à venda" : "Só à venda"}</span>
      </Button>
      {setOnlyForLoan && (
        <Button
          variant={onlyForLoan ? "default" : "outline"}
          onClick={() => setOnlyForLoan((v) => !v)}
          className={onlyForLoan ? "bg-sky-500 text-white hover:bg-sky-500/90 shrink-0" : "shrink-0"}
        >
          <ArrowLeftRight className="h-4 w-4" />
          <span className="hidden sm:inline">{onlyForLoan ? "Mostrando empréstimo" : "Só empréstimo"}</span>
        </Button>
      )}
    </div>
  </div>
);
