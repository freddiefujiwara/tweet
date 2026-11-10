import { describe, it, expect } from "vitest";
import {
  DRY_RUN_NOTE,
  buildListCommentsPayload,
  buildReplyCommentPayload,
  commentUrl,
  parentTweetUrl,
  isReplied,
  badgeFor,
  isQuote,
  kindBadgeFor,
  badgesFor,
  isQuoteReply,
  formatCommentTime,
  toCommentView,
  normalizeComments,
  inboxNotes,
  canReply,
} from "../src/comments.js";
import { MAX_LENGTH } from "../src/composer.js";

const baseComment = {
  comment_id: "1234567890",
  author_id: "42",
  author_username: "someone",
  author_name: "誰か",
  text: "いいですね",
  created_at: "2026-11-10T05:53:00.000Z",
  in_reply_to_tweet_id: "999",
  conversation_id: "999",
  status: "new",
  our_reply_id: null,
};

describe("buildListCommentsPayload", () => {
  it("sends the ID token with the list_comments action", () => {
    expect(buildListCommentsPayload({ idToken: "tok" })).toEqual({
      idToken: "tok",
      action: "list_comments",
    });
  });

  it("sends the share token instead when present", () => {
    expect(buildListCommentsPayload({ idToken: "tok", shareToken: "share" })).toEqual({
      share_token: "share",
      action: "list_comments",
    });
  });
});

describe("buildReplyCommentPayload", () => {
  it("includes action, comment_id and text with the ID token", () => {
    expect(buildReplyCommentPayload({ idToken: "tok" }, "123", "ありがとうございます")).toEqual({
      idToken: "tok",
      action: "reply_comment",
      comment_id: "123",
      text: "ありがとうございます",
    });
  });

  it("uses the share token when present", () => {
    expect(buildReplyCommentPayload({ shareToken: "share" }, "123", "hi")).toEqual({
      share_token: "share",
      action: "reply_comment",
      comment_id: "123",
      text: "hi",
    });
  });

  it("adds as_quote: true only when quoting (ID token)", () => {
    expect(
      buildReplyCommentPayload({ idToken: "tok" }, "123", "hi", { asQuote: true }),
    ).toEqual({
      idToken: "tok",
      action: "reply_comment",
      comment_id: "123",
      text: "hi",
      as_quote: true,
    });
    // Boolean shorthand is also accepted.
    expect(
      buildReplyCommentPayload({ idToken: "tok" }, "123", "hi", true),
    ).toEqual(expect.objectContaining({ as_quote: true }));
  });

  it("adds as_quote: true only when quoting (share token)", () => {
    expect(
      buildReplyCommentPayload({ shareToken: "share" }, "123", "hi", { asQuote: true }),
    ).toEqual({
      share_token: "share",
      action: "reply_comment",
      comment_id: "123",
      text: "hi",
      as_quote: true,
    });
  });

  it("omits as_quote for a normal reply", () => {
    for (const options of [undefined, false, { asQuote: false }, { as_quote: false }, {}]) {
      const payload = buildReplyCommentPayload({ idToken: "tok" }, "123", "hi", options);
      expect(payload).not.toHaveProperty("as_quote");
    }
    expect(isQuoteReply({ asQuote: true })).toBe(true);
    expect(isQuoteReply(true)).toBe(true);
    expect(isQuoteReply({ asQuote: false })).toBe(false);
    expect(isQuoteReply(undefined)).toBe(false);
  });
});

describe("comment links", () => {
  it("builds the comment URL from username and comment id", () => {
    expect(commentUrl(baseComment)).toBe("https://x.com/someone/status/1234567890");
  });

  it("falls back to the /i/status form without a username", () => {
    expect(commentUrl({ comment_id: "7", author_username: "" })).toBe(
      "https://x.com/i/status/7",
    );
    expect(commentUrl({})).toBe("");
  });

  it("builds the parent tweet URL only when a parent id exists", () => {
    expect(parentTweetUrl(baseComment)).toBe("https://x.com/i/status/999");
    expect(parentTweetUrl({ ...baseComment, in_reply_to_tweet_id: null })).toBe("");
    expect(parentTweetUrl({ ...baseComment, in_reply_to_tweet_id: "" })).toBe("");
  });
});

describe("badge judgement", () => {
  it("treats status new as unreplied", () => {
    expect(isReplied(baseComment)).toBe(false);
    expect(badgeFor(baseComment)).toEqual({ label: "未返信", replied: false });
  });

  it("treats status replied as replied", () => {
    const replied = { ...baseComment, status: "replied", our_reply_id: "555" };
    expect(isReplied(replied)).toBe(true);
    expect(badgeFor(replied)).toEqual({ label: "返信済み", replied: true });
  });

  it("treats unknown or missing status as unreplied", () => {
    expect(badgeFor({ status: "other" }).replied).toBe(false);
    expect(badgeFor({}).replied).toBe(false);
    expect(badgeFor(null).replied).toBe(false);
  });
});

describe("kind / quote badge", () => {
  it("shows the 引用 badge only for kind=quote", () => {
    expect(isQuote({ kind: "quote" })).toBe(true);
    expect(kindBadgeFor({ kind: "quote" })).toEqual({ label: "引用", kind: "quote" });
    for (const kind of ["mention", "reply", undefined, null, "", "other"]) {
      expect(isQuote({ kind })).toBe(false);
      expect(kindBadgeFor({ kind })).toBeNull();
    }
    expect(isQuote({})).toBe(false);
    expect(isQuote(null)).toBe(false);
    expect(kindBadgeFor(null)).toBeNull();
  });

  it("combines the quote badge with the status badge", () => {
    expect(badgesFor({ status: "new", kind: "quote" })).toEqual([
      { key: "status", label: "未返信", replied: false },
      { key: "quote", label: "引用", kind: "quote" },
    ]);
    expect(badgesFor({ status: "replied", kind: "quote" })).toEqual([
      { key: "status", label: "返信済み", replied: true },
      { key: "quote", label: "引用", kind: "quote" },
    ]);
  });

  it("returns only the status badge for non-quote and legacy items", () => {
    expect(badgesFor({ status: "new", kind: "mention" })).toEqual([
      { key: "status", label: "未返信", replied: false },
    ]);
    expect(badgesFor({ status: "new", kind: "reply" })).toEqual([
      { key: "status", label: "未返信", replied: false },
    ]);
    // Legacy data without kind: no kind badge.
    expect(badgesFor({ status: "new" })).toEqual([
      { key: "status", label: "未返信", replied: false },
    ]);
  });
});

describe("formatCommentTime", () => {
  it("formats as YYYY/MM/DD HH:MM in local time", () => {
    const iso = new Date(2026, 10, 10, 14, 53).toISOString();
    expect(formatCommentTime(iso)).toBe("2026/11/10 14:53");
  });

  it("returns an empty string for an invalid date", () => {
    expect(formatCommentTime("not-a-date")).toBe("");
    expect(formatCommentTime("")).toBe("");
    expect(formatCommentTime(undefined)).toBe("");
  });
});

describe("toCommentView", () => {
  it("converts an API comment into display data", () => {
    const view = toCommentView(baseComment);
    expect(view.commentId).toBe("1234567890");
    expect(view.authorLabel).toBe("誰か（@someone）");
    expect(view.text).toBe("いいですね");
    expect(view.commentUrl).toBe("https://x.com/someone/status/1234567890");
    expect(view.parentUrl).toBe("https://x.com/i/status/999");
    expect(view.badgeLabel).toBe("未返信");
    expect(view.replied).toBe(false);
    expect(view.ourReplyId).toBeNull();
  });

  it("omits the @ label when the username is missing", () => {
    const view = toCommentView({ ...baseComment, author_username: "" });
    expect(view.authorLabel).toBe("誰か");
  });

  it("exposes the quote badge only for kind=quote", () => {
    const quoteView = toCommentView({ ...baseComment, kind: "quote" });
    expect(quoteView.kind).toBe("quote");
    expect(quoteView.isQuote).toBe(true);
    expect(quoteView.kindBadgeLabel).toBe("引用");
    expect(quoteView.badges.map((b) => b.label)).toEqual(["未返信", "引用"]);

    for (const kind of ["mention", "reply"]) {
      const view = toCommentView({ ...baseComment, kind });
      expect(view.isQuote).toBe(false);
      expect(view.kindBadgeLabel).toBeNull();
      expect(view.badges.map((b) => b.label)).toEqual(["未返信"]);
    }

    const legacyView = toCommentView(baseComment);
    expect(legacyView.kind).toBeNull();
    expect(legacyView.isQuote).toBe(false);
    expect(legacyView.kindBadgeLabel).toBeNull();
  });

  it("keeps the quote badge alongside 返信済み", () => {
    const view = toCommentView({ ...baseComment, kind: "quote", status: "replied" });
    expect(view.badgeLabel).toBe("返信済み");
    expect(view.kindBadgeLabel).toBe("引用");
    expect(view.badges.map((b) => b.label)).toEqual(["返信済み", "引用"]);
  });
});

describe("normalizeComments", () => {
  it("orders comments newest first", () => {
    const older = { ...baseComment, comment_id: "1", created_at: "2026-11-09T00:00:00.000Z" };
    const newer = { ...baseComment, comment_id: "2", created_at: "2026-11-10T00:00:00.000Z" };
    const views = normalizeComments([older, newer]);
    expect(views.map((v) => v.commentId)).toEqual(["2", "1"]);
  });

  it("returns an empty array for non-array input", () => {
    expect(normalizeComments(undefined)).toEqual([]);
    expect(normalizeComments(null)).toEqual([]);
    expect(normalizeComments("x")).toEqual([]);
  });
});

describe("inboxNotes", () => {
  it("shows the staging note for a dry run", () => {
    expect(inboxNotes({ ok: true, dry_run: true, comments: [] })).toEqual([DRY_RUN_NOTE]);
    expect(DRY_RUN_NOTE).toBe("ステージングではコメントを取得しません");
  });

  it("shows the backend note when present", () => {
    expect(inboxNotes({ ok: true, comments: [], note: "補足です" })).toEqual(["補足です"]);
  });

  it("shows both the dry-run note and the backend note", () => {
    expect(inboxNotes({ ok: true, dry_run: true, note: "補足です" })).toEqual([
      DRY_RUN_NOTE,
      "補足です",
    ]);
  });

  it("shows nothing for a plain response", () => {
    expect(inboxNotes({ ok: true, comments: [] })).toEqual([]);
    expect(inboxNotes({ ok: true, comments: [], note: "" })).toEqual([]);
    expect(inboxNotes(null)).toEqual([]);
  });
});

describe("canReply", () => {
  it("allows non-empty text within the limit when authenticated", () => {
    expect(canReply("tok", "返信です")).toBe(true);
    expect(canReply("tok", "a".repeat(MAX_LENGTH))).toBe(true);
  });

  it("rejects empty or over-limit text", () => {
    expect(canReply("tok", "")).toBe(false);
    expect(canReply("tok", "a".repeat(MAX_LENGTH + 1))).toBe(false);
  });

  it("rejects any text when unauthenticated", () => {
    expect(canReply(null, "返信です")).toBe(false);
    expect(canReply("", "返信です")).toBe(false);
  });
});
