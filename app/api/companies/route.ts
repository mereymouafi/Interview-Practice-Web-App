import { NextRequest, NextResponse } from "next/server";
import { CompanyInputError, createCompany, listCompanies, parseCompanyInput } from "@/lib/companies";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ companies: await listCompanies() });
  } catch (error) {
    console.error("GET companies error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load companies." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const company = await createCompany(parseCompanyInput(await request.json()));
    return NextResponse.json({ company }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create company.";
    const status = error instanceof CompanyInputError
      ? message.includes("already exists") ? 409 : 400
      : 500;
    if (status === 500) console.error("POST company error:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
