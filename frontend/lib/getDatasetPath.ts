import path from "node:path";

export function getDatasetPath(): string {
  const configured = process.env.DATASET_PATH?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.join(process.cwd(), "pokemon_series");
}
