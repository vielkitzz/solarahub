interface ShirtIconProps {
  clubId?: string | null;
  number?: number;
  highlighted?: boolean;
  size?: string;
}

const SHIRT_NUMBER_COLOR: Record<string, string> = {
  "3998bef5-9fc4-4955-87cd-a2b74db5daee": "#1E1E1E", // Córdoba
  "263f38d8-b42e-48b3-a576-7a62da256fc3": "white", // Luciérnaga
  // adicione os outros clubes aqui
};

export function ShirtIcon({ clubId, number, highlighted, size = "w-8 h-8" }: ShirtIconProps) {
  const src = clubId ? `/kits/${clubId}.svg` : "/placeholder.svg";
  const numberColor = (clubId && SHIRT_NUMBER_COLOR[clubId]) || "white";

  return (
    <div className={`relative ${size}`}>
      <img
        src={src}
        alt="Camisa"
        className={`w-full h-full object-contain transition-all duration-300 ${
          highlighted ? "drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]" : ""
        }`}
      />
      {number != null && (
        <span
          className="absolute inset-0 flex items-center justify-center font-bold"
          style={{
            fontSize: "clamp(14px, 70%, 32px)",
            color: numberColor,
            paddingBottom: "15%",
            zIndex: 10,
            fontFamily: "'Vina Sans', sans-serif",
          }}
        >
          {number}
        </span>
      )}
    </div>
  );
}
