import "./style.css";
import { CONFIG, ALLOWED_EMAIL } from "./config.js";
import { decodeJwtPayload, isAllowedEmail } from "./auth.js";
import { THEME_KEY, resolveTheme, nextTheme, applyTheme } from "./theme.js";
import { countText, canPost } from "./composer.js";
import { postTweet } from "./post.js";

const gateEl = document.getElementById("gate");
const gateErrorEl = document.getElementById("gate-error");
const composerEl = document.getElementById("composer");
const textEl = document.getElementById("text");
const postBtn = document.getElementById("post");
const countEl = document.getElementById("count");
const statusEl = document.getElementById("status");
const accountEl = document.getElementById("account");
const logoutBtn = document.getElementById("logout");
const themeBtn = document.getElementById("theme-toggle");

let idToken = null;

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
  postBtn.disabled = !canPost(idToken, textEl.value);
}

textEl.addEventListener("input", refreshState);

function showComposer(email) {
  gateEl.hidden = true;
  composerEl.hidden = false;
  logoutBtn.hidden = false;
  accountEl.textContent = "ログイン中：" + email;
  refreshState();
}

function showGate() {
  gateEl.hidden = false;
  composerEl.hidden = true;
  logoutBtn.hidden = true;
}

function onCredential(response) {
  const payload = decodeJwtPayload(response.credential);
  if (!isAllowedEmail(payload.email, ALLOWED_EMAIL)) {
    gateErrorEl.textContent =
      "このアカウントでは投稿できません：" + payload.email;
    idToken = null;
    showGate();
    return;
  }
  gateErrorEl.textContent = "";
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

window.addEventListener("load", () => {
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
    const data = await postTweet(CONFIG.GAS_ENDPOINT, idToken, textEl.value);
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
    } else {
      showError("失敗しました：" + data.error);
    }
  } catch (err) {
    showError("通信に失敗しました：" + err);
  }
});
