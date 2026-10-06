// Presentation semantics only. This module does not grant authority or alter evidence.
import { evidencePackage, POLICY } from './engine.js';
export const predicateLabels = { persistence: 'Persistence ≥ 3 distinct samples', independentSupport: 'Independent sources ≥ 2', provenance: 'Source lineage intact', contradictionClear: 'No active contradiction', authorizedScope: 'Requested consequence in scope' };
export const consequenceLabel = 'Simulated planned-inspection work request';
export function excludedEvidence(lab) {
  return lab.classified.filter(f => !['support', 'contradiction', 'quarantined'].includes(f.disposition));
}
export function exclusionReason(f) {
  const labels = { stale: `stale / outside ${POLICY.window}s review window`, future: 'observation time has not arrived', superseded: 'superseded by return-to-corridor evidence', clear: 'return-to-corridor observation; not supporting evidence', 'low-confidence': 'below admissible confidence', 'below-threshold': 'below notice threshold' };
  return labels[f.disposition] || f.disposition;
}
export function stateResult(row) {
  if (row.action?.type === 'review') {
    const labels = { approve: 'APPROVED', hold: 'REVIEW HELD', deny: 'CONSEQUENCE DENIED', quarantine: 'CASE QUARANTINED' };
    return `${row.to} · ${labels[row.action.decision]}`;
  }
  return row.from === row.to ? `${row.to} · unchanged` : `${row.from} → ${row.to}`;
}
export function publicAudit(audit) {
  const rows = [];
  for (const row of audit) {
    const last = rows.at(-1);
    if (row.action.publicGroup && last?.action.publicGroup === row.action.publicGroup) {
      rows[rows.length - 1] = { ...row, from: last.from, reason: 'All active supporting evidence cleared; prior findings retained as superseded.', internalSequences: [...last.internalSequences, row.sequence] };
    } else rows.push({ ...row, internalSequences: [row.sequence] });
  }
  return rows;
}
export function presentation(lab) {
  const g = lab.governance;
  const historical = g.status === 'quarantined';
  const everReviewed = lab.audit.some(a => a.reviewEligible || a.action.type === 'review');
  const lastDecision = [...lab.audit].reverse().find(a => a.action.type === 'review');
  const decisionLabels = { held: 'HUMAN REVIEW: HELD', denied: 'HUMAN REVIEW: DENIED', approved: 'HUMAN REVIEW: APPROVED', quarantined: 'HUMAN REVIEW: QUARANTINED' };
  let reviewLabel = decisionLabels[g.status];
  if (!reviewLabel) reviewLabel = lab.reviewRequired ? 'HUMAN REVIEW REQUIRED' : everReviewed ? 'REVIEW NO LONGER ELIGIBLE' : 'HUMAN REVIEW NOT YET ELIGIBLE';
  let reviewMessage = evidencePackage(lab).reason;
  if (historical) reviewMessage = 'Case quarantined by human review. The evidence package and predicate values below describe the decision point; they do not grant current authority.';
  else if (g.status === 'approved') reviewMessage = 'Human approval applies only to the reviewed evidence package and the simulated planned-inspection work request.';
  else if (g.status === 'held') reviewMessage = 'Human review held the request. Evidence remains available; no consequence is authorized.';
  else if (g.status === 'denied') reviewMessage = 'Human review denied the requested consequence. Evidence remains available; no consequence is authorized.';
  else if (!lab.reviewRequired) {
    if (everReviewed) {
      const expired = lab.state === 'RESOLVED' && lab.classified.some(f => f.disposition === 'stale') && !lab.classified.some(f => f.disposition === 'clear');
      reviewMessage = lab.state === 'RESOLVED'
        ? lastDecision ? 'Review closed — candidate resolved. The previous human decision remains in the audit history; no current authority remains.' : expired ? 'Review closed — admissible evidence expired before governance action.' : 'Review closed — candidate resolved before governance action.'
        : 'Review no longer eligible — evidence fell below the governance threshold. Prior review history is retained.';
    } else reviewMessage = 'Human review has not opened. A consequential request needs sufficient persistent, independent support, or persistence with unresolved contradiction.';
  }
  const pkg = historical ? g.package : evidencePackage(lab);
  const predicates = historical ? Object.fromEntries(Object.keys(predicateLabels).map(k => [k, pkg.predicatesSatisfied.includes(k)])) : lab.predicates;
  const rows = publicAudit(lab.audit);
  const latest = rows.at(-1);
  const currentResult = historical ? 'QUARANTINED · CASE QUARANTINED' : g.status === 'approved' ? 'GOVERNED · APPROVED' : g.status === 'held' ? `${lab.state} · REVIEW HELD` : g.status === 'denied' ? `${lab.state} · CONSEQUENCE DENIED` : ['RESOLVED', 'QUARANTINED'].includes(lab.state) ? lab.state : latest ? stateResult(latest) : 'AWAITING FIRST FINDING';
  const blockedReason = lab.contradictoryEvidence.length ? 'Resolve or disposition the active contradiction before approval.' : !lab.promotionEligibility ? 'Approval is blocked until all promotion predicates are satisfied.' : '';
  return { historical, predicates, pkg, rows, latest, currentResult, reviewLabel, reviewMessage, everReviewed,
    reviewActive: lab.reviewRequired && !['approved', 'quarantined'].includes(g.status),
    approvalBlocked: !lab.promotionEligibility, blockedReason,
    authorizedConsequence: lab.authority === 'simulated_planned_inspection' ? consequenceLabel : null,
    excluded: excludedEvidence(lab),
    counts: { total: lab.findings.length, supportPaths: lab.apparentSupport, independent: lab.independentSupport, contradictions: lab.contradictoryEvidence.length, quarantined: lab.quarantinedEvidence.length, excluded: excludedEvidence(lab).length },
  };
}
