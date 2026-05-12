const modules = import.meta.glob(
  "@/assets/kits/*.svg",
  {
    query: "?raw",
    import: "default",
    eager: true,
  }
);

export const CLUB_SHIRTS = Object.fromEntries(
  Object.entries(modules).map(([path, svg]) => {
    const id = path
      .split("/")
      .pop()
      ?.replace(".svg", "");

    return [id, svg];
  })
);

export function getClubShirt(clubId?: string) {
  if (!clubId) return null;

  return CLUB_SHIRTS[clubId] || null;
}

export function injectShirtNumber(
  svg: string,
  number?: number
) {
  if (!number) return svg;

  return svg.replace(
    "</svg>",
    `
      <text
        x="238"
        y="240"
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="120"
        font-family="Inter"
        font-weight="800"
        fill="white"
      >
        ${number}
      </text>
    </svg>
    `
  );
}