import "./style.css";
import { CONFIG } from "./config.js";
import { decodeJwtPayload } from "./auth.js";
import { THEME_KEY, resolveTheme, nextTheme, applyTheme } from "./theme.js";
import { countText, canPost } from "./composer.js";
import {
  postTweet,
  postTweetWithShare,
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
} from "./post.js";
import { normalizeComments, inboxNotes, canReply } from "./comments.js";
import {
  normalizeConversations,
  dmNotes,
  canReplyDm,
  countDmText,
  DM_MAX_LENGTH,
} from "./dms.js";
import {
  parseShareToken,
  buildShareUrl,
  shareSecondsLeft,
  formatShareRemaining,
  formatShareExpiry,
} from "./share.js";
import { isStagingBuild, showStagingBanner } from "./staging-banner.js";

if (isStagingBuild()) {
  showStagingBanner();
}

const gateEl = document.getElementById("gate");
const composerEl = document.getElementById("composer");
const expiredEl = document.getElementById("share-expired");
const textEl = document.getElementById("text");
const postBtn = document.getElementById("post");
const countEl = document.getElementById("count");
const statusEl = document.getElementById("status");
const accountEl = document.getElementById("account");
const logoutBtn = document.getElementById("logout");
const themeBtn = document.getElementById("theme-toggle");
const shareCardEl = document.getElementById("share-card");
const shareIssuedEl = document.getElementById("share-issued");
const shareIssueRowEl = document.getElementById("share-issue-row");
const shareIssueBtn = document.getElementById("share-issue");
const shareReissueBtn = document.getElementById("share-reissue");
const shareRevokeBtn = document.getElementById("share-revoke");
const shareCopyBtn = document.getElementById("share-copy");
const shareUrlEl = document.getElementById("share-url");
const shareRemainingEl = document.getElementById("share-remaining");
const shareExpiresEl = document.getElementById("share-expires");
const shareStatusEl = document.getElementById("share-status");
const inboxEl = document.getElementById("inbox");
const inboxRefreshBtn = document.getElementById("inbox-refresh");
const inboxNoteEl = document.getElementById("inbox-note");
const inboxStatusEl = document.getElementById("inbox-status");
const inboxListEl = document.getElementById("inbox-list");
const inboxEmptyEl = document.getElementById("inbox-empty");
const dmEl = document.getElementById("dm");
const dmRefreshBtn = document.getElementById("dm-refresh");
const dmNoteEl = document.getElementById("dm-note");
const dmStatusEl = document.getElementById("dm-status");
const dmListEl = document.getElementById("dm-list");
const dmEmptyEl = document.getElementById("dm-empty");

let idToken = null;
// Set when the page was opened via a temporary access link (#share=…).
let shareToken = null;
let shareExpiresAt = null;

// Theme: same behavior as the health site (dark by default,
// data-theme="light" on <html>, label shows the target theme).
let theme = resolveTheme(localStorage.getItem(THEME_KEY));
applyTheme(document.documentElement, themeBtn, theme);

themeBtn.addEventListener("click", () => {
  theme = nextTheme(theme);
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(document.documentElement, themeBtn, theme);
});

function refreshState() {
  countEl.textContent = countText(textEl.value);
  postBtn.disabled = !canPost(idToken || shareToken, textEl.value);
}

textEl.addEventListener("input", refreshState);

function showComposer(email) {
  gateEl.hidden = true;
  expiredEl.hidden = true;
  composerEl.hidden = false;
  shareCardEl.hidden = false;
  inboxEl.hidden = false;
  dmEl.hidden = false;
  logoutBtn.hidden = false;
  accountEl.textContent = "ログイン中：" + email;
  refreshState();
  loadComments();
  loadDms();
}

function showGate() {
  gateEl.hidden = false;
  composerEl.hidden = true;
  shareCardEl.hidden = true;
  inboxEl.hidden = true;
  dmEl.hidden = true;
  expiredEl.hidden = true;
  logoutBtn.hidden = true;
}

function showShareComposer() {
  gateEl.hidden = true;
  expiredEl.hidden = true;
  composerEl.hidden = false;
  shareCardEl.hidden = true;
  inboxEl.hidden = false;
  dmEl.hidden = false;
  logoutBtn.hidden = true;
  accountEl.textContent = `一時リンクで表示中です（${formatShareExpiry(shareExpiresAt)} まで有効）`;
  refreshState();
  loadComments();
  loadDms();
}

function showShareExpired() {
  shareToken = null;
  shareExpiresAt = null;
  gateEl.hidden = true;
  composerEl.hidden = true;
  shareCardEl.hidden = true;
  inboxEl.hidden = true;
  dmEl.hidden = true;
  logoutBtn.hidden = true;
  expiredEl.hidden = false;
}

function onCredential(response) {
  // No client-side authorization gate: tweet-gas verifies the token
  // and the account, and rejects unauthorized posts server-side.
  const payload = decodeJwtPayload(response.credential);
  idToken = response.credential;
  showComposer(payload.email);
}

logoutBtn.addEventListener("click", () => {
  idToken = null;
  if (window.google) {
    google.accounts.id.disableAutoSelect();
  }
  showGate();
});

// --- Temporary access link (share mode) ---

async function enterShareMode(token) {
  try {
    const data = await validateShareToken(CONFIG.GAS_ENDPOINT, token);
    if (data.ok && data._share) {
      shareToken = token;
      shareExpiresAt = data._share.expires_at;
      showShareComposer();
    } else {
      showShareExpired();
    }
  } catch {
    showShareExpired();
  }
}

// --- Owner's share administration card ---

function renderIssuedShare(data) {
  const base = `${window.location.origin}${window.location.pathname}`;
  shareUrlEl.value = buildShareUrl(base, data.share_token);
  shareRemainingEl.textContent = formatShareRemaining(
    shareSecondsLeft(data.expires_at, Date.now()),
  );
  shareExpiresEl.textContent = formatShareExpiry(data.expires_at);
  shareIssuedEl.hidden = false;
  shareIssueRowEl.hidden = true;
  shareStatusEl.textContent = "";
  shareCopyBtn.textContent = "URLをコピー";
}

async function issueShare() {
  shareStatusEl.textContent = "発行しています…";
  try {
    const data = await shareAction(CONFIG.GAS_ENDPOINT, idToken, "issue_share");
    if (data.ok) {
      renderIssuedShare(data);
    } else {
      shareStatusEl.textContent = "発行に失敗しました：" + data.error;
    }
  } catch (err) {
    shareStatusEl.textContent = "通信に失敗しました：" + err;
  }
}

shareIssueBtn.addEventListener("click", issueShare);
shareReissueBtn.addEventListener("click", issueShare);

shareRevokeBtn.addEventListener("click", async () => {
  shareStatusEl.textContent = "無効化しています…";
  try {
    const data = await shareAction(CONFIG.GAS_ENDPOINT, idToken, "revoke_share");
    if (data.ok) {
      shareIssuedEl.hidden = true;
      shareIssueRowEl.hidden = false;
      shareUrlEl.value = "";
      shareStatusEl.textContent = "リンクを無効化しました。";
    } else {
      shareStatusEl.textContent = "無効化に失敗しました：" + data.error;
    }
  } catch (err) {
    shareStatusEl.textContent = "通信に失敗しました：" + err;
  }
});

shareCopyBtn.addEventListener("click", async () => {
  shareUrlEl.select();
  try {
    await navigator.clipboard.writeText(shareUrlEl.value);
    shareCopyBtn.textContent = "コピーしました";
  } catch {
    document.execCommand("copy");
    shareCopyBtn.textContent = "コピーしました";
  }
});

window.addEventListener("load", () => {
  const tokenFromHash = parseShareToken(window.location.hash);
  if (tokenFromHash) {
    enterShareMode(tokenFromHash);
    return;
  }
  google.accounts.id.initialize({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    callback: onCredential,
  });
  google.accounts.id.renderButton(document.getElementById("signin"), {
    theme: "outline",
    size: "large",
    text: "signin_with",
  });
});

function showError(message) {
  statusEl.innerHTML = "";
  const span = document.createElement("span");
  span.className = "error";
  span.textContent = message;
  statusEl.append(span);
  postBtn.disabled = false;
}

// --- Comment inbox ---

function showInboxError(message) {
  inboxStatusEl.innerHTML = "";
  const span = document.createElement("span");
  span.className = "error";
  span.textContent = message;
  inboxStatusEl.append(span);
}

function renderComment(view) {
  const article = document.createElement("article");
  article.className = "comment-item";

  const meta = document.createElement("p");
  meta.className = "comment-meta";
  const author = document.createElement("strong");
  author.textContent = view.authorLabel || view.authorName;
  meta.append(author);
  if (view.timeLabel) {
    meta.append(" ", view.timeLabel);
  }
  const badge = document.createElement("span");
  badge.className = view.replied ? "badge badge-replied" : "badge";
  badge.textContent = view.badgeLabel;
  meta.append(" ", badge);
  if (view.isQuote) {
    const quoteBadge = document.createElement("span");
    quoteBadge.className = "badge badge-quote";
    quoteBadge.textContent = view.kindBadgeLabel || "引用";
    meta.append(" ", quoteBadge);
  }
  article.append(meta);

  const body = document.createElement("p");
  body.className = "comment-text";
  body.textContent = view.text;
  article.append(body);

  const links = document.createElement("p");
  links.className = "comment-links meta";
  if (view.commentUrl) {
    const a = document.createElement("a");
    a.href = view.commentUrl;
    a.textContent = "コメントを見る";
    a.target = "_blank";
    a.rel = "noopener";
    links.append(a);
  }
  if (view.parentUrl) {
    if (links.childNodes.length > 0) {
      links.append(" ／ ");
    }
    const a = document.createElement("a");
    a.href = view.parentUrl;
    a.textContent = "返信先の投稿を見る";
    a.target = "_blank";
    a.rel = "noopener";
    links.append(a);
  }
  if (links.childNodes.length > 0) {
    article.append(links);
  }

  // Reply box: same counting rule and no pre-send confirmation,
  // matching the existing post flow.
  const replyText = document.createElement("textarea");
  replyText.rows = 3;
  replyText.placeholder = "返信する文面";
  replyText.setAttribute("aria-label", "返信する文面");

  // Reply method toggle: unchecked sends a normal reply, checked
  // sends the same text as a quote repost (as_quote: true).
  const quoteToggle = document.createElement("label");
  quoteToggle.className = "reply-mode-toggle";
  const quoteCheckbox = document.createElement("input");
  quoteCheckbox.type = "checkbox";
  quoteCheckbox.className = "reply-as-quote";
  quoteCheckbox.setAttribute("aria-label", "引用リポストで返す");
  quoteToggle.append(quoteCheckbox, "引用リポストで返す");

  const row = document.createElement("div");
  row.className = "composer-row";
  const count = document.createElement("span");
  count.className = "meta";
  const countValue = document.createElement("span");
  countValue.textContent = "0";
  count.append(countValue, " / 280");
  const replyBtn = document.createElement("button");
  replyBtn.type = "button";
  replyBtn.className = "post-button";
  replyBtn.textContent = "返信する";
  replyBtn.disabled = true;
  row.append(count, replyBtn);

  quoteCheckbox.addEventListener("change", () => {
    replyBtn.textContent = quoteCheckbox.checked ? "引用で返す" : "返信する";
  });

  const replyStatus = document.createElement("div");
  replyStatus.className = "comment-reply-status";

  replyText.addEventListener("input", () => {
    countValue.textContent = countText(replyText.value);
    replyBtn.disabled = !canReply(idToken || shareToken, replyText.value);
  });

  replyBtn.addEventListener("click", async () => {
    replyBtn.disabled = true;
    const asQuote = quoteCheckbox.checked;
    replyStatus.textContent = asQuote ? "引用リポストしています…" : "返信しています…";
    try {
      const data = shareToken
        ? await replyCommentWithShare(CONFIG.GAS_ENDPOINT, shareToken, view.commentId, replyText.value, { asQuote })
        : await replyComment(CONFIG.GAS_ENDPOINT, idToken, view.commentId, replyText.value, { asQuote });
      if (data.ok) {
        replyStatus.innerHTML = "";
        if (data.dry_run) {
          replyStatus.textContent = asQuote
            ? "ステージングでは引用リポストしません（ドライラン）。"
            : "ステージングでは返信しません（ドライラン）。";
        } else if (data.url) {
          const a = document.createElement("a");
          a.href = data.url;
          a.textContent = data.url;
          a.target = "_blank";
          a.rel = "noopener";
          replyStatus.append(asQuote ? "引用リポストしました：\n" : "返信しました：\n", a);
          if (data.verifiedText != null) {
            replyStatus.append("\n確認済みの本文：" + data.verifiedText);
          }
        } else {
          replyStatus.textContent = asQuote ? "引用リポストしました。" : "返信しました。";
        }
        replyText.value = "";
        countValue.textContent = "0";
        quoteCheckbox.checked = false;
        replyBtn.textContent = "返信する";
        // Refresh so the replied state (badge) becomes visible.
        await loadComments();
      } else if (shareToken && data.error === "unauthorized") {
        showShareExpired();
      } else {
        const span = document.createElement("span");
        span.className = "error";
        span.textContent = "失敗しました：" + data.error;
        replyStatus.innerHTML = "";
        replyStatus.append(span);
        replyBtn.disabled = false;
      }
    } catch (err) {
      const span = document.createElement("span");
      span.className = "error";
      span.textContent = "通信に失敗しました：" + err;
      replyStatus.innerHTML = "";
      replyStatus.append(span);
      replyBtn.disabled = false;
    }
  });

  article.append(replyText, quoteToggle, row, replyStatus);
  return article;
}

async function loadComments() {
  if (!(idToken || shareToken)) {
    return;
  }
  inboxRefreshBtn.disabled = true;
  inboxStatusEl.textContent = "読み込んでいます…";
  try {
    const data = shareToken
      ? await listCommentsWithShare(CONFIG.GAS_ENDPOINT, shareToken)
      : await listComments(CONFIG.GAS_ENDPOINT, idToken);
    if (data.ok) {
      inboxStatusEl.textContent = "";
      const notes = inboxNotes(data);
      inboxNoteEl.hidden = notes.length === 0;
      inboxNoteEl.textContent = notes.join(" ");
      const views = normalizeComments(data.comments);
      inboxListEl.innerHTML = "";
      for (const view of views) {
        inboxListEl.append(renderComment(view));
      }
      inboxEmptyEl.hidden = views.length !== 0 || Boolean(data.dry_run);
    } else if (shareToken && data.error === "unauthorized") {
      showShareExpired();
    } else {
      showInboxError("取得に失敗しました：" + data.error);
    }
  } catch (err) {
    showInboxError("通信に失敗しました：" + err);
  } finally {
    inboxRefreshBtn.disabled = false;
  }
}

inboxRefreshBtn.addEventListener("click", loadComments);

// --- DM inbox ---
// Independent from the comment inbox: both load in parallel after
// sign-in, and a failure in one never blocks the other.

// Conversation views from the latest list_dms response.
let dmViews = [];
// True when the latest list response was a dry run (staging). While
// dry-running, opening a conversation must not call mark_dm_read.
let dmDryRun = false;
// Conversation whose thread is currently expanded.
let openDmConversationId = null;
// Conversations a mark_dm_read request was already sent for, so
// reopening never sends it twice.
const dmMarkRequested = new Set();
// Notice to show inside a thread after a reply-triggered reload
// rebuilds the DOM (e.g. the staging dry-run message).
let dmThreadNotice = null;

function showDmError(message) {
  dmStatusEl.innerHTML = "";
  const span = document.createElement("span");
  span.className = "error";
  span.textContent = message;
  dmStatusEl.append(span);
}

function renderDmThread(view) {
  const thread = document.createElement("div");
  thread.className = "dm-thread";

  for (const message of view.messages) {
    const item = document.createElement("div");
    item.className = message.isMine ? "dm-message dm-message-mine" : "dm-message";
    const meta = document.createElement("p");
    meta.className = "dm-message-meta";
    const sender = document.createElement("strong");
    sender.textContent = message.senderLabel;
    meta.append(sender);
    if (message.timeLabel) {
      meta.append(" ", message.timeLabel);
    }
    const body = document.createElement("p");
    body.className = "dm-message-text";
    body.textContent = message.text;
    item.append(meta, body);
    thread.append(item);
  }
  if (view.messages.length === 0) {
    const empty = document.createElement("p");
    empty.className = "meta";
    empty.textContent = "メッセージはありません。";
    thread.append(empty);
  }

  // Reply box: code point count with a 10,000 limit (a different
  // rule from the 280 post count).
  const replyText = document.createElement("textarea");
  replyText.rows = 3;
  replyText.placeholder = "返信する文面";
  replyText.setAttribute("aria-label", "DMに返信する文面");

  const row = document.createElement("div");
  row.className = "composer-row";
  const count = document.createElement("span");
  count.className = "meta";
  const countValue = document.createElement("span");
  countValue.textContent = "0";
  count.append(countValue, ` / ${DM_MAX_LENGTH}`);
  const replyBtn = document.createElement("button");
  replyBtn.type = "button";
  replyBtn.className = "post-button";
  replyBtn.textContent = "送信する";
  replyBtn.disabled = true;
  row.append(count, replyBtn);

  const replyStatus = document.createElement("div");
  replyStatus.className = "comment-reply-status";
  if (dmThreadNotice && dmThreadNotice.conversationId === view.conversationId) {
    replyStatus.textContent = dmThreadNotice.text;
    dmThreadNotice = null;
  }

  replyText.addEventListener("input", () => {
    countValue.textContent = countDmText(replyText.value);
    replyBtn.disabled = !canReplyDm(idToken || shareToken, replyText.value);
  });

  replyBtn.addEventListener("click", async () => {
    replyBtn.disabled = true;
    replyStatus.textContent = "送信しています…";
    try {
      const data = shareToken
        ? await replyDmWithShare(CONFIG.GAS_ENDPOINT, shareToken, view.conversationId, replyText.value)
        : await replyDm(CONFIG.GAS_ENDPOINT, idToken, view.conversationId, replyText.value);
      if (data.ok) {
        replyText.value = "";
        countValue.textContent = "0";
        dmThreadNotice = {
          conversationId: view.conversationId,
          text: data.dry_run
            ? "ステージングではDMを送信しません（ドライラン）。"
            : "送信しました。",
        };
        // Reload so state changes (badges, latest message) show;
        // the open conversation stays open.
        await loadDms();
      } else if (shareToken && data.error === "unauthorized") {
        showShareExpired();
      } else {
        const span = document.createElement("span");
        span.className = "error";
        span.textContent = "失敗しました：" + data.error;
        replyStatus.innerHTML = "";
        replyStatus.append(span);
        replyBtn.disabled = false;
      }
    } catch (err) {
      const span = document.createElement("span");
      span.className = "error";
      span.textContent = "通信に失敗しました：" + err;
      replyStatus.innerHTML = "";
      replyStatus.append(span);
      replyBtn.disabled = false;
    }
  });

  thread.append(replyText, row, replyStatus);
  return thread;
}

async function markDmConversationRead(view) {
  if (!view.unread || dmDryRun || !view.latestEventId) {
    return;
  }
  if (dmMarkRequested.has(view.conversationId)) {
    return;
  }
  dmMarkRequested.add(view.conversationId);
  // Optimistically clear the unread badge; a failed request leaves
  // the guard in place so it is not retried in a loop.
  view.unread = false;
  view.badges = view.badges.filter((b) => b.key !== "unread");
  view.badgeLabels = view.badges.map((b) => b.label);
  try {
    const data = shareToken
      ? await markDmReadWithShare(CONFIG.GAS_ENDPOINT, shareToken, view.conversationId, view.latestEventId)
      : await markDmRead(CONFIG.GAS_ENDPOINT, idToken, view.conversationId, view.latestEventId);
    if (!data.ok && shareToken && data.error === "unauthorized") {
      showShareExpired();
    }
  } catch {
    // Read-marking is best-effort: the thread is already open and
    // the next list reload will show the server's state.
  }
}

function renderDmConversation(view) {
  const article = document.createElement("article");
  article.className = "comment-item";

  const header = document.createElement("button");
  header.type = "button";
  header.className = "dm-header";
  const who = document.createElement("span");
  const name = document.createElement("strong");
  name.textContent = view.participantLabel;
  who.append(name);
  for (const badge of view.badges) {
    const span = document.createElement("span");
    span.className =
      badge.key === "needs_reply" ? "badge badge-needs-reply" : "badge";
    span.textContent = badge.label;
    who.append(" ", span);
  }
  header.append(who);
  if (view.timeLabel) {
    const time = document.createElement("span");
    time.className = "meta";
    time.textContent = view.timeLabel;
    header.append(time);
  }
  header.addEventListener("click", () => {
    if (openDmConversationId === view.conversationId) {
      openDmConversationId = null;
      renderDmList();
    } else {
      openDmConversationId = view.conversationId;
      renderDmList();
      // Opening an unread conversation marks it read (once).
      markDmConversationRead(view).then(() => {
        if (openDmConversationId === view.conversationId) {
          renderDmList();
        }
      });
    }
  });
  article.append(header);

  const preview = document.createElement("p");
  preview.className = "comment-text dm-preview";
  preview.textContent = view.preview;
  article.append(preview);

  if (openDmConversationId === view.conversationId) {
    article.append(renderDmThread(view));
  }
  return article;
}

function renderDmList() {
  dmListEl.innerHTML = "";
  for (const view of dmViews) {
    dmListEl.append(renderDmConversation(view));
  }
  dmEmptyEl.hidden = dmViews.length !== 0 || dmDryRun;
}

async function loadDms() {
  if (!(idToken || shareToken)) {
    return;
  }
  dmRefreshBtn.disabled = true;
  dmStatusEl.textContent = "読み込んでいます…";
  try {
    const data = shareToken
      ? await listDmsWithShare(CONFIG.GAS_ENDPOINT, shareToken)
      : await listDms(CONFIG.GAS_ENDPOINT, idToken);
    if (data.ok) {
      dmStatusEl.textContent = "";
      dmDryRun = Boolean(data.dry_run);
      const notes = dmNotes(data);
      dmNoteEl.hidden = notes.length === 0;
      dmNoteEl.textContent = notes.join(" ");
      dmViews = normalizeConversations(data.conversations);
      renderDmList();
    } else if (shareToken && data.error === "unauthorized") {
      showShareExpired();
    } else {
      showDmError("取得に失敗しました：" + data.error);
    }
  } catch (err) {
    showDmError("通信に失敗しました：" + err);
  } finally {
    dmRefreshBtn.disabled = false;
  }
}

dmRefreshBtn.addEventListener("click", loadDms);

postBtn.addEventListener("click", async () => {
  postBtn.disabled = true;
  statusEl.textContent = "投稿しています…";
  try {
    const data = shareToken
      ? await postTweetWithShare(CONFIG.GAS_ENDPOINT, shareToken, textEl.value)
      : await postTweet(CONFIG.GAS_ENDPOINT, idToken, textEl.value);
    if (data.ok) {
      statusEl.innerHTML = "";
      const a = document.createElement("a");
      a.href = data.url;
      a.textContent = data.url;
      a.target = "_blank";
      a.rel = "noopener";
      statusEl.append(
        "投稿しました：\n",
        a,
        "\n" +
          (data.verifiedText != null
            ? "確認済みの本文：" + data.verifiedText
            : "（投稿の確認リクエストは失敗しました。リンク先でご確認ください）"),
      );
      textEl.value = "";
      refreshState();
    } else if (shareToken && data.error === "unauthorized") {
      // The link expired or was revoked while composing.
      showShareExpired();
    } else {
      showError("失敗しました：" + data.error);
    }
  } catch (err) {
    showError("通信に失敗しました：" + err);
  }
});
