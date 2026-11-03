// Staging-only banner.
//
// The staging build sets VITE_STAGING=1 (see the staging steps in the
// GitHub Pages workflows); production builds leave it unset, so this
// banner can never appear in production. It exists so the staging
// environment is never mistaken for production at a glance.

export function isStagingBuild(env = import.meta.env) {
  return env?.VITE_STAGING === "1";
}

export function showStagingBanner(doc = document) {
  const el = doc.createElement("div");
  el.textContent = "STAGING ― これはステージング環境です（本番ではありません）";
  el.setAttribute(
    "style",
    "background:#f7e9e2;color:#8f2a12;text-align:center;font-size:12px;line-height:2.2;letter-spacing:.06em;"
  );
  doc.body.prepend(el);
  return el;
}
