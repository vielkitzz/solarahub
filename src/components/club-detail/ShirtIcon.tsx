// ShirtIcon.tsx
import { getClubShirt, injectShirtNumber } from "@/lib/shirts/shirt-utils";

export function ShirtIcon({ clubId, number, highlighted, size = "w-8 h-8" }: ShirtIconProps) {
  const rawSvg = getClubShirt(clubId);
  const svgWithNumber = injectShirtNumber(rawSvg ?? "", number);

  return (
    <div
      className={`relative ${size} ${highlighted ? "drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]" : ""}`}
      dangerouslySetInnerHTML={{ __html: svgWithNumber || "" }}
    />
  );
}
