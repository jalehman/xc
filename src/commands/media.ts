/**
 * Media upload command: upload images, GIFs, or videos to the X API.
 *
 * Usage:
 *   xc media upload <file>              — upload and return media_id
 *   xc media upload <file> --type video — force video category
 *
 * Supports:
 *   Images: up to 5MB  (one-shot upload)
 *   GIFs:   up to 15MB (chunked upload)
 *   Video:  up to 512MB (chunked upload)
 */

import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { getClient } from "../lib/api.js";
import { getAccount } from "../lib/config.js";

/** MIME type detection based on file extension. */
const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".webp": "image/webp",
  ".tiff": "image/tiff",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".ts": "video/mp2t",
};

/** File extension to media category mapping. */
const CATEGORY_MAP: Record<string, string> = {
  ".jpg": "tweet_image",
  ".jpeg": "tweet_image",
  ".png": "tweet_image",
  ".bmp": "tweet_image",
  ".webp": "tweet_image",
  ".tiff": "tweet_image",
  ".gif": "tweet_gif",
  ".mp4": "tweet_video",
  ".webm": "tweet_video",
  ".mov": "tweet_video",
  ".ts": "tweet_video",
};

/** Size limits by category in bytes. */
const SIZE_LIMITS: Record<string, number> = {
  tweet_image: 5 * 1024 * 1024,
  tweet_gif: 15 * 1024 * 1024,
  tweet_video: 512 * 1024 * 1024,
};

/** Chunk size for chunked uploads (5MB). */
const CHUNK_SIZE = 5 * 1024 * 1024;

/** Response shape from media upload status API. */
interface UploadStatusData {
  id?: string;
  processingInfo?: {
    state?: string;
    checkAfterSecs?: number;
    error?: { message?: string };
  };
}

/**
 * Upload media using chunked (INIT/APPEND/FINALIZE) flow.
 * Used for GIFs and videos that exceed one-shot limits.
 */
async function chunkedUpload(
  client: Awaited<ReturnType<typeof getClient>>,
  filePath: string,
  mediaType: string,
  mediaCategory: string,
  accountName?: string,
): Promise<string> {
  const fileSize = fs.statSync(filePath).size;

  // INIT — tell API what we're uploading
  const initResult = await client.media.initializeUpload({
    body: {
      mediaType,
      mediaCategory,
      totalBytes: fileSize,
    },
  } as Record<string, unknown>);

  const mediaId = (initResult as Record<string, Record<string, string>>).data
    ?.id;
  if (!mediaId) {
    throw new Error("Failed to initialize upload (no media ID returned)");
  }

  // APPEND — send file in chunks via multipart/form-data
  // The X API v2 APPEND endpoint requires multipart, not JSON body
  const account = getAccount(accountName);
  const accessToken = account?.auth?.accessToken;
  if (!accessToken) {
    throw new Error("No access token available for chunked upload");
  }

  const fd = fs.openSync(filePath, "r");
  try {
    let segmentIndex = 0;
    let bytesRead = 0;

    while (bytesRead < fileSize) {
      const chunkLen = Math.min(CHUNK_SIZE, fileSize - bytesRead);
      const buffer = Buffer.alloc(chunkLen);
      fs.readSync(fd, buffer, 0, chunkLen, bytesRead);

      const formData = new FormData();
      formData.append("media", new Blob([buffer]), path.basename(filePath));
      formData.append("segment_index", String(segmentIndex));

      const appendUrl = `https://api.x.com/2/media/upload/${mediaId}/append`;
      const resp = await fetch(appendUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });

      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(
          `APPEND failed (segment ${segmentIndex}): HTTP ${resp.status} ${body}`,
        );
      }

      bytesRead += chunkLen;
      segmentIndex++;

      // Show progress for large uploads
      const pct = Math.round((bytesRead / fileSize) * 100);
      console.error(`Uploading... ${pct}%`);
    }
  } finally {
    fs.closeSync(fd);
  }

  // FINALIZE — tell API we're done
  const finalResult = await client.media.finalizeUpload(mediaId);
  const finalData = (finalResult as Record<string, UploadStatusData>).data;

  // Poll for processing completion if needed (video transcoding)
  if (mediaCategory === "tweet_video" || finalData?.processingInfo) {
    await waitForProcessing(client, mediaId);
  }

  return mediaId;
}

/**
 * Poll the upload status endpoint until processing completes.
 * Videos require server-side transcoding that takes time.
 */
async function waitForProcessing(
  client: Awaited<ReturnType<typeof getClient>>,
  mediaId: string,
): Promise<void> {
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    const status = await client.media.getUploadStatus(mediaId, {
      command: "STATUS",
    } as Parameters<typeof client.media.getUploadStatus>[1]);
    const data = (status as Record<string, UploadStatusData>).data;
    const info = data?.processingInfo;

    if (!info || info.state === "succeeded") return;

    if (info.state === "failed") {
      throw new Error(
        `Media processing failed: ${info.error?.message ?? "unknown error"}`,
      );
    }

    // Wait the suggested interval or default to 5 seconds
    const waitSecs = info.checkAfterSecs ?? 5;
    console.error(`Processing... (check again in ${waitSecs}s)`);
    await new Promise((r) => setTimeout(r, waitSecs * 1000));
  }

  throw new Error("Media processing timed out");
}

/**
 * Upload a file using one-shot upload (images only, ≤5MB).
 * Returns the media_id string.
 */
async function oneShotUpload(
  client: Awaited<ReturnType<typeof getClient>>,
  filePath: string,
  mediaType: string,
  mediaCategory: string,
): Promise<string> {
  const fileData = fs.readFileSync(filePath);
  const base64 = fileData.toString("base64");

  const result = await client.media.upload({
    body: {
      media: base64,
      mediaType,
      mediaCategory,
    },
  } as Record<string, unknown>);

  const mediaId = (result as Record<string, Record<string, string>>).data?.id;
  if (!mediaId) {
    throw new Error("Upload failed (no media ID returned)");
  }

  return mediaId;
}

/**
 * Upload a file and return its media_id.
 * Automatically selects one-shot vs. chunked upload based on type.
 */
export async function uploadMedia(
  filePath: string,
  accountName?: string,
): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const mediaType = MIME_MAP[ext];
  if (!mediaType) {
    throw new Error(`Unsupported file type: ${ext}`);
  }

  const mediaCategory = CATEGORY_MAP[ext] ?? "tweet_image";
  const sizeLimit = SIZE_LIMITS[mediaCategory] ?? SIZE_LIMITS.tweet_image;
  const fileSize = fs.statSync(filePath).size;

  if (fileSize > sizeLimit) {
    const limitMB = Math.round(sizeLimit / 1024 / 1024);
    throw new Error(
      `File too large (${Math.round(fileSize / 1024 / 1024)}MB). ` +
        `${mediaCategory} limit is ${limitMB}MB.`,
    );
  }

  const client = await getClient(accountName);

  // Use one-shot for small images, chunked for GIFs and videos
  if (mediaCategory === "tweet_image") {
    return oneShotUpload(client, filePath, mediaType, mediaCategory);
  }
  return chunkedUpload(client, filePath, mediaType, mediaCategory, accountName);
}

export function registerMediaCommand(program: Command): void {
  const media = program
    .command("media")
    .description("Media upload operations");

  media
    .command("upload <file>")
    .description("Upload media and return media_id")
    .option("--json", "Output raw JSON")
    .option("--account <name>", "Account to use")
    .action(async (file: string, opts) => {
      try {
        const filePath = path.resolve(file);
        if (!fs.existsSync(filePath)) {
          console.error(`Error: file not found: ${filePath}`);
          process.exit(1);
        }

        const mediaId = await uploadMedia(filePath, opts.account);

        if (opts.json) {
          console.log(JSON.stringify({ mediaId }, null, 2));
          return;
        }

        console.log(`Uploaded: media_id=${mediaId}`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
