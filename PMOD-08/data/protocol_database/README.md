# data/protocol_database — プロトコルデータベース

**最終更新:** 2026-04-10

---

## このフォルダの役割

再現性のある治療プロトコルを蓄積するデータベース。

症例経験・文献・臨床判断から導き出した「この症状にはこう使う」というプロトコルを記録し、
標準化・共有可能な形にする。

---

## ファイル命名規則

`protocol_[症状カテゴリ]_[バージョン].md`

例:
- `protocol_chronic_low_back_pain_v1.md`
- `protocol_shoulder_neck_tension_v1.md`
- `protocol_tendinopathy_v1.md`

---

## プロトコルの作成基準

- 症例データ（`data/cases/`）の蓄積後に作成するのが理想
- Phase 2 以降で本格的に整備する
- 作成後はAIレビュー（`prompts/ai_review_prompt.md`）を実施する
