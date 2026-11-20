import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { decodeJwtPayload } from "../src/auth.js";
import { MAX_LENGTH, canPost, countText } from "../src/composer.js";
import {
  formatCommentTime,
  normalizeComments,
} from "../src/comments.js";
import {
  DM_PREVIEW_LENGTH,
  canReplyDm,
  countDmText,
  normalizeConversations,
  participantsLabel,
  previewText,
} from "../src/dms.js";
import {
  buildShareUrl,
  formatShareExpiry,
  formatShareRemaining,
  parseShareToken,
  shareSecondsLeft,
} from "../src/share.js";

// The JSON domain every /exec payload field lives in, plus an
// explicit unstringifiable member: {"toString": []} is valid JSON,
// yet converting it to a primitive throws a TypeError.
const unstringifiable = fc.constant({ toString: [] });
const jsonValue = fc.oneof(fc.jsonValue(), unstringifiable);

// Comment/DM rows with individually deformed fields.
const deformedComment = fc.record(
  {
    comment_id: jsonValue,
    author_name: jsonValue,
    author_username: jsonValue,
    text: jsonValue,
    created_at: jsonValue,
    status: jsonValue,
    kind: jsonValue,
  },
  { requiredKeys: [] },
);
const deformedConversation = fc.record(
  {
    conversation_id: jsonValue,
    participants: fc.array(jsonValue, { maxLength: 4 }),
    latest_event: fc.record(
      { created_at: jsonValue, text: jsonValue },
      { requiredKeys: [] },
    ),
    messages: fc.array(jsonValue, { maxLength: 4 }),
    unread: jsonValue,
    needs_reply: jsonValue,
  },
  { requiredKeys: [] },
);

const RUNS = { numRuns: 100 };

describe("share helpers are total over the JSON domain", () => {
  it("parseShareToken returns a string for any hash text", () => {
    fc.assert(
      fc.property(fc.string(), (hash) => {
        expect(typeof parseShareToken(hash)).toBe("string");
      }),
      RUNS,
    );
  });

  it("parseShareToken returns an empty string for any non-string hash", () => {
    fc.assert(
      fc.property(jsonValue, (hash) => {
        fc.pre(typeof hash !== "string");
        expect(parseShareToken(hash)).toBe("");
      }),
      RUNS,
    );
  });

  it("a built share URL round-trips through its hash portion", () => {
    // The token domain is grapheme strings: a lone surrogate cannot
    // occur in a real location hash or a server-issued token, and
    // encodeURIComponent rejects it outright (same narrowing as the
    // sibling apps). parseShareToken's contract is a hash fragment,
    // so the round-trip goes through the URL's hash portion, not the
    // full URL.
    fc.assert(
      fc.property(
        fc.string({ unit: "grapheme", minLength: 1, maxLength: 40 }),
        (token) => {
          const url = buildShareUrl("https://example.com/tweet/", token);
          const hash = url.slice(url.indexOf("#"));
          expect(parseShareToken(hash)).toBe(token);
        },
      ),
      RUNS,
    );
  });

  it("buildShareUrl returns a string for any token value", () => {
    fc.assert(
      fc.property(jsonValue, (token) => {
        const url = buildShareUrl("https://example.com/tweet/", token);
        expect(typeof url).toBe("string");
        if (typeof token === "string" && token) {
          expect(url).toContain("#share=");
        } else {
          expect(url).toBe("");
        }
      }),
      RUNS,
    );
  });

  it("shareSecondsLeft is null or a finite non-negative integer", () => {
    fc.assert(
      fc.property(
        jsonValue,
        fc.oneof(
          fc.integer({ min: 0, max: 2 ** 53 }),
          fc.constant(NaN),
          fc.constant(Infinity),
          fc.constant(-Infinity),
        ),
        (expiresAt, nowMs) => {
          const seconds = shareSecondsLeft(expiresAt, nowMs);
          expect(
            seconds === null ||
              (Number.isInteger(seconds) && seconds >= 0),
          ).toBe(true);
        },
      ),
      RUNS,
    );
  });

  it("formatShareRemaining never leaks NaN or Infinity", () => {
    fc.assert(
      fc.property(jsonValue, (seconds) => {
        const label = formatShareRemaining(seconds);
        expect(typeof label).toBe("string");
        expect(label).not.toMatch(/NaN|Infinity/);
      }),
      RUNS,
    );
  });

  it("formatShareExpiry is empty or a formatted timestamp", () => {
    fc.assert(
      fc.property(jsonValue, (expiresAt) => {
        const label = formatShareExpiry(expiresAt);
        expect(label === "" || /^\d{8} \d{2}:\d{2}$/.test(label)).toBe(true);
      }),
      RUNS,
    );
  });
});

describe("counting is a total, exact code-point count", () => {
  it("countText agrees with the spread length for any string", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(countText(text)).toBe([...text].length);
        expect(countDmText(text)).toBe([...text].length);
      }),
      RUNS,
    );
  });

  it("counting a non-string reads as empty and validators stay boolean", () => {
    fc.assert(
      fc.property(jsonValue, jsonValue, (token, text) => {
        fc.pre(typeof text !== "string");
        expect(countText(text)).toBe(0);
        expect(countDmText(text)).toBe(0);
        expect(canPost(token, text)).toBe(false);
        expect(canReplyDm(token, text)).toBe(false);
      }),
      RUNS,
    );
  });

  it("canPost is exactly the 0 < count <= 280 rule over code points", () => {
    // Each alphabet member is exactly one code point (🎉 is a single
    // astral code point), so the array length is the exact count.
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("a", "あ", "é", "🎉"), {
          minLength: 0,
          maxLength: MAX_LENGTH + 40,
        }),
        (chars) => {
          const text = chars.join("");
          expect(countText(text)).toBe(chars.length);
          expect(canPost("tok", text)).toBe(
            chars.length > 0 && chars.length <= MAX_LENGTH,
          );
        },
      ),
      RUNS,
    );
  });
});

describe("comment shaping is total over the JSON domain", () => {
  it("formatCommentTime is empty or a formatted timestamp", () => {
    fc.assert(
      fc.property(jsonValue, (value) => {
        const label = formatCommentTime(value);
        expect(
          label === "" || /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/.test(label),
        ).toBe(true);
      }),
      RUNS,
    );
  });

  it("normalizeComments conserves rows and types its display fields", () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(jsonValue, deformedComment), { maxLength: 12 }),
        (comments) => {
          const views = normalizeComments(comments);
          expect(views).toHaveLength(comments.length);
          for (const view of views) {
            expect(typeof view.authorName).toBe("string");
            expect(typeof view.authorUsername).toBe("string");
            expect(typeof view.authorLabel).toBe("string");
            expect(typeof view.text).toBe("string");
            expect(typeof view.timeLabel).toBe("string");
            expect(typeof view.commentUrl).toBe("string");
            expect(typeof view.parentUrl).toBe("string");
            expect(typeof view.replied).toBe("boolean");
            expect(Array.isArray(view.badges)).toBe(true);
          }
        },
      ),
      RUNS,
    );
  });

  it("normalizeComments orders well-formed comments newest first", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 100000 }), {
          minLength: 0,
          maxLength: 10,
        }),
        (offsets) => {
          const comments = offsets.map((n) => ({
            comment_id: String(n),
            text: "x",
            created_at: new Date(Date.UTC(2026, 0, 1) + n * 60000).toISOString(),
          }));
          const views = normalizeComments(comments);
          const expected = [...offsets]
            .sort((a, b) => b - a)
            .map(String);
          expect(views.map((v) => v.commentId)).toEqual(expected);
        },
      ),
      RUNS,
    );
  });
});

describe("DM shaping is total over the JSON domain", () => {
  it("normalizeConversations conserves rows and types its display fields", () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(jsonValue, deformedConversation), {
          maxLength: 12,
        }),
        (conversations) => {
          const views = normalizeConversations(conversations);
          expect(views).toHaveLength(conversations.length);
          for (const view of views) {
            expect(typeof view.participantLabel).toBe("string");
            expect(view.participantLabel.length).toBeGreaterThan(0);
            expect(typeof view.preview).toBe("string");
            expect([...view.preview].length).toBeLessThanOrEqual(
              DM_PREVIEW_LENGTH + 1,
            );
            expect(typeof view.timeLabel).toBe("string");
            for (const message of view.messages) {
              expect(typeof message.senderLabel).toBe("string");
              expect(typeof message.text).toBe("string");
              expect(typeof message.timeLabel).toBe("string");
            }
          }
        },
      ),
      RUNS,
    );
  });

  it("normalizeConversations orders well-formed conversations newest first", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 100000 }), {
          minLength: 0,
          maxLength: 10,
        }),
        (offsets) => {
          const conversations = offsets.map((n) => ({
            conversation_id: String(n),
            latest_event: {
              created_at: new Date(
                Date.UTC(2026, 0, 1) + n * 60000,
              ).toISOString(),
              text: "x",
            },
          }));
          const views = normalizeConversations(conversations);
          const expected = [...offsets]
            .sort((a, b) => b - a)
            .map(String);
          expect(views.map((v) => v.conversationId)).toEqual(expected);
        },
      ),
      RUNS,
    );
  });

  it("participantsLabel always returns a non-empty string", () => {
    fc.assert(
      fc.property(fc.array(jsonValue, { maxLength: 6 }), (participants) => {
        const label = participantsLabel(participants);
        expect(typeof label).toBe("string");
        expect(label.length).toBeGreaterThan(0);
      }),
      RUNS,
    );
  });

  it("previewText flattens short texts and bounds long ones", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const flat = text.replace(/\s+/g, " ").trim();
        const preview = previewText(text);
        if ([...flat].length <= DM_PREVIEW_LENGTH) {
          expect(preview).toBe(flat);
        }
        expect([...preview].length).toBeLessThanOrEqual(DM_PREVIEW_LENGTH + 1);
      }),
      RUNS,
    );
  });

  it("previewText returns a string for any value", () => {
    fc.assert(
      fc.property(jsonValue, (text) => {
        expect(typeof previewText(text)).toBe("string");
      }),
      RUNS,
    );
  });
});

describe("decodeJwtPayload round-trips a generated payload", () => {
  it("decodes a token built from a generated claims object", () => {
    // The claims domain is grapheme strings (no lone surrogates, so
    // the UTF-8 round-trip through atob is exact), safe integers,
    // booleans and null — the shapes a Google ID token carries.
    const claims = fc.dictionary(
      fc.string({ unit: "grapheme", minLength: 1, maxLength: 6 }),
      fc.oneof(
        fc.string({ unit: "grapheme", maxLength: 20 }),
        fc.integer(),
        fc.boolean(),
        fc.constant(null),
      ),
      { minKeys: 1, maxKeys: 5 },
    );
    fc.assert(
      fc.property(claims, (payload) => {
        const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
          "base64url",
        );
        expect(decodeJwtPayload(`header.${body}.signature`)).toEqual(payload);
      }),
      RUNS,
    );
  });

  it("never throws and returns an object for any string", () => {
    fc.assert(
      fc.property(fc.string(), (token) => {
        const payload = decodeJwtPayload(token);
        expect(typeof payload).toBe("object");
        expect(payload).not.toBeNull();
      }),
      RUNS,
    );
  });
});
