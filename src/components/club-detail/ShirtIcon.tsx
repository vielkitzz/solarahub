import { getClubShirt } from "@/lib/club-shirts";

interface ShirtIconProps {
  clubId?: string | null;
  className?: string;
}

export function ShirtIcon({ clubId, className = "" }: ShirtIconProps) {
  const shirtSrc = getClubShirt(clubId);

  if (!shirtSrc) return null;

  return <img src={shirtSrc} alt="Camisa" className={`w-full h-full object-contain ${className}`} />;
}
