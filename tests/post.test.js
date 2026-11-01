import { describe, it, expect, vi } from "vitest";
import { postTweet } from "../src/post.js";

function stubFetch(json) {
  return vi.fn(async () => ({ json: async () => json }));
}

describe("postTweet", () => {
  it("posts idToken and text as JSON with a text/plain content type", async () => {
    const fetchImpl = stubFetch({ ok: true, url: "https://x.com/i/status/1" });
    const data = await postTweet("https://example.com/exec", "tok", "本文", fetchImpl);
    expect(data).toEqual({ ok: true, url: "https://x.com/i/status/1" });
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://example.com/exec");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("text/plain;charset=utf-8");
    expect(JSON.parse(options.body)).toEqual({ idToken: "tok", text: "本文" });
  });

  it("returns the server's error object as-is", async () => {
    const fetchImpl = stubFetch({ ok: false, error: "boom" });
    await expect(postTweet("https://example.com/exec", "tok", "x", fetchImpl))
      .resolves.toEqual({ ok: false, error: "boom" });
  });

  it("propagates network failures", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("offline"); });
    await expect(postTweet("https://example.com/exec", "tok", "x", fetchImpl))
      .rejects.toThrow("offline");
  });
});
