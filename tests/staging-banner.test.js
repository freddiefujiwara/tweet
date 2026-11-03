import { describe, it, expect } from "vitest";
import { isStagingBuild, showStagingBanner } from "../src/staging-banner.js";

describe("isStagingBuild", () => {
  it("is true only when VITE_STAGING is exactly '1'", () => {
    expect(isStagingBuild({ VITE_STAGING: "1" })).toBe(true);
    expect(isStagingBuild({ VITE_STAGING: "true" })).toBe(false);
    expect(isStagingBuild({})).toBe(false);
    expect(isStagingBuild(undefined)).toBe(false);
  });
});

describe("showStagingBanner", () => {
  it("prepends a banner naming the staging environment", () => {
    document.body.innerHTML = "<main id=\"app\"></main>";
    const el = showStagingBanner();
    expect(document.body.firstChild).toBe(el);
    expect(el.textContent).toContain("STAGING");
    expect(el.textContent).toContain("ステージング環境");
  });
});
