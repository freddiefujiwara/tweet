// Send the post text to the tweet-gas endpoint with the Google ID
// token. Returns the parsed JSON response ({ ok, url, ... } or
// { ok: false, error }). Throws on network/parse failure.
export async function postTweet(endpoint, idToken, text, fetchImpl = fetch) {
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ idToken, text }),
  });
  return res.json();
}
