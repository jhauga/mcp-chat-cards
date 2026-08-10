import { describe, expect, it } from "vitest";
import { extractPage } from "../src/fetcher/extract.js";

const FIXTURE = `<!DOCTYPE html>
<html>
<head>
<title>Woodworking Basics</title>
<meta name="description" content="An introduction to hand tools.">
<script>ignored()</script>
</head>
<body>
<h1>Woodworking Basics</h1>
<h2>Hand Tools</h2>
<p>Every workshop starts with a few essentials.</p>
<table>
<tr><th>Tool</th><th>Use</th></tr>
<tr><td>Chisel</td><td>Paring joints</td></tr>
<tr><td>Hand plane</td><td>Flattening boards</td></tr>
</table>
<img src="/images/bench.jpg" alt="Workbench">
<a href="/guides/joinery">Joinery guide</a>
<form action="/newsletter" method="post">
<label for="email">Email address</label>
<input type="email" id="email" name="email" required>
<select name="frequency">
<option value="weekly">Weekly</option>
<option value="monthly">Monthly</option>
</select>
<input type="radio" name="level" value="beginner">
<input type="radio" name="level" value="expert">
<input type="submit" value="Sign up">
</form>
</body>
</html>`;

describe("extractPage", () => {
  const page = extractPage(FIXTURE, "https://example.com/basics");

  it("extracts title, description, and headings", () => {
    expect(page.title).toBe("Woodworking Basics");
    expect(page.description).toBe("An introduction to hand tools.");
    expect(page.headings).toContainEqual({ level: 2, text: "Hand Tools" });
  });

  it("extracts tables with headers and rows", () => {
    expect(page.tables).toHaveLength(1);
    expect(page.tables[0].headers).toEqual(["Tool", "Use"]);
    expect(page.tables[0].rows).toContainEqual(["Chisel", "Paring joints"]);
  });

  it("resolves relative image and link urls", () => {
    expect(page.images[0]).toEqual({ src: "https://example.com/images/bench.jpg", alt: "Workbench" });
    expect(page.links[0].href).toBe("https://example.com/guides/joinery");
  });

  it("extracts form fields, merging radio groups and skipping submits", () => {
    expect(page.forms).toHaveLength(1);
    const form = page.forms[0];
    expect(form.action).toBe("https://example.com/newsletter");
    expect(form.method).toBe("POST");
    const names = form.fields.map((field) => field.name);
    expect(names).toEqual(["email", "frequency", "level"]);
    const email = form.fields[0];
    expect(email.type).toBe("email");
    expect(email.required).toBe(true);
    expect(email.label).toBe("Email address");
    expect(form.fields[1].options).toEqual(["weekly", "monthly"]);
    expect(form.fields[2].options).toEqual(["beginner", "expert"]);
  });

  it("strips scripts from readable text", () => {
    expect(page.text).toContain("Every workshop starts");
    expect(page.text).not.toContain("ignored()");
  });
});
