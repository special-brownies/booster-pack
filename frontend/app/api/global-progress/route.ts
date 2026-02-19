import { proxyToBackend } from "@/app/api/_backend";

export async function GET() {
  return proxyToBackend({ path: ["/api/global-progress", "/global-progress", "/getGlobalProgress"], method: "GET" });
}
