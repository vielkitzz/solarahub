import { getClubShirt } from "@/lib/club-shirts";

interface ShirtIconProps {
  clubId?: string | null;
  number?: number;
  size?: string;
  highlighted?: boolean;
}

export function ShirtIcon({ clubId, number, size = "w-16 h-16", highlighted = false }: ShirtIconProps) {
  const shirtSrc = getClubShirt(clubId);

  return (
    <div
      className={`
        relative ${size}
        ${highlighted ? "scale-110" : ""}
        transition-all duration-300
      `}
    >
      <img
        src={shirtSrc || "/placeholder.svg"}
        alt="Camisa"
        className="w-full h-full object-contain drop-shadow-[0_2px_5px_rgba(0,0,0,0.6)]"
      />

      {number !== undefined && (
        <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm pointer-events-none">
          {number}
        </div>
      )}
    </div>
  );
}
