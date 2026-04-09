# PUBLISH_READY_ARTIFACT_SPEC.md

Last Updated: 2026-04-10

## 1. Role

The publish-ready artifact is the minimum handoff unit between the internal CLI layer and the future public layer.

- Internal layer:
  ranking, compare, review support, source health, fixture / regression
- Public layer:
  weekly web publication, editorial review queue, publish / hold decision

This artifact exists so the public layer does not read raw collector output, CLI tables, or CSV row data directly.

## 2. Why It Sits Between Internal And Public Output

The internal CLI is optimized for analyst review.
The future public layer needs a smaller, safer, and health-aware payload.

The artifact therefore acts as:

- a reusable weekly summary snapshot
- a health gate for publication
- a compact summary that can be turned into Markdown, CMS input, or web cards later

## 3. What It Includes

The minimum JSON artifact includes:

- `schema_version`
- `week`
- `generated_at`
- `publish_ready`
- `health`
  - `overall_status`
  - `publish_ready`
  - `reasons`
  - `source_summary`
- `public_summary`
  - `headline`
  - `top_categories`
  - `featured_models`
  - `compare_summary` when compare is enabled
- `public_notice`
- `internal_reference`

`internal_reference` is intentionally minimal and is meant only for traceability back to the internal run configuration.

## 3A. Schema Version Contract

- `schema_version` is required
- current canonical value:
  `publish-ready/v1`
- the writer must always emit this field
- the renderer must validate this field before any ranking / compare specific rendering logic

This field is the producer / consumer compatibility contract.

## 4. What It Does Not Include

The artifact must not become a raw-data dump.
It does not include:

- raw collector JSON
- full CLI table output
- full CSV row output
- all intermediate scoring logic
- all per-metric contributions
- unpublished tuning notes or private sourcing logic

## 5. Meaning Of `publish_ready`

- `publish_ready=true`
  - the run is suitable for public-layer reuse after editorial review
- `publish_ready=false`
  - the run may still be useful internally, but it should not be treated as normal publish-quality output

`publish_ready` is a publication gate, not an instruction to auto-publish.

## 6. Relationship To Health Status

- `ok`
  - artifact is generated
  - `publish_ready=true`
- `review_only`
  - artifact is generated
  - `publish_ready=false`
  - reasons must be preserved
- `blocked`
  - artifact is not generated
  - this keeps the public layer from mistaking a blocked week for a weak but valid week

This project currently chooses the clearer rule: blocked runs do not emit publish-ready artifacts.

## 7. Public Summary Rules

The public summary should stay compact and review-oriented.

- ranking summary:
  top categories and featured models only
- compare summary:
  significant count, rank-shift count, top drivers, largest impact label, short highlights
- public notice:
  a short publication caution tied to run health

The summary is allowed to mention direction and highlights, but should avoid exposing raw internal scoring detail.

## 8. CLI And Storage Behavior

The current CLI entry point is:

```bash
python scripts/run_batch.py --output-publish-artifact
```

When successful, the sidecar is written to:

```text
data/output/publish_ready_YYYYMMDD.json
```

Compare mode uses a separate path so a compare-focused artifact does not overwrite the plain ranking artifact:

```text
data/output/publish_ready_compare_YYYYMMDD.json
```

This is intentionally separate from:

- console health summary
- ranking / compare console tables
- CSV row-data exports

## 8A. Compatibility Policy

Current policy is intentionally strict.

- supported writer output:
  `schema_version="publish-ready/v1"`
- supported renderer input:
  `publish-ready/v1` only
- missing `schema_version`:
  fail explicitly
- unsupported `schema_version`:
  fail explicitly and report the received version plus the supported version list

Legacy policy:

- artifacts without `schema_version` are treated as legacy
- legacy artifacts are not auto-upgraded or inferred
- the current renderer does not accept legacy artifacts

## 9. How Future Web Use Is Expected

The future public layer should read this artifact as reviewed input, not as raw evidence.

Expected downstream uses:

- weekly editorial draft generation
- publish / hold decisions based on `publish_ready`
- web cards for featured categories and models
- compare-based weekly highlight text
- caution banners when internal review says the result is not publishable

## 10. Non-Goals

This artifact does not mean:

- automatic public publishing
- automatic purchasing decisions
- raw collector output exposure
- pretending degraded runs are publication-quality

## 11. Current Minimal Implementation Scope

The 2026-04-10 implementation is intentionally small.

- explicit CLI flag
- JSON output only
- source health aware
- compare-aware when compare mode is used
- blocked runs skip artifact generation
- schema contract fixed at `publish-ready/v1`
- renderer validates supported schema versions before rendering

Future work can add:

- Markdown rendering
- CMS-oriented export
- richer editorial fields
- future schema versions with explicit compatibility handling

## 2026-04-10 Markdown Renderer Update

The next minimum consumer after the JSON artifact is a Markdown renderer.

- CLI:
  `python scripts/render_publish_markdown.py --artifact <path>`
- input:
  publish-ready artifact JSON only
- output:
  `data/output/<artifact_stem>.md`

Rendering rules:

- `publish_ready=true`
  render publication-oriented Markdown
- `publish_ready=false`
  render hold-only Markdown for internal review
- blocked run
  no artifact means no Markdown render input

This keeps the public layer artifact-only and prevents any raw collector or DB re-read.
