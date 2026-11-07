import { NextRequest, NextResponse } from "next/server";
import {
  CompanyInputError,
  CompanyNotFoundError,
  CompanyQuestionNotFoundError,
  isValidCompanyId,
  parseQuestionInput,
  updateQuestions,
} from "@/lib/companies";

export const runtime = "nodejs";
type Context = { params: Promise<{ companyId: string; questionId: string }> };

export async function PUT(request: NextRequest, context: Context) {
  try {
    const { companyId, questionId } = await context.params;
    if (!isValidCompanyId(companyId)) return NextResponse.json({ error: "Company not found." }, { status: 404 });
    const questions = await updateQuestions(
      companyId,
      "update",
      parseQuestionInput(await request.json()),
      questionId
    );
    return NextResponse.json({ questions });
  } catch (error) {
    const status = error instanceof CompanyNotFoundError || error instanceof CompanyQuestionNotFoundError
      ? 404
      : error instanceof CompanyInputError
        ? 400
        : 500;
    if (status === 500) console.error("PUT company question error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update question." },
      { status }
    );
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const { companyId, questionId } = await context.params;
    if (!isValidCompanyId(companyId)) return NextResponse.json({ error: "Company not found." }, { status: 404 });
    const questions = await updateQuestions(companyId, "delete", {}, questionId);
    return NextResponse.json({ questions });
  } catch (error) {
    const status = error instanceof CompanyNotFoundError || error instanceof CompanyQuestionNotFoundError ? 404 : 500;
    if (status === 500) console.error("DELETE company question error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete question." },
      { status }
    );
  }
}
