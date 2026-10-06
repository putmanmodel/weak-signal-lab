# PUTMAN Weak-Signal Lab

A deterministic architectural demonstration of weak-signal triage and promotion control.

**Stephen A. Putman / PUTMAN · v0.1**

Core idea:

**Weak evidence may increase attention before it earns stronger consequence or authority.**

**Notice weakly. Escalate gradually. Preserve uncertainty. Require corroboration. Separate concern from authority.**

## Scope

v0.1 uses one synthetic industrial motor-monitoring scenario with vibration, temperature, and electrical/current findings to demonstrate:

- persistence over time;
- independent corroboration;
- provenance and source lineage;
- derived evidence that does not falsely increase independence;
- contradictory evidence;
- source quarantine;
- evidence expiry and staleness;
- resolution;
- scoped human review;
- consequence authorization.

Weak-Signal Lab is **not an anomaly detector**. The anomaly/sensor layer is upstream. The lab demonstrates how provisional findings may influence attention and how stronger consequence is gated. Candidate interpretations remain provisional; the concern index is an illustrative attention display, not a probability of failure.

The six replay paths—Motor stress, Echo Trap, Contradiction, Sensor fault, Signal clears, and Stale evidence—explore the same motor scenario. There is no live sensor ingestion, equipment integration, authentication, database, or backend service.

## Echo Trap

Multiple outputs derived from one underlying sensor may look like multiple pieces of evidence but still represent only one independent source. The Echo Trap shows three active support paths from one vibration sensor. Repetition and derived outputs cannot manufacture independent corroboration.

A genuinely independent temperature source is required before corroboration advances in this replay. Independence follows the declared underlying source lineage, not the number of output labels.

## Concern vs authority

**More concern does not automatically mean more authority.**

A case may accumulate evidence and reach high concern while operational authority remains unchanged until the appropriate governance boundary is crossed.

`NORMAL → NOTICED → WATCHING → CORROBORATED → GOVERNED`

`RESOLVED` and `QUARANTINED` are legitimate lifecycle outcomes. Evidence loss may also regress an active case. NOTICED, WATCHING, and CORROBORATED are evidence and attention states; they do not authorize maintenance work or equipment shutdown.

## Human review

Human review is consequence-sensitive rather than triggered by every weak anomaly. The system can automatically notice, preserve, correlate, prioritize, and request evidence. A consequential simulated maintenance request requires explicit review.

Review becomes eligible after a consequential request has persistent independent support, or persistence with unresolved contradiction. The reviewer can **APPROVE / HOLD / DENY / QUARANTINE** and must provide a rationale.

- **APPROVE** authorizes only the simulated planned-inspection work request for the reviewed evidence package. No real work request is created.
- **HOLD** preserves evidence without granting authority.
- **DENY** rejects the requested consequence without rewriting evidence.
- **QUARANTINE** closes the case without granting authority and preserves the historical evidence package and predicate values at the decision point.

Active contradiction blocks approval. Source quarantine removes only that source and its descendants from admissible support; findings remain visible. Approval is tied to the evidence package and consequence. Changed or expired supporting, contradictory, or quarantined evidence invalidates current approval while retaining the prior decision in the audit history.

**Clear current signals** returns current signal conditions to baseline. It does not erase experiment history or undo historical governance decisions. It can resolve a case and end current authority when the supporting evidence no longer qualifies. Reset/reload clears the in-memory experiment.

## Determinism

The v0.1 scenarios are synthetic, deterministic, and replayable. No ML model is used to generate weak-signal findings in this demonstration. The engine uses simulated event time rather than the wall clock, and the same event sequence produces the same result.

The record distinguishes actual state transitions from same-state audit events. Clear-current-signals is displayed as one public audit event; its individual internal events remain available for deterministic replay. Excluded observations—including clear, superseded, stale, future, low-confidence, and below-threshold findings—remain visible and contribute no active support. Contradictory and quarantined findings are counted separately.

## Running locally

Requires **Node.js 20 or later** and npm, as bundled with Node.js. There are no third-party dependencies and no installation step. From the project directory:

```sh
npm start
```

Open [the local lab](http://127.0.0.1:5173). If that port is occupied, run `PORT=5174 npm start` and use port 5174 instead.

Run the regression suite and JavaScript syntax checks:

```sh
npm test
npm run check
```

This is a **buildless static application**: `dist/` already contains the complete browser-ready files. There is no compilation or `npm run build` step. `server.mjs` is a local preview convenience, not an application backend. No publishing or deployment system is included.

To try the lab, choose an experiment and advance one event at a time. In Motor stress, watch concern rise while authority stays unchanged, then inspect the human-review package. In Echo Trap, event 6 shows three active support paths but only one independent source; event 7 supplies the independent temperature finding. Alternate-branch controls let you explore evidence loss, contradiction, and expiry. Reset restores the guided replay.

## Architecture

`bounded finding → provisional interpretation → bounded attention → human-governed consequence`

- `dist/engine.js`: deterministic state evaluation, admissibility, source lineage, promotion predicates, governance records, and replayable audit events. No network or equipment effects.
- `dist/scenarios.js`: fixed synthetic motor events and alternate replay paths.
- `dist/presentation.js`: review status, historical quarantine predicates, excluded-evidence wording, and public audit grouping.
- `dist/app.js`: interface, replay controls, evidence inspection, and simulated review. Its optional read-only browser inspection tool exposes no approval action.
- `test/engine.test.mjs` and `test/presentation.test.mjs`: behavior and presentation-semantics regression tests.

The source registry declares accelerometer-A, thermocouple-B, and current-probe-C as independent lineages. That independence is a fixture assumption, not an empirically established property. Derived findings must reference a matching parent source, raw sample, and observation timestamp.

Illustrative policy: observations remain admissible for 0–180 simulated seconds; supporting deviation must be at least 1 illustrative standard deviation with confidence at least 0.5. Persistence requires three distinct raw samples at distinct times from one lineage within the window. Corroboration requires at least two independent supporting lineages. Approval additionally requires intact provenance, no active admissible contradiction, an in-scope request, and explicit human review. Asset criticality is fixed at tier-2. These choices are not universal or validated thresholds.

The lab remains separate from CDE and Kingpin:

**Weak-Signal determines what deserves increased attention. Governance determines what consequence that evidence has earned.**

## Limitations / Non-goals

This project:

- does not claim predictive-maintenance accuracy;
- does not control real industrial equipment;
- is not safety-certified;
- does not validate the illustrative thresholds;
- is not a substitute for domain-specific sensing, diagnostics, or operational governance.

The reviewer identity and token simulate an authority boundary. They are not authentication, cryptographic signatures, durable audit infrastructure, or production security controls. The prototype demonstrates architectural behavior; it does not establish operational effectiveness.

## Related work

Weak-Signal Lab is an implementation-oriented demonstration within a broader body of work by Stephen A. Putman on weak-signal interpretation, bounded escalation, and governed consequence.

The v0.1 architecture draws most directly from:

- **[Weak-Signal Interpretation for Industrial Fault Detection and Predictive Maintenance](https://github.com/putmanmodel/spanda-architectural-framework/blob/main/papers/bridges/PaperBridge03_Weak-Signal_Interpretation_for_Industrial_Fault_Detection_and_Predictive_Maintenance_v0.2.pdf)**, v0.2, April 2026  
  Industrial weak-signal states, persistence, independent corroboration, escalation gates, and sensor-fault quarantine.  
  [Zenodo record](https://zenodo.org/records/19562131)

- **[Notice, Interpret, Shape, Govern: A Consolidation Note on Weak-Signal Architecture](https://github.com/putmanmodel/spanda-architectural-framework/blob/main/papers/bridges/00_FinalConsolidation_Notice_Interpret_Shape_Govern_v0.2.pdf)**, v0.2, May 2026  
  The broader Notice → Interpret → Shape → Govern architecture, including promotion predicates, provenance, contradiction handling, bounded consequence, and evidence-bearing governance records.  
  [Zenodo record](https://zenodo.org/records/20193087)

Weak-Signal Lab translates those architectural ideas into a deterministic, inspectable browser demonstration. The motor trace, 180-second review window, concern index, Echo Trap presentation, and interactive human-review workflow are illustrative implementation choices rather than claims or prescribed parameters from the papers.

The papers remain separately published and versioned through the PUTMAN / Spanda architectural framework and Zenodo.

## Author

**Stephen A. Putman**  
PUTMAN  
Contact: `putmanmodel@pm.me`

## Collaboration / Discussion

I’m interested in discussion or collaboration around weak-signal interpretation, bounded escalation, runtime governance, industrial monitoring, robotics, AI safety, and related systems work.

For research, engineering, demonstration, or collaboration inquiries:

**putmanmodel@pm.me**

## License

Copyright © 2026 Stephen A. Putman. All rights reserved.

This repository is published for demonstration, evaluation, and discussion. It is not offered under an open-source license. Reuse requires written permission from the copyright holder except as permitted by applicable law. See [LICENSE](LICENSE) for the complete rights notice.
