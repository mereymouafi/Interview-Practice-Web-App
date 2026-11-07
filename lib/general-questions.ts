import {
  getDrive,
  getGeneralQuestionBankFolderId,
  readJsonFile,
  writeJsonFile,
} from "@/lib/drive";

export const GENERAL_CATEGORIES = ["HR", "Technical", "Behavioral"] as const;
export type GeneralCategory = (typeof GENERAL_CATEGORIES)[number];
export const QUESTION_DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"] as const;
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number];

export type GeneralQuestion = {
  id: string;
  question: string;
  answer: string;
  category: GeneralCategory;
  difficulty?: QuestionDifficulty;
  tags?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

const LEGACY_QUESTIONS: Record<GeneralCategory, string[]> = {
  HR: [
    "Tell me about yourself.",
    "Why are you interested in this position?",
    "What do you know about our company?",
    "Why should we hire you?",
    "What are your greatest strengths?",
    "What is one skill you are currently working to improve?",
    "Where do you see yourself in the next three to five years?",
    "What motivates you at work?",
    "What are your salary expectations?",
    "Do you have any questions for us?",
  ],
  Technical: [
    "Can you describe one of your most relevant projects?",
    "What was the biggest technical challenge you faced, and how did you solve it?",
    "How would you explain your project architecture?",
    "How do you test and debug your code?",
    "How would you deploy a machine learning model into production?",
    "What is the difference between a REST API and a database?",
    "How do you monitor a machine learning pipeline?",
    "How do you handle missing or poor-quality data?",
    "Explain a technical concept to a non-technical person.",
    "Which technologies are you most comfortable working with, and why?",
  ],
  Behavioral: [
    "Tell me about a time you had to learn something quickly.",
    "Describe a situation where you worked as part of a team.",
    "How do you handle pressure or tight deadlines?",
    "Tell me about a mistake you made and what you learned from it.",
    "Describe a disagreement with a colleague and how you handled it.",
    "Tell me about a time you took initiative.",
    "How do you organize your work when you have several priorities?",
    "Describe a time you received difficult feedback.",
  ],
};

const CATEGORY_FILES: Record<GeneralCategory, string> = {
  HR: "hr.json",
  Technical: "technical.json",
  Behavioral: "behavioral.json",
};

export class QuestionInputError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class QuestionNotFoundError extends Error {
  constructor() {
    super("Question not found.");
  }
}

function isCategory(value: unknown): value is GeneralCategory {
  return typeof value === "string" && GENERAL_CATEGORIES.includes(value as GeneralCategory);
}

function validateTags(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20 || value.some((tag) => typeof tag !== "string")) {
    throw new QuestionInputError("Tags must be a list of up to 20 text values.");
  }
  const tags = value.map((tag: string) => tag.trim()).filter(Boolean).map((tag: string) => tag.slice(0, 40));
  return [...new Set(tags)];
}

export function parseGeneralQuestionInput(
  value: unknown
): Omit<GeneralQuestion, "id" | "createdAt" | "updatedAt"> {
  if (!value || typeof value !== "object") {
    throw new QuestionInputError("Question details are required.");
  }
  const data = value as Record<string, unknown>;
  const question = typeof data.question === "string" ? data.question.trim() : "";
  const answer = typeof data.answer === "string" ? data.answer.trim() : "";
  if (!question || question.length > 4000) {
    throw new QuestionInputError("Question is required and must be no more than 4,000 characters.");
  }
  if (answer.length > 20000) {
    throw new QuestionInputError("Prepared answer must be no more than 20,000 characters.");
  }
  if (!isCategory(data.category)) {
    throw new QuestionInputError("Choose HR, Technical, or Behavioral as the category.");
  }
  if (
    data.difficulty !== undefined &&
    data.difficulty !== "" &&
    !QUESTION_DIFFICULTIES.includes(data.difficulty as QuestionDifficulty)
  ) {
    throw new QuestionInputError("Choose Beginner, Intermediate, or Advanced as the difficulty.");
  }
  if (data.answer !== undefined && typeof data.answer !== "string") {
    throw new QuestionInputError("Prepared answer must be text.");
  }
  if (data.notes !== undefined && typeof data.notes !== "string") {
    throw new QuestionInputError("Notes must be text.");
  }
  const notes = typeof data.notes === "string" ? data.notes.trim() : "";
  if (notes.length > 5000) throw new QuestionInputError("Notes must be no more than 5,000 characters.");

  return {
    question,
    answer,
    category: data.category,
    ...(data.difficulty ? { difficulty: data.difficulty as QuestionDifficulty } : {}),
    tags: validateTags(data.tags),
    notes,
  };
}

async function getCategoryFile(
  drive: Awaited<ReturnType<typeof getDrive>>,
  folderId: string,
  category: GeneralCategory
) {
  const fileName = CATEGORY_FILES[category];
  const existing = await readJsonFile<GeneralQuestion[]>(drive, folderId, fileName);
  if (existing) {
    if (!Array.isArray(existing.value)) throw new Error(`${fileName} in Google Drive is not a valid question list.`);
    return existing;
  }

  const now = new Date().toISOString();
  const initialQuestions = LEGACY_QUESTIONS[category].map((question) => ({
    id: crypto.randomUUID(),
    question,
    answer: "",
    category,
    tags: [],
    notes: "",
    createdAt: now,
    updatedAt: now,
  }));
  const id = await writeJsonFile(drive, folderId, fileName, initialQuestions);
  return { id, value: initialQuestions };
}

async function getAllCategoryFiles() {
  const drive = await getDrive();
  const folderId = await getGeneralQuestionBankFolderId(drive);
  const files = await Promise.all(
    GENERAL_CATEGORIES.map(async (category) => ({
      category,
      ...(await getCategoryFile(drive, folderId, category)),
    }))
  );
  return { drive, folderId, files };
}

export async function listGeneralQuestions(category?: GeneralCategory) {
  const { files } = await getAllCategoryFiles();
  return files
    .filter((file) => !category || file.category === category)
    .flatMap((file) => file.value)
    .sort((a, b) => a.category.localeCompare(b.category) || a.question.localeCompare(b.question));
}

export async function createGeneralQuestion(
  input: ReturnType<typeof parseGeneralQuestionInput>
) {
  const { drive, folderId } = await getAllCategoryFiles();
  const file = await getCategoryFile(drive, folderId, input.category);
  if (file.value.some((item) => item.question.toLocaleLowerCase() === input.question.toLocaleLowerCase())) {
    throw new QuestionInputError("A question with this text already exists in that category.");
  }
  const now = new Date().toISOString();
  const question: GeneralQuestion = {
    id: crypto.randomUUID(),
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  await writeJsonFile(drive, folderId, CATEGORY_FILES[input.category], [...file.value, question], file.id);
  return question;
}

export async function updateGeneralQuestion(
  questionId: string,
  input: ReturnType<typeof parseGeneralQuestionInput>
) {
  const { drive, folderId, files } = await getAllCategoryFiles();
  const previousFile = files.find((file) => file.value.some((item) => item.id === questionId));
  const previous = previousFile?.value.find((item) => item.id === questionId);
  if (!previous || !previousFile) throw new QuestionNotFoundError();

  const targetFile = files.find((file) => file.category === input.category);
  if (!targetFile) throw new Error("Could not load the target question category.");
  if (targetFile.value.some(
    (item) => item.id !== questionId && item.question.toLocaleLowerCase() === input.question.toLocaleLowerCase()
  )) {
    throw new QuestionInputError("A question with this text already exists in that category.");
  }

  const updated: GeneralQuestion = { ...previous, ...input, updatedAt: new Date().toISOString() };
  if (previousFile.category === targetFile.category) {
    const updatedItems = previousFile.value.map((item) => item.id === questionId ? updated : item);
    await writeJsonFile(
      drive,
      folderId,
      CATEGORY_FILES[previousFile.category],
      updatedItems,
      previousFile.id
    );
  } else {
    await writeJsonFile(
      drive,
      folderId,
      CATEGORY_FILES[targetFile.category],
      [...targetFile.value, updated],
      targetFile.id
    );
    await writeJsonFile(
      drive,
      folderId,
      CATEGORY_FILES[previousFile.category],
      previousFile.value.filter((item) => item.id !== questionId),
      previousFile.id
    );
  }
  return updated;
}

export async function deleteGeneralQuestion(questionId: string) {
  const { drive, folderId, files } = await getAllCategoryFiles();
  const file = files.find((candidate) => candidate.value.some((item) => item.id === questionId));
  if (!file) throw new QuestionNotFoundError();
  const updated = file.value.filter((item) => item.id !== questionId);
  await writeJsonFile(drive, folderId, CATEGORY_FILES[file.category], updated, file.id);
}

export function isGeneralCategory(value: string): value is GeneralCategory {
  return isCategory(value);
}
