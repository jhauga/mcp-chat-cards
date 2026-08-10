import { describe, expect, it } from "vitest";
import {
  balanceHeaders,
  detectCellDelimiter,
  normalizeRows,
  textToTable,
} from "../src/util/text-to-table.js";

describe("detectCellDelimiter", () => {
  it("detects tabs before pipes and commas", () => {
    expect(detectCellDelimiter(["a\tb", "c\td"])).toBe("\t");
    expect(detectCellDelimiter(["a | b", "c | d"])).toBe("|");
    expect(detectCellDelimiter(["a, b", "c, d"])).toBe(",");
  });

  it("returns null when no delimiter is consistent", () => {
    expect(detectCellDelimiter(["alpha", "beta", "gamma"])).toBeNull();
  });
});

describe("balanceHeaders", () => {
  it("pads missing titles with Column N", () => {
    expect(balanceHeaders(["Name"], 3)).toEqual(["Name", "Column 2", "Column 3"]);
  });
});

describe("textToTable", () => {
  it("parses delimited text into rows", () => {
    const table = textToTable("Method, Purpose\nmap, transform items\nfilter, keep items", {
      headers: ["Method", "Purpose"],
    });
    expect(table.headers).toEqual(["Method", "Purpose"]);
    expect(table.rows).toContainEqual(["map", "transform items"]);
    expect(table.rows.every((row) => row.length === 2)).toBe(true);
  });

  it("chunks plain lines into rows when no delimiter exists", () => {
    const table = textToTable("one\ntwo\nthree\nfour", { columns: 2 });
    expect(table.rows).toEqual([
      ["one", "two"],
      ["three", "four"],
    ]);
  });

  it("pads uneven rows to the widest width", () => {
    const table = textToTable("a|b|c\nd|e", {});
    expect(table.rows[1]).toEqual(["d", "e", ""]);
  });

  it("handles empty input", () => {
    const table = textToTable("", { headers: ["A"] });
    expect(table.rows).toEqual([]);
    expect(table.headers).toEqual(["A"]);
  });
});

describe("normalizeRows", () => {
  it("makes rows rectangular and balances headers", () => {
    const table = normalizeRows([["a"], ["b", "c"]], ["First"]);
    expect(table.rows).toEqual([
      ["a", ""],
      ["b", "c"],
    ]);
    expect(table.headers).toEqual(["First", "Column 2"]);
  });
});
