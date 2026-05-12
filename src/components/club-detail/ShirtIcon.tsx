import { clubShirts } from "@/lib/club-shirts";

interface ShirtIconProps {
  clubId?: string;
  number?: number | null;
  size?: "sm" | "md";
  highlighted?: boolean;
}

export function ShirtIcon({
  clubId,
  number,
  size = "md",
  highlighted = false,
}: ShirtIconProps) {
  const dim = size === "sm" ? "w-8 h-8" : "w-10 h-10";

  const svg = clubId ? clubShirts[clubId] : null;

  if (!svg) {
    return (
      <div
        className={`relative flex items-center justify-center rounded-md bg-white text-black font-black ${dim}`}
      >
        {number ?? "--"}
      </div>
    );
  }

  return (
    <div className={`relative ${dim}`}>
      <div
        className="w-full h-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      <div
        className={`absolute inset-0 flex items-center justify-center font-black
        ${size === "sm" ? "text-[10px]" : "text-[12px]"}
        ${highlighted ? "text-yellow-300" : "text-white"}`}
        style={{
          transform: "translateY(-2%)",
        }}
      >
        {number ?? "--"}
      </div>
    </div>
  );
}