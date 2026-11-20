import { describe, expect, it } from "vitest";
import { decodeJwtPayload } from "../src/auth.js";
import { MAX_LENGTH, canPost, countText } from "../src/composer.js";
import {
  canReply,
  commentUrl,
  formatCommentTime,
  normalizeComments,
  parentTweetUrl,
  toCommentView,
} from "../src/comments.js";
import {
  DM_MAX_LENGTH,
  canReplyDm,
  countDmText,
  normalizeConversations,
  participantsLabel,
  previewText,
  toConversationView,
  toMessageView,
} from "../src/dms.js";
import {
  buildShareUrl,
  formatShareExpiry,
  formatShareRemaining,
  parseShareToken,
  shareSecondsLeft,
} from "../src/share.js";

// A value JSON can carry whose toString is not a function: converting
// it to a primitive (string concatenation, String(), Date.parse, a
// template literal, a textContent assignment) throws a TypeError.
// Every field of a GAS /exec payload is JSON, so any field can arrive
// in this shape; the hash fragment is hand-editable text besides.
const UNSTRINGIFIABLE = { toString: [] };

describe("parseShareToken with a malformed hash", () => {
  it("treats an undecodable share value as no token", () => {
    expect(parseShareToken("#share=%E0%A4%A")).toBe("");
    expect(parseShareToken("#share=%")).toBe("");
    expect(parseShareToken("#share=%zz")).toBe("");
    expect(parseShareToken("#share=abc%2")).toBe("");
  });

  it("treats a non-string hash as no token", () => {
    expect(parseShareToken(42)).toBe("");
    expect(parseShareToken(true)).toBe("");
    expect(parseShareToken({})).toBe("");
    expect(parseShareToken([])).toBe("");
    expect(parseShareToken(UNSTRINGIFIABLE)).toBe("");
  });

  it("still returns an empty string for an empty share value", () => {
    expect(parseShareToken("#share=")).toBe("");
  });
});

describe("buildShareUrl with a missing or deformed token", () => {
  const base = "https://example.com/tweet/";

  it("builds no URL when the issue response carried no token", () => {
    expect(buildShareUrl(base, undefined)).toBe("");
    expect(buildShareUrl(base, null)).toBe("");
    expect(buildShareUrl(base, "")).toBe("");
  });

  it("builds no URL for a non-string token", () => {
    expect(buildShareUrl(base, 42)).toBe("");
    expect(buildShareUrl(base, UNSTRINGIFIABLE)).toBe("");
  });
});

describe("shareSecondsLeft with deformed input", () => {
  const iso = "2030-01-01T00:00:00.000Z";

  it("returns null for a non-scalar expiry", () => {
    expect(shareSecondsLeft(UNSTRINGIFIABLE, Date.now())).toBeNull();
    expect(shareSecondsLeft({}, Date.now())).toBeNull();
    expect(shareSecondsLeft([], Date.now())).toBeNull();
  });

  it("returns null when the current time is not a finite number", () => {
    expect(shareSecondsLeft(iso, NaN)).toBeNull();
    expect(shareSecondsLeft(iso, undefined)).toBeNull();
    expect(shareSecondsLeft(iso, Infinity)).toBeNull();
    expect(shareSecondsLeft(iso, -Infinity)).toBeNull();
  });
});

describe("formatShareExpiry with deformed input", () => {
  it("returns an empty string instead of throwing or printing the epoch", () => {
    expect(formatShareExpiry(UNSTRINGIFIABLE)).toBe("");
    expect(formatShareExpiry({})).toBe("");
    expect(formatShareExpiry(null)).toBe("");
    expect(formatShareExpiry(undefined)).toBe("");
  });
});

describe("formatShareRemaining with deformed input", () => {
  it("never prints NaN or Infinity", () => {
    expect(formatShareRemaining(NaN)).toBe("");
    expect(formatShareRemaining(Infinity)).toBe("");
  });

  it("treats a non-number as unknown", () => {
    expect(formatShareRemaining(UNSTRINGIFIABLE)).toBe("");
    expect(formatShareRemaining("30")).toBe("");
    expect(formatShareRemaining(undefined)).toBe("");
  });

  it("keeps reading -Infinity as expired", () => {
    expect(formatShareRemaining(-Infinity)).toBe("期限切れ");
  });

  it("chains safely from a shareSecondsLeft with a bad clock", () => {
    expect(
      formatShareRemaining(shareSecondsLeft("2030-01-01T00:00:00.000Z", NaN)),
    ).toBe("");
  });
});

describe("composer counting with deformed text", () => {
  it("counts a non-string as empty", () => {
    expect(countText(null)).toBe(0);
    expect(countText(undefined)).toBe(0);
    expect(countText(42)).toBe(0);
    expect(countText(["a", "b"])).toBe(0);
    expect(countText(UNSTRINGIFIABLE)).toBe(0);
  });

  it("rejects deformed text instead of throwing", () => {
    expect(canPost("tok", null)).toBe(false);
    expect(canPost("tok", 42)).toBe(false);
    expect(canPost("tok", UNSTRINGIFIABLE)).toBe(false);
    expect(canReply(true, null)).toBe(false);
    expect(canReply(true, 42)).toBe(false);
    expect(canReply(true, UNSTRINGIFIABLE)).toBe(false);
  });

  it("pins the code-point boundary at the limit", () => {
    expect(countText("🎉".repeat(MAX_LENGTH))).toBe(MAX_LENGTH);
    expect(canPost("tok", "🎉".repeat(MAX_LENGTH))).toBe(true);
    expect(canPost("tok", "🎉".repeat(MAX_LENGTH + 1))).toBe(false);
  });
});

describe("comment shaping with deformed payload fields", () => {
  it("formats an unstringifiable created_at as no time", () => {
    expect(formatCommentTime(UNSTRINGIFIABLE)).toBe("");
    expect(formatCommentTime({})).toBe("");
    expect(formatCommentTime([])).toBe("");
  });

  it("builds no comment URL from an unstringifiable id", () => {
    expect(
      commentUrl({ comment_id: UNSTRINGIFIABLE, author_username: "someone" }),
    ).toBe("");
    expect(parentTweetUrl({ in_reply_to_tweet_id: UNSTRINGIFIABLE })).toBe("");
  });

  it("falls back to the id-only URL when the username is deformed", () => {
    expect(
      commentUrl({ comment_id: "7", author_username: UNSTRINGIFIABLE }),
    ).toBe("https://x.com/i/status/7");
  });

  it("keeps every field of the view a string when fields are deformed", () => {
    const view = toCommentView({
      comment_id: UNSTRINGIFIABLE,
      author_name: { a: 1 },
      author_username: UNSTRINGIFIABLE,
      text: UNSTRINGIFIABLE,
      created_at: UNSTRINGIFIABLE,
    });
    expect(view.authorName).toBe("");
    expect(view.authorLabel).toBe("");
    expect(view.text).toBe("");
    expect(view.timeLabel).toBe("");
    expect(view.commentUrl).toBe("");
    expect(view.parentUrl).toBe("");
  });

  it("stringifies numeric text fields", () => {
    const view = toCommentView({ author_name: 42, text: 42 });
    expect(view.authorName).toBe("42");
    expect(view.text).toBe("42");
  });

  it("normalizes a list mixing healthy and deformed comments", () => {
    const views = normalizeComments([
      {
        comment_id: "ok1",
        author_name: "誰か",
        author_username: "someone",
        text: "こんにちは",
        created_at: "2026-11-10T05:53:00.000Z",
      },
      {
        comment_id: UNSTRINGIFIABLE,
        author_name: UNSTRINGIFIABLE,
        text: UNSTRINGIFIABLE,
        created_at: UNSTRINGIFIABLE,
      },
      null,
      42,
    ]);
    expect(views).toHaveLength(4);
    const healthy = views.find((v) => v.commentId === "ok1");
    expect(healthy.text).toBe("こんにちは");
    expect(healthy.commentUrl).toBe("https://x.com/someone/status/ok1");
    for (const view of views) {
      expect(typeof view.authorLabel).toBe("string");
      expect(typeof view.text).toBe("string");
      expect(typeof view.timeLabel).toBe("string");
    }
  });
});

describe("DM shaping with deformed payload fields", () => {
  it("previews an unstringifiable text as empty", () => {
    expect(previewText(UNSTRINGIFIABLE)).toBe("");
    expect(previewText(42)).toBe("42");
  });

  it("counts a non-string DM text as empty and rejects it", () => {
    expect(countDmText(42)).toBe(0);
    expect(countDmText(UNSTRINGIFIABLE)).toBe(0);
    expect(canReplyDm(true, 42)).toBe(false);
    expect(canReplyDm(true, UNSTRINGIFIABLE)).toBe(false);
    expect(canReplyDm(true, null)).toBe(false);
  });

  it("pins the DM code-point boundary at the limit", () => {
    expect(canReplyDm(true, "a".repeat(DM_MAX_LENGTH))).toBe(true);
    expect(canReplyDm(true, "a".repeat(DM_MAX_LENGTH + 1))).toBe(false);
  });

  it("falls back to the generic label when participant names are deformed", () => {
    expect(participantsLabel([{ name: { a: 1 } }])).toBe("相手");
    expect(participantsLabel([{ name: UNSTRINGIFIABLE }])).toBe("相手");
    expect(
      toConversationView({ participants: [{ name: UNSTRINGIFIABLE }] })
        .participantLabel,
    ).toBe("相手");
    expect(toMessageView({ sender_name: UNSTRINGIFIABLE }).senderLabel).toBe(
      "相手",
    );
  });

  it("keeps message text a string when it is deformed", () => {
    expect(toMessageView({ text: UNSTRINGIFIABLE }).text).toBe("");
    expect(toMessageView({ text: 42 }).text).toBe("42");
  });

  it("normalizes a list whose latest event time is unstringifiable", () => {
    const views = normalizeConversations([
      { conversation_id: "c1", latest_event: { created_at: UNSTRINGIFIABLE } },
      { conversation_id: "c2", latest_event: { created_at: "2026-11-10T05:53:00.000Z", text: "やあ" } },
    ]);
    expect(views).toHaveLength(2);
    for (const view of views) {
      expect(typeof view.participantLabel).toBe("string");
      expect(typeof view.preview).toBe("string");
      expect(typeof view.timeLabel).toBe("string");
    }
  });
});

describe("decodeJwtPayload with a malformed credential", () => {
  it("returns an empty payload instead of throwing", () => {
    expect(decodeJwtPayload("garbage")).toEqual({});
    expect(decodeJwtPayload("a.b.c")).toEqual({});
    expect(decodeJwtPayload("")).toEqual({});
    expect(decodeJwtPayload(undefined)).toEqual({});
    expect(decodeJwtPayload(null)).toEqual({});
    expect(decodeJwtPayload(42)).toEqual({});
    expect(decodeJwtPayload(UNSTRINGIFIABLE)).toEqual({});
  });
});
