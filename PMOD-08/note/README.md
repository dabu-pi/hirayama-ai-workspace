# note — 公開コンテンツ

**最終更新:** 2026-04-10

---

## フォルダ構成

```
note/
├── README.md          # このファイル
├── series_plan.md     # シリーズ構成・公開計画
├── free/              # 公開済み無料記事
├── paid/              # 公開済み有料記事
└── drafts/            # 下書き
```

---

## 記事作成フロー

1. `drafts/` にMarkdownで草稿を書く
2. `prompts/ai_review_prompt.md` でAIレビューを実施
3. 修正後、`free/` または `paid/` に移動
4. note に投稿
5. `series_plan.md` の状態を更新

---

## ファイル命名規則

`[シリーズ略称]_[番号]_[タイトル略].md`

例:
- `basics_01_what_is_electrotherapy.md`
- `clinical_01_chronic_low_back.md`

---

## 公開ルール

- AI レビュー未実施の記事は公開しない
- 個人情報・特定可能な症例は含めない
- エビデンスレベルを記事内に明示する
