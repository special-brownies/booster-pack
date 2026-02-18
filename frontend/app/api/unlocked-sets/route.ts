import { proxyToBackend } from "@/app/api/_backend";

export async function GET() {
  return proxyToBackend({ path: ["/getUnlockedSets", "/unlocked-sets"], method: "GET" });
}
