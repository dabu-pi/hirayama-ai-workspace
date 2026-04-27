# Claude Code Setup Prompt

このファイルは、Life Design Project の初期セットアップで使用したプロンプトを保存しています。

## 使用日

2026-04-26

## プロジェクト概要

人生設計対象者に質問を行い、その回答をもとに以下を行うフレームワーク：

- プロフィール整理
- インタビュー記録
- 価値観分析
- 不安・課題整理
- 仕事・健康・家族・お金・趣味の整理
- 将来像の可視化
- 行動計画化

## 役割分担

- 平山：インタビュアー、本音を引き出す対話者
- ChatGPT：設計者、質問設計、分析、構造化
- Claude Code：実作業、ファイル作成、Markdown整理
- 対象者：自分の人生を言語化する人

## 作成したフォルダー構造

```
life-design-project/
├─ README.md
├─ PROJECT_STATUS.md
├─ 00_templates/
│  ├─ interview_questions_template.md
│  ├─ profile_template.md
│  ├─ analysis_template.md
│  ├─ life_design_template.md
│  └─ visualization_template.md
├─ 01_people/
│  └─ nishio-shingo/
│     ├─ README.md
│     ├─ profile.md
│     ├─ interviews/
│     │  └─ interview_001_initial.md
│     ├─ analysis/
│     │  ├─ life_themes.md
│     │  ├─ concerns_and_risks.md
│     │  └─ gap_analysis.md
│     ├─ life_design/
│     │  ├─ 10_year_vision.md
│     │  ├─ work_plan.md
│     │  ├─ health_plan.md
│     │  ├─ family_private_plan.md
│     │  ├─ money_security_plan.md
│     │  └─ action_plan.md
│     └─ visualization/
│        ├─ life_map.md
│        ├─ timeline_53_to_75.md
│        └─ one_page_summary.md
└─ 99_prompts/
   ├─ claude_code_setup_prompt.md
   ├─ interview_update_prompt.md
   └─ file_update_rules.md
```

## 次の対象者追加手順

1. `01_people/` 配下に `{氏名-ローマ字}/` フォルダーを作成
2. `00_templates/` のテンプレートをコピーして各ファイルを初期化
3. profile.md に基本情報を記入
4. interview_001_initial.md にインタビュー質問を記入
5. PROJECT_STATUS.md を更新
