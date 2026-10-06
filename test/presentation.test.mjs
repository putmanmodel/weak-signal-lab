import test from 'node:test';
import assert from 'node:assert/strict';
import { createLab, dispatch, SOURCES } from '../dist/engine.js';
import { SCENARIOS, finding } from '../dist/scenarios.js';
import { presentation, publicAudit, stateResult, exclusionReason, consequenceLabel } from '../dist/presentation.js';
const run = (id='motor') => SCENARIOS[id].steps.reduce((s, x) => dispatch(s, x.action), createLab());
const decision = (s, choice) => dispatch(s, { type: 'review', decision: choice, actor: 'fixture-human', rationale: `Test ${choice}` });
const clearAll = s => Object.keys(SOURCES).reduce((s, source) => dispatch(s, { ...finding(`clear-${source}`, source, 120, .1, { kind: 'clear' }), publicGroup: 'clear-all-1' }), s);
for (const [choice, status, result] of [['hold','HELD','CORROBORATED · REVIEW HELD'],['deny','DENIED','CORROBORATED · CONSEQUENCE DENIED'],['approve','APPROVED','GOVERNED · APPROVED'],['quarantine','QUARANTINED','QUARANTINED · CASE QUARANTINED']]) {
  test(`${choice}: correct decision label, no stale required label`, () => {
    const s = decision(run(), choice), v = presentation(s);
    assert.equal(v.reviewLabel, `HUMAN REVIEW: ${status}`);
    assert.equal(v.currentResult, result);
    assert.ok(!v.reviewLabel.includes('REQUIRED'));
    assert.equal(v.authorizedConsequence, choice === 'approve' ? consequenceLabel : null);
    if (choice !== 'hold') assert.ok(!v.currentResult.includes('HELD'));
  });
}
test('source regression closes review and retains quarantine evidence', () => {
  const s = dispatch(run(), { type: 'diagnostic', at: 100, source: 'VIB-01', reason: 'self-test failed' });
  const v = presentation(s);
  assert.equal(s.state, 'NOTICED'); assert.equal(v.reviewActive, false);
  assert.equal(v.reviewLabel, 'REVIEW NO LONGER ELIGIBLE');
  assert.match(v.reviewMessage, /fell below the governance threshold/);
  assert.equal(s.quarantinedEvidence.length, 3); assert.equal(s.independentSupport, 2);
});
test('contradiction stays trusted and gives an explicit blocked-approval reason', () => {
  const s = run('contradiction'), v = presentation(s);
  assert.equal(v.reviewActive, true); assert.equal(v.approvalBlocked, true);
  assert.match(v.blockedReason, /Resolve or disposition the active contradiction/);
  assert.equal(s.contradictoryEvidence.length, 1); assert.equal(s.quarantinedEvidence.length, 0);
});
test('whole-case quarantine displays the pre-decision predicates and evidence', () => {
  const before = run(), s = decision(before, 'quarantine'), v = presentation(s);
  assert.equal(v.historical, true);
  assert.deepEqual(v.predicates, before.predicates);
  assert.equal(v.pkg.independentSourceCount, 3);
  assert.equal(v.pkg.supportingEvidence.length, 5);
  assert.equal(s.independentSupport, 0); assert.equal(v.reviewActive, false);
  assert.match(v.reviewMessage, /decision point/);
});
test('clear-all coalesces only its public rows; full audit is preserved and replayable', () => {
  const before = run(), s = clearAll(before), rows = publicAudit(s.audit), row = rows.at(-1);
  assert.equal(s.audit.length, before.audit.length + 3);
  assert.equal(rows.length, before.audit.length + 1);
  assert.equal(stateResult(row), 'CORROBORATED → RESOLVED');
  assert.equal(row.reason, 'All active supporting evidence cleared; prior findings retained as superseded.');
  assert.equal(row.internalSequences.length, 3);
  assert.equal(s.classified.filter(f => f.disposition === 'superseded').length, 5);
  assert.deepEqual(s.audit.reduce((a, r) => dispatch(a, r.action), createLab()), s);
  assert.equal(presentation(s).currentResult, 'RESOLVED');
});
test('same-state events are unchanged, never a false HOLD', () => {
  const s = dispatch(run(), finding('stale', 'TEMP-01', 100, 1.5, { timestamp: -140 }));
  assert.equal(stateResult(s.audit.at(-1)), 'CORROBORATED · unchanged');
  assert.match(s.audit.at(-1).reason, /Stale temperature finding added; outside the admissible 180s/);
  assert.ok(!presentation(s).currentResult.includes('HELD'));
});
test('stale support appears in excluded package without displacing fresh source evidence', () => {
  const before = run(), s = dispatch(before, finding('old-temp', 'TEMP-01', 100, 1.5, { timestamp: -140 })), v = presentation(s);
  assert.equal(s.independentSupport, before.independentSupport);
  assert.equal(s.apparentSupport, before.apparentSupport);
  assert.equal(v.pkg.excludedEvidence.length, 1);
  assert.equal(v.pkg.excludedEvidence[0].id, 'old-temp');
  assert.match(exclusionReason(v.pkg.excludedEvidence[0]), /stale \/ outside 180s/);
  assert.equal(s.classified.find(f => f.id === 't1').disposition, 'support');
  assert.equal(v.counts.total, 6); assert.equal(v.counts.excluded, 1);
});
test('review history distinguishes resolution, expiry, and never-opened review', () => {
  assert.match(presentation(clearAll(run())).reviewMessage, /candidate resolved before governance action/);
  assert.match(presentation(dispatch(run(), { type: 'tick', at: 300 })).reviewMessage, /admissible evidence expired before governance action/);
  assert.match(presentation(run('resolution')).reviewMessage, /has not opened/);
  const closed = presentation(clearAll(decision(run(), 'hold')));
  assert.match(closed.reviewMessage, /previous human decision remains/);
  assert.ok(!closed.reviewMessage.includes('before governance action'));
});
test('alternate finding reasons are explicit and deterministic', () => {
  let s = run();
  s = dispatch(s, finding('conflict', 'AMP-01', 100, -1, { kind: 'contradiction' }));
  assert.equal(s.audit.at(-1).reason, 'Independent current evidence contradicts the candidate interpretation.');
  s = dispatch(s, finding('derivative', 'VIB-01', 101, 1.7, { derivedFrom: 'v3', timestamp: 60, sampleId: 'VIB-01/sample-60', feature: 'extra' }));
  assert.match(s.audit.at(-1).reason, /Derived vibration output retained/);
  assert.ok(s.audit.every(r => r.reason !== 'finding'));
});

test('time-only audit after approval does not falsely claim a new human decision', () => {
  const s = dispatch(decision(run(), 'approve'), { type: 'tick', at: 95 });
  assert.equal(s.state, 'GOVERNED');
  assert.equal(stateResult(s.audit.at(-1)), 'GOVERNED · unchanged');
  assert.match(s.audit.at(-1).reason, /Simulation time advanced/);
});
