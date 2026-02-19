import { proxyToBackend } from "@/app/api/_backend";

export async function POST() {
  return proxyToBackend({
    path: ["/api/reset-progress", "/reset-progress", "/resetProgress"],
    method: "POST",
    body: {}
  });
}
