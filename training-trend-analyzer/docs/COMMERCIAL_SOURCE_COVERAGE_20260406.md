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

`publish_ready=true` is blocked by the same missing coverage set across all three publication-gate sources:

- GT metric: `google_trends_interest`
- GS metric: `search_suggest_count`
- YT metric: `youtube_suggest_count`

## Coverage Summary

| Source | Metric | Present | Missing | Coverage | Blocking state |
|---|---|---:|---:|---:|---|
| GT | `google_trends_interest` | 4 | 7 | 36.4% | warning -> `review_only` |
| GS | `search_suggest_count` | 4 | 7 | 36.4% | warning -> `review_only` |
| YT | `youtube_suggest_count` | 4 | 7 | 36.4% | warning -> `review_only` |

All three sources have data for the same four model seeds:

- `Concept2 SkiErg`
- `Life Fitness T5`
- `Precor TRM 445`
- `TECHNOGYM Run`

## Coverage Matrix

| Entity | Category | model_id | GT | GS | YT | Notes |
|---|---|---:|---|---|---|---|
| Matrix A50 | elliptical | 15 | missing | missing | missing | needs model seed |
| Life Fitness T5 | treadmill | 7 | present | present | present | current seed exists |
| TECHNOGYM Run Now | treadmill | 2 | missing | missing | missing | needs model seed |
| Concept2 Model D | rowing | 20 | missing | missing | missing | needs model seed |
| Life Fitness IC5 | spin_bike | 10 | missing | missing | missing | needs model seed |
| TECHNOGYM Run | treadmill | 1 | present | present | present | current seed exists |
| Life Fitness 95T | treadmill | 8 | missing | missing | missing | needs model seed |
| Concept2 SkiErg | ski_erg | 22 | present | present | present | current seed exists |
| Life Fitness IC7 | spin_bike | 11 | missing | missing | missing | needs model seed |
| CYBEX 770T | treadmill | 19 | missing | missing | missing | needs model seed |
| Precor TRM 445 | treadmill | 16 | present | present | present | current seed exists |
| JOHNSON `(model_id NULL)` | unknown | n/a | excluded | excluded | excluded | brand-only row; excluded from publication-health denominator |
| TECHNOGYM `(model_id NULL)` | unknown | n/a | excluded | excluded | excluded | brand-only row; excluded from publication-health denominator |

## Missing Models

Resolved model rows that can be covered by adding model seeds:

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
mock fallback can exercise the new seed configuration. Real DB `source_metrics` still needs a
live or accepted mock import before the publication gate can reach 11/11.

## Shortest Route To Fill Coverage

1. Keep the 2 brand-only rows out of the publication-health denominator.

   These previously inflated the health denominator to 13 but cannot be directly covered by model collectors because they have no `model_id`.

   They are now excluded by `DbCollector(..., only_commercial=True)`. Longer term, either map them to a canonical model if they are legitimate model observations, or clean up the source rows if they are brand-level inputs.

2. Collect and import the 7 resolved missing model seeds.

   Suggested seed IDs:

   - `cybex_770t_model`
   - `concept2_model_d_model`
   - `lifefitness_95t_model`
   - `lifefitness_ic5_model`
   - `lifefitness_ic7_model`
   - `matrix_a50_model`
   - `technogym_run_now_model`

3. Collect and import those seeds for all three gate sources.

   Prefer `--mode auto` for GT so live can fall back to mock if needed. For GS / YT, `auto` is also available, but missing seed fixture coverage may require live or a fixture update.

4. Rerun the publication gate.

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

- The shortest true blocker is not a single source. GT, GS, and YT are all at `4/11`.
- The seven resolved model gaps are identical across GT / GS / YT, so seed expansion should be done once and reused across all three collectors.
- The two `model_id=NULL` rows are now excluded from publication-health coverage, but still remain a source-data hygiene follow-up.
