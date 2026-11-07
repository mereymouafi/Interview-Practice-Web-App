import { NextRequest, NextResponse } from "next/server";
import {
  CompanyNotFoundError,
  CompanyInputError,
  deleteCompany,
  getCompany,
  isValidCompanyId,
  parseCompanyInput,
  updateCompany,
} from "@/lib/companies";

export const runtime = "nodejs";
type Context = { params: Promise<{ companyId: string }> };

async function companyIdFrom(context: Context) {
  const { companyId } = await context.params;
  if (!isValidCompanyId(companyId)) throw new CompanyNotFoundError();
  return companyId;
}

export async function GET(_request: NextRequest, context: Context) {
  try {
    const { company, questions } = await getCompany(await companyIdFrom(context));
    return NextResponse.json({ company, questions });
  } catch (error) {
    const status = error instanceof CompanyNotFoundError ? 404 : 500;
    if (status === 500) console.error("GET company error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load company." },
      { status }
    );
  }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    const company = await updateCompany(
      await companyIdFrom(context),
      parseCompanyInput(await request.json())
    );
    return NextResponse.json({ company });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update company.";
    const status = error instanceof CompanyNotFoundError
      ? 404
      : error instanceof CompanyInputError
        ? message.includes("already exists") ? 409 : 400
        : 500;
    if (status === 500) console.error("PUT company error:", error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    await deleteCompany(await companyIdFrom(context));
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = error instanceof CompanyNotFoundError ? 404 : 500;
    if (status === 500) console.error("DELETE company error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete company." },
      { status }
    );
  }
}
