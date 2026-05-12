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
  const svgWithNumber = injectShirtNumber((rawSvg as string) ?? "", number);

  return (
    <div
      className={`relative ${size} ${highlighted ? "drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]" : ""}`}
      dangerouslySetInnerHTML={{ __html: svgWithNumber || "" }}
    />
  );
}
