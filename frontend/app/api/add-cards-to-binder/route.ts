import { NextRequest } from "next/server";
import { proxyToBackend } from "@/app/api/_backend";

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyToBackend({
    path: ["/api/add-cards-to-binder", "/add-cards-to-binder", "/addCardsToBinder"],
    method: "POST",
    body
  });
}
