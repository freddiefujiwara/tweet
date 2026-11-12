// Requests to the tweet-gas endpoint. All calls are POSTs with a
// JSON body sent as text/plain (the GAS-friendly transport this app
// has always used). Each function returns the parsed JSON response
// ({ ok, ... } or { ok: false, error }) and throws on network/parse
// failure.
import {
  buildListCommentsPayload,
  buildReplyCommentPayload,
} from "./comments.js";
import {
  buildListDmsPayload,
  buildMarkDmReadPayload,
  buildReplyDmPayload,
} from "./dms.js";
async function sendJson(endpoint, payload, fetchImpl) {
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// Post with the owner's 30-day session token (the post-sign-in
// steady state; exchanged from the ID token at sign-in).
export async function postTweetWithSession(endpoint, sessionToken, text, fetchImpl = fetch) {
  return sendJson(endpoint, { session_token: sessionToken, text }, fetchImpl);
}

// Exchange a fresh Google ID token for a 30-day owner session:
// resolves to { ok: true, session_token, expires_at, ... }.
export async function exchangeSession(endpoint, idToken, fetchImpl = fetch) {
  return sendJson(endpoint, { idToken, action: "exchange_session" }, fetchImpl);
}

// Revoke the owner session (logout). Best effort by design.
export async function revokeSession(endpoint, sessionToken, fetchImpl = fetch) {
  return sendJson(endpoint, { session_token: sessionToken, action: "revoke_session" }, fetchImpl);
}

// Post with a share link token instead of signing in. A share link is
// owner-equivalent: the post is made as the owner.
export async function postTweetWithShare(endpoint, shareToken, text, fetchImpl = fetch) {
  return sendJson(endpoint, { share_token: shareToken, text }, fetchImpl);
}

// Check a share link before composing: resolves to { ok: true,
// _share: { expires_at } } for a live link, { ok: false } otherwise.
export async function validateShareToken(endpoint, shareToken, fetchImpl = fetch) {
  return sendJson(endpoint, { share_token: shareToken, action: "validate_share" }, fetchImpl);
}

// Owner-only share administration: action is "issue_share" or
// "revoke_share"; requires owner proof (ID token, or the session).
export async function shareActionWithSession(endpoint, sessionToken, action, fetchImpl = fetch) {
  return sendJson(endpoint, { session_token: sessionToken, action }, fetchImpl);
}

// Comment inbox: list comments on our tweets. Same endpoint and auth
// as posting; the action field selects the operation server-side.
export async function listCommentsWithShare(endpoint, shareToken, fetchImpl = fetch) {
  return sendJson(
    endpoint,
    buildListCommentsPayload({ shareToken }),
    fetchImpl,
  );
}

export async function listCommentsWithSession(endpoint, sessionToken, fetchImpl = fetch) {
  return sendJson(
    endpoint,
    buildListCommentsPayload({ sessionToken }),
    fetchImpl,
  );
}

// Reply to one comment. The success response has the same shape as a
// post success ({ ok, id, url, text, ... }); in DRY_RUN it also
// carries dry_run: true.
//
// The reply method is selected with an optional options argument:
// { asQuote: true } sends the reply as a quote repost
// (as_quote: true on the payload); omitted / false sends a normal
// reply with no as_quote field. For backward compatibility the
// options argument may be omitted and fetchImpl passed directly as
// the fifth argument, or passed as the sixth argument.
function resolveReplyArgs(options, fetchImpl) {
  if (typeof options === "function") {
    return { options: undefined, fetchImpl: options };
  }
  if (options && typeof options === "object" && typeof options.fetchImpl === "function" && fetchImpl === undefined) {
    const { fetchImpl: innerFetch, ...rest } = options;
    return { options: rest, fetchImpl: innerFetch };
  }
  return { options, fetchImpl: fetchImpl ?? fetch };
}

export async function replyCommentWithShare(endpoint, shareToken, commentId, text, options, fetchImpl) {
  const resolved = resolveReplyArgs(options, fetchImpl);
  return sendJson(
    endpoint,
    buildReplyCommentPayload({ shareToken }, commentId, text, resolved.options),
    resolved.fetchImpl,
  );
}

export async function replyCommentWithSession(endpoint, sessionToken, commentId, text, options, fetchImpl) {
  const resolved = resolveReplyArgs(options, fetchImpl);
  return sendJson(
    endpoint,
    buildReplyCommentPayload({ sessionToken }, commentId, text, resolved.options),
    resolved.fetchImpl,
  );
}

// DM inbox: list DM conversations. Same endpoint and auth as
// posting; the action field selects the operation server-side.
export async function listDmsWithShare(endpoint, shareToken, fetchImpl = fetch) {
  return sendJson(
    endpoint,
    buildListDmsPayload({ shareToken }),
    fetchImpl,
  );
}

export async function listDmsWithSession(endpoint, sessionToken, fetchImpl = fetch) {
  return sendJson(
    endpoint,
    buildListDmsPayload({ sessionToken }),
    fetchImpl,
  );
}

// Mark one conversation as read, up to the given (latest) event.
export async function markDmReadWithShare(endpoint, shareToken, conversationId, eventId, fetchImpl = fetch) {
  return sendJson(
    endpoint,
    buildMarkDmReadPayload({ shareToken }, conversationId, eventId),
    fetchImpl,
  );
}

export async function markDmReadWithSession(endpoint, sessionToken, conversationId, eventId, fetchImpl = fetch) {
  return sendJson(
    endpoint,
    buildMarkDmReadPayload({ sessionToken }, conversationId, eventId),
    fetchImpl,
  );
}

// Reply inside one DM conversation. The success response carries
// conversation_id and event_id; in DRY_RUN it also carries
// dry_run: true.
export async function replyDmWithShare(endpoint, shareToken, conversationId, text, fetchImpl = fetch) {
  return sendJson(
    endpoint,
    buildReplyDmPayload({ shareToken }, conversationId, text),
    fetchImpl,
  );
}

export async function replyDmWithSession(endpoint, sessionToken, conversationId, text, fetchImpl = fetch) {
  return sendJson(
    endpoint,
    buildReplyDmPayload({ sessionToken }, conversationId, text),
    fetchImpl,
  );
}
