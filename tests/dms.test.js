import { describe, it, expect } from "vitest";
import {
  DM_DRY_RUN_NOTE,
  DM_MAX_LENGTH,
  DM_PREVIEW_LENGTH,
  buildListDmsPayload,
  buildMarkDmReadPayload,
  buildReplyDmPayload,
  participantLabelFor,
  participantsLabel,
  previewText,
  badgesFor,
  formatCommentTime,
  toMessageView,
  toConversationView,
  normalizeConversations,
  dmNotes,
  countDmText,
  canReplyDm,
} from "../src/dms.js";

const baseMessage = {
  event_id: "ev2",
  conversation_id: "conv1",
  sender_id: "42",
  sender_username: "someone",
  sender_name: "誰か",
  text: "こんにちは",
  created_at: "2026-11-10T05:53:00.000Z",
  is_mine: false,
};

const myMessage = {
  event_id: "ev1",
  conversation_id: "conv1",
  sender_id: "1",
  sender_username: "freddiefujiwara",
  sender_name: "藤原史和",
  text: "ありがとうございます",
  created_at: "2026-11-10T05:50:00.000Z",
  is_mine: true,
};

const baseConversation = {
  conversation_id: "conv1",
  participants: [{ id: "42", name: "誰か", username: "someone" }],
  latest_event: baseMessage,
  messages: [myMessage, baseMessage],
  unread: true,
  needs_reply: true,
};

describe("buildListDmsPayload", () => {
  it("sends the ID token with the list_dms action", () => {
    expect(buildListDmsPayload({ idToken: "tok" })).toEqual({
      idToken: "tok",
      action: "list_dms",
    });
  });

  it("sends the share token instead when present", () => {
    expect(buildListDmsPayload({ idToken: "tok", shareToken: "share" })).toEqual({
      share_token: "share",
      action: "list_dms",
    });
  });
});

describe("buildMarkDmReadPayload", () => {
  it("includes action, conversation_id and event_id with the ID token", () => {
    expect(buildMarkDmReadPayload({ idToken: "tok" }, "conv1", "ev2")).toEqual({
      idToken: "tok",
      action: "mark_dm_read",
      conversation_id: "conv1",
      event_id: "ev2",
    });
  });

  it("uses the share token when present", () => {
    expect(buildMarkDmReadPayload({ shareToken: "share" }, "conv1", "ev2")).toEqual({
      share_token: "share",
      action: "mark_dm_read",
      conversation_id: "conv1",
      event_id: "ev2",
    });
  });
});

describe("buildReplyDmPayload", () => {
  it("includes action, conversation_id and text with the ID token", () => {
    expect(buildReplyDmPayload({ idToken: "tok" }, "conv1", "返信です")).toEqual({
      idToken: "tok",
      action: "reply_dm",
      conversation_id: "conv1",
      text: "返信です",
    });
  });

  it("uses the share token when present", () => {
    expect(buildReplyDmPayload({ shareToken: "share" }, "conv1", "hi")).toEqual({
      share_token: "share",
      action: "reply_dm",
      conversation_id: "conv1",
      text: "hi",
    });
  });
});

describe("participantsLabel", () => {
  it("formats one participant as name (@username)", () => {
    expect(participantsLabel(baseConversation.participants)).toBe("誰か（@someone）");
    expect(participantLabelFor({ name: "誰か", username: "someone" })).toBe(
      "誰か（@someone）",
    );
  });

  it("joins multiple participants", () => {
    expect(
      participantsLabel([
        { id: "1", name: "甲", username: "kou" },
        { id: "2", name: "乙", username: null },
      ]),
    ).toBe("甲（@kou）、乙");
  });

  it("degrades to the available part", () => {
    expect(participantLabelFor({ name: "名前だけ", username: null })).toBe("名前だけ");
    expect(participantLabelFor({ name: null, username: "nameonly" })).toBe("@nameonly");
    expect(participantLabelFor({ name: null, username: null })).toBe("");
    expect(participantLabelFor(null)).toBe("");
  });

  it("falls back to 相手 when nothing is known", () => {
    expect(participantsLabel([{ id: "9", name: null, username: null }])).toBe("相手");
    expect(participantsLabel([])).toBe("相手");
    expect(participantsLabel(undefined)).toBe("相手");
    expect(participantsLabel(null)).toBe("相手");
  });
});

describe("previewText", () => {
  it("returns short text unchanged", () => {
    expect(previewText("短い文")).toBe("短い文");
  });

  it("collapses whitespace and newlines into one line", () => {
    expect(previewText("一行目\n\n二行目　三行目")).toBe("一行目 二行目 三行目");
  });

  it("returns text exactly at the limit unchanged", () => {
    const text = "あ".repeat(DM_PREVIEW_LENGTH);
    expect(previewText(text)).toBe(text);
  });

  it("truncates long text with an ellipsis", () => {
    const text = "あ".repeat(DM_PREVIEW_LENGTH + 10);
    expect(previewText(text)).toBe("あ".repeat(DM_PREVIEW_LENGTH) + "…");
  });

  it("truncates by code points, not UTF-16 units", () => {
    const text = "😀".repeat(DM_PREVIEW_LENGTH + 1);
    expect(previewText(text)).toBe("😀".repeat(DM_PREVIEW_LENGTH) + "…");
  });

  it("handles empty or missing text", () => {
    expect(previewText("")).toBe("");
    expect(previewText(null)).toBe("");
    expect(previewText(undefined)).toBe("");
  });
});

describe("badgesFor", () => {
  it("returns both badges when unread and needs reply", () => {
    expect(badgesFor(baseConversation)).toEqual([
      { key: "unread", label: "未読" },
      { key: "needs_reply", label: "要返信" },
    ]);
  });

  it("returns only the applicable badge", () => {
    expect(badgesFor({ unread: true, needs_reply: false })).toEqual([
      { key: "unread", label: "未読" },
    ]);
    expect(badgesFor({ unread: false, needs_reply: true })).toEqual([
      { key: "needs_reply", label: "要返信" },
    ]);
  });

  it("returns no badges otherwise", () => {
    expect(badgesFor({ unread: false, needs_reply: false })).toEqual([]);
    expect(badgesFor({})).toEqual([]);
    expect(badgesFor(null)).toEqual([]);
  });
});

describe("formatCommentTime (DM times use the comment format)", () => {
  it("formats as YYYY/MM/DD HH:MM in local time", () => {
    const iso = new Date(2026, 10, 10, 14, 53).toISOString();
    expect(formatCommentTime(iso)).toBe("2026/11/10 14:53");
  });

  it("returns an empty string for an invalid date", () => {
    expect(formatCommentTime("not-a-date")).toBe("");
    expect(formatCommentTime(undefined)).toBe("");
  });
});

describe("toMessageView", () => {
  it("labels the other side by name and username", () => {
    const view = toMessageView(baseMessage);
    expect(view.eventId).toBe("ev2");
    expect(view.senderLabel).toBe("誰か（@someone）");
    expect(view.isMine).toBe(false);
    expect(view.text).toBe("こんにちは");
  });

  it("labels my own messages as 自分", () => {
    const view = toMessageView(myMessage);
    expect(view.senderLabel).toBe("自分");
    expect(view.isMine).toBe(true);
  });

  it("falls back to 相手 when the sender is unknown", () => {
    const view = toMessageView({ ...baseMessage, sender_name: null, sender_username: null });
    expect(view.senderLabel).toBe("相手");
  });
});

describe("toConversationView", () => {
  it("converts an API conversation into display data", () => {
    const view = toConversationView(baseConversation);
    expect(view.conversationId).toBe("conv1");
    expect(view.participantLabel).toBe("誰か（@someone）");
    expect(view.latestEventId).toBe("ev2");
    expect(view.preview).toBe("こんにちは");
    expect(view.unread).toBe(true);
    expect(view.needsReply).toBe(true);
    expect(view.badgeLabels).toEqual(["未読", "要返信"]);
    expect(view.messages.map((m) => m.eventId)).toEqual(["ev1", "ev2"]);
    expect(view.messages[0].isMine).toBe(true);
  });

  it("tolerates a missing latest_event and messages", () => {
    const view = toConversationView({ conversation_id: "c2", participants: [] });
    expect(view.participantLabel).toBe("相手");
    expect(view.preview).toBe("");
    expect(view.latestEventId).toBe("");
    expect(view.messages).toEqual([]);
    expect(view.badges).toEqual([]);
  });
});

describe("normalizeConversations", () => {
  it("orders conversations by latest event, newest first", () => {
    const older = {
      ...baseConversation,
      conversation_id: "old",
      latest_event: { ...baseMessage, created_at: "2026-11-09T00:00:00.000Z" },
    };
    const newer = {
      ...baseConversation,
      conversation_id: "new",
      latest_event: { ...baseMessage, created_at: "2026-11-10T00:00:00.000Z" },
    };
    const views = normalizeConversations([older, newer]);
    expect(views.map((v) => v.conversationId)).toEqual(["new", "old"]);
  });

  it("returns an empty array for non-array input", () => {
    expect(normalizeConversations(undefined)).toEqual([]);
    expect(normalizeConversations(null)).toEqual([]);
    expect(normalizeConversations("x")).toEqual([]);
  });
});

describe("dmNotes", () => {
  it("shows the staging note for a dry run", () => {
    expect(dmNotes({ ok: true, dry_run: true, conversations: [] })).toEqual([
      DM_DRY_RUN_NOTE,
    ]);
    expect(DM_DRY_RUN_NOTE).toBe("ステージングではDMを取得しません");
  });

  it("shows the backend note when present", () => {
    expect(dmNotes({ ok: true, conversations: [], note: "補足です" })).toEqual(["補足です"]);
  });

  it("shows both the dry-run note and the backend note", () => {
    expect(dmNotes({ ok: true, dry_run: true, note: "補足です" })).toEqual([
      DM_DRY_RUN_NOTE,
      "補足です",
    ]);
  });

  it("shows nothing for a plain response", () => {
    expect(dmNotes({ ok: true, conversations: [] })).toEqual([]);
    expect(dmNotes(null)).toEqual([]);
  });
});

describe("canReplyDm", () => {
  it("allows non-empty text when authenticated", () => {
    expect(canReplyDm("tok", "返信です")).toBe(true);
  });

  it("rejects empty text", () => {
    expect(canReplyDm("tok", "")).toBe(false);
    expect(countDmText("")).toBe(0);
  });

  it("allows exactly 10,000 code points", () => {
    expect(DM_MAX_LENGTH).toBe(10000);
    expect(canReplyDm("tok", "a".repeat(10000))).toBe(true);
  });

  it("rejects 10,001 code points", () => {
    expect(canReplyDm("tok", "a".repeat(10001))).toBe(false);
  });

  it("counts Unicode code points, not UTF-16 units", () => {
    expect(countDmText("😀")).toBe(1);
    expect(canReplyDm("tok", "😀".repeat(10000))).toBe(true);
    expect(canReplyDm("tok", "😀".repeat(10001))).toBe(false);
  });

  it("rejects any text when unauthenticated", () => {
    expect(canReplyDm(null, "返信です")).toBe(false);
    expect(canReplyDm("", "返信です")).toBe(false);
    expect(canReplyDm(undefined, "返信です")).toBe(false);
  });
});
