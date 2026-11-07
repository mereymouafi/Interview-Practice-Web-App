
import { NextRequest, NextResponse } from "next/server";
import {
  getAppFolderId,
  getDrive,
  safePart,
  APP_MARKER,
  getCompanyRecordingsFolderId,
  listCompanyFolders,
} from "@/lib/drive";
import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import { getCompany } from "@/lib/companies";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    const drive = await getDrive();
    const rootId = await getAppFolderId(drive);

    const companyFolders = await listCompanyFolders(drive);
    const folderIds = [rootId];
    for (const folder of companyFolders) {
      const companyId = folder.appProperties?.companyId;
      if (companyId) {
        try {
          folderIds.push(await getCompanyRecordingsFolderId(drive, companyId));
        } catch (error) {
          console.error("Could not load a company recordings folder:", error);
        }
      }
    }
    const responses = await Promise.all(folderIds.map((folderId) => drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      pageSize: 100,
      orderBy: "createdTime desc",
      fields: "files(id,name,mimeType,createdTime,appProperties)",
    })));

    const recordings = responses.flatMap((response: {
      data: {
        files?: Array<{
          id?: string | null;
          name?: string | null;
          mimeType?: string | null;
          appProperties?: {
            app?: string | null;
            question?: string;
            category?: string;
            date?: string;
            version?: string;
            duration?: string;
            companyId?: string;
            companyName?: string;
            position?: string;
            questionId?: string;
          } | null;
          createdTime?: string | null;
        }> | null;
      };
    }) => response.data.files || [])
      .filter(
        (file: {
          id?: string | null;
          mimeType?: string | null;
          appProperties?: { app?: string | null } | null;
        }) =>
          file.id &&
          file.mimeType !== "application/vnd.google-apps.folder" &&
          file.appProperties?.app === APP_MARKER
      )
      .map((file: {
        id?: string | null;
        name?: string | null;
        appProperties?: {
          question?: string;
          category?: string;
          date?: string;
          version?: string;
          duration?: string;
          companyId?: string;
          companyName?: string;
          position?: string;
          questionId?: string;
        } | null;
        createdTime?: string | null;
      }) => ({
        id: file.id!,
        name: file.name || "Audio answer",
        question: file.appProperties?.question || file.name || "Interview answer",
        category: file.appProperties?.category || "Other",
        date: file.appProperties?.date || "",
        version: Number(file.appProperties?.version || 1),
        duration: file.appProperties?.duration || "",
        companyId: file.appProperties?.companyId || "",
        companyName: file.appProperties?.companyName || "",
        position: file.appProperties?.position || "",
        questionId: file.appProperties?.questionId || "",
        createdTime: file.createdTime || "",
      }));

    return NextResponse.json({ recordings });
  } catch (error) {
    console.error("GET recordings error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load recordings.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();

    const audio = form.get("audio");
    const question = String(form.get("question") || "").trim();
    const category = String(form.get("category") || "Other").trim();
    const durationSeconds = String(form.get("durationSeconds") || "0");
    const companyId = String(form.get("companyId") || "").trim();
    const questionId = String(form.get("questionId") || "").trim();

    if (!(audio instanceof File) || !question) {
      return NextResponse.json(
        { error: "Audio file and question are required." },
        { status: 400 }
      );
    }

    if (audio.size === 0) {
      return NextResponse.json(
        { error: "The recording is empty." },
        { status: 400 }
      );
    }

    if (audio.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        {
          error:
            "Recording is larger than 20 MB. Please record a shorter answer.",
        },
        { status: 413 }
      );
    }

    const drive = await getDrive();
    const rootId = await getAppFolderId(drive);
    let parentId = rootId;
    let companyMetadata: { id: string; name: string; position: string; question: string } | null = null;
    if (companyId || questionId) {
      if (!companyId || !questionId) {
        return NextResponse.json({ error: "Company and question metadata must be provided together." }, { status: 400 });
      }
      const workspace = await getCompany(companyId);
      const savedQuestion = workspace.questions.find((item) => item.id === questionId);
      if (!savedQuestion || savedQuestion.question !== question) {
        return NextResponse.json({ error: "The selected company question could not be verified." }, { status: 400 });
      }
      companyMetadata = {
        id: workspace.company.id,
        name: workspace.company.name,
        position: workspace.company.position,
        question: savedQuestion.question,
      };
      parentId = await getCompanyRecordingsFolderId(drive, companyId);
    }

    const date = new Date().toISOString().slice(0, 10);
    const qSafe = safePart(question);

    const listed = await drive.files.list({
      q: `'${parentId}' in parents and trashed = false`,
      pageSize: 100,
      fields: "files(id,name,appProperties)",
    });

    const sameQuestion = (listed.data.files || []).filter(
      (file: {
        appProperties?: {
          app?: string | null;
          category?: string | null;
          question?: string | null;
          date?: string | null;
          questionId?: string | null;
        } | null;
      }) =>
        file.appProperties?.app === APP_MARKER &&
        file.appProperties?.category === category &&
        file.appProperties?.question === question &&
        file.appProperties?.date === date &&
        (file.appProperties?.questionId || "") === questionId
    );

    const version =
      sameQuestion.reduce(
        (max: number, file: { appProperties?: { version?: string | null } | null }) =>
          Math.max(max, Number(file.appProperties?.version || 0)),
        0
      ) + 1;

    const mime = audio.type || "audio/webm";
    const extension = mime.includes("mp4") ? "m4a" : "webm";
    const name = `${qSafe}_${date}_v${version}.${extension}`;

    const buffer = Buffer.from(await audio.arrayBuffer());

    const created = await drive.files.create({
      requestBody: {
        name,
        parents: [parentId],
        appProperties: {
          app: APP_MARKER,
          question,
          category,
          date,
          version: String(version),
          duration: durationSeconds,
          ...(companyMetadata ? {
            companyId: companyMetadata.id,
            companyName: companyMetadata.name,
            position: companyMetadata.position,
            questionId,
          } : {}),
        },
      },
      media: {
        mimeType: mime,
        body: Readable.from([buffer]),
      },
      fields: "id,name",
    });

    return NextResponse.json({
      recording: {
        id: created.data.id,
        name: created.data.name || name,
        question,
        category,
        date,
        version,
        duration: durationSeconds,
        ...(companyMetadata ? {
          companyId: companyMetadata.id,
          companyName: companyMetadata.name,
          position: companyMetadata.position,
          questionId,
        } : {}),
      },
    });
  } catch (error) {
    console.error("POST recordings error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not save recording.",
      },
      { status: 500 }
    );
  }
}
