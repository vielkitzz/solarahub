const modules = import.meta.glob("@/assets/kits/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

export const CLUB_SHIRTS = Object.fromEntries(
  Object.entries(modules).map(([path, svg]) => {
    const id = path.split("/").pop()?.replace(".svg", "");

    return [id, svg];
  }),
);

export function getClubShirt(clubId?: string): string | null {
  if (!clubId) return null;

  return (CLUB_SHIRTS[clubId] as string) || null;
}

export function injectShirtNumber(svg: string, number?: number): string {
  if (!svg) return "";

  // remove width/height fixos
  let result = svg.replace(
    /<svg([^>]*?)width="[^"]*"([^>]*?)height="[^"]*"([^>]*?)>/,
    '<svg$1$2$3 viewBox="0 0 475 500" width="100%" height="100%">',
  );

  if (number === undefined) return result;

  return result.replace(
    "</svg>",
    `
    <text
      x="237.5"
      y="235"
      text-anchor="middle"
      dominant-baseline="middle"
      font-size="110"
      font-family="'Vina Sans', sans-serif"
      font-weight="400"
      fill="white"
    >${number}</text>
    </svg>`,
  );
}
