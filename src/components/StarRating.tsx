export const StarRating = ({ value, className, size = 14 }: Props) => {
  const safeValue = Math.max(0, Math.min(5, value || 0));
  const fullStars = Math.floor(safeValue);
  const hasHalfStar = safeValue - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <div
      className={cn("inline-flex items-center gap-0.5", className)}
      aria-label={`Avaliação: ${safeValue} de 5 estrelas`}
    >
      {/* Estrelas Cheias */}
      {[...Array(fullStars)].map((_, i) => (
        <Star key={`f-${i}`} size={size} className="text-primary fill-primary" />
      ))}

      {/* Estrela Metade */}
      {hasHalfStar && (
        <span className="relative inline-block" style={{ width: size, height: size }}>
          <Star size={size} className="absolute inset-0 text-muted-foreground/20" />
          <StarHalf size={size} className="absolute inset-0 text-primary fill-primary" />
        </span>
      )}

      {/* Estrelas Vazias */}
      {[...Array(emptyStars)].map((_, i) => (
        <Star key={`e-${i}`} size={size} className="text-muted-foreground/20" />
      ))}
    </div>
  );
};
