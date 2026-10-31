# tweet

A small web page to post to X (@freddiefujiwara). The backend is the `tweet-gas` repository.

## How it works

- Sign in with Google.
- Only `zegenvs@gmail.com` can post. The page checks the email, and the backend checks the ID token again with the same rule.
- Type the text and press the post button. The page sends the ID token and the text to the tweet-gas web app.
- After posting, the page shows the tweet URL and the text that the backend read back from X.

## Setup

1. Set two values in `config.js`.
   - `GOOGLE_CLIENT_ID`: the OAuth 2.0 web client ID for Google Sign-In. You can use the same client as the health site. Add this site's origin to the client's authorized JavaScript origins.
   - `GAS_ENDPOINT`: the `/exec` URL of the tweet-gas web app.
2. Turn on GitHub Pages for this repository.

## Notes

- The character count is simple (max 280). X makes the final decision for URLs and emoji.
- To delete a post, use X.
