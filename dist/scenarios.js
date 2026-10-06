export function finding(id, source, at, deviation, extra = {}) {
  return { type: 'finding', at, finding: { id, source, sampleId: `${source}/sample-${at}`, timestamp: at, deviation, confidence: 0.78, provenance: [`${source}/raw-${at}`, 'local baseline / 70% load'], ...extra } };
}
const weak = finding('v1', 'VIB-01', 0, 1.8);
const second = finding('v2', 'VIB-01', 30, 1.9);
const third = finding('v3', 'VIB-01', 60, 2.0);
const temp = finding('t1', 'TEMP-01', 70, 1.2);
const current = finding('c1', 'AMP-01', 80, 1.4);
const request = { type: 'request', at: 90, consequence: 'planned_inspection' };
const step = (title, note, action) => ({ title, note, action: { ...action, label: title } });
const start = [
  step('Notice a weak vibration deviation', 'A local departure merits closer sampling, not a fault declaration.', weak),
  step('Observe the vibration again', 'A new raw sample adds persistence. It is still the same source.', second),
  step('Persistence earns a watch state', 'Three distinct samples within 180 seconds. Independent support is still one.', third),
];
export const SCENARIOS = {
  motor: { title: 'Motor stress', subtitle: 'Weak drift earns attention, then review.', steps: [...start,
    step('Add independent temperature evidence', 'A separate thermocouple corroborates the vibration sensor.', temp),
    step('Add independent electrical evidence', 'The current probe provides a third independent source. Authority remains unchanged.', current),
    step('Request a planned inspection', 'The evidence can now support a human-reviewed simulated work request.', request),
  ] },
  echo: { title: 'Echo Trap', subtitle: 'Three apparent signals. One underlying sensor.', steps: [...start,
    step('Add a derived spectral output', 'Spectral energy is derived from VIB-01 sample-60. No new source or sample.', finding('echo-spectrum', 'VIB-01', 65, 1.7, { timestamp: 60, sampleId: 'VIB-01/sample-60', derivedFrom: 'v3', feature: 'spectral energy', provenance: ['VIB-01/raw-60', 'spectral transform'] })),
    step('Add a derived trend output', 'RMS, spectral energy, and trend look like three signals. All trace to accelerometer-A.', finding('echo-trend', 'VIB-01', 66, 1.8, { timestamp: 60, sampleId: 'VIB-01/sample-60', derivedFrom: 'v3', feature: 'trend score', provenance: ['VIB-01/raw-60', 'trend transform'] })),
    step('Request inspection — blocked', 'Apparent support = 3, independent support = 1. More echoes earn no promotion or review.', { ...request, at: 67 }),
    step('Introduce a genuinely independent signal', 'TEMP-01 has separate lineage. Independent support reaches two; human review opens.', temp),
  ] },
  contradiction: { title: 'Contradiction', subtitle: 'Corroboration can coexist with uncertainty.', steps: [...start,
    step('Add independent temperature evidence', 'Two independent sources support possible motor stress.', temp),
    step('Receive contradictory electrical evidence', 'A valid current-probe check conflicts with the candidate. It is retained, not discarded.', finding('c-conflict', 'AMP-01', 80, -1.1, { kind: 'contradiction', feature: 'contradictory load check' })),
    step('Request a consequential review', 'The human can hold, deny, or quarantine. Approval remains blocked by contradiction.', request),
  ] },
  quarantine: { title: 'Sensor fault', subtitle: 'Unreliable evidence loses its influence.', steps: [...start,
    step('Vibration sensor fails its self-test', 'All descendants of VIB-01 are quarantined. A sensor failure is not a motor fault.', { type: 'diagnostic', at: 75, source: 'VIB-01', reason: 'Self-test failed: intermittent flatline and implausible rate of change.' }),
  ] },
  resolution: { title: 'Signal clears', subtitle: 'A useful watch state can end without work.', steps: [...start,
    step('Vibration returns to its local corridor', 'A reliable new sample supersedes prior support from this source. No work request was created.', finding('v-clear', 'VIB-01', 100, 0.2, { kind: 'clear', feature: 'return to corridor' })),
  ] },
  stale: { title: 'Stale evidence', subtitle: 'Arrival time does not make an old signal fresh.', steps: [...start,
    step('Receive an old temperature observation', 'Its event timestamp is 240 seconds old at arrival. It cannot corroborate current evidence.', finding('t-stale', 'TEMP-01', 70, 1.5, { timestamp: -170, sampleId: 'TEMP-01/sample-old', provenance: ['TEMP-01/archive-170', 'local baseline / 70% load'] })),
    step('Let the review window expire', 'All supporting findings are now older than 180 seconds. The case resolves.', { type: 'tick', at: 250 }),
  ] },
};
