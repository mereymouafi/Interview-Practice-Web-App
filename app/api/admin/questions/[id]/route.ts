import { NextRequest, NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/admin-auth";
import {
  deleteGeneralQuestion,
  parseGeneralQuestionInput,
  QuestionInputError,
  QuestionNotFoundError,
  updateGeneralQuestion,
} from "@/lib/general-questions";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Context) {
  const authorization = await authorizeAdmin();
  if (authorization.response) return authorization.response;
  try {
    const { id } = await context.params;
    if (!id || id.length > 100) {
      return NextResponse.json({ error: "Question not found." }, { status: 404 });
    }
    const question = await updateGeneralQuestion(id, parseGeneralQuestionInput(await request.json()));
    return NextResponse.json({ question });
  } catch (error) {
    if (error instanceof QuestionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof QuestionInputError || error instanceof SyntaxError) {
      return NextResponse.json(
        { error: error instanceof SyntaxError ? "Request body must be valid JSON." : error.message },
        { status: 400 }
      );
    }
    console.error("PUT admin question error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update the question." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  const authorization = await authorizeAdmin();
  if (authorization.response) return authorization.response;
  try {
    const { id } = await context.params;
    if (!id || id.length > 100) {
      return NextResponse.json({ error: "Question not found." }, { status: 404 });
    }
    await deleteGeneralQuestion(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof QuestionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("DELETE admin question error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete the question." },
      { status: 500 }
    );
  }
}
