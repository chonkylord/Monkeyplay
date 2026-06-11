import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { access, mkdir, readFile, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

export async function sha1File(path: string): Promise<string> {
  const hash = createHash("sha1");
  hash.update(await readFile(path));
  return hash.digest("hex");
}

export async function verifySha1(path: string, expectedSha1?: string): Promise<boolean> {
  if (!expectedSha1) {
    return true;
  }
  try {
    return (await sha1File(path)).toLowerCase() === expectedSha1.toLowerCase();
  } catch {
    return false;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function downloadFile(url: string, targetPath: string, expectedSha1?: string): Promise<void> {
  // With a known hash we can trust an existing file; without one (e.g. loader
  // libraries from Maven) we must still fetch when the file is missing instead
  // of assuming it is already present.
  if (expectedSha1) {
    if (await verifySha1(targetPath, expectedSha1)) {
      return;
    }
  } else if (await fileExists(targetPath)) {
    return;
  }

  await mkdir(dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.download`;
  await rm(tempPath, { force: true });

  const response = await fetch(url, {
    headers: {
      "User-Agent": "MonkeyPlay/0.1.0"
    }
  });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }

  await pipeline(Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>), createWriteStream(tempPath));

  if (!(await verifySha1(tempPath, expectedSha1))) {
    await rm(tempPath, { force: true });
    throw new Error(`SHA-1 mismatch for ${url}`);
  }

  await rename(tempPath, targetPath);
}
