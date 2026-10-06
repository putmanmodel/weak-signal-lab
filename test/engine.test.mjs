import test from 'node:test';
import assert from 'node:assert/strict';
import { createLab, dispatch, POLICY, evidencePackage } from '../dist/engine.js';
import { SCENARIOS, finding } from '../dist/scenarios.js';
const run = (id, count = Infinity) => SCENARIOS[id].steps.slice(0, count).reduce((s, x) => dispatch(s, x.action), createLab());
const review = decision => ({ type: 'review', decision, actor: 'test-human', rationale: `Fixture: ${decision}` });

test('motor ladder advances attention only until explicit human approval', () => {
  let s = createLab();
  const states = [s.state];
  for (const step of SCENARIOS.motor.steps) { s = dispatch(s, step.action); states.push(s.state); assert.equal(s.authority, 'none'); }
  assert.deepEqual(states, ['NORMAL', 'NOTICED', 'NOTICED', 'WATCHING', 'CORROBORATED', 'CORROBORATED', 'CORROBORATED']);
  assert.equal(s.concern, 100);
  assert.equal(s.reviewRequired, true);
  s = dispatch(s, review('approve'));
  assert.equal(s.state, 'GOVERNED');
  assert.equal(s.authority, 'simulated_planned_inspection');
  assert.ok(s.governance.token);
  assert.equal(s.governance.package.independentSourceCount, 3);
});
test('weak or corroborated evidence does not itself create a human-review task', () => {
  assert.equal(run('motor', 1).reviewRequired, false);
  assert.equal(run('motor', 5).reviewRequired, false);
  assert.throws(() => dispatch(run('motor', 1), review('approve')), /not available/);
});
test('Echo Trap: three output paths, one independent source, blocked promotion', () => {
  const s = run('echo', 6);
  assert.equal(s.apparentSupport, 3);
  assert.equal(s.independentSupport, 1);
  assert.equal(s.persistence, 3);
  assert.equal(s.state, 'WATCHING');
  assert.equal(s.promotionEligibility, false);
  assert.equal(s.reviewRequired, false);
  assert.equal(s.authority, 'none');
  const final = run('echo');
  assert.equal(final.independentSupport, 2);
  assert.equal(final.state, 'CORROBORATED');
  assert.equal(final.reviewRequired, true);
  assert.equal(final.authority, 'none');
});
test('duplicate outputs cannot invent persistence or independent lineage', () => {
  let s = dispatch(createLab(), finding('v', 'VIB-01', 0, 1.8));
  for (let n = 1; n <= 3; n++) s = dispatch(s, finding(`d${n}`, 'VIB-01', n, 2, { timestamp: 0, sampleId: 'VIB-01/sample-0', derivedFrom: 'v', feature: `derived-${n}`, group: `fake-${n}` }));
  assert.equal(s.persistence, 1);
  assert.equal(s.independentSupport, 1);
  assert.equal(s.state, 'NOTICED');
});
test('simultaneous records with different sample IDs cannot invent elapsed persistence', () => {
  let s = createLab();
  for (let n = 1; n <= 3; n++) s = dispatch(s, finding(`f${n}`, 'VIB-01', 0, 2, { sampleId: `sample-${n}` }));
  assert.equal(s.persistence, 1);
});
test('reused raw sample with a changed timestamp is quarantined', () => {
  let s = dispatch(createLab(), finding('first', 'VIB-01', 0, 1.8));
  s = dispatch(s, finding('second', 'VIB-01', 30, 1.8, { sampleId: 'VIB-01/sample-0' }));
  assert.equal(s.quarantinedEvidence.length, 1);
  assert.equal(s.persistence, 1);
});
test('contradiction permits review but blocks approval even with sufficient support', () => {
  const s = run('contradiction');
  assert.equal(s.state, 'CORROBORATED');
  assert.equal(s.independentSupport, 2);
  assert.equal(s.reviewRequired, true);
  assert.equal(s.promotionEligibility, false);
  assert.equal(s.contradictoryEvidence.length, 1);
  assert.throws(() => dispatch(s, review('approve')), /Missing predicates/);
  assert.equal(dispatch(s, review('hold')).authority, 'none');
});
test('sensor failure quarantines all evidence from that source and resolves no false motor fault', () => {
  const s = run('quarantine');
  assert.equal(s.state, 'QUARANTINED');
  assert.equal(s.independentSupport, 0);
  assert.equal(s.quarantinedEvidence.length, 3);
  assert.equal(s.authority, 'none');
  assert.match(s.closureReason, /diagnostics/);
});
test('sensor diagnostics invalidate derived outputs as well as raw samples', () => {
  const s = dispatch(run('echo', 5), { type: 'diagnostic', source: 'VIB-01', at: 75, reason: 'failed' });
  assert.equal(s.apparentSupport, 0);
  assert.equal(s.quarantinedEvidence.length, 5);
  assert.equal(s.state, 'QUARANTINED');
});
test('source quarantine retains independent evidence from healthy sensors', () => {
  const s = dispatch(run('motor'), { type: 'diagnostic', source: 'TEMP-01', at: 100, reason: 'failed' });
  assert.equal(s.independentSupport, 2);
  assert.equal(s.state, 'CORROBORATED');
  assert.equal(s.quarantinedEvidence.length, 1);
});
test('return to corridor resolves the case and removes elevated attention', () => {
  const s = run('resolution');
  assert.equal(s.state, 'RESOLVED');
  assert.equal(s.concern, 0);
  assert.equal(s.authority, 'none');
  assert.deepEqual(s.attentionActions, []);
});
test('stale evidence cannot corroborate and timeout resolves unsupported cases', () => {
  const s = run('stale', 4);
  assert.equal(s.independentSupport, 1);
  assert.equal(s.classified.find(f => f.id === 't-stale').disposition, 'stale');
  assert.equal(run('stale').state, 'RESOLVED');
});
test('review-window boundary is inclusive and expiration uses observation time', () => {
  let s = dispatch(createLab(), finding('v', 'VIB-01', 0, 1.8));
  s = dispatch(s, { type: 'tick', at: POLICY.window });
  assert.equal(s.independentSupport, 1);
  s = dispatch(s, { type: 'tick', at: POLICY.window + 1 });
  assert.equal(s.independentSupport, 0);
});
test('future and low-confidence findings do not add support', () => {
  let s = dispatch(createLab(), finding('future', 'TEMP-01', 0, 2, { timestamp: 100 }));
  s = dispatch(s, finding('uncertain', 'AMP-01', 0, 2, { confidence: 0.2 }));
  assert.equal(s.independentSupport, 0);
});
test('broken provenance or unregistered sources never count', () => {
  let s = dispatch(createLab(), finding('broken', 'VIB-01', 0, 2, { provenance: [] }));
  s = dispatch(s, finding('unknown', 'FAKE', 30, 2));
  assert.equal(s.independentSupport, 0);
  assert.equal(s.quarantinedEvidence.length, 2);
});
test('derived evidence cannot claim a different underlying sensor', () => {
  let s = dispatch(createLab(), finding('parent', 'VIB-01', 0, 2));
  s = dispatch(s, finding('child', 'TEMP-01', 30, 2, { derivedFrom: 'parent', timestamp: 0, sampleId: 'VIB-01/sample-0' }));
  assert.equal(s.independentSupport, 1);
  assert.equal(s.quarantinedEvidence.length, 1);
});
test('HOLD and DENY grant no authority; reviewer rationale is required', () => {
  const s = run('motor');
  for (const choice of ['hold', 'deny']) {
    const result = dispatch(s, review(choice));
    assert.equal(result.authority, 'none');
    assert.equal(result.state, 'CORROBORATED');
  }
  assert.throws(() => dispatch(s, { ...review('approve'), rationale: '' }), /required/);
});
test('human case quarantine closes attention and prevents later approval', () => {
  const s = dispatch(run('motor'), review('quarantine'));
  assert.equal(s.state, 'QUARANTINED');
  assert.equal(s.authority, 'none');
  assert.equal(s.independentSupport, 0);
  assert.equal(s.quarantinedEvidence.length, 5);
  assert.throws(() => dispatch(s, review('approve')), /not available/);
});
test('approval expires when evidence changes or falls outside the window', () => {
  const approved = dispatch(run('motor'), review('approve'));
  const stale = dispatch(approved, { type: 'tick', at: 300 });
  assert.equal(stale.state, 'RESOLVED');
  assert.equal(stale.authority, 'none');
  assert.equal(stale.governance.status, 'expired');
  const changed = dispatch(approved, finding('new', 'AMP-01', 100, 1.5));
  assert.equal(changed.governance.status, 'expired');
  assert.equal(changed.authority, 'none');
});
test('shutdown remains outside scope even after a human tries to approve', () => {
  const s = dispatch(run('motor'), { type: 'request', consequence: 'shutdown', at: 100 });
  assert.equal(s.reviewRequired, true);
  assert.equal(s.predicates.authorizedScope, false);
  assert.throws(() => dispatch(s, review('approve')), /Missing predicates/);
});
test('replay is deterministic, input state is unchanged, and audit contains the decision basis', () => {
  for (const id of Object.keys(SCENARIOS)) assert.deepEqual(run(id), run(id));
  const original = createLab();
  const snapshot = structuredClone(original);
  dispatch(original, SCENARIOS.motor.steps[0].action);
  assert.deepEqual(original, snapshot);
  const s = run('motor');
  const replay = s.audit.reduce((acc, row) => dispatch(acc, row.action), createLab());
  assert.deepEqual(replay, s);
  assert.ok(s.audit.every(row => row.predicates && row.policy && row.reason));
  const pkg = evidencePackage(s);
  for (const key of ['candidate', 'supportingEvidence', 'independentSourceCount', 'contradictoryEvidence', 'quarantinedEvidence', 'provenance', 'predicatesSatisfied', 'predicatesMissing', 'requestedConsequence', 'reason']) assert.ok(key in pkg);
});
test('duplicate event IDs and time travel reject without corrupting the input', () => {
  const s = run('motor', 3);
  const snapshot = structuredClone(s);
  assert.throws(() => dispatch(s, SCENARIOS.motor.steps[2].action), /Duplicate/);
  assert.throws(() => dispatch(s, { type: 'tick', at: 0 }), /monotonic/);
  assert.deepEqual(s, snapshot);
});
