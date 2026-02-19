import { NextRequest } from "next/server";
import { proxyToBackend } from "@/app/api/_backend";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  return proxyToBackend({
    path: ["/api/collection-progress", "/collection-progress", "/getCollectionProgress"],
    method: "GET",
    query
  });
}
