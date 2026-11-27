import { describe, it, expect, vi } from "vitest";
import { postTweetWithSession, postTweetWithShare } from "../src/post.js";

function stubFetch(json) {
  return vi.fn(async () => ({ json: async () => json }));
}

const MEDIA = [{ data: "QUJD", type: "image/png" }];

describe("post with media", () => {
  it("postTweetWithSession includes media when options carry it", async () => {
    const fetchImpl = stubFetch({ ok: true });
    await postTweetWithSession("https://example.com/exec", "sess", "本文", { media: MEDIA }, fetchImpl);
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      session_token: "sess",
      text: "本文",
      media: MEDIA,
    });
  });

  it("postTweetWithSession omits media when the list is empty", async () => {
    const fetchImpl = stubFetch({ ok: true });
    await postTweetWithSession("https://example.com/exec", "sess", "本文", { media: [] }, fetchImpl);
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ session_token: "sess", text: "本文" });
  });

  it("postTweetWithSession still accepts fetchImpl as the fourth argument", async () => {
    const fetchImpl = stubFetch({ ok: true });
    await postTweetWithSession("https://example.com/exec", "sess", "本文", fetchImpl);
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ session_token: "sess", text: "本文" });
  });

  it("postTweetWithShare includes media when options carry it", async () => {
    const fetchImpl = stubFetch({ ok: true });
    await postTweetWithShare("https://example.com/exec", "share", "本文", { media: MEDIA }, fetchImpl);
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      share_token: "share",
      text: "本文",
      media: MEDIA,
    });
  });
});
