// Pure helpers for the DM inbox: request payload building and
// display-data conversion. DOM rendering lives in main.js; keeping
// this logic separate makes it unit-testable without a document.
import { formatCommentTime } from "./comments.js";

export { formatCommentTime };

// Shown whenever the backend reports dry_run (staging never fetches
// or sends real DMs). Same wording pattern as the comment inbox.
export const DM_DRY_RUN_NOTE = "ステージングではDMを取得しません";

// DM texts allow up to 10,000 Unicode code points. This is a
// different rule from the 280 weighted count used for posts, so the
// DM reply box counts code points directly ([...text].length).
export const DM_MAX_LENGTH = 10000;

// Preview of the latest message in the conversation list.
export const DM_PREVIEW_LENGTH = 80;

// --- Request payloads ---
// Auth follows the existing post pattern: the owner's Google ID token
// as { idToken }, or a temporary access link as { share_token }.
// A share token, when present, takes precedence (same as posting).

export function buildListDmsPayload(auth) {
  if (auth?.shareToken) {
    return { share_token: auth.shareToken, action: "list_dms" };
  }
  return { idToken: auth?.idToken ?? null, action: "list_dms" };
}

export function buildMarkDmReadPayload(auth, conversationId, eventId) {
  if (auth?.shareToken) {
    return {
      share_token: auth.shareToken,
      action: "mark_dm_read",
      conversation_id: conversationId,
      event_id: eventId,
    };
  }
  return {
    idToken: auth?.idToken ?? null,
    action: "mark_dm_read",
    conversation_id: conversationId,
    event_id: eventId,
  };
}

export function buildReplyDmPayload(auth, conversationId, text) {
  if (auth?.shareToken) {
    return {
      share_token: auth.shareToken,
      action: "reply_dm",
      conversation_id: conversationId,
      text,
    };
  }
  return {
    idToken: auth?.idToken ?? null,
    action: "reply_dm",
    conversation_id: conversationId,
    text,
  };
}

// --- Participants ---

/** One participant as "名前（@username）", degrading gracefully. */
export function participantLabelFor(participant) {
  const name = participant?.name || "";
  const username = participant?.username || "";
  if (name && username) {
    return `${name}（@${username}）`;
  }
  if (name) {
    return name;
  }
  if (username) {
    return `@${username}`;
  }
  return "";
}

/**
 * Label for the other side of a conversation: every participant with
 * usable info, joined together. Falls back to "相手" when nothing is
 * known.
 */
export function participantsLabel(participants) {
  if (!Array.isArray(participants)) {
    return "相手";
  }
  const labels = participants.map(participantLabelFor).filter(Boolean);
  return labels.length > 0 ? labels.join("、") : "相手";
}

// --- Preview ---

/**
 * One-line preview of a message text: whitespace (including
 * newlines) collapsed, and truncated with "…" beyond maxLength code
 * points.
 */
export function previewText(text, maxLength = DM_PREVIEW_LENGTH) {
  const flat = String(text ?? "").replace(/\s+/g, " ").trim();
  const chars = [...flat];
  if (chars.length <= maxLength) {
    return flat;
  }
  return chars.slice(0, maxLength).join("") + "…";
}

// --- Badges ---

/**
 * Badges for a conversation: "未読" when unread, "要返信" when a
 * reply is needed. Both can apply at once.
 */
export function badgesFor(conversation) {
  const badges = [];
  if (conversation?.unread) {
    badges.push({ key: "unread", label: "未読" });
  }
  if (conversation?.needs_reply) {
    badges.push({ key: "needs_reply", label: "要返信" });
  }
  return badges;
}

// --- Display data ---

function senderLabelFor(message) {
  if (message?.is_mine) {
    return "自分";
  }
  return (
    participantLabelFor({
      name: message?.sender_name,
      username: message?.sender_username,
    }) || "相手"
  );
}

/** Convert one API message into the shape the thread renders. */
export function toMessageView(message) {
  return {
    eventId: message?.event_id ?? "",
    conversationId: message?.conversation_id ?? "",
    senderId: message?.sender_id ?? "",
    senderUsername: message?.sender_username ?? "",
    senderName: message?.sender_name ?? "",
    senderLabel: senderLabelFor(message),
    text: message?.text ?? "",
    createdAt: message?.created_at ?? "",
    timeLabel: formatCommentTime(message?.created_at),
    isMine: Boolean(message?.is_mine),
  };
}

/** Convert one API conversation into the shape the list renders. */
export function toConversationView(conversation) {
  const messages = Array.isArray(conversation?.messages)
    ? conversation.messages.map(toMessageView)
    : [];
  const latest = conversation?.latest_event
    ? toMessageView(conversation.latest_event)
    : (messages[messages.length - 1] ?? null);
  const badges = badgesFor(conversation ?? {});
  return {
    conversationId: conversation?.conversation_id ?? "",
    participantLabel: participantsLabel(conversation?.participants),
    latestEventId: latest?.eventId ?? "",
    preview: previewText(latest?.text ?? ""),
    createdAt: latest?.createdAt ?? "",
    timeLabel: latest?.timeLabel ?? "",
    unread: Boolean(conversation?.unread),
    needsReply: Boolean(conversation?.needs_reply),
    badges,
    badgeLabels: badges.map((b) => b.label),
    messages,
  };
}

/**
 * Convert the API list into display data, most recent conversation
 * first (by latest event time). Sorting a copy defensively keeps the
 * display correct even if the API order ever changes.
 */
export function normalizeConversations(conversations) {
  if (!Array.isArray(conversations)) {
    return [];
  }
  return [...conversations]
    .sort(
      (a, b) =>
        Date.parse(b?.latest_event?.created_at ?? "") -
        Date.parse(a?.latest_event?.created_at ?? ""),
    )
    .map(toConversationView);
}

// --- Response notes ---

/**
 * Notes to show above the list: the staging note when the response
 * is a dry run, plus the backend's own note when one is present.
 */
export function dmNotes(data) {
  const notes = [];
  if (data?.dry_run) {
    notes.push(DM_DRY_RUN_NOTE);
  }
  if (typeof data?.note === "string" && data.note) {
    notes.push(data.note);
  }
  return notes;
}

// --- Reply validation (code point count, 10,000 limit) ---

export function countDmText(text) {
  return [...(text ?? "")].length;
}

export function canReplyDm(authenticated, text) {
  const len = countDmText(text);
  return Boolean(authenticated) && len > 0 && len <= DM_MAX_LENGTH;
}
