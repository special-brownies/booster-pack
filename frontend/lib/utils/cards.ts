const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.BACKEND_API_BASE_URL ??
  "http://localhost:8000"
)
  .trim()
  .replace(/\/+$/, "");

if (typeof window !== "undefined") {
  // Temporary production verification log.
  console.info("[CardImage] API_BASE_URL", API_BASE_URL);
}

export function getCardImageUrl(setId: string, cardId: string): string {
  return `${API_BASE_URL}/api/cards/${setId}/${cardId}.png`;
}

export function inferSetIdFromCard(cardId: string): string {
  const idx = cardId.indexOf("-");
  if (idx <= 0) return "";
  return cardId.slice(0, idx);
}
