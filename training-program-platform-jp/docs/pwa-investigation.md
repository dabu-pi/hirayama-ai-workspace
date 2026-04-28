# PWA化 安全調査メモ

## STATUS

調査完了。  
現時点では実装しない。  
先に別タスクを実施し、その後に PWA Phase 1 として最小実装を行う。

---

## 調査対象

`training-program-platform-jp` を、スマホのホーム画面からアプリのように起動できるようにする PWA 化について調査した。

目的は、Google Play / App Store に出す本格アプリ化の前段階として、まず低コスト・低リスクで「アプリっぽく使える」状態にすること。

---

## 現状

| 項目 | 状態 |
|---|---|
| `public/` ディレクトリ | 存在しない |
| Web App Manifest | なし |
| Service Worker | なし |
| PWA 依存パッケージ | なし |
| `next-pwa` / `workbox` | 未導入 |
| `next.config.mjs` | `reactStrictMode: true` のみ |
| `/train` | `force-dynamic` |
| `/session-history` | `force-dynamic` |

---

## キャッシュリスク評価

現状では Service Worker がないため、PWA由来の古いキャッシュリスクはない。

`/train` や `/session-history` は `force-dynamic` のため、HTML は毎回サーバー側で生成される。  
また、Next.js の JS / CSS などの静的アセットはコンテンツハッシュ付きファイル名で配信されるため、通常の更新時には自動的に新しいファイルへ切り替わる。

したがって、Service Worker を追加しない限り、以下のようなリスクは低い。

- 古い `/train` 画面が表示される
- 古い履歴が表示される
- workout_sessions の古いデータを読む
- admin / member 情報が古いまま表示される
- Supabase/API レスポンスがキャッシュされる

---

## 推奨方針

PWA Phase 1 では、Service Worker を追加しない。

まずは以下の最小対応に限定する。

| 実装項目 | 方法 | リスク |
|---|---|---|
| Web App Manifest | `app/manifest.ts` を追加 | 低 |
| アプリ名 / 表示モード | manifest で設定 | 低 |
| テーマカラー | `layout.tsx` metadata で設定 | 低 |
| Android用アイコン | `public/icons/` に追加 | 低 |
| iOS用アイコン | `apple-touch-icon.png` を追加 | 低 |
| Service Worker | 追加しない | 古いキャッシュリスクを避けられる |
| `next-pwa` / Workbox | 追加しない | 同上 |

---

## キャッシュ方針

### キャッシュしてよいもの

- アプリアイコン
- manifest
- CSS
- JavaScript
- 画像などの静的アセット

### キャッシュしないもの

- `/train`
- `/session-history`
- `/admin/*`
- `/api/*`
- Supabase 関連レスポンス
- workout_sessions
- 履歴データ
- 会員情報
- ログイン状態
- 認証後ページのHTML
- オフライン保存データ

---

## PWA Phase 1 でやること

### 追加・変更候補

- `app/manifest.ts`
- `app/layout.tsx`
- `public/icons/icon.svg`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `public/apple-touch-icon.png`

### manifest 設定候補

```ts
{
  name: "トレーニング記録",
  short_name: "トレ記録",
  start_url: "/",
  scope: "/",
  display: "standalone",
  theme_color: "...",
  background_color: "..."
}
```

`start_url` は `/train` ではなく `/` にする。  
認証後ページを直接 start_url にしない。

---

## Android / iOS の挙動

### Android Chrome

manifest と icon があれば、ホーム画面追加またはインストール案内が出る可能性がある。  
スタンドアロン表示でアプリのように起動できる。

### iOS Safari

自動インストールプロンプトは基本的に出ない。  
Safari の共有メニューから「ホーム画面に追加」を手動で行う。  
`apple-touch-icon.png` が必要。

---

## 今回やらないこと

- Service Worker 追加
- `next-pwa` 導入
- Workbox 導入
- HTML キャッシュ
- API レスポンスキャッシュ
- Supabase レスポンスキャッシュ
- workout_sessions のローカル保存
- オフライン記録
- Push通知
- Google Play / App Store 公開
- Capacitor 化
- React Native / Expo 化

---

## 将来タスク

### PWA Phase 2 以降

- Android 実機でホーム画面追加確認
- iOS Safari でホーム画面追加確認
- アイコンデザイン改善
- Splash / 起動画面調整
- 必要性が出た場合のみ Service Worker 検討

### さらに将来

- Capacitor による Android アプリ化
- Google Play Console 登録
- iOS アプリ化
- Apple Developer Program 登録
- Push通知
- オフライン対応

ただし、オフライン保存は同期ズレや二重保存リスクがあるため、かなり後回しにする。

---

## 結論

現時点で最も安全な方針は以下。

1. まずは Service Worker なしの最小PWA化を行う
2. manifest / metadata / icon のみ追加する
3. `/train` / `/session-history` / `/admin` / Supabaseデータはキャッシュしない
4. オフライン保存は実装しない
5. Android / iOS のホーム画面追加確認を行う
6. 本格アプリ化は PWA 運用後に検討する

PWA Phase 1 は低リスクで進められるが、実装は一旦保留する。  
先に別タスクを実施してから着手する。
