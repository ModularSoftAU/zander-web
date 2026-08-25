import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const stylesheet = await readFile(
  new URL("../../assets/css/style.css", import.meta.url),
  "utf8"
);

describe("forum post layout", () => {
  it("keeps author details, post controls, and content in a responsive layout", () => {
    expect(stylesheet).toMatch(/\.forums-post-layout\s*\{[^}]*display:\s*grid/s);
    expect(stylesheet).toMatch(/\.forums-post-layout\s*\{[^}]*grid-template-columns:\s*minmax\(150px, 180px\)\s+minmax\(0, 1fr\)/s);
    expect(stylesheet).toMatch(/\.forums-post-content\s*\{[^}]*min-width:\s*0/s);
    expect(stylesheet).toMatch(/@media\s*\(max-width:\s*767\.98px\)\s*\{[^}]*\.forums-post-layout\s*\{[^}]*grid-template-columns:\s*1fr/s);
  });
});
