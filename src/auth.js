// Decode the payload of a Google ID token (JWT) without verifying the
// signature. Verification and authorization happen server-side in
// tweet-gas; this is only used to read the signed-in account's email
// for display.
export function decodeJwtPayload(token) {
  try {
    const part = typeof token === "string" ? token.split(".")[1] : undefined;
    if (!part) {
      return {};
    }
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    const payload = JSON.parse(json);
    return payload && typeof payload === "object" ? payload : {};
  } catch {
    // A malformed credential (or a sign-in response without one)
    // reads as an empty payload: the caller runs before its own
    // try/catch, and the payload only feeds the email display — the
    // exchange itself uses the raw credential and is verified
    // server-side.
    return {};
  }
}
