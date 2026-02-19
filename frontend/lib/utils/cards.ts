import { API_BASE_URL } from "@/lib/config/api-base-url";

export function buildCardImageUrl(setId: string, cardId: string): string {
  return `${API_BASE_URL}/api/cards/${setId}/${cardId}.png`;
}

export const getCardImageUrl = buildCardImageUrl;

export function inferSetIdFromCard(cardId: string): string {
  const idx = cardId.indexOf("-");
  if (idx <= 0) return "";
  return cardId.slice(0, idx);
}
