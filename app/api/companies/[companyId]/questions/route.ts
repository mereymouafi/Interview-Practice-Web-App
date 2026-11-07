import { NextRequest, NextResponse } from "next/server";
import {
  CompanyInputError,
  CompanyNotFoundError,
  getCompany,
  isValidCompanyId,
  parseQuestionInput,
  updateQuestions,
} from "@/lib/companies";

export const runtime = "nodejs";
type Context = { params: Promise<{ companyId: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    const { companyId } = await context.params;
    if (!isValidCompanyId(companyId)) return NextResponse.json({ error: "Company not found." }, { status: 404 });
    const { questions } = await getCompany(companyId);
    return NextResponse.json({ questions });
  } catch (error) {
    const status = error instanceof CompanyNotFoundError ? 404 : 500;
    if (status === 500) console.error("GET company questions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load questions." },
      { status }
    );
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { companyId } = await context.params;
    if (!isValidCompanyId(companyId)) return NextResponse.json({ error: "Company not found." }, { status: 404 });
    const questions = await updateQuestions(
      companyId,
      "add",
      parseQuestionInput(await request.json())
    );
    return NextResponse.json({ questions }, { status: 201 });
  } catch (error) {
    const status = error instanceof CompanyNotFoundError ? 404 : error instanceof CompanyInputError ? 400 : 500;
    if (status === 500) console.error("POST company question error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create question." },
      { status }
    );
  }
}
