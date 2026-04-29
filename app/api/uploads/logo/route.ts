import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"]);

const getExtensionFromMime = (mimeType: string) => {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/jpeg":
    case "image/jpg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/svg+xml":
      return ".svg";
    default:
      return "";
  }
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file upload." }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Unsupported file type. Use PNG, JPG, WEBP, or SVG." }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File too large. Maximum size is 2MB." }, { status: 400 });
    }

    const extension = getExtensionFromMime(file.type);
    if (!extension) {
      return NextResponse.json({ error: "Could not determine file extension." }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const safeName = file.name.toLowerCase().replace(/[^a-z0-9.-]/g, "-").replace(/-+/g, "-");
    const baseName = safeName.replace(/\.[a-z0-9]+$/, "") || "logo";
    const filename = `${baseName}-${Date.now()}${extension}`;
    const destination = path.join(uploadsDir, filename);

    const bytes = await file.arrayBuffer();
    await writeFile(destination, Buffer.from(bytes));

    return NextResponse.json({
      success: true,
      url: `/uploads/${filename}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload logo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
