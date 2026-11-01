// tweet frontend configuration.
//
// GOOGLE_CLIENT_ID: OAuth 2.0 Web client ID used for Google Sign-In.
//   The same client as the health site.
// GAS_ENDPOINT: the /exec URL of the tweet-gas web app deployment.
// ALLOWED_EMAIL: the only Google account allowed to post, injected at
//   build time from the ALLOWED_EMAIL repository secret (locally, set
//   VITE_ALLOWED_EMAIL in a .env file). It still ends up in the served
//   JavaScript, so this is not a secrecy boundary: the real
//   enforcement is server-side, where tweet-gas verifies the ID token
//   and this address.
export const CONFIG = {
  GOOGLE_CLIENT_ID:
    "728154182351-5ribj1diqcp8jpfo3rnqk9rei1aka98t.apps.googleusercontent.com",
  GAS_ENDPOINT:
    "https://script.google.com/macros/s/AKfycbzuui1RIL3ZqOiYPC5KiLUvp165u-rf9jT5XmQrdW9rgpEoqaTSQmbyCW31O9is6i-X/exec",
};

export const ALLOWED_EMAIL = import.meta.env.VITE_ALLOWED_EMAIL ?? "";
