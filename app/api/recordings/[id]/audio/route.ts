import { NextRequest, NextResponse } from "next/server";
import { getDrive, APP_MARKER } from "@/lib/drive";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const drive = await getDrive();
    const metadata = await drive.files.get({ fileId: id, fields: "id,name,mimeType,appProperties" });
    if (metadata.data.appProperties?.app !== APP_MARKER) {
      return NextResponse.json({ error: "Recording not found." }, { status: 404 });
    }
    const media = await drive.files.get({ fileId: id, alt: "media" }, { responseType: "arraybuffer" });
    const bytes = Buffer.from(media.data as ArrayBuffer);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": metadata.data.mimeType || "audio/webm",
        "Content-Disposition": `inline; filename="${(metadata.data.name || "recording").replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not play recording." }, { status: 500 });
  }
}
