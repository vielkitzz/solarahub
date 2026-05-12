interface ShirtIconProps {
  clubId?: string | null;
  number?: number;
  highlighted?: boolean;
  size?: string;
}

export function ShirtIcon({ clubId, number, highlighted, size = "w-8 h-8" }: ShirtIconProps) {
  const src = clubId ? `/kits/${clubId}.svg` : "/placeholder.svg";
  console.log("ShirtIcon number:", number);

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
            color: "black",
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
