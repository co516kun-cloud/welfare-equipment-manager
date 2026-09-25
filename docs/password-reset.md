# パスワードを忘れたときの仕組みと、管理者の作業

2026-09-25 追加。スタッフは各自のメールアドレスで Supabase にログインしている。

## スタッフから見た流れ

1. ログイン画面の「パスワードを忘れた場合」を押す
2. ログインに使っているメールアドレスを入れて「再設定メールを送る」
3. 届いたメールのリンクを開くと「新しいパスワードの設定」画面が出る
4. 新しいパスワードを2回入れて設定 → 「アプリを使い始める」

ログイン中に自分で変えたいときは、PC は右上の名前、スマホは ☰ メニューの「パスワード変更」から変えられる（今のパスワードが必要）。

## 管理者が1回だけ行う設定（Supabase ダッシュボード）

**これをしないと、再設定メールはスタッフに届かない。** Supabase 標準のメール送信は、プロジェクトのチームメンバーのアドレスにしか送らず、1時間に2通までという制限がある。

### 1. メール送信（SMTP）を設定する

Authentication → Emails → SMTP Settings で「Enable Custom SMTP」をオンにして、送信に使うサービスの情報を入れる。

独自ドメインを持っていない場合は、Gmail の送信サーバーを使うのが手軽。

| 項目 | 入れる値 |
|---|---|
| Sender email | 送信に使う Gmail アドレス |
| Sender name | 福祉用具管理システム |
| Host | smtp.gmail.com |
| Port | 465 |
| Username | 送信に使う Gmail アドレス |
| Password | Google アカウントの「アプリ パスワード」（2段階認証をオンにすると作れる。ふだんの Gmail のパスワードではない） |

独自ドメインがある場合は、Resend や SendGrid などのメール送信サービスでも良い。

### 2. 戻り先の URL を登録する

Authentication → URL Configuration で次のように設定する。

- Site URL: `https://welfare-equipment-manager.vercel.app`
- Redirect URLs に追加: `https://welfare-equipment-manager.vercel.app/reset-password`
- 手元の開発環境で試すなら、これも追加: `http://localhost:5173/reset-password`

登録していない URL へは戻れないので、リンクを開くと Site URL に戻ってしまう（その場合もアプリは再設定モードに入るが、登録しておくのが確実）。

### 3. メールの文面を日本語にする（任意）

Authentication → Emails → Templates → Reset Password。初期の文面は英語。

- Subject: `【福祉用具管理システム】パスワード再設定のご案内`
- Body:

```html
<p>パスワードを設定し直すには、下のリンクを開いてください。</p>
<p><a href="{{ .ConfirmationURL }}">新しいパスワードを設定する</a></p>
<p>リンクの有効期限は1時間です。心当たりがない場合は、このメールを無視してください。</p>
```

`{{ .ConfirmationURL }}` はそのまま残すこと（ここに再設定リンクが入る）。

### 設定できたかの確かめ方

1. 本番のログイン画面で「パスワードを忘れた場合」から、**Supabase のチームメンバーではないスタッフ**のアドレスに送る。管理者自身のアドレスは Supabase 標準のメール送信でも届くので、SMTP が効いていなくても届いてしまい、確認にならない
2. 届いたメールの差出人が、手順1で入れた Sender name / Sender email になっていることを確かめる。差出人が Supabase Auth（noreply@mail.app.supabase.io）なら、SMTP の設定が効いていない
3. リンクを開くと「新しいパスワードの設定」画面が出れば OK

送信時の表示で原因の見当がつく。

| ログイン画面の表示 | 見直すところ |
|---|---|
| メール送信の設定が済んでいない可能性があります | SMTP がオンになっていない |
| メールを送れませんでした（Error sending recovery email） | SMTP の値（アプリ パスワード・Port 465・Username が Gmail アドレスか） |
| 少し前に再設定メールを送っています | 同じ人への再送は1分ほどあける決まり。故障ではない |

再送すると前のメールのリンクは使えなくなる。何通か届いたときは、いちばん新しいメールのリンクを開く。

## メールが届かないスタッフがいるとき（管理者が仮パスワードを発行する）

登録アドレスが受信できない、迷惑メールで弾かれている、リンクを開くと毎回「有効期限切れ」になる（会社のメールのリンク検査が先にリンクを開いてしまう場合がある）、などでメールが使えないときの受け皿。

1. 本人から連絡を受ける（電話・対面などで本人と確認する）
2. Supabase ダッシュボード → SQL Editor で下の SQL を貼り、**2か所を書き換えて** Run
3. 結果に1行（そのスタッフのメールアドレス）が出れば成功。0行ならアドレスの綴り違い（大文字・小文字は区別しないので、綴りだけ確かめる）
4. 仮パスワードを本人にだけ伝える（口頭が安全。チャットやメールに残さない）
5. 本人は仮パスワードでログインし、「パスワード変更」ですぐに自分のパスワードへ変える

```sql
-- 1人分だけ仮パスワードに戻す。
-- 影響範囲: auth.users のうち、where で指定したメールアドレスの1行の
--           パスワード（encrypted_password）と更新日時だけ。名前・貸与履歴などは変わらない。
update auth.users
set encrypted_password = extensions.crypt('ここに仮パスワード（8文字以上）', extensions.gen_salt('bf')),
    updated_at = now()
-- Supabase はアドレスを小文字で保存しているので、lower で合わせる
where email = lower(trim('スタッフのメールアドレス'))
returning email, updated_at;
```

## 仕組みのメモ（開発者向け）

- 再設定メールの送信: `requestPasswordReset`（`src/hooks/useAuth.ts`）。戻り先は `/reset-password`
- リンクから戻ったかの判定: `src/lib/auth-redirect.ts` が起動直後に URL を読む。auth-js は成功時に URL の `#` 以降を消すので、`supabase.ts` が createClient より先にこのファイルを読み込んでいる
- 再設定モードの間、`App.tsx` は普段の画面の代わりに `src/pages/reset-password.tsx` を出し、初期データの読み込みも止める
- パスワードを変えると、Supabase はほかの端末のログインを切る。ほかの端末は次のトークン更新（最長で約1時間後）でログイン画面に戻る
