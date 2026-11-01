// tweet frontend configuration.
//
// GOOGLE_CLIENT_ID: OAuth 2.0 Web client ID used for Google Sign-In.
//   The same client as the health site.
// GAS_ENDPOINT: the /exec URL of the tweet-gas web app deployment.
//
// There is deliberately no allowed-email check on the client side:
// authorization is enforced by tweet-gas, which verifies the ID
// token and the account's email before posting.
export const CONFIG = {
  GOOGLE_CLIENT_ID:
    "728154182351-5ribj1diqcp8jpfo3rnqk9rei1aka98t.apps.googleusercontent.com",
  GAS_ENDPOINT:
    "https://script.google.com/macros/s/AKfycbzuui1RIL3ZqOiYPC5KiLUvp165u-rf9jT5XmQrdW9rgpEoqaTSQmbyCW31O9is6i-X/exec",
};
