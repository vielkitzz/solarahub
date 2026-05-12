// ShirtIcon.tsx
import { getClubShirt, injectShirtNumber } from "@/lib/shirts/shirt-utils";

interface ShirtIconProps {
  clubId?: string | null;
  number?: number;
  highlighted?: boolean;
  size?: string;
}

export function ShirtIcon({ clubId, number, highlighted, size = "w-8 h-8" }: ShirtIconProps) {
  const rawSvg = getClubShirt(clubId ?? undefined);

  if (!rawSvg) {
    return <div className={`relative ${size}`} />;
  }

  const svgWithNumber = injectShirtNumber(rawSvg, number);

  return (
    <div
      className={`relative ${size} ${highlighted ? "drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]" : ""}`}
      style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      dangerouslySetInnerHTML={{ __html: svgWithNumber }}
    />
  );
}
