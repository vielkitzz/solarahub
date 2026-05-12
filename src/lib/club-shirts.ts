export function getClubShirt(clubId?: string | null) {
  if (!clubId) return null;

  return `/kits/${clubId}.svg`;
}
