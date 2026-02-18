import { proxyToBackend } from "@/app/api/_backend";

export async function GET() {
  return proxyToBackend({ path: ["/getBinderState", "/binder-state"], method: "GET" });
}
