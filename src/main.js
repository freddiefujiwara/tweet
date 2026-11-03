import "./style.css";
import { CONFIG } from "./config.js";
import { decodeJwtPayload } from "./auth.js";
import { THEME_KEY, resolveTheme, nextTheme, applyTheme } from "./theme.js";
import { countText, canPost } from "./composer.js";
import { postTweet, postTweetWithShare, validateShareToken, shareAction } from "./post.js";
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
  logoutBtn.hidden = false;
  accountEl.textContent = "ログイン中：" + email;
  refreshState();
}

function showGate() {
  gateEl.hidden = false;
  composerEl.hidden = true;
  shareCardEl.hidden = true;
  expiredEl.hidden = true;
  logoutBtn.hidden = true;
}

function showShareComposer() {
  gateEl.hidden = true;
  expiredEl.hidden = true;
  composerEl.hidden = false;
  shareCardEl.hidden = true;
  logoutBtn.hidden = true;
  accountEl.textContent = `一時リンクで表示中です（${formatShareExpiry(shareExpiresAt)} まで有効）`;
  refreshState();
}

function showShareExpired() {
  shareToken = null;
  shareExpiresAt = null;
  gateEl.hidden = true;
  composerEl.hidden = true;
  shareCardEl.hidden = true;
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
