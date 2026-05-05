import { getFlagUrl, getCountryByName } from "@/data/countries";

interface CountryFlagProps {
  country: string;
  size?: number;
  className?: string;
}

export default function CountryFlag({ country, size = 28, className = "" }: CountryFlagProps) {
  const countryData = getCountryByName(country);
  if (!countryData) return null;

  const { code, customFlag } = countryData;

  if (customFlag) {
    return (
      <img
        src={customFlag}
        alt={country}
        width={size}
        height={Math.round(size * 0.75)}
        className={`inline-block object-cover rounded-[2px] ${className}`}
      />
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w80/${code}.webp`}
      srcSet={`
        https://flagcdn.com/w80/${code}.webp 1x,
        https://flagcdn.com/w160/${code}.webp 2x,
        https://flagcdn.com/w320/${code}.webp 3x
      `}
      alt={country}
      width={size}
      height={Math.round(size * 0.75)}
      className={`inline-block object-cover rounded-[2px] ${className}`}
      loading="lazy"
      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}