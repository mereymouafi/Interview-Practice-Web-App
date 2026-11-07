import {
  createCompanyFolder,
  getCompanyFolderId,
  getDrive,
  listCompanyFolders,
  readJsonFile,
  trashCompanyFolder,
  writeJsonFile,
} from "@/lib/drive";

export type Company = {
  id: string;
  name: string;
  website?: string;
  position: string;
  description?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type CompanyQuestion = {
  id: string;
  companyId: string;
  question: string;
  answer: string;
  category: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export class CompanyNotFoundError extends Error {
  constructor() {
    super("Company not found.");
  }
}

export class CompanyInputError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class CompanyQuestionNotFoundError extends Error {
  constructor() {
    super("Question not found.");
  }
}

function cleanOptional(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseCompanyInput(value: unknown) {
  if (!value || typeof value !== "object") throw new CompanyInputError("Company details are required.");
  const data = value as Record<string, unknown>;
  const name = cleanOptional(data.name);
  if (!name || name.length > 120) throw new CompanyInputError("Company name is required and must be under 120 characters.");
  return {
    name,
    website: cleanOptional(data.website),
    position: cleanOptional(data.position),
    description: cleanOptional(data.description),
    notes: cleanOptional(data.notes),
  };
}

export function parseQuestionInput(value: unknown) {
  if (!value || typeof value !== "object") throw new CompanyInputError("Question details are required.");
  const data = value as Record<string, unknown>;
  const question = cleanOptional(data.question);
  const answer = cleanOptional(data.answer);
  if (!question || question.length > 2000) throw new CompanyInputError("Question is required and must be under 2,000 characters.");
  if (!answer || answer.length > 12000) throw new CompanyInputError("Prepared answer is required and must be under 12,000 characters.");
  return {
    question,
    answer,
    category: cleanOptional(data.category).slice(0, 80),
    notes: cleanOptional(data.notes).slice(0, 4000),
  };
}

export async function listCompanies() {
  const drive = await getDrive();
  const folders = await listCompanyFolders(drive);
  const companies = await Promise.all(
    folders.map(async (folder) => {
      if (!folder.id || !folder.appProperties?.companyId) return null;
      const metadata = await readJsonFile<Company>(drive, folder.id, "company.json");
      if (!metadata || metadata.value.id !== folder.appProperties.companyId) return null;
      const questions = await readJsonFile<CompanyQuestion[]>(drive, folder.id, "questions.json");
      return {
        ...metadata.value,
        questionCount: Array.isArray(questions?.value) ? questions.value.length : 0,
      };
    })
  );
  return companies.filter((company): company is NonNullable<typeof company> => company !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCompany(companyId: string) {
  const drive = await getDrive();
  const folderId = await getCompanyFolderId(drive, companyId);
  if (!folderId) throw new CompanyNotFoundError();
  const metadata = await readJsonFile<Company>(drive, folderId, "company.json");
  if (!metadata || metadata.value.id !== companyId) throw new CompanyNotFoundError();
  const questionsFile = await readJsonFile<CompanyQuestion[]>(drive, folderId, "questions.json");
  return {
    company: metadata.value,
    questions: Array.isArray(questionsFile?.value) ? questionsFile.value : [],
    folderId,
    companyFileId: metadata.id,
    questionsFileId: questionsFile?.id,
  };
}

export async function createCompany(input: ReturnType<typeof parseCompanyInput>) {
  const drive = await getDrive();
  const existing = await listCompanies();
  if (existing.some((company) => company.name.toLocaleLowerCase() === input.name.toLocaleLowerCase())) {
    throw new CompanyInputError("A company with this name already exists.");
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const company: Company = { id, ...input, createdAt: now, updatedAt: now };
  const folderId = await createCompanyFolder(drive, id, input.name);
  await writeJsonFile(drive, folderId, "company.json", company);
  await writeJsonFile<CompanyQuestion[]>(drive, folderId, "questions.json", []);
  return company;
}

export async function updateCompany(
  companyId: string,
  input: ReturnType<typeof parseCompanyInput>
) {
  const { company, folderId, companyFileId } = await getCompany(companyId);
  const companies = await listCompanies();
  if (companies.some((other) => other.id !== companyId && other.name.toLocaleLowerCase() === input.name.toLocaleLowerCase())) {
    throw new CompanyInputError("A company with this name already exists.");
  }
  const updated: Company = {
    ...company,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  const drive = await getDrive();
  await writeJsonFile(drive, folderId, "company.json", updated, companyFileId);
  return updated;
}

export async function deleteCompany(companyId: string) {
  const { folderId } = await getCompany(companyId);
  const drive = await getDrive();
  await trashCompanyFolder(drive, folderId);
}

export async function updateQuestions(companyId: string, operation: "add" | "update" | "delete", payload: unknown, questionId?: string) {
  const drive = await getDrive();
  const { company, folderId, companyFileId, questionsFileId, questions } = await getCompany(companyId);
  let next = [...questions];
  if (operation === "add") {
    const input = parseQuestionInput(payload);
    const now = new Date().toISOString();
    next.push({ id: crypto.randomUUID(), companyId, ...input, createdAt: now, updatedAt: now });
  } else {
    const index = next.findIndex((item) => item.id === questionId && item.companyId === company.id);
    if (index < 0) throw new CompanyQuestionNotFoundError();
    if (operation === "delete") next.splice(index, 1);
    else {
      const input = parseQuestionInput(payload);
      next[index] = { ...next[index], ...input, updatedAt: new Date().toISOString() };
    }
  }
  await writeJsonFile(drive, folderId, "questions.json", next, questionsFileId);
  await writeJsonFile(
    drive,
    folderId,
    "company.json",
    { ...company, updatedAt: new Date().toISOString() },
    companyFileId
  );
  return next;
}

export function isValidCompanyId(companyId: string) {
  return companyId.length <= 100 && /^[a-zA-Z0-9-]+$/.test(companyId);
}
