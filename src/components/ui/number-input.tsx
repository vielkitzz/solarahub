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
  allowNegative?: boolean;
  unbounded?: boolean;
  thousands?: boolean;
}

const _NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
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
      v = v.replace(/[^\d.,-]/g, "");
      if (!negOk) v = v.replace(/-/g, "");
      v = v.replace(/(?!^)-/g, "");
      const n = parseFormatted(v);
      if (!unbounded) {
        if (max !== undefined && Number.isFinite(n) && n > max) return;
        if (min !== undefined && Number.isFinite(n) && n < min && v !== "-" && v !== "") return;
      }
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

_NumberInput.displayName = "NumberInput";

export const NumberInput = _NumberInput as React.ForwardRefExoticComponent
  NumberInputProps & React.RefAttributes<HTMLInputElement>
>;