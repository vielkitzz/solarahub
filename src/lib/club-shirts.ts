export function getClubShirt(clubId?: string | null) {
  if (!clubId) return null;

  return `/src/assets/flags/kits/${clubId}.svg`;
}