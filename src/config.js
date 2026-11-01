// tweet frontend configuration.
//
// GOOGLE_CLIENT_ID: OAuth 2.0 Web client ID used for Google Sign-In.
//   The same client as the health site.
// GAS_ENDPOINT: the /exec URL of the tweet-gas web app deployment.
// ALLOWED_EMAIL: the only Google account allowed to post. The real
//   enforcement is server-side (tweet-gas verifies the ID token and
//   this address); the check here is a client-side gate.
export const CONFIG = {
  GOOGLE_CLIENT_ID:
    "728154182351-5ribj1diqcp8jpfo3rnqk9rei1aka98t.apps.googleusercontent.com",
  GAS_ENDPOINT:
    "https://script.google.com/macros/s/AKfycbzuui1RIL3ZqOiYPC5KiLUvp165u-rf9jT5XmQrdW9rgpEoqaTSQmbyCW31O9is6i-X/exec",
};

export const ALLOWED_EMAIL = "zegenvs@gmail.com";
