import { NextRequest } from "next/server";
import { proxyToBackend } from "@/app/api/_backend";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  return proxyToBackend({
    path: ["/getCollectionProgress", "/collection-progress"],
    method: "GET",
    query
  });
}
