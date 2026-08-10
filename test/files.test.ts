import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { zipSync, strToU8 } from "fflate";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  FileAccessError,
  languageForFile,
  readLocalTextFile,
  resolveLocalPath,
  sortProjectFiles,
} from "../src/util/files.js";
import { readArchive } from "../src/util/archive.js";

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "mcc-test-"));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

afterEach(() => {
  delete process.env.MCP_CHAT_CARDS_FS_ROOT;
});

describe("readLocalTextFile", () => {
  it("reads text files and reports size", async () => {
    const file = path.join(dir, "notes.md");
    await writeFile(file, "# Notes\nhello");
    const result = await readLocalTextFile(file);
    expect(result.content).toContain("hello");
    expect(result.truncated).toBe(false);
  });

  it("refuses binary files", async () => {
    const file = path.join(dir, "blob.bin");
    await writeFile(file, Buffer.from([0x50, 0x4b, 0x00, 0x01, 0x02]));
    await expect(readLocalTextFile(file)).rejects.toThrow(/binary/);
  });

  it("truncates beyond the byte cap", async () => {
    const file = path.join(dir, "big.txt");
    await writeFile(file, "x".repeat(5000));
    const result = await readLocalTextFile(file, 1000);
    expect(result.content.length).toBe(1000);
    expect(result.truncated).toBe(true);
  });

  it("reports missing files clearly", async () => {
    await expect(readLocalTextFile(path.join(dir, "nope.txt"))).rejects.toThrow(/not found/i);
  });
});

describe("resolveLocalPath root restriction", () => {
  it("allows paths inside MCP_CHAT_CARDS_FS_ROOT and blocks escapes", () => {
    process.env.MCP_CHAT_CARDS_FS_ROOT = dir;
    expect(resolveLocalPath(path.join(dir, "ok.txt"))).toContain("ok.txt");
    expect(() => resolveLocalPath(path.join(dir, "..", "escape.txt"))).toThrow(FileAccessError);
  });
});

describe("languageForFile and ordering", () => {
  it("maps extensions to languages", () => {
    expect(languageForFile("src/main.rs")).toBe("rust");
    expect(languageForFile("Cargo.toml")).toBe("toml");
    expect(languageForFile("mystery.xyz")).toBe("text");
  });

  it("orders README, manifest, then source", () => {
    const sorted = sortProjectFiles(["src/main.rs", "Cargo.toml", "README.md", "LICENSE.md"]);
    expect(sorted[0]).toBe("README.md");
    expect(sorted[1]).toBe("Cargo.toml");
    expect(sorted[2]).toBe("src/main.rs");
  });
});

describe("readArchive", () => {
  let zipPath: string;

  beforeAll(async () => {
    const zipped = zipSync({
      "project/README.md": strToU8("# Sample project"),
      "project/Cargo.toml": strToU8('[package]\nname = "sample"'),
      "project/src/main.rs": strToU8('fn main() { println!("hi"); }'),
      "project/target/debug/build.bin": strToU8("cache noise"),
      "project/logo.png": new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]),
    });
    zipPath = path.join(dir, "sample.zip");
    await writeFile(zipPath, Buffer.from(zipped));
  });

  it("lists entries and returns ordered text files", async () => {
    const archive = await readArchive(zipPath);
    expect(archive.entries.length).toBe(5);
    const paths = archive.files.map((file) => file.path);
    expect(paths[0]).toBe("project/README.md");
    expect(paths).toContain("project/src/main.rs");
    // Build caches and binaries are excluded from returned files.
    expect(paths.some((p) => p.includes("target/"))).toBe(false);
    expect(paths.some((p) => p.endsWith(".png"))).toBe(false);
    const main = archive.files.find((file) => file.path.endsWith("main.rs"));
    expect(main?.language).toBe("rust");
    expect(main?.content).toContain("println!");
  });

  it("honors include filters", async () => {
    const archive = await readArchive(zipPath, { include: ["src/"] });
    expect(archive.files.map((file) => file.path)).toEqual(["project/src/main.rs"]);
  });

  it("rejects non-zip files", async () => {
    const notZip = path.join(dir, "not.zip");
    await writeFile(notZip, "plain text");
    await expect(readArchive(notZip)).rejects.toThrow(/archive/i);
  });
});
