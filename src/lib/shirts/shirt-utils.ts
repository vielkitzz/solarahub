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

  let result = svg.replace(/<svg([^>]*)>/, '<svg$1 width="100%" height="100%">');

  if (number === undefined) return result;

  return result.replace(
    "</svg>",
    `
    <style>
      .shirt-number {
        font-family: 'Vina Sans', sans-serif;
      }
    </style>

    <text
      x="237.5"
      y="235"
      text-anchor="middle"
      dominant-baseline="middle"
      font-size="120"
      class="shirt-number"
      font-weight="400"
      fill="white"
      stroke="rgba(0,0,0,0.35)"
      stroke-width="6"
      paint-order="stroke"
    >
      ${number}
    </text>
    </svg>`,
  );
}
