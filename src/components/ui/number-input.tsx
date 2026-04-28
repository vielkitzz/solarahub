import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatThousands, parseFormatted } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "min" | "max" | "type"> {
  value: number | string | null | undefined;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Permite valores negativos. Default: true se min < 0, false caso contrário. */
  allowNegative?: boolean;
  /** Permite digitar valores fora dos limites (ex: painel admin). Default: false. */
  unbounded?: boolean;
  /** Formatar com pontos de milhar. Default: true. */
  thousands?: boolean;
}

/**
 * Input numérico com:
 * - Formatação automática 1.000.000 (separador pt-BR)
 * - Clamp em min/max no blur (a menos que `unbounded`)
 * - Bloqueio de digitação fora dos limites quando `unbounded=false`
 */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, min, max, allowNegative, unbounded = false, thousands = true, onBlur, className, ...rest }, ref) => {
    const negOk = allowNegative ?? (min !== undefined && min < 0);

    const display = React.useMemo(() => {
      if (value === null || value === undefined || value === "") return "";
      const n = typeof value === "number" ? value : parseFormatted(value);
      if (!Number.isFinite(n)) return "";
      return thousands ? formatThousands(n) : String(n);
    }, [value, thousands]);

    const [raw, setRaw] = React.useState<string>(display);

    React.useEffect(() => {
      setRaw(display);
    }, [display]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let v = e.target.value;
      // Aceita apenas dígitos, pontos, vírgula e sinal
      v = v.replace(/[^\d.,-]/g, "");
      if (!negOk) v = v.replace(/-/g, "");
      // Mantém apenas o primeiro "-"
      v = v.replace(/(?!^)-/g, "");
      const n = parseFormatted(v);

      // Bloqueia digitação fora dos limites se não for unbounded
      if (!unbounded) {
        if (max !== undefined && Number.isFinite(n) && n > max) {
          // não atualiza
          return;
        }
        if (min !== undefined && Number.isFinite(n) && n < min && v !== "-" && v !== "") {
          return;
        }
      }
      // Reformata enquanto digita
      const formatted = v === "" || v === "-" ? v : (thousands ? formatThousands(n) : String(n));
      setRaw(formatted);
      onChange(n);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      let n = parseFormatted(raw);
      if (!unbounded) {
        if (min !== undefined && n < min) n = min;
        if (max !== undefined && n > max) n = max;
      }
      const formatted = raw === "" ? "" : (thousands ? formatThousands(n) : String(n));
      setRaw(formatted);
      onChange(n);
      onBlur?.(e);
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={raw}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(className)}
        {...rest}
      />
    );
  },
);
NumberInput.displayName = "NumberInput";
