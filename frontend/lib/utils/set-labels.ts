export const SET_DISPLAY_NAME_MAP: Record<string, string> = {
  base2: "Base Set 2",
  base3: "Team Rocket",
  base4: "Gym Heroes",
  base5: "Gym Challenge",
  jungle: "Jungle",
  fossil: "Fossil"
};

const DEFAULT_SET_ORDER = ["base2", "jungle", "fossil", "base3", "base4", "base5"];

export function getSetDisplayName(setId: string): string {
  return SET_DISPLAY_NAME_MAP[setId] ?? setId;
}

export function formatSetList(setIds: string[]): string {
  if (!setIds.length) return "None";
  return setIds.map(getSetDisplayName).join(", ");
}

export function sortSetIds(setIds: string[]): string[] {
  const order = new Map(DEFAULT_SET_ORDER.map((id, idx) => [id, idx]));
  return [...setIds].sort((a, b) => {
    const aOrder = order.get(a);
    const bOrder = order.get(b);
    if (typeof aOrder === "number" && typeof bOrder === "number") return aOrder - bOrder;
    if (typeof aOrder === "number") return -1;
    if (typeof bOrder === "number") return 1;
    return a.localeCompare(b);
  });
}
