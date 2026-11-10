// Pure helpers for the comment inbox: request payload building and
// display-data conversion. DOM rendering lives in main.js; keeping
// this logic separate makes it unit-testable without a document.
import { countText, MAX_LENGTH } from "./composer.js";

// Shown whenever the backend reports dry_run (staging never fetches
// or posts real comments).
export const DRY_RUN_NOTE = "ステージングではコメントを取得しません";

// --- Request payloads ---
// Auth follows the existing post pattern: the owner's Google ID token
// as { idToken }, or a temporary access link as { share_token }.
// A share token, when present, takes precedence (same as posting).

export function buildListCommentsPayload(auth) {
  if (auth?.shareToken) {
    return { share_token: auth.shareToken, action: "list_comments" };
  }
  return { idToken: auth?.idToken ?? null, action: "list_comments" };
}

/**
 * Whether a reply should be sent as a quote repost.
 * Accepts a boolean, or an options object shaped as
 * { asQuote: true } / { as_quote: true }.
 */
export function isQuoteReply(options) {
  if (options === true) {
    return true;
  }
  if (options && typeof options === "object") {
    return Boolean(options.asQuote ?? options.as_quote);
  }
  return false;
}

export function buildReplyCommentPayload(auth, commentId, text, options) {
  const asQuote = isQuoteReply(options);
  const extra = asQuote ? { as_quote: true } : {};
  if (auth?.shareToken) {
    return {
      share_token: auth.shareToken,
      action: "reply_comment",
      comment_id: commentId,
      text,
      ...extra,
    };
  }
  return {
    idToken: auth?.idToken ?? null,
    action: "reply_comment",
    comment_id: commentId,
    text,
    ...extra,
  };
}

// --- Links ---

/** Canonical URL of the comment itself on X. */
export function commentUrl(comment) {
  if (!comment?.comment_id) {
    return "";
  }
  if (comment.author_username) {
    return `https://x.com/${comment.author_username}/status/${comment.comment_id}`;
  }
  return `https://x.com/i/status/${comment.comment_id}`;
}

/** URL of our tweet the comment replied to, or "" when unknown. */
export function parentTweetUrl(comment) {
  if (!comment?.in_reply_to_tweet_id) {
    return "";
  }
  return `https://x.com/i/status/${comment.in_reply_to_tweet_id}`;
}

// --- Status badge ---

export function isReplied(comment) {
  return comment?.status === "replied";
}

export function badgeFor(comment) {
  return isReplied(comment)
    ? { label: "返信済み", replied: true }
    : { label: "未返信", replied: false };
}

// --- Kind badge ---
// list_comments items carry `kind`: "mention" | "reply" | "quote".
// Only quote items get an extra badge; mention/reply and legacy
// items without a kind get none.

export function isQuote(comment) {
  return comment?.kind === "quote";
}

export function kindBadgeFor(comment) {
  return isQuote(comment) ? { label: "引用", kind: "quote" } : null;
}

/**
 * All badges for a comment, status badge first, then the kind
 * badge when present. Always returns at least the status badge.
 */
export function badgesFor(comment) {
  const status = badgeFor(comment);
  const badges = [{ key: "status", label: status.label, replied: status.replied }];
  const kind = kindBadgeFor(comment);
  if (kind) {
    badges.push({ key: "quote", label: kind.label, kind: kind.kind });
  }
  return badges;
}

// --- Time formatting ---

/** "2026/11/10 14:53" in local time; "" when the value is invalid. */
export function formatCommentTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// --- Display data ---

/** Convert one API comment into the shape the inbox renders. */
export function toCommentView(comment) {
  const badge = badgeFor(comment);
  const kindBadge = kindBadgeFor(comment);
  const name = comment?.author_name || "";
  const username = comment?.author_username || "";
  return {
    commentId: comment?.comment_id ?? "",
    authorName: name,
    authorUsername: username,
    authorLabel: username ? `${name}（@${username}）` : name,
    text: comment?.text ?? "",
    createdAt: comment?.created_at ?? "",
    timeLabel: formatCommentTime(comment?.created_at),
    commentUrl: commentUrl(comment ?? {}),
    parentUrl: parentTweetUrl(comment ?? {}),
    status: comment?.status ?? "new",
    replied: badge.replied,
    badgeLabel: badge.label,
    kind: comment?.kind ?? null,
    isQuote: Boolean(kindBadge),
    kindBadgeLabel: kindBadge?.label ?? null,
    badges: badgesFor(comment),
    ourReplyId: comment?.our_reply_id ?? null,
  };
}

/**
 * Convert the API list into display data, newest first. The API
 * already returns newest first; sorting a copy defensively keeps the
 * display correct even if the order ever changes.
 */
export function normalizeComments(comments) {
  if (!Array.isArray(comments)) {
    return [];
  }
  return [...comments]
    .sort((a, b) => Date.parse(b?.created_at) - Date.parse(a?.created_at))
    .map(toCommentView);
}

// --- Response notes ---

/**
 * Notes to show above the list: the staging note when the response
 * is a dry run, plus the backend's own note when one is present.
 */
export function inboxNotes(data) {
  const notes = [];
  if (data?.dry_run) {
    notes.push(DRY_RUN_NOTE);
  }
  if (typeof data?.note === "string" && data.note) {
    notes.push(data.note);
  }
  return notes;
}

// --- Reply validation (same counting rule as posting) ---

export function canReply(authenticated, text) {
  const len = countText(text ?? "");
  return Boolean(authenticated) && len > 0 && len <= MAX_LENGTH;
}
