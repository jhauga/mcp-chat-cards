// Local file access for plug-n-play workflows: the model generates files
// during a conversation (project archives, guides, data) and these helpers
// bring their contents into cards. Reads are text-only and size-capped, and
// can be confined to a root directory via MCP_CHAT_CARDS_FS_ROOT.
import { promises as fs } from "node:fs";
import path from "node:path";

export class FileAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileAccessError";
  }
}

export const DEFAULT_MAX_FILE_BYTES = 512 * 1024;

export interface TextFileResult {
  path: string;
  content: string;
  size: number;
  truncated: boolean;
}

// A caller working over a remote bridge sometimes sends a path from ITS
// filesystem (a cloud sandbox is usually Linux, this server may run on
// Windows). path.resolve would silently graft the local drive onto "/root/x"
// and report `C:\root\x not found` - a path that never existed on either
// machine. Naming the actual mismatch is the only actionable error.
export function assertNativePath(
  inputPath: string,
  platform: NodeJS.Platform = process.platform,
): void {
  const trimmed = inputPath.trim();
  if (/^~([\\/]|$)/.test(trimmed)) {
    throw new FileAccessError(
      `Home-relative paths are not expanded: ${trimmed}. Pass an absolute path on the machine ` +
        "running this server.",
    );
  }
  // A single leading slash is a POSIX absolute path; "//host/share" and
  // "\\host\share" are UNC names, which Windows resolves natively.
  const posixAbsolute = /^\/(?!\/)/.test(trimmed);
  const windowsAbsolute = /^[a-zA-Z]:[\\/]/.test(trimmed) || /^\\\\/.test(trimmed);
  if (platform === "win32" && posixAbsolute) {
    throw new FileAccessError(
      `Expected a path on the machine running this server (Windows), got a POSIX path: ` +
        `${trimmed}. If the file exists only in the caller's environment, pass its content ` +
        "to the card tool directly instead of a path.",
    );
  }
  if (platform !== "win32" && windowsAbsolute) {
    throw new FileAccessError(
      `Expected a path on the machine running this server (POSIX), got a Windows path: ` +
        `${trimmed}. If the file exists only in the caller's environment, pass its content ` +
        "to the card tool directly instead of a path.",
    );
  }
}

// Resolve a path to absolute form and, when MCP_CHAT_CARDS_FS_ROOT is set,
// require it to stay inside that root.
export function resolveLocalPath(inputPath: string): string {
  if (!inputPath || inputPath.trim().length === 0) {
    throw new FileAccessError("A file path is required.");
  }
  assertNativePath(inputPath);
  const resolved = path.resolve(inputPath);
  const root = process.env.MCP_CHAT_CARDS_FS_ROOT;
  if (root) {
    const resolvedRoot = path.resolve(root);
    const relative = path.relative(resolvedRoot, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new FileAccessError(
        `Path is outside the allowed root (${resolvedRoot}): ${resolved}`,
      );
    }
  }
  return resolved;
}

// Binary sniff: a null byte in the first chunk means "not text".
export function looksBinary(buffer: Buffer): boolean {
  const probe = buffer.subarray(0, 8192);
  return probe.includes(0);
}

export async function readLocalTextFile(
  inputPath: string,
  maxBytes = DEFAULT_MAX_FILE_BYTES,
): Promise<TextFileResult> {
  const resolved = resolveLocalPath(inputPath);
  let stat;
  try {
    stat = await fs.stat(resolved);
  } catch {
    throw new FileAccessError(`File not found: ${resolved}`);
  }
  if (!stat.isFile()) {
    throw new FileAccessError(`Not a file: ${resolved}`);
  }
  const buffer = await fs.readFile(resolved);
  if (looksBinary(buffer)) {
    throw new FileAccessError(
      `File appears to be binary: ${resolved}. Only text files can be read into cards.`,
    );
  }
  const truncated = buffer.length > maxBytes;
  return {
    path: resolved,
    content: buffer.subarray(0, maxBytes).toString("utf8"),
    size: buffer.length,
    truncated,
  };
}

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  rs: "rust",
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  rb: "ruby",
  go: "go",
  java: "java",
  kt: "kotlin",
  cs: "csharp",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  php: "php",
  swift: "swift",
  sh: "bash",
  bash: "bash",
  ps1: "powershell",
  bat: "batch",
  sql: "sql",
  html: "html",
  css: "css",
  scss: "scss",
  json: "json",
  toml: "toml",
  yml: "yaml",
  yaml: "yaml",
  xml: "xml",
  md: "markdown",
  txt: "text",
  lock: "text",
  gitignore: "text",
  env: "text",
  cfg: "text",
  ini: "text",
};

export function languageForFile(filePath: string): string {
  const base = path.basename(filePath).toLowerCase();
  const ext = base.includes(".") ? base.slice(base.lastIndexOf(".") + 1) : base;
  return LANGUAGE_BY_EXTENSION[ext] ?? "text";
}

export function isLikelyTextFile(filePath: string): boolean {
  const base = path.basename(filePath).toLowerCase();
  if (["makefile", "dockerfile", "license", "readme"].includes(base)) return true;
  const ext = base.includes(".") ? base.slice(base.lastIndexOf(".") + 1) : "";
  return ext in LANGUAGE_BY_EXTENSION;
}

const MANIFEST_FILES = ["cargo.toml", "package.json", "pyproject.toml", "go.mod", "gemfile"];

// Order project files the way a reader wants to meet them: README, then
// manifests, then source folders, then everything else. Full sorting is for
// paths with no meaningful order of their own (zip entries); an explicit
// caller-provided list goes through hoistProjectAnchors instead.
export function sortProjectFiles(paths: string[]): string[] {
  const rank = (filePath: string): number => {
    const normalized = filePath.replace(/\\/g, "/").toLowerCase();
    const base = path.basename(normalized);
    if (base.startsWith("readme")) return 0;
    if (MANIFEST_FILES.includes(base)) return 1;
    if (normalized.includes("src/") || normalized.includes("lib/")) return 2;
    if (base.endsWith(".md")) return 4;
    return 3;
  };
  return [...paths].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

// Bring README and manifests to the front and keep every other file exactly
// where the caller put it. An explicit file list often encodes a teaching
// order (data model, then errors, then the entry point) that an alphabetical
// sort would destroy.
export function hoistProjectAnchors(paths: string[]): string[] {
  const rank = (filePath: string): number => {
    const base = path.basename(filePath.replace(/\\/g, "/").toLowerCase());
    if (base.startsWith("readme")) return 0;
    if (MANIFEST_FILES.includes(base)) return 1;
    return 2;
  };
  // Array.prototype.sort is stable, so files of equal rank keep caller order.
  return [...paths].sort((a, b) => rank(a) - rank(b));
}
