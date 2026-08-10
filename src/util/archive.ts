// Read zip archives the model generated during a conversation so their
// contents can be turned into cards. Everything happens in memory with
// caps against oversized or malicious archives.
import { promises as fs } from "node:fs";
import { unzipSync } from "fflate";
import {
  FileAccessError,
  isLikelyTextFile,
  languageForFile,
  looksBinary,
  resolveLocalPath,
  sortProjectFiles,
} from "./files.js";

export interface ArchiveEntry {
  path: string;
  size: number;
  isText: boolean;
}

export interface ArchiveFile {
  path: string;
  language: string;
  content: string;
  truncated: boolean;
}

export interface ArchiveResult {
  archivePath: string;
  entries: ArchiveEntry[];
  files: ArchiveFile[];
  skipped: string[];
}

export interface ReadArchiveOptions {
  // Only include files whose path contains one of these substrings
  // (case-insensitive), e.g. ["src/", "Cargo.toml"].
  include?: string[];
  maxFiles?: number;
  maxFileBytes?: number;
  maxTotalBytes?: number;
  maxArchiveBytes?: number;
}

const DEFAULTS = {
  maxFiles: 40,
  maxFileBytes: 256 * 1024,
  maxTotalBytes: 4 * 1024 * 1024,
  maxArchiveBytes: 32 * 1024 * 1024,
};

// Build-cache and dependency folders are never useful in a tutorial card.
const IGNORED_SEGMENTS = ["node_modules/", "target/", ".git/", "dist/", "__pycache__/", ".venv/"];

export async function readArchive(
  inputPath: string,
  options: ReadArchiveOptions = {},
): Promise<ArchiveResult> {
  const archivePath = resolveLocalPath(inputPath);
  const maxFiles = options.maxFiles ?? DEFAULTS.maxFiles;
  const maxFileBytes = options.maxFileBytes ?? DEFAULTS.maxFileBytes;
  const maxTotalBytes = options.maxTotalBytes ?? DEFAULTS.maxTotalBytes;
  const maxArchiveBytes = options.maxArchiveBytes ?? DEFAULTS.maxArchiveBytes;

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(archivePath);
  } catch {
    throw new FileAccessError(`Archive not found: ${archivePath}`);
  }
  if (buffer.length > maxArchiveBytes) {
    throw new FileAccessError(
      `Archive is too large (${buffer.length} bytes, cap ${maxArchiveBytes}).`,
    );
  }

  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(new Uint8Array(buffer));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new FileAccessError(`Could not read the archive (${reason}). Only zip files are supported.`);
  }

  const include = (options.include ?? []).map((value) => value.toLowerCase());
  const matchesInclude = (entryPath: string): boolean =>
    include.length === 0 || include.some((needle) => entryPath.toLowerCase().includes(needle));
  const isIgnored = (entryPath: string): boolean =>
    IGNORED_SEGMENTS.some((segment) => entryPath.toLowerCase().includes(segment));

  const entries: ArchiveEntry[] = [];
  const skipped: string[] = [];
  const candidates = new Map<string, Uint8Array>();

  for (const [entryPath, data] of Object.entries(unzipped)) {
    if (entryPath.endsWith("/")) continue;
    const isText = isLikelyTextFile(entryPath) && !looksBinary(Buffer.from(data.subarray(0, 8192)));
    entries.push({ path: entryPath, size: data.length, isText });
    if (isIgnored(entryPath) || !matchesInclude(entryPath)) continue;
    if (!isText) {
      skipped.push(`${entryPath} (binary)`);
      continue;
    }
    candidates.set(entryPath, data);
  }

  const files: ArchiveFile[] = [];
  let totalBytes = 0;
  for (const entryPath of sortProjectFiles([...candidates.keys()])) {
    if (files.length >= maxFiles) {
      skipped.push(`${entryPath} (file cap ${maxFiles} reached)`);
      continue;
    }
    const data = candidates.get(entryPath) as Uint8Array;
    if (totalBytes + Math.min(data.length, maxFileBytes) > maxTotalBytes) {
      skipped.push(`${entryPath} (total size cap reached)`);
      continue;
    }
    const truncated = data.length > maxFileBytes;
    const slice = data.subarray(0, maxFileBytes);
    totalBytes += slice.length;
    files.push({
      path: entryPath,
      language: languageForFile(entryPath),
      content: Buffer.from(slice).toString("utf8"),
      truncated,
    });
  }

  entries.sort((a, b) => a.path.localeCompare(b.path));
  return { archivePath, entries, files, skipped };
}
