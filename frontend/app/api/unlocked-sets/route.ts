import { proxyToBackend } from "@/app/api/_backend";

export async function GET() {
  return proxyToBackend({ path: ["/api/unlocked-sets", "/unlocked-sets", "/getUnlockedSets"], method: "GET" });
}
