import { NextRequest } from "next/server";
import { proxyToBackend } from "@/app/api/_backend";

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyToBackend({ path: ["/openPack", "/open-pack"], method: "POST", body });
}
