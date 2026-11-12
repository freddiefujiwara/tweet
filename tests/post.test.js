import { describe, it, expect, vi } from "vitest";
import {
  postTweetWithSession,
  postTweetWithShare,
  exchangeSession,
  revokeSession,
  shareActionWithSession,
  validateShareToken,
  listCommentsWithShare,
  replyCommentWithShare,
  listDmsWithShare,
  markDmReadWithShare,
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
});

describe("comment inbox requests", () => {
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
});

describe("DM inbox requests", () => {
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
});
