import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PublicationBook } from "./model.js";

export interface MaterializedAssets {
  hrefByMediaId: Record<string, string>;
  files: Array<{ absolutePath: string; href: string; mediaType: string }>;
}

export async function materializeAssets(book: PublicationBook, oebpsRoot: string): Promise<MaterializedAssets> {
  const directory = path.join(oebpsRoot, "images");
  await mkdir(directory, { recursive: true });

  const hrefByMediaId: Record<string, string> = {};
  const files: MaterializedAssets["files"] = [];

  for (const media of Object.values(book.media)) {
    if (!["Image", "Map"].includes(media.type)) continue;
    const source = media.externalUrl ?? media.permanentUrl;
    if (!source) continue;

    const response = await fetch(source, { redirect: "follow" });
    if (!response.ok) throw new Error(`Asset download failed (${response.status}) for ${media.name}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const contentType = normalizeMediaType(response.headers.get("content-type"));
    const extension = extensionFor(contentType, source);
    const fileName = `${safe(media.id)}${extension}`;
    const absolutePath = path.join(directory, fileName);
    await writeFile(absolutePath, bytes);

    const href = `images/${fileName}`;
    hrefByMediaId[media.id] = href;
    files.push({ absolutePath, href, mediaType: contentType });
  }

  return { hrefByMediaId, files };
}

function normalizeMediaType(value: string | null): string {
  const type = value?.split(";")[0]?.trim().toLowerCase();
  if (type?.startsWith("image/")) return type;
  return "image/jpeg";
}

function extensionFor(mediaType: string, source: string): string {
  const fromType: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg"
  };
  if (fromType[mediaType]) return fromType[mediaType];
  const ext = path.extname(new URL(source).pathname).toLowerCase();
  return ext && ext.length <= 6 ? ext : ".jpg";
}

function safe(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "");
}
