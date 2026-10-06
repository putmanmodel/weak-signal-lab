// No wall clock, randomness, network, UI, or equipment side effects.
export const POLICY = Object.freeze({ window: 180, notice: 1, confidence: 0.5, samples: 3, support: 2, version: 'motor-policy/0.1' });
export const SOURCES = Object.freeze({
  'VIB-01': { signal: 'vibration', group: 'accelerometer-A', label: 'Vibration sensor', baseline: 'motor-70pct/vibration-v1' },
  'TEMP-01': { signal: 'temperature', group: 'thermocouple-B', label: 'Bearing temperature', baseline: 'motor-70pct/temperature-v1' },
  'AMP-01': { signal: 'current', group: 'current-probe-C', label: 'Motor current', baseline: 'motor-70pct/current-v1' },
});
export function createLab() {
  return evaluate({ eventId: 'M77-CASE-001', now: 0, state: 'NORMAL', findings: [], unreliable: {}, audit: [], governance: { status: 'not_requested' }, requestedConsequence: null, assetCriticality: 'tier-2', closureReason: null, sequence: 0 });
}
const unique = xs => [...new Set(xs)];
const timed = (now, timestamp) => now - timestamp >= 0 && now - timestamp <= POLICY.window;
export function evaluate(lab) {
  const latestClear = {};
  for (const f of lab.findings) {
    if (f.valid && !lab.unreliable[f.source] && f.confidence >= POLICY.confidence && f.kind === 'clear' && timed(lab.now, f.timestamp)) {
      latestClear[f.group] = Math.max(latestClear[f.group] ?? -Infinity, f.timestamp);
    }
  }
  const classified = lab.findings.map(f => {
    let disposition = 'support';
    if (lab.governance.status === 'quarantined' || !f.valid) disposition = 'quarantined';
    else if (lab.unreliable[f.source]) disposition = 'quarantined';
    else if (lab.now < f.timestamp) disposition = 'future';
    else if (!timed(lab.now, f.timestamp)) disposition = 'stale';
    else if (f.confidence < POLICY.confidence) disposition = 'low-confidence';
    else if (f.kind === 'clear') disposition = 'clear';
    else if (f.timestamp <= (latestClear[f.group] ?? -Infinity)) disposition = 'superseded';
    else if (f.kind === 'contradiction') disposition = 'contradiction';
    else if (f.deviation < POLICY.notice) disposition = 'below-threshold';
    return { ...f, disposition };
  });
  const supporting = classified.filter(f => f.disposition === 'support');
  const contradictory = classified.filter(f => f.disposition === 'contradiction');
  const quarantined = classified.filter(f => f.disposition === 'quarantined');
  const groups = unique(supporting.map(f => f.group));
  // Repeated outputs of one raw sample are not persistence, either.
  const persistence = Math.max(0, ...groups.map(g => {
    const rawSamples = new Map(supporting.filter(f => f.group === g).map(f => [f.sampleId, f.timestamp]));
    return unique([...rawSamples.values()]).length;
  }));
  const apparent = unique(supporting.map(f => `${f.source}/${f.feature}`)).length;
  const predicates = {
    persistence: persistence >= POLICY.samples,
    independentSupport: groups.length >= POLICY.support,
    provenance: supporting.length > 0 && supporting.every(f => f.valid),
    contradictionClear: contradictory.length === 0,
    authorizedScope: lab.requestedConsequence === 'planned_inspection',
  };
  const evidenceReady = predicates.persistence && predicates.independentSupport && predicates.provenance;
  const eligible = evidenceReady && predicates.contradictionClear && predicates.authorizedScope;
  const reviewRequired = Boolean(lab.requestedConsequence && supporting.length && (
    evidenceReady || (predicates.persistence && contradictory.length > 0)
  ));
  // Approval binds to a precise evidence package and consequence, never a score.
  const fingerprint = JSON.stringify({ support: supporting.map(f => f.id), contradictions: contradictory.map(f => f.id), quarantined: quarantined.map(f => f.id), consequence: lab.requestedConsequence });
  let governance = { ...lab.governance };
  if (governance.status === 'approved' && (!eligible || governance.fingerprint !== fingerprint)) governance = { ...governance, status: 'expired', reason: 'Evidence package changed or expired; prior approval grants no current authority.' };
  if (['held', 'denied'].includes(governance.status) && governance.fingerprint !== fingerprint) governance = { ...governance, status: 'expired', reason: 'Evidence package changed; a fresh review is required.' };
  const granted = eligible && governance.status === 'approved' && governance.fingerprint === fingerprint;
  let state = 'NORMAL';
  let closureReason = null;
  if (governance.status === 'quarantined') { state = 'QUARANTINED'; closureReason = 'Human reviewer quarantined the case; reset to open a new experiment.'; }
  else if (!supporting.length && lab.findings.length) {
    state = quarantined.length && !classified.some(f => f.disposition === 'clear') ? 'QUARANTINED' : 'RESOLVED';
    closureReason = state === 'QUARANTINED' ? 'Sensor diagnostics or provenance checks invalidate available support.' : 'No admissible supporting evidence remains: signal cleared or review window expired.';
  } else if (supporting.length) {
    state = !predicates.persistence ? 'NOTICED' : groups.length < POLICY.support ? 'WATCHING' : 'CORROBORATED';
    if (granted) state = 'GOVERNED';
  }
  const attention = state === 'NORMAL' || ['RESOLVED', 'QUARANTINED'].includes(state) ? [] : [
    'Preserve bounded finding', 'Sample every 10 seconds (simulated)',
    ...(predicates.persistence ? ['Request independent corroboration'] : []),
    ...(groups.length >= 2 ? ['Raise review priority', 'Preserve competing interpretations'] : []),
  ];
  const concern = Math.min(100, supporting.length ? 20 + Math.min(persistence, 3) * 10 + Math.max(0, groups.length - 1) * 25 : 0);
  return { ...lab, state, closureReason, governance, classified, supportingFindings: supporting, contradictoryEvidence: contradictory, quarantinedEvidence: quarantined, independentGroups: groups, independentSupport: groups.length, apparentSupport: apparent, persistence, predicates, promotionEligibility: eligible, reviewRequired, fingerprint, concern, attentionActions: attention, authority: granted ? 'simulated_planned_inspection' : 'none' };
}
export function evidencePackage(lab) {
  return {
    eventId: lab.eventId, timestamp: lab.now, candidate: 'Possible motor stress; transient operating variation or sensor artifact remain alternatives.',
    supportingEvidence: lab.supportingFindings, independentSourceCount: lab.independentSupport,
    contradictoryEvidence: lab.contradictoryEvidence, quarantinedEvidence: lab.quarantinedEvidence,
    excludedEvidence: lab.classified.filter(f => !['support', 'contradiction', 'quarantined'].includes(f.disposition)),
    provenance: lab.supportingFindings.map(f => ({ id: f.id, source: f.source, sampleId: f.sampleId, group: f.group, path: f.provenance })),
    predicatesSatisfied: Object.keys(lab.predicates).filter(k => lab.predicates[k]),
    predicatesMissing: Object.keys(lab.predicates).filter(k => !lab.predicates[k]),
    requestedConsequence: lab.requestedConsequence, assetCriticality: lab.assetCriticality,
    reason: lab.reviewRequired ? `Tier-2 asset; requested consequence crosses the attention-only automation boundary.${lab.contradictoryEvidence.length ? ' Unresolved contradiction blocks approval.' : ''} A human decision is required.` : 'Stronger consequence is not yet eligible for human review.',
    policy: POLICY.version, fingerprint: lab.fingerprint,
  };
}
export function dispatch(previous, action) {
  const lab = structuredClone(previous);
  const now = action.at ?? lab.now;
  if (!Number.isFinite(now) || now < lab.now) throw new Error('Simulation time must be monotonic.');
  lab.now = now;
  lab.sequence += 1;
  let detail = action.label || action.type;
  if (action.type === 'finding') {
    const x = action.finding;
    if (lab.findings.some(f => f.id === x.id)) throw new Error('Duplicate finding ID.');
    const source = SOURCES[x.source];
    const parent = x.derivedFrom ? lab.findings.find(f => f.id === x.derivedFrom) : null;
    const timestamp = x.timestamp ?? now;
    const conflictingSample = lab.findings.some(f => f.source === x.source && f.sampleId === x.sampleId && f.timestamp !== timestamp);
    const valid = Boolean(!conflictingSample && source && typeof x.id === 'string' && x.id && typeof x.sampleId === 'string' && x.sampleId && Number.isFinite(timestamp) && Number.isFinite(x.deviation) && Number.isFinite(x.confidence) && x.confidence >= 0 && x.confidence <= 1 && Array.isArray(x.provenance) && x.provenance.length && x.provenance.every(p => typeof p === 'string' && p.length) && ['support', 'contradiction', 'clear'].includes(x.kind || 'support') && (!x.derivedFrom || (parent?.valid && parent.source === x.source && parent.sampleId === x.sampleId && parent.timestamp === timestamp)));
    lab.findings.push({ ...x, timestamp, kind: x.kind || 'support', feature: x.feature || 'baseline deviation', signal: source?.signal || 'unknown', group: source?.group || 'untrusted', baseline: source?.baseline || 'unknown', valid });
  } else if (action.type === 'diagnostic') {
    if (!SOURCES[action.source]) throw new Error('Unknown sensor.');
    lab.unreliable[action.source] = action.reason || 'Self-test failed';
  } else if (action.type === 'request') {
    if (!['planned_inspection', 'shutdown'].includes(action.consequence)) throw new Error('Unknown consequence.');
    lab.requestedConsequence = action.consequence;
  } else if (action.type === 'review') {
    const current = evaluate(lab);
    if (!current.reviewRequired || current.governance.status === 'quarantined') throw new Error('Human review is not available.');
    if (!['approve', 'hold', 'deny', 'quarantine'].includes(action.decision)) throw new Error('Unknown review decision.');
    if (!action.actor || !action.rationale?.trim()) throw new Error('Reviewer and rationale are required.');
    if (action.decision === 'approve' && !current.promotionEligibility) throw new Error('Missing predicates block approval.');
    const statuses = { approve: 'approved', hold: 'held', deny: 'denied', quarantine: 'quarantined' };
    lab.governance = { status: statuses[action.decision], actor: action.actor, rationale: action.rationale.trim(), timestamp: now, fingerprint: current.fingerprint, token: `HUMAN-${String(lab.sequence).padStart(3, '0')}`, package: evidencePackage(current) };
    detail = `Human review: ${action.decision.toUpperCase()} — ${action.rationale.trim()}`;
  } else if (action.type !== 'tick') throw new Error('Unknown action.');
  const next = evaluate(lab);
  if (action.type === 'finding') {
    const f = next.classified.find(f => f.id === action.finding.id);
    detail = f.disposition === 'stale' ? `Stale ${f.signal} finding added; outside the admissible ${POLICY.window}s review window.`
      : f.disposition === 'contradiction' ? `Independent ${f.signal} evidence contradicts the candidate interpretation.`
      : f.disposition === 'quarantined' ? `${f.source} finding retained in quarantine; contributes no admissible support.`
      : f.disposition === 'future' ? `${f.signal} finding excluded until its observation time arrives.`
      : f.disposition === 'low-confidence' ? `${f.signal} finding excluded: confidence below the admissible threshold.`
      : f.kind === 'clear' ? `${f.source} returned to corridor; prior findings retained as superseded.`
      : f.derivedFrom ? `Derived ${f.signal} output retained; shares ${f.source} lineage and adds no independent support.`
      : `${f.signal[0].toUpperCase() + f.signal.slice(1)} observation recorded against its scoped baseline.`;
  } else if (action.type === 'diagnostic') detail = `${action.source} quarantined: ${lab.unreliable[action.source]}`;
  else if (action.type === 'request') detail = 'Planned consequence requested; promotion predicates and human review remain mandatory.';
  else if (action.type === 'tick') detail = 'Simulation time advanced; admissibility reevaluated against the review window.';
  const reason = action.type === 'review' ? detail : action.type === 'finding' && ['contradiction', 'stale'].includes(next.classified.at(-1).disposition) ? detail : next.state === 'QUARANTINED' ? next.closureReason : next.state === 'RESOLVED' ? next.closureReason : previous.independentSupport !== next.independentSupport ? `Independent support ${previous.independentSupport} → ${next.independentSupport}; persistence ${next.persistence}/${POLICY.samples}.` : previous.persistence !== next.persistence ? `Distinct samples ${previous.persistence} → ${next.persistence}; independent support ${next.independentSupport}.` : detail;
  next.audit.push({ sequence: lab.sequence, timestamp: now, from: previous.state, to: next.state, reason, detail, predicates: { ...next.predicates }, reviewEligible: next.reviewRequired, governanceToken: next.governance.token || null, authority: next.authority, action: structuredClone(action), policy: POLICY.version });
  return next;
}
