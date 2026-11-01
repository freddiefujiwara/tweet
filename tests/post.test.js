import { describe, it, expect, vi } from "vitest";
import {
  postTweet,
  postTweetWithShare,
  validateShareToken,
  shareAction,
} from "../src/post.js";

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

describe("share requests", () => {
  it("posts with a share token instead of an ID token", async () => {
    const fetchImpl = stubFetch({ ok: true, url: "https://x.com/i/status/2" });
    const data = await postTweetWithShare(
      "https://example.com/exec",
      "share-tok",
      "本文",
      fetchImpl,
    );
    expect(data.ok).toBe(true);
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ share_token: "share-tok", text: "本文" });
  });

  it("validates a share token without posting", async () => {
    const fetchImpl = stubFetch({ ok: true, _share: { expires_at: "2026-12-02T00:00:00.000Z" } });
    const data = await validateShareToken("https://example.com/exec", "share-tok", fetchImpl);
    expect(data._share.expires_at).toBe("2026-12-02T00:00:00.000Z");
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      share_token: "share-tok",
      action: "validate_share",
    });
  });

  it("sends owner share actions with the ID token", async () => {
    const fetchImpl = stubFetch({ ok: true, share_token: "new-tok" });
    await shareAction("https://example.com/exec", "tok", "issue_share", fetchImpl);
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ idToken: "tok", action: "issue_share" });

    const fetchImpl2 = stubFetch({ ok: true, revoked: true });
    await shareAction("https://example.com/exec", "tok", "revoke_share", fetchImpl2);
    const [, options2] = fetchImpl2.mock.calls[0];
    expect(JSON.parse(options2.body)).toEqual({ idToken: "tok", action: "revoke_share" });
  });
});
