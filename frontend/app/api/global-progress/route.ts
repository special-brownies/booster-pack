import { proxyToBackend } from "@/app/api/_backend";

export async function GET() {
  return proxyToBackend({ path: ["/getGlobalProgress", "/global-progress"], method: "GET" });
}
