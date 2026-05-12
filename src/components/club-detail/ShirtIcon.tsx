import { getClubShirt, injectShirtNumber } from "@/lib/shirts/shirt-utils";

interface ShirtIconProps {
  clubId?: string | null;
  number?: number;
  highlighted?: boolean;
  size?: string;
}

export function ShirtIcon({ clubId, number, highlighted, size = "w-8 h-8" }: ShirtIconProps) {
  const svg = injectShirtNumber(getClubShirt(clubId || undefined) || "", number);

  return (
    <div
      className={`${size} ${highlighted ? "drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]" : ""}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
