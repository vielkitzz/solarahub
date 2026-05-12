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

// shirt-utils.ts
export function getClubShirt(clubId?: string): string | null {
  if (!clubId) return null;
  return (CLUB_SHIRTS[clubId] as string) || null;
}

export function injectShirtNumber(svg: string, number?: number): string {
  if (!svg) return "";

  // Garante que o SVG preencha o container
  let result = svg.replace(/<svg/, '<svg width="100%" height="100%"');

  if (!number) return result;

  return result.replace(
    "</svg>",
    `<text
      x="238"
      y="240"
      text-anchor="middle"
      dominant-baseline="middle"
      font-size="120"
      font-family="Vina Sans"
      font-weight="800"
      fill="white"
    >${number}</text></svg>`,
  );
}
