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

// Post with the owner's Google ID token.
export async function postTweet(endpoint, idToken, text, fetchImpl = fetch) {
  return sendJson(endpoint, { idToken, text }, fetchImpl);
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
// "revoke_share"; requires the owner's Google ID token.
export async function shareAction(endpoint, idToken, action, fetchImpl = fetch) {
  return sendJson(endpoint, { idToken, action }, fetchImpl);
}

// Comment inbox: list comments on our tweets. Same endpoint and auth
// as posting; the action field selects the operation server-side.
export async function listComments(endpoint, idToken, fetchImpl = fetch) {
  return sendJson(
    endpoint,
    buildListCommentsPayload({ idToken }),
    fetchImpl,
  );
}

export async function listCommentsWithShare(endpoint, shareToken, fetchImpl = fetch) {
  return sendJson(
    endpoint,
    buildListCommentsPayload({ shareToken }),
    fetchImpl,
  );
}

// Reply to one comment. The success response has the same shape as a
// post success ({ ok, id, url, text, ... }); in DRY_RUN it also
// carries dry_run: true.
export async function replyComment(endpoint, idToken, commentId, text, fetchImpl = fetch) {
  return sendJson(
    endpoint,
    buildReplyCommentPayload({ idToken }, commentId, text),
    fetchImpl,
  );
}

export async function replyCommentWithShare(endpoint, shareToken, commentId, text, fetchImpl = fetch) {
  return sendJson(
    endpoint,
    buildReplyCommentPayload({ shareToken }, commentId, text),
    fetchImpl,
  );
}

// DM inbox: list DM conversations. Same endpoint and auth as
// posting; the action field selects the operation server-side.
export async function listDms(endpoint, idToken, fetchImpl = fetch) {
  return sendJson(
    endpoint,
    buildListDmsPayload({ idToken }),
    fetchImpl,
  );
}

export async function listDmsWithShare(endpoint, shareToken, fetchImpl = fetch) {
  return sendJson(
    endpoint,
    buildListDmsPayload({ shareToken }),
    fetchImpl,
  );
}

// Mark one conversation as read, up to the given (latest) event.
export async function markDmRead(endpoint, idToken, conversationId, eventId, fetchImpl = fetch) {
  return sendJson(
    endpoint,
    buildMarkDmReadPayload({ idToken }, conversationId, eventId),
    fetchImpl,
  );
}

export async function markDmReadWithShare(endpoint, shareToken, conversationId, eventId, fetchImpl = fetch) {
  return sendJson(
    endpoint,
    buildMarkDmReadPayload({ shareToken }, conversationId, eventId),
    fetchImpl,
  );
}

// Reply inside one DM conversation. The success response carries
// conversation_id and event_id; in DRY_RUN it also carries
// dry_run: true.
export async function replyDm(endpoint, idToken, conversationId, text, fetchImpl = fetch) {
  return sendJson(
    endpoint,
    buildReplyDmPayload({ idToken }, conversationId, text),
    fetchImpl,
  );
}

export async function replyDmWithShare(endpoint, shareToken, conversationId, text, fetchImpl = fetch) {
  return sendJson(
    endpoint,
    buildReplyDmPayload({ shareToken }, conversationId, text),
    fetchImpl,
  );
}
