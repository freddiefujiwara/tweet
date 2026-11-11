import { describe, it, expect, vi } from "vitest";
import {
  postTweet,
  postTweetWithSession,
  postTweetWithShare,
  exchangeSession,
  revokeSession,
  shareActionWithSession,
  validateShareToken,
  shareAction,
  listComments,
  listCommentsWithShare,
  replyComment,
  replyCommentWithShare,
  listDms,
  listDmsWithShare,
  markDmRead,
  markDmReadWithShare,
  replyDm,
  replyDmWithShare,
} from "../src/post.js";

function stubFetch(json) {
  return vi.fn(async () => ({ json: async () => json }));
}

describe("owner session calls", () => {
  it("exchangeSession sends the id token to the exchange action", async () => {
    const fetchImpl = stubFetch({ ok: true, session_token: "sess" });
    const data = await exchangeSession("https://example.com/exec", "tok", fetchImpl);
    expect(data.session_token).toBe("sess");
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ idToken: "tok", action: "exchange_session" });
  });

  it("revokeSession sends the session token to the revoke action", async () => {
    const fetchImpl = stubFetch({ ok: true, revoked: true });
    await revokeSession("https://example.com/exec", "sess", fetchImpl);
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      session_token: "sess",
      action: "revoke_session",
    });
  });

  it("postTweetWithSession posts session_token and text", async () => {
    const fetchImpl = stubFetch({ ok: true });
    await postTweetWithSession("https://example.com/exec", "sess", "本文", fetchImpl);
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ session_token: "sess", text: "本文" });
  });

  it("shareActionWithSession sends the session token", async () => {
    const fetchImpl = stubFetch({ ok: true });
    await shareActionWithSession("https://example.com/exec", "sess", "issue_share", fetchImpl);
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      session_token: "sess",
      action: "issue_share",
    });
  });
});

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

describe("comment inbox requests", () => {
  it("lists comments with the ID token", async () => {
    const payload = { ok: true, comments: [{ comment_id: "1" }] };
    const fetchImpl = stubFetch(payload);
    const data = await listComments("https://example.com/exec", "tok", fetchImpl);
    expect(data).toEqual(payload);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://example.com/exec");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("text/plain;charset=utf-8");
    expect(JSON.parse(options.body)).toEqual({ idToken: "tok", action: "list_comments" });
  });

  it("lists comments with a share token", async () => {
    const fetchImpl = stubFetch({ ok: true, comments: [], dry_run: true });
    const data = await listCommentsWithShare("https://example.com/exec", "share-tok", fetchImpl);
    expect(data.dry_run).toBe(true);
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      share_token: "share-tok",
      action: "list_comments",
    });
  });

  it("replies to a comment with the ID token", async () => {
    const payload = { ok: true, id: "555", url: "https://x.com/i/status/555", text: "返信" };
    const fetchImpl = stubFetch(payload);
    const data = await replyComment(
      "https://example.com/exec",
      "tok",
      "123",
      "返信",
      fetchImpl,
    );
    expect(data).toEqual(payload);
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      idToken: "tok",
      action: "reply_comment",
      comment_id: "123",
      text: "返信",
    });
  });

  it("replies to a comment with a share token", async () => {
    const fetchImpl = stubFetch({ ok: true, dry_run: true });
    await replyCommentWithShare(
      "https://example.com/exec",
      "share-tok",
      "123",
      "返信",
      fetchImpl,
    );
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      share_token: "share-tok",
      action: "reply_comment",
      comment_id: "123",
      text: "返信",
    });
  });

  it("sends as_quote: true when quoting with the ID token", async () => {
    const fetchImpl = stubFetch({ ok: true, id: "556", url: "https://x.com/i/status/556" });
    await replyComment(
      "https://example.com/exec",
      "tok",
      "123",
      "引用です",
      { asQuote: true },
      fetchImpl,
    );
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      idToken: "tok",
      action: "reply_comment",
      comment_id: "123",
      text: "引用です",
      as_quote: true,
    });
  });

  it("sends as_quote: true when quoting with a share token", async () => {
    const fetchImpl = stubFetch({ ok: true, dry_run: true });
    await replyCommentWithShare(
      "https://example.com/exec",
      "share-tok",
      "123",
      "引用です",
      { asQuote: true },
      fetchImpl,
    );
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      share_token: "share-tok",
      action: "reply_comment",
      comment_id: "123",
      text: "引用です",
      as_quote: true,
    });
  });

  it("omits as_quote for a normal reply via the options form", async () => {
    const fetchImpl = stubFetch({ ok: true });
    await replyComment(
      "https://example.com/exec",
      "tok",
      "123",
      "返信",
      { asQuote: false },
      fetchImpl,
    );
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      idToken: "tok",
      action: "reply_comment",
      comment_id: "123",
      text: "返信",
    });
    expect(JSON.parse(options.body)).not.toHaveProperty("as_quote");
  });

  it("propagates network failures for comment requests", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("offline"); });
    await expect(listComments("https://example.com/exec", "tok", fetchImpl))
      .rejects.toThrow("offline");
    await expect(replyComment("https://example.com/exec", "tok", "1", "x", fetchImpl))
      .rejects.toThrow("offline");
  });
});

describe("DM inbox requests", () => {
  it("lists DMs with the ID token", async () => {
    const payload = { ok: true, conversations: [{ conversation_id: "conv1" }] };
    const fetchImpl = stubFetch(payload);
    const data = await listDms("https://example.com/exec", "tok", fetchImpl);
    expect(data).toEqual(payload);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://example.com/exec");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("text/plain;charset=utf-8");
    expect(JSON.parse(options.body)).toEqual({ idToken: "tok", action: "list_dms" });
  });

  it("lists DMs with a share token", async () => {
    const fetchImpl = stubFetch({ ok: true, conversations: [], dry_run: true });
    const data = await listDmsWithShare("https://example.com/exec", "share-tok", fetchImpl);
    expect(data.dry_run).toBe(true);
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      share_token: "share-tok",
      action: "list_dms",
    });
  });

  it("marks a conversation read with the ID token", async () => {
    const fetchImpl = stubFetch({ ok: true });
    const data = await markDmRead(
      "https://example.com/exec",
      "tok",
      "conv1",
      "ev2",
      fetchImpl,
    );
    expect(data).toEqual({ ok: true });
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      idToken: "tok",
      action: "mark_dm_read",
      conversation_id: "conv1",
      event_id: "ev2",
    });
  });

  it("marks a conversation read with a share token", async () => {
    const fetchImpl = stubFetch({ ok: true });
    await markDmReadWithShare(
      "https://example.com/exec",
      "share-tok",
      "conv1",
      "ev2",
      fetchImpl,
    );
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      share_token: "share-tok",
      action: "mark_dm_read",
      conversation_id: "conv1",
      event_id: "ev2",
    });
  });

  it("replies to a DM with the ID token", async () => {
    const payload = { ok: true, conversation_id: "conv1", event_id: "ev9" };
    const fetchImpl = stubFetch(payload);
    const data = await replyDm(
      "https://example.com/exec",
      "tok",
      "conv1",
      "返信です",
      fetchImpl,
    );
    expect(data).toEqual(payload);
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      idToken: "tok",
      action: "reply_dm",
      conversation_id: "conv1",
      text: "返信です",
    });
  });

  it("replies to a DM with a share token", async () => {
    const fetchImpl = stubFetch({ ok: true, dry_run: true });
    await replyDmWithShare(
      "https://example.com/exec",
      "share-tok",
      "conv1",
      "返信です",
      fetchImpl,
    );
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      share_token: "share-tok",
      action: "reply_dm",
      conversation_id: "conv1",
      text: "返信です",
    });
  });

  it("propagates network failures for DM requests", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("offline"); });
    await expect(listDms("https://example.com/exec", "tok", fetchImpl))
      .rejects.toThrow("offline");
    await expect(markDmRead("https://example.com/exec", "tok", "c", "e", fetchImpl))
      .rejects.toThrow("offline");
    await expect(replyDm("https://example.com/exec", "tok", "c", "x", fetchImpl))
      .rejects.toThrow("offline");
  });
});
