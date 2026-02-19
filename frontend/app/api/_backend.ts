import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/config/api-base-url";

const BACKEND_BASE = API_BASE_URL;

type ProxyOptions = {
  path: string | string[];
  method?: "GET" | "POST";
  body?: unknown;
  query?: URLSearchParams;
};

export async function proxyToBackend({ path, method = "GET", body, query }: ProxyOptions) {
  if (!BACKEND_BASE) {
    return NextResponse.json(
      {
        error: "Backend API base URL is not configured."
      },
      { status: 503 }
    );
  }

  const queryText = query?.toString();
  const candidatePaths = Array.isArray(path) ? path : [path];

  const requestOnce = async (candidatePath: string) => {
    const target = `${BACKEND_BASE}${candidatePath}${queryText ? `?${queryText}` : ""}`;
    const response = await fetch(target, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });
    const text = await response.text();
    return { response, text };
  };

  try {
    let response: Response | null = null;
    let text = "";
    for (const candidatePath of candidatePaths) {
      const result = await requestOnce(candidatePath);
      response = result.response;
      text = result.text;
      if (response.status !== 404) break;
    }
    if (!response) {
      return NextResponse.json({ error: "Backend request failed." }, { status: 502 });
    }

    try {
      return NextResponse.json(JSON.parse(text), { status: response.status });
    } catch {
      return NextResponse.json(
        { error: text || "Unknown backend response" },
        { status: response.status }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Backend request failed: ${error.message}`
            : "Backend request failed."
      },
      { status: 502 }
    );
  }
}
