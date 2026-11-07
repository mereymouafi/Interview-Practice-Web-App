import { NextResponse } from "next/server";
import { APP_MARKER, getDrive } from "@/lib/drive";

export const runtime = "nodejs";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!/^[\w-]{10,}$/.test(id)) {
      return NextResponse.json({ error: "Recording not found." }, { status: 404 });
    }

    const drive = await getDrive();
    const file = await drive.files.get({ fileId: id, fields: "id,mimeType,appProperties" });
    if (
      file.data.mimeType === "application/vnd.google-apps.folder" ||
      file.data.appProperties?.app !== APP_MARKER
    ) {
      return NextResponse.json({ error: "Recording not found." }, { status: 404 });
    }

    await drive.files.delete({ fileId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE recording error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete recording." },
      { status: 500 }
    );
  }
}
