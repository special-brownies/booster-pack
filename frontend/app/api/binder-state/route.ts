import { proxyToBackend } from "@/app/api/_backend";

export async function GET() {
  return proxyToBackend({ path: ["/api/binder-state", "/binder-state", "/getBinderState"], method: "GET" });
}
