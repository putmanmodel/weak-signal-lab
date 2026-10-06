import { createLab, dispatch, evidencePackage, POLICY, SOURCES } from './engine.js';
import { SCENARIOS, finding } from './scenarios.js';
import { presentation, predicateLabels, stateResult, exclusionReason, consequenceLabel } from './presentation.js';
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const time = t => `${t < 0 ? '−' : '+'}${String(Math.floor(Math.abs(t) / 60)).padStart(2, '0')}:${String(Math.abs(t) % 60).padStart(2, '0')}`;
let lab = createLab(), selected = 'motor', cursor = 0, custom = false;
const states = ['NORMAL', 'NOTICED', 'WATCHING', 'CORROBORATED', 'GOVERNED'];
$('scenario').innerHTML = Object.entries(SCENARIOS).map(([id, s]) => `<option value="${id}">${s.title}</option>`).join('');
function reset(id = selected) { if (!SCENARIOS[id]) throw new Error('Unknown experiment'); selected = id; lab = createLab(); cursor = 0; custom = false; $('scenario').value = id; render(); }
function apply(action) { lab = dispatch(lab, action); render(); }
function next() { if (custom || cursor >= SCENARIOS[selected].steps.length) return; const event = SCENARIOS[selected].steps[cursor++]; apply(event.action); }
$('scenario').addEventListener('change', e => reset(e.target.value));
$('reset').addEventListener('click', () => reset());
$('step').addEventListener('click', next);
const injectionLabels = { vibration: 'Vibration sample', temperature: 'Temperature sample', current: 'Current sample', duplicate: 'Duplicate / derived', contradiction: 'Contradictory current', unreliable: 'Fail vibration sensor', clear: 'Clear current signals', stale: 'Old temperature', tick: 'Advance 181s', request: 'Request inspection' };
$('injections').innerHTML = Object.entries(injectionLabels).map(([id, label]) => `<button data-inject="${id}">${label}</button>`).join('');
function inject(kind) {
  custom = true;
  const at = lab.now + 30, id = `manual-${lab.sequence + 1}`;
  if (['vibration', 'temperature', 'current'].includes(kind)) {
    const source = Object.keys(SOURCES).find(s => SOURCES[s].signal === kind);
    apply(finding(id, source, at, kind === 'vibration' ? 1.8 : 1.3));
  } else if (kind === 'duplicate') {
    const original = [...lab.findings].reverse().find(f => f.source === 'VIB-01' && f.valid && !f.derivedFrom && f.kind === 'support');
    if (original) apply(finding(id, 'VIB-01', at, 1.7, { timestamp: original.timestamp, sampleId: original.sampleId, derivedFrom: original.id, feature: `derived ${id}`, provenance: [...original.provenance, 'derived output'] }));
  } else if (kind === 'contradiction') apply(finding(id, 'AMP-01', at, -1.1, { kind: 'contradiction', feature: 'contradictory load check' }));
  else if (kind === 'unreliable') apply({ type: 'diagnostic', source: 'VIB-01', at, reason: 'Sensor self-test failed; downstream derivatives are also unreliable.' });
  else if (kind === 'clear') {
    for (const source of Object.keys(SOURCES)) lab = dispatch(lab, { ...finding(`${id}-${source}`, source, at, 0.1, { kind: 'clear' }), publicGroup: `clear-all-${id}` });
    render();
  } else if (kind === 'stale') apply(finding(id, 'TEMP-01', at, 1.5, { timestamp: at - 240, sampleId: `old-${id}` }));
  else if (kind === 'tick') apply({ type: 'tick', at: lab.now + 181, label: 'Review window expired' });
  else if (kind === 'request') apply({ type: 'request', at, consequence: 'planned_inspection' });
}
$('injections').addEventListener('click', e => { const b = e.target.closest('[data-inject]'); if (b) inject(b.dataset.inject); });
function render() {
  const scenario = SCENARIOS[selected], item = scenario.steps[cursor], view = presentation(lab), latest = view.latest;
  $('scenario-description').textContent = scenario.subtitle;
  $('clock').textContent = `T ${time(lab.now)}`;
  $('step-count').textContent = custom ? 'ALTERNATE BRANCH / RESET TO REPLAY' : `EVENT ${Math.min(cursor + 1, scenario.steps.length)} / ${scenario.steps.length}`;
  $('next-title').textContent = custom ? 'Your branch is live' : item ? item.title : 'Replay complete';
  $('next-note').textContent = custom ? 'Use the branch controls to probe the evidence boundary. Every choice remains in the transition record.' : item ? item.note : view.reviewActive ? 'Inspect the evidence package below, then make a human review decision.' : 'Inspect the outcome or reset to replay the same events.';
  $('step').disabled = custom || !item;
  $('step').textContent = cursor === 0 ? 'Start experiment' : item ? 'Next event' : 'Replay complete';
  $('concern-value').textContent = `${lab.concern} / 100`;
  $('concern-fill').style.width = `${lab.concern}%`;
  $('concern-note').textContent = `${lab.independentSupport} independent source${lab.independentSupport === 1 ? '' : 's'} · ${lab.persistence} distinct persistence samples · illustrative attention index, not fault probability`;
  const granted = lab.authority !== 'none';
  $('authority-value').textContent = granted ? 'HUMAN-APPROVED' : 'UNCHANGED';
  $('authority-track').classList.toggle('granted', granted);
  $('authority-note').textContent = granted ? 'Simulated planned inspection permitted. No real work created; no shutdown authority.' : 'Attention only. No maintenance work or shutdown authorized.';
  const colors = { vibration: '#50dfb4', temperature: '#ffca73', current: '#8bbdff' };
  $('streams').innerHTML = Object.entries(SOURCES).map(([source, config]) => {
    const fs = lab.classified.filter(f => f.source === source && !f.derivedFrom && f.valid).sort((a, b) => a.timestamp - b.timestamp);
    const last = fs.at(-1);
    const points = fs.map(f => `${Math.max(0, Math.min(260, (f.timestamp / Math.max(lab.now, 100)) * 260))},${38 - Math.max(-.1, Math.min(2.5, f.deviation)) * 12}`).join(' ');
    const status = lab.unreliable[source] ? 'QUARANTINED' : last?.disposition || 'awaiting input';
    return `<div class="stream" data-signal="${config.signal}"><div class="stream-head"><span>${esc(config.label)}</span><strong>${last ? `${last.deviation > 0 ? '+' : ''}${last.deviation.toFixed(1)}σ` : '—'}</strong></div><svg viewBox="0 0 260 45" role="img" aria-label="${esc(config.label)} synthetic deviation trace"><path d="M0 38H260" stroke="#304357" stroke-dasharray="3 4" fill="none"/><path d="M0 26H260" stroke="#304357" stroke-dasharray="2 5" fill="none"/>${points ? `<polyline points="${points}" fill="none" stroke="${colors[config.signal]}" stroke-width="2"/>${fs.map(f => `<circle cx="${Math.max(0, Math.min(260, f.timestamp / Math.max(lab.now, 100) * 260))}" cy="${38 - Math.max(-.1, Math.min(2.5, f.deviation)) * 12}" r="3" fill="${colors[config.signal]}"/>`).join('')}` : ''}</svg><small>${source} · ${esc(status)}</small></div>`;
  }).join('');
  const index = states.indexOf(lab.state);
  $('ladder').innerHTML = states.map((state, i) => `<li class="${i === index ? 'active' : i < index ? 'passed' : ''} ${state === 'GOVERNED' ? 'governance-step' : ''}"><span class="step-node">${i < index ? '✓' : i + 1}</span>${state}${state === 'GOVERNED' ? `<small>${esc(view.reviewLabel)}</small>` : ''}</li>`).join('');
  $('alternate-state').innerHTML = `<div class="branch-label">EVIDENCE LIFECYCLE OUTCOMES</div><div class="branches">${['RESOLVED', 'QUARANTINED'].map(state => `<span class="branch ${lab.state === state ? 'selected' : ''}" ${lab.state === state ? 'aria-current="step"' : ''}>${state}</span>`).join('')}</div>`;
  $('transition-label').textContent = view.currentResult;
  $('transition-reason').textContent = latest?.reason || 'The upstream detector supplies observations. This lab decides what they may mean and do.';
  $('attention-list').innerHTML = (lab.attentionActions.length ? lab.attentionActions : ['Ordinary monitoring only']).map(a => `<li>${esc(a)}</li>`).join('');
  $('authorized-consequence').innerHTML = view.authorizedConsequence ? `<span class="eyebrow">AUTHORIZED CONSEQUENCE</span><p><strong>${esc(view.authorizedConsequence)}</strong></p><p>Only the reviewed consequence is authorized. No equipment shutdown or real industrial action.</p>` : '';
  $('authorized-consequence').hidden = !view.authorizedConsequence;
  $('evidence-counts').textContent = `${view.counts.total} total observations · ${view.counts.contradictions} contradictory · ${view.counts.quarantined} quarantined · ${view.counts.excluded} excluded from active support`;
  $('apparent').textContent = lab.apparentSupport;
  $('independent').textContent = lab.independentSupport;
  const trap = lab.apparentSupport > lab.independentSupport;
  document.querySelector('.support-counts .separator').textContent = trap ? '≠' : '=';
  $('lineage-note').classList.toggle('trap', trap);
  $('lineage-note').textContent = trap ? `${lab.apparentSupport} active admissible support paths trace to ${lab.independentSupport} independent source${lab.independentSupport === 1 ? '' : 's'}. Derived outputs do not earn extra corroboration.` : 'Independence follows the underlying sensor, not the number of outputs or repeated readings.';
  $('lineages').innerHTML = Object.entries(SOURCES).map(([source, c]) => {
    const fs = lab.supportingFindings.filter(f => f.source === source);
    const features = [...new Set(fs.map(f => f.feature))];
    return `<div class="lineage ${fs.length ? '' : 'inactive'}"><strong>${source}</strong> <span>→ ${c.group}</span><p>${features.length ? features.map(esc).join(' + ') : lab.unreliable[source] ? 'Source quarantined; contributes 0' : 'No admissible support'}${fs.length ? ` · contributes 1 independent source` : ''}</p></div>`;
  }).join('');
  $('predicate-heading').textContent = view.historical ? 'PREDICATES AT CASE QUARANTINE' : 'PROMOTION PREDICATES';
  $('predicate-list').innerHTML = Object.entries(predicateLabels).map(([key, label]) => `<li><span>${label}</span><span class="${view.predicates[key] ? 'yes' : 'no'}">${view.historical ? (view.predicates[key] ? 'MET AT QUARANTINE' : 'MISSING AT QUARANTINE') : view.predicates[key] ? 'MET' : 'MISSING'}</span></li>`).join('') + `<li><span>Explicit human approval</span><span class="${granted ? 'yes' : 'no'}">${view.historical ? 'NOT APPLICABLE: CASE QUARANTINED' : granted ? 'RECORDED' : 'NOT GRANTED'}</span></li>`;
  $('finding-count').textContent = `(${lab.findings.length} total)`;
  $('finding-list').innerHTML = lab.classified.length ? [...lab.classified].reverse().map(f => `<div class="finding"><strong>${esc(f.id)} · ${esc(f.source)}</strong> <span class="status">${f.disposition.toUpperCase()}</span><br>Observed ${time(f.timestamp)} · age ${lab.now - f.timestamp}s · ${f.deviation}σ · confidence ${f.confidence}<br>Raw sample: ${esc(f.sampleId)}<br>Lineage: ${esc(f.group)}${f.derivedFrom ? ` · derived from ${esc(f.derivedFrom)}` : ''}<br>${(f.provenance || []).map(esc).join(' → ')}${lab.unreliable[f.source] ? `<br>Reason: ${esc(lab.unreliable[f.source])}` : ''}</div>`).join('') : '<p class="caption">No observations yet.</p>';
  document.querySelector('[data-inject="duplicate"]').disabled = !lab.findings.some(f => f.source === 'VIB-01' && !f.derivedFrom && f.kind === 'support');
  renderReview();
  $('audit-body').innerHTML = lab.audit.length ? [...view.rows].reverse().map(a => `<tr><td>${time(a.timestamp)}</td><td>${esc(stateResult(a))}</td><td>${esc(a.reason)}</td><td>${a.authority === 'none' ? 'None' : 'Simulated inspection'}</td></tr>`).join('') : '<tr><td colspan="4">No transitions yet. Start the experiment to introduce a weak finding.</td></tr>';
}
function renderReview() {
  const previousDraft = $('review-rationale')?.value ?? '';
  const view = presentation(lab), pkg = view.pkg, g = lab.governance, active = view.reviewActive;
  $('review').classList.toggle('closed', !lab.reviewRequired);
  const heading = `<div class="review-head"><div><h2 id="review-title">${esc(view.reviewLabel)}</h2><p>${esc(view.reviewMessage)}</p></div><span class="chip">${lab.authority === 'none' ? 'NO AUTHORITY GRANTED' : 'SCOPED APPROVAL'}</span></div>`;
  const decision = g.token ? `<div class="decision"><strong>${g.status.toUpperCase()} · ${esc(g.token)}</strong> · ${esc(g.actor)} at ${time(g.timestamp)}<br>${esc(g.reason || g.rationale)}</div>` : '';
  if (!lab.reviewRequired && !view.historical) {
    $('review').innerHTML = heading + decision;
    return;
  }
  const ids = fs => fs.length ? fs.map(f => `${esc(f.id)} (${esc(f.source)})`).join(', ') : 'None';
  const excluded = pkg.excludedEvidence || [];
  $('review').innerHTML = heading + `${view.historical ? '<p class="historical-note">HISTORICAL EVIDENCE PACKAGE · AT QUARANTINE</p>' : ''}<div class="review-grid"><dl><dt>Candidate interpretation</dt><dd>${esc(pkg.candidate)}</dd><dt>Supporting evidence${view.historical ? ' at quarantine' : ''}</dt><dd>${ids(pkg.supportingEvidence)}</dd><dt>Independent supporting sources${view.historical ? ' at quarantine' : ''}</dt><dd>${pkg.independentSourceCount} / required ${POLICY.support}</dd></dl><dl><dt>Contradictory evidence</dt><dd>${ids(pkg.contradictoryEvidence)}</dd><dt>Quarantined evidence${view.historical ? ' before case closure' : ''}</dt><dd>${ids(pkg.quarantinedEvidence)}</dd><dt>Excluded evidence</dt><dd>${excluded.length ? excluded.map(f => `${esc(f.id)} (${esc(f.source)}) — ${esc(exclusionReason(f))}`).join('<br>') : 'None'}</dd><dt>Provenance</dt><dd>${pkg.provenance.map(p => `${esc(p.id)} → ${esc(p.source)} → ${esc(p.group)}<br>`).join('') || 'No admissible provenance'}</dd></dl><dl><dt>Predicates satisfied${view.historical ? ' at quarantine' : ''}</dt><dd>${pkg.predicatesSatisfied.map(k => predicateLabels[k]).join('; ') || 'None'}</dd><dt>Predicates missing${view.historical ? ' at quarantine' : ''}</dt><dd>${[...pkg.predicatesMissing.map(k => predicateLabels[k]), ...(view.historical ? ['Human approval not applicable: case quarantined'] : lab.authority === 'none' ? ['Explicit human approval'] : [])].join('; ') || 'None'}</dd><dt>Requested consequence</dt><dd>${pkg.requestedConsequence === 'planned_inspection' ? consequenceLabel : pkg.requestedConsequence === 'shutdown' ? 'Shutdown — outside this demo’s authorized scope' : 'None'}<br><span class="subtle">No real equipment action occurs.</span></dd></dl></div>` + decision + (active ? `<div class="review-actions"><label for="review-rationale">Reviewer rationale<textarea id="review-rationale" placeholder="Explain your decision for the transition record.">${esc(previousDraft)}</textarea></label><div class="review-controls">${view.approvalBlocked ? `<p id="approval-blocked" class="blocked-reason">${esc(view.blockedReason)}</p>` : ''}<div class="review-buttons"><button class="primary" data-review="approve" ${view.approvalBlocked ? 'disabled aria-describedby="approval-blocked"' : ''}>${view.approvalBlocked ? 'APPROVE — BLOCKED' : 'APPROVE'}</button><button data-review="hold">HOLD</button><button data-review="deny">DENY</button><button data-review="quarantine">QUARANTINE</button></div></div></div><p id="review-error" class="caption error" role="alert"></p>` : '');
}
$('review').addEventListener('click', e => {
  const b = e.target.closest('[data-review]'); if (!b) return;
  const rationale = $('review-rationale')?.value.trim();
  if (!rationale) { $('review-error').textContent = 'Add a short rationale before recording the decision.'; $('review-rationale').focus(); return; }
  try { apply({ type: 'review', decision: b.dataset.review, actor: 'human-demo-reviewer', rationale }); }
  catch (err) { $('review-error').textContent = err.message; }
});
render();
// Read-only inspection only: browser agents cannot impersonate the human reviewer.
if (document.modelContext?.registerTool) {
  try { Promise.resolve(document.modelContext.registerTool({ name: 'inspect_weak_signal_case', description: 'Read the visible deterministic case, evidence predicates, and authority. Does not change state or submit human review.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute(input) { if (Object.keys(input || {}).length) throw new Error('No parameters expected.'); return { state: lab.state, concern: lab.concern, authority: lab.authority, independentSupport: lab.independentSupport, apparentSupport: lab.apparentSupport, predicates: lab.predicates, governanceStatus: lab.governance.status }; } })).catch(() => {}); } catch {}
}
