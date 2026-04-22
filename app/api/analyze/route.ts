import { NextResponse } from "next/server";
import { analyzeQuery } from "../../lib/grounded-analysis";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { query?: string };
    const query = body.query?.trim();

    if (!query) {
      return NextResponse.json(
        { error: "Query is required." },
        { status: 400 },
      );
    }

    const result = await analyzeQuery(query);
    return NextResponse.json({ result });
  } catch (error) {
    console.error("[api/analyze] request failed", error);
    return NextResponse.json(
      { error: "Analysis request failed." },
      { status: 500 },
    );
  }
}
