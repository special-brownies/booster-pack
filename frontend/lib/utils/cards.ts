const CARD_IMAGE_BASE = process.env.NEXT_PUBLIC_CARD_IMAGE_BASE_URL ?? "http://localhost:8000/cards";

export function getCardImageUrl(setId: string, cardId: string): string {
  return `${CARD_IMAGE_BASE}/${setId}/${cardId}.png`;
}

export function inferSetIdFromCard(cardId: string): string {
  const idx = cardId.indexOf("-");
  if (idx <= 0) return "";
  return cardId.slice(0, idx);
}
