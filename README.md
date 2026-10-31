# tweet

X（@freddiefujiwara）へ投稿するためのフロントエンド。バックエンドは別リポジトリ `tweet-gas`。

## 仕組み

- Google Sign-In（Google Identity Services）でログインする
- ログインできるのは `zegenvs@gmail.com` だけ（画面側の制御に加え、バックエンドでも ID トークンを検証して同じ条件を強制する）
- 「投稿する」で tweet-gas の Web アプリへ ID トークンと文面を送り、投稿結果の URL と、バックエンドが再取得して確認した本文を表示する

## セットアップ

1. `config.js` の2項目を設定する
   - `GOOGLE_CLIENT_ID`：Google Sign-In 用の OAuth 2.0 Web クライアントID（health サイトで使っているものと同じでよい。その場合、このサイトのオリジンを「承認済みの JavaScript 生成元」に追加すること）
   - `GAS_ENDPOINT`：tweet-gas の Web アプリの `/exec` URL
2. GitHub Pages を有効化して公開する（公開しても投稿はログイン＋バックエンド検証の二重で守られる）

## 注意

- 文字数は簡易カウント（280字）。URL や絵文字の重み付けは X 側の判定が最終。
- 投稿の取り消しは X の画面から行う。
