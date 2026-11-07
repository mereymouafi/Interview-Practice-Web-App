import { google } from "googleapis";
import { Readable } from "node:stream";
import { driveClient } from "@/lib/session";

const APP_MARKER = "interview-practice-v1";
const COMPANY_MARKER = "interview-practice-company-v1";
const QUESTION_BANK_MARKER = "interview-practice-general-question-bank-v1";

export type CompanyFolderRef = {
  id?: string | null;
  name?: string | null;
  appProperties?: Record<string, string> | null;
};

export async function getDrive() {
  const auth = await driveClient();
  if (!auth) throw new Error("Please sign in with Google first.");
  return google.drive({ version: "v3", auth });
}

export async function getAppFolderId(drive: Awaited<ReturnType<typeof getDrive>>) {
  const found = await drive.files.list({
    q: "name = 'Interview Practice' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: "files(id,name)",
    pageSize: 10,
  });
  const folder = found.data.files?.[0];
  if (folder?.id) return folder.id;
  const created = await drive.files.create({
    requestBody: { name: "Interview Practice", mimeType: "application/vnd.google-apps.folder" },
    fields: "id",
  });
  if (!created.data.id) throw new Error("Could not create the Drive folder.");
  return created.data.id;
}

async function ensureFolder(
  drive: Awaited<ReturnType<typeof getDrive>>,
  name: string,
  parentId: string,
  marker: string
) {
  const found = await drive.files.list({
    q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id,name,appProperties)",
    pageSize: 100,
  });
  const folders = (found.data.files || []) as CompanyFolderRef[];
  const folder = folders.find((file) => file.name === name && file.appProperties?.app === marker);
  if (folder?.id) return folder.id;
  const created = await drive.files.create({
    requestBody: {
      name,
      parents: [parentId],
      mimeType: "application/vnd.google-apps.folder",
      appProperties: { app: marker },
    },
    fields: "id",
  });
  if (!created.data.id) throw new Error(`Could not create the ${name} Drive folder.`);
  return created.data.id;
}

export async function getCompaniesFolderId(drive: Awaited<ReturnType<typeof getDrive>>) {
  const rootId = await getAppFolderId(drive);
  return ensureFolder(drive, "companies", rootId, COMPANY_MARKER);
}

export async function getGeneralQuestionBankFolderId(
  drive: Awaited<ReturnType<typeof getDrive>>
) {
  const rootId = await getAppFolderId(drive);
  return ensureFolder(drive, "general-question-bank", rootId, QUESTION_BANK_MARKER);
}

export async function getCompanyFolderId(
  drive: Awaited<ReturnType<typeof getDrive>>,
  companyId: string
) {
  const companiesId = await getCompaniesFolderId(drive);
  const found = await drive.files.list({
    q: `'${companiesId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id,appProperties)",
    pageSize: 1000,
  });
  const folders = (found.data.files || []) as CompanyFolderRef[];
  const folder = folders.find(
    (file) =>
      file.appProperties?.app === COMPANY_MARKER &&
      file.appProperties?.companyId === companyId
  );
  return folder?.id || null;
}

export async function listCompanyFolders(
  drive: Awaited<ReturnType<typeof getDrive>>
): Promise<CompanyFolderRef[]> {
  const companiesId = await getCompaniesFolderId(drive);
  const found = await drive.files.list({
    q: `'${companiesId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id,name,appProperties)",
    pageSize: 1000,
  });
  return ((found.data.files || []) as CompanyFolderRef[]).filter(
    (file) => file.id && file.appProperties?.app === COMPANY_MARKER
  );
}

export async function createCompanyFolder(
  drive: Awaited<ReturnType<typeof getDrive>>,
  companyId: string,
  name: string
) {
  const companiesId = await getCompaniesFolderId(drive);
  const created = await drive.files.create({
    requestBody: {
      name: safePart(name),
      parents: [companiesId],
      mimeType: "application/vnd.google-apps.folder",
      appProperties: { app: COMPANY_MARKER, companyId },
    },
    fields: "id",
  });
  if (!created.data.id) throw new Error("Could not create the company Drive folder.");
  return created.data.id;
}

export async function getCompanyRecordingsFolderId(
  drive: Awaited<ReturnType<typeof getDrive>>,
  companyId: string
) {
  const companyFolderId = await getCompanyFolderId(drive, companyId);
  if (!companyFolderId) throw new Error("Company not found.");
  return ensureFolder(drive, "recordings", companyFolderId, COMPANY_MARKER);
}

export async function readJsonFile<T>(
  drive: Awaited<ReturnType<typeof getDrive>>,
  folderId: string,
  fileName: string
): Promise<{ id: string; value: T } | null> {
  const found = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType)",
    pageSize: 100,
  });
  const files = (found.data.files || []) as Array<{ id?: string | null; name?: string | null }>;
  const file = files.find((item) => item.name === fileName);
  if (!file?.id) return null;
  const response = await drive.files.get(
    { fileId: file.id, alt: "media" },
    { responseType: "text" }
  );
  return { id: file.id, value: JSON.parse(String(response.data)) as T };
}

export async function writeJsonFile<T>(
  drive: Awaited<ReturnType<typeof getDrive>>,
  folderId: string,
  fileName: string,
  value: T,
  existingFileId?: string
) {
  const body = Readable.from([Buffer.from(JSON.stringify(value, null, 2))]);
  if (existingFileId) {
    await drive.files.update({
      fileId: existingFileId,
      media: { mimeType: "application/json", body },
    });
    return existingFileId;
  }
  const created = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId], mimeType: "application/json" },
    media: { mimeType: "application/json", body },
    fields: "id",
  });
  if (!created.data.id) throw new Error(`Could not create ${fileName} in Google Drive.`);
  return created.data.id;
}

export async function trashCompanyFolder(
  drive: Awaited<ReturnType<typeof getDrive>>,
  folderId: string
) {
  const children = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,mimeType)",
    pageSize: 1000,
  });
  for (const child of children.data.files || []) {
    if (!child.id) continue;
    if (child.mimeType === "application/vnd.google-apps.folder") {
      await trashCompanyFolder(drive, child.id);
    } else {
      await drive.files.update({ fileId: child.id, requestBody: { trashed: true } });
    }
  }
  await drive.files.update({ fileId: folderId, requestBody: { trashed: true } });
}

export function safePart(value: string) {
  return value.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_").slice(0, 70) || "Interview_Answer";
}

export { APP_MARKER, COMPANY_MARKER, QUESTION_BANK_MARKER };
