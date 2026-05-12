import { getClubShirt } from "@/lib/club-shirts";

interface ShirtIconProps {
  clubId?: string | null;
  number?: number;
  highlighted?: boolean;
  size?: string;
}

export function ShirtIcon({ clubId, number, highlighted, size = "w-8 h-8" }: ShirtIconProps) {
  const shirtSrc = getClubShirt(clubId);

  return (
    <div className={`relative ${size}`}>
      <img
        src={shirtSrc || "/placeholder.svg"}
        alt="Camisa"
        className={`w-full h-full object-contain transition-all duration-300 ${
          highlighted ? "drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]" : ""
        }`}
      />

      {number && (
        <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold">
          {number}
        </span>
      )}
    </div>
  );
}
