// ShirtIcon.tsx
import { getClubShirt, injectShirtNumber } from "@/lib/shirts/shirt-utils";

interface ShirtIconProps {
  clubId?: string | null;
  number?: number;
  highlighted?: boolean;
  size?: string;
}

export function ShirtIcon({ clubId, number, highlighted, size = "w-8 h-8" }: ShirtIconProps) {
  const src = clubId ? `/kits/${clubId}.svg` : "/placeholder.svg";

  return (
    <div className={`relative ${size}`}>
      <img
        src={src}
        alt="Camisa"
        className={`w-full h-full object-contain transition-all duration-300 ${
          highlighted ? "drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]" : ""
        }`}
      />
      {number !== undefined && (
        <span
          className="absolute inset-0 flex items-center justify-center font-bold text-white"
          style={{ fontSize: "clamp(8px, 30%, 14px)", paddingTop: "15%" }}
        >
          {number}
        </span>
      )}
    </div>
  );
}
