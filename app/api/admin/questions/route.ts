import { NextRequest, NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/admin-auth";
import {
  createGeneralQuestion,
  listGeneralQuestions,
  parseGeneralQuestionInput,
  QuestionInputError,
} from "@/lib/general-questions";

export const runtime = "nodejs";

export async function GET() {
  const authorization = await authorizeAdmin();
  if (authorization.response) return authorization.response;
  try {
    const questions = await listGeneralQuestions();
    return NextResponse.json({ questions });
  } catch (error) {
    console.error("GET admin questions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load the question bank." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeAdmin();
  if (authorization.response) return authorization.response;
  try {
    const question = await createGeneralQuestion(parseGeneralQuestionInput(await request.json()));
    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    if (error instanceof QuestionInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    console.error("POST admin question error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save the question." },
      { status: 500 }
    );
  }
}
