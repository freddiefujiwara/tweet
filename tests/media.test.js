import { describe, it, expect } from "vitest";
import {
  MAX_MEDIA_BYTES,
  mediaFileError,
  fileToMediaItem,
  mediaPreviewUrl,
} from "../src/media.js";

describe("mediaFileError", () => {
  it("accepts a supported image within the size limit", () => {
    expect(mediaFileError({ type: "image/png", size: 1024 })).toBeNull();
    expect(mediaFileError({ type: "image/jpeg", size: MAX_MEDIA_BYTES })).toBeNull();
  });

  it("rejects an unsupported type", () => {
    expect(mediaFileError({ type: "video/mp4", size: 10 })).toMatch(/形式/);
  });

  it("rejects an oversized image", () => {
    expect(mediaFileError({ type: "image/png", size: MAX_MEDIA_BYTES + 1 })).toMatch(/大きすぎ/);
  });

  it("rejects a missing file", () => {
    expect(mediaFileError(null)).toMatch(/選ばれていません/);
  });
});

class FakeReader {
  readAsDataURL(file) {
    this.result = `data:${file.type};base64,QUJD`;
    this.onload();
  }
}

describe("fileToMediaItem", () => {
  it("strips the data URL prefix and keeps the type", async () => {
    const item = await fileToMediaItem({ type: "image/png" }, FakeReader);
    expect(item).toEqual({ data: "QUJD", type: "image/png" });
  });
});

describe("mediaPreviewUrl", () => {
  it("builds a data URL from an item", () => {
    expect(mediaPreviewUrl({ data: "QUJD", type: "image/jpeg" })).toBe(
      "data:image/jpeg;base64,QUJD",
    );
  });
});
