import { NextRequest, NextResponse } from "next/server";
import {
  GENERAL_CATEGORIES,
  isGeneralCategory,
  listGeneralQuestions,
  type GeneralCategory,
} from "@/lib/general-questions";
import { readSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await readSession();
  if (!session?.refresh_token) {
    return NextResponse.json({ error: "Sign in with Google to load questions." }, { status: 401 });
  }
  const categoryParam = request.nextUrl.searchParams.get("category");
  let category: GeneralCategory | undefined;
  if (categoryParam) {
    if (!isGeneralCategory(categoryParam)) {
      return NextResponse.json(
        { error: `Category must be one of: ${GENERAL_CATEGORIES.join(", ")}.` },
        { status: 400 }
      );
    }
    category = categoryParam;
  }
  try {
    const questions = await listGeneralQuestions(category);
    return NextResponse.json({ questions, categories: GENERAL_CATEGORIES });
  } catch (error) {
    console.error("GET questions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load questions from Google Drive." },
      { status: 500 }
    );
  }
}
