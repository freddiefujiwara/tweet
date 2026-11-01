import { describe, it, expect } from "vitest";
import { MAX_LENGTH, countText, canPost } from "../src/composer.js";

describe("countText", () => {
  it("counts ASCII and Japanese characters", () => {
    expect(countText("")).toBe(0);
    expect(countText("hello")).toBe(5);
    expect(countText("こんにちは")).toBe(5);
  });

  it("counts an emoji as one code point", () => {
    expect(countText("a🎉b")).toBe(3);
  });
});

describe("canPost", () => {
  const token = "id-token";

  it("allows non-empty text within the limit when signed in", () => {
    expect(canPost(token, "テスト")).toBe(true);
    expect(canPost(token, "a".repeat(MAX_LENGTH))).toBe(true);
  });

  it("rejects empty text and text over the limit", () => {
    expect(canPost(token, "")).toBe(false);
    expect(canPost(token, "a".repeat(MAX_LENGTH + 1))).toBe(false);
  });

  it("rejects any text when signed out", () => {
    expect(canPost(null, "テスト")).toBe(false);
  });
});
