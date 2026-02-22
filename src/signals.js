const OPPORTUNITY_SIGNALS = [
  'user_feature_request', 'user_improvement_suggestion', 'perf_bottleneck',
  'capability_gap', 'stable_success_plateau', 'external_opportunity',
  'recurring_error', 'unsupported_input_type', 'evolution_stagnation_detected',
  'repair_loop_detected', 'force_innovation_after_repair_loop',
];

export function extractSignals({ context, recentEvents }) {
  const signals = [];
  const text = String(context || '');
  const lower = text.toLowerCase();

  const errorHit = /\[error\]|error:|exception:|iserror":true|"status":\s*"error"|"status":\s*"failed"/.test(lower);
  if (errorHit) signals.push('log_error');

  try {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const errLine = lines.find(l => /\b(typeerror|referenceerror|syntaxerror)\b\s*:|error\s*:|exception\s*:|\[error/i.test(l));
    if (errLine) {
      signals.push('errsig:' + errLine.replace(/\s+/g, ' ').slice(0, 260));
    }
  } catch { /* ignore */ }

  if (/\b(add|implement|create|build|make)\b[^.?!\n]{3,60}\b(feature|function|module|capability|tool)\b/i.test(text)) {
    signals.push('user_feature_request');
  }
  if (/\b(i want|i need|we need|please add|can you add)\b/i.test(lower)) {
    signals.push('user_feature_request');
  }
  if (/\b(should be|could be better|improve|enhance|upgrade|refactor)\b/i.test(lower) && !errorHit) {
    signals.push('user_improvement_suggestion');
  }
  if (/\b(slow|timeout|timed?\s*out|latency|bottleneck|performance issue)\b/i.test(lower)) {
    signals.push('perf_bottleneck');
  }
  if (/\b(not supported|cannot|doesn'?t support|missing feature|unsupported)\b/i.test(lower)) {
    signals.push('capability_gap');
  }

  const history = analyzeRecentHistory(recentEvents || []);
  if (history.suppressedSignals.size > 0) {
    const before = signals.length;
    const filtered = signals.filter(s => {
      const key = s.startsWith('errsig:') ? 'errsig' : s;
      return !history.suppressedSignals.has(key);
    });
    if (before > 0 && filtered.length === 0) {
      return ['evolution_stagnation_detected', 'stable_success_plateau'];
    }
    if (filtered.length > 0) return [...new Set(filtered)];
  }

  if (history.consecutiveRepairCount >= 3) {
    const noRepairSignals = signals.filter(s => s !== 'log_error' && !s.startsWith('errsig:'));
    if (noRepairSignals.length === 0) {
      return ['repair_loop_detected', 'stable_success_plateau', 'force_innovation_after_repair_loop'];
    }
    return [...new Set([...noRepairSignals, 'force_innovation_after_repair_loop'])];
  }

  if (signals.length === 0) signals.push('stable_success_plateau');
  return [...new Set(signals)];
}

export function hasOpportunitySignal(signals) {
  const list = Array.isArray(signals) ? signals : [];
  return OPPORTUNITY_SIGNALS.some(s => list.includes(s));
}

export function analyzeRecentHistory(recentEvents) {
  if (!Array.isArray(recentEvents) || recentEvents.length === 0) {
    return { suppressedSignals: new Set(), recentIntents: [], consecutiveRepairCount: 0 };
  }
  const recent = recentEvents.slice(-10);
  let consecutiveRepairCount = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i].intent === 'repair') consecutiveRepairCount++;
    else break;
  }

  const signalFreq = {};
  const tail = recent.slice(-8);
  for (const evt of tail) {
    const sigs = Array.isArray(evt.signals) ? evt.signals : [];
    for (const s of sigs) {
      const key = String(s).startsWith('errsig:') ? 'errsig' : String(s);
      signalFreq[key] = (signalFreq[key] || 0) + 1;
    }
  }

  const suppressedSignals = new Set();
  for (const [key, count] of Object.entries(signalFreq)) {
    if (count >= 3) suppressedSignals.add(key);
  }

  return { suppressedSignals, recentIntents: recent.map(e => e.intent || 'unknown'), consecutiveRepairCount };
}

export { OPPORTUNITY_SIGNALS };
