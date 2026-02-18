const DEFAULT_CARD_IMAGE_BASE = "http://localhost:8000/api/cards";
const RAW_CARD_IMAGE_BASE = process.env.NEXT_PUBLIC_CARD_IMAGE_BASE_URL ?? "";

function normalizeCardImageBase(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  if (!normalized) return DEFAULT_CARD_IMAGE_BASE;
  if (normalized.endsWith("/api/cards")) return normalized;
  if (normalized.endsWith("/cards")) {
    return `${normalized.slice(0, -"/cards".length)}/api/cards`;
  }
  return `${normalized}/api/cards`;
}

const CARD_IMAGE_BASE = normalizeCardImageBase(RAW_CARD_IMAGE_BASE);

export function getCardImageUrl(setId: string, cardId: string): string {
  return `${CARD_IMAGE_BASE}/${setId}/${cardId}.png`;
}

export function inferSetIdFromCard(cardId: string): string {
  const idx = cardId.indexOf("-");
  if (idx <= 0) return "";
  return cardId.slice(0, idx);
}
