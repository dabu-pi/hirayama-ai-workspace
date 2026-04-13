# Commercial Source Coverage Audit: 2026-04-06

Date checked: 2026-04-10

## Scope

Target week: `2026-04-06`

The coverage target follows the current publication gate path:

```bash
python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --show-metric-details --output-publish-artifact
```

Current `DbCollector(..., only_commercial=True)` excludes consumer brands with:

```sql
(b.market_type IS NULL OR b.market_type != 'consumer')
```

With the 2026-04-10 denominator cleanup, `only_commercial` also excludes `sm.model_id IS NULL`
from DB-backed publication-health inputs. Brand-only rows are not collector-fillable model
targets, so they stay out of the model coverage denominator until resolved into canonical
models or cleaned up at the source.

That makes the current publication-health denominator 11 ranking entities:

- 11 resolved commercial model rows with `model_id`
- 0 brand-only rows with `model_id=NULL`

## Result

Before the denominator cleanup, `run_batch.py` reported:

```text
[NORMALIZE] 13 models
[HEALTH] overall=review_only publish_ready=no
[HEALTH] GT=warning(4/13) GS=warning(4/13) YT=warning(4/13)
[HEALTH] reason=source coverage is incomplete; ranking and compare are advisory only
```

After the denominator cleanup, the same real DB week reports 11 resolved model targets:

```text
[NORMALIZE] 11 models
[HEALTH] overall=review_only publish_ready=no
[HEALTH] GT=warning(4/11) GS=warning(4/11) YT=warning(4/11)
[HEALTH] reason=source coverage is incomplete; ranking and compare are advisory only
```

At that point, `publish_ready=true` was blocked by the same missing coverage set across all three publication-gate sources:

- GT metric: `google_trends_interest`
- GS metric: `search_suggest_count`
- YT metric: `youtube_suggest_count`

After the 2026-04-10 live collector/import pass, the same real DB week reached the target gate:

```text
[NORMALIZE] 11 models
[HEALTH] overall=ok publish_ready=yes
[HEALTH] GT=ok(11/11) GS=ok(11/11) YT=ok(11/11)
```

The follow-up publication pipeline also completed as a ranking candidate:

```text
[PIPELINE] content_kind=ranking
[PIPELINE] publish_ready=yes
[PIPELINE] artifact=data/output/publish_ready_20260406.json
[PIPELINE] markdown=data/output/publish_ready_20260406.md
[PIPELINE] handoff=data/output/publication_handoff_20260406_20260410T190547.json
[PIPELINE] latest=data/output/publication_handoff_latest.json
```

## Coverage Summary

| Source | Metric | Present | Missing | Coverage | Blocking state |
|---|---|---:|---:|---:|---|
| GT | `google_trends_interest` | 11 | 0 | 100.0% | ok |
| GS | `search_suggest_count` | 11 | 0 | 100.0% | ok |
| YT | `youtube_suggest_count` | 11 | 0 | 100.0% | ok |

All three sources now have gate coverage for all eleven resolved model rows. The original four already-covered model seeds were:

- `Concept2 SkiErg`
- `Life Fitness T5`
- `Precor TRM 445`
- `TECHNOGYM Run`

The seven newly collected/imported model seeds were:

- `CYBEX 770T`
- `Concept2 Model D`
- `Life Fitness 95T`
- `Life Fitness IC5`
- `Life Fitness IC7`
- `Matrix A50`
- `TECHNOGYM Run Now`

## Coverage Matrix

| Entity | Category | model_id | GT | GS | YT | Notes |
|---|---|---:|---|---|---|---|
| Matrix A50 | elliptical | 15 | present | present | present | live import completed |
| Life Fitness T5 | treadmill | 7 | present | present | present | current seed exists |
| TECHNOGYM Run Now | treadmill | 2 | present | present | present | live import completed |
| Concept2 Model D | rowing | 20 | present | present | present | live import completed after GT query expansion |
| Life Fitness IC5 | spin_bike | 10 | present | present | present | live import completed |
| TECHNOGYM Run | treadmill | 1 | present | present | present | current seed exists |
| Life Fitness 95T | treadmill | 8 | present | present | present | live import completed after GT retry |
| Concept2 SkiErg | ski_erg | 22 | present | present | present | current seed exists |
| Life Fitness IC7 | spin_bike | 11 | present | present | present | live import completed |
| CYBEX 770T | treadmill | 19 | present | present | present | live import completed after GT query expansion |
| Precor TRM 445 | treadmill | 16 | present | present | present | current seed exists |
| JOHNSON `(model_id NULL)` | unknown | n/a | excluded | excluded | excluded | brand-only row; excluded from publication-health denominator |
| TECHNOGYM `(model_id NULL)` | unknown | n/a | excluded | excluded | excluded | brand-only row; excluded from publication-health denominator |

## Previously Missing Models

Resolved model rows that were covered by the 2026-04-10 live collector/import pass:

- `CYBEX::770T`
- `Concept2::Model D`
- `Life Fitness::95T`
- `Life Fitness::IC5`
- `Life Fitness::IC7`
- `Matrix::A50`
- `TECHNOGYM::Run Now`

Brand-only rows that should not be treated as collector-fillable model targets until resolved:

- `JOHNSON::(model_id NULL)::unknown`
- `TECHNOGYM::(model_id NULL)::unknown`

No resolved commercial model row remains missing from the 2026-04-06 publication-health denominator.

## Seed Config Gap

Before the 2026-04-10 seed expansion, `config/trends/seed_queries.json` had four
`seed_type=model` entries, matching the four covered models:

- `technogym_run_model` -> `TECHNOGYM::Run`
- `lifefitness_t5_model` -> `Life Fitness::T5`
- `precor_trm445_model` -> `Precor::TRM 445`
- `concept2_skierg_model` -> `Concept2::SkiErg`

The 2026-04-10 seed expansion added model seeds for the seven resolved missing models:

- `cybex_770t_model` -> `CYBEX::770T`
- `concept2_model_d_model` -> `Concept2::Model D`
- `lifefitness_95t_model` -> `Life Fitness::95T`
- `lifefitness_ic5_model` -> `Life Fitness::IC5`
- `lifefitness_ic7_model` -> `Life Fitness::IC7`
- `matrix_a50_model` -> `Matrix::A50`
- `technogym_run_now_model` -> `TECHNOGYM::Run Now`

GT / GS / YT mock fixtures were also expanded for these seed IDs so local collector tests and
mock fallback can exercise the new seed configuration.

During live import, GT needed additional query variants for two low-volume model seeds:

- `cybex_770t_model`: added `cybex 770 t`, `cybex 770`, `サイベックス 770t`
- `concept2_model_d_model`: added `concept2 rowerg`, `concept 2 rower`, `コンセプト2 ローイング`

Canonical targets were unchanged.

## Shortest Route To Fill Coverage

Status: completed for the 2026-04-06 resolved commercial model denominator.

1. Keep the 2 brand-only rows out of the publication-health denominator.

   These previously inflated the health denominator to 13 but cannot be directly covered by model collectors because they have no `model_id`.

   They are now excluded by `DbCollector(..., only_commercial=True)`. Longer term, either map them to a canonical model if they are legitimate model observations, or clean up the source rows if they are brand-level inputs.

2. Collect and import the 7 resolved missing model seeds. Completed on 2026-04-10.

   Suggested seed IDs:

   - `cybex_770t_model`
   - `concept2_model_d_model`
   - `lifefitness_95t_model`
   - `lifefitness_ic5_model`
   - `lifefitness_ic7_model`
   - `matrix_a50_model`
   - `technogym_run_now_model`

3. Collect and import those seeds for all three gate sources. Completed on 2026-04-10.

   GT was kept on `--mode live` during retry to avoid treating mock fallback as real coverage for low-volume seeds.

4. Rerun the publication gate. Completed on 2026-04-10.

   The target state is:

   ```text
   [HEALTH] overall=ok publish_ready=yes
   [HEALTH] GT=ok(N/N) GS=ok(N/N) YT=ok(N/N)
   ```

## Recommended Commands

Current audit commands:

```bash
python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --show-metric-details --output-publish-artifact
python scripts/check_google_trends_source_metrics.py --week 2026-04-06 --metric-type google_trends_interest
python scripts/check_source_metrics.py --source-name google_suggest --metric-type search_suggest_count --week 2026-04-06
python scripts/check_source_metrics.py --source-name youtube_suggest --metric-type youtube_suggest_count --week 2026-04-06
```

After the seven model seeds added to `config/trends/seed_queries.json`, use the existing collectors:

```bash
python scripts/run_google_trends.py --mode auto --seed-id cybex_770t_model --seed-id concept2_model_d_model --seed-id lifefitness_95t_model --seed-id lifefitness_ic5_model --seed-id lifefitness_ic7_model --seed-id matrix_a50_model --seed-id technogym_run_now_model --import-db --replace-existing --skip-unresolved --only-commercial

python scripts/run_google_suggest.py --mode auto --seed-id cybex_770t_model --seed-id concept2_model_d_model --seed-id lifefitness_95t_model --seed-id lifefitness_ic5_model --seed-id lifefitness_ic7_model --seed-id matrix_a50_model --seed-id technogym_run_now_model --import-db --replace-existing --skip-unresolved --only-commercial

python scripts/run_youtube_suggest.py --mode auto --seed-id cybex_770t_model --seed-id concept2_model_d_model --seed-id lifefitness_95t_model --seed-id lifefitness_ic5_model --seed-id lifefitness_ic7_model --seed-id matrix_a50_model --seed-id technogym_run_now_model --import-db --replace-existing --skip-unresolved --only-commercial
```

Validation after import:

```bash
python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --show-metric-details --output-publish-artifact
python scripts/run_publication_pipeline.py --week 2026-04-06 --use-db --only-commercial
```

## Publish-ready True Conditions

For the current health gate, `publish_ready=true` requires:

- GT, GS, and YT each have the target metric for every entity in the `run_batch --use-db --only-commercial` denominator
- no source-level `affects_review` warning remains
- no blocking GT/core-source error is present
- brand-only rows either resolve into proper model rows or stay out of the publication-health denominator

## Notes

- The previous blocker was not a single source. GT, GS, and YT were all at `4/11` before the live import pass.
- The seven resolved model gaps were identical across GT / GS / YT, so seed expansion was done once and reused across all three collectors.
- The two `model_id=NULL` rows are now excluded from publication-health coverage, but still remain a source-data hygiene follow-up.
- `publish_ready=true` is a coverage gate pass, not a content-quality guarantee. Several newly covered GT rows are zero-valued observations and should be checked during editorial review.
