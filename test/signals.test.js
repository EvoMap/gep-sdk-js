import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extractSignals, hasOpportunitySignal, analyzeRecentHistory, OPPORTUNITY_SIGNALS } from '../src/signals.js';

test('extractSignals: detects log_error from English error pattern', () => {
  const sigs = extractSignals({ context: '[error] something failed' });
  assert.ok(sigs.includes('log_error'));
});

test('extractSignals: detects log_error from Chinese error pattern', () => {
  const sigs = extractSignals({ context: '错误：连接超时' });
  assert.ok(sigs.includes('log_error'));
});

test('extractSignals: detects perf_bottleneck', () => {
  const sigs = extractSignals({ context: 'request took too long, latency 30s' });
  assert.ok(sigs.includes('perf_bottleneck'));
});

test('extractSignals: detects capability_gap', () => {
  const sigs = extractSignals({ context: 'this feature is not supported on Windows' });
  assert.ok(sigs.includes('capability_gap'));
});

test('extractSignals: detects user_feature_request with EN snippet', () => {
  const sigs = extractSignals({ context: 'please add a new feature for batch import' });
  assert.ok(sigs.some(s => s.startsWith('user_feature_request:')));
});

test('extractSignals: detects user_feature_request with ZH snippet', () => {
  const sigs = extractSignals({ context: '帮我加个批量导入功能' });
  assert.ok(sigs.some(s => s.startsWith('user_feature_request:')));
});

test('extractSignals: detects user_feature_request with JA snippet', () => {
  const sigs = extractSignals({ context: 'バッチインポート機能を追加してほしい' });
  assert.ok(sigs.some(s => s.startsWith('user_feature_request:')));
});

test('extractSignals: defaults to stable_success_plateau when no signals', () => {
  const sigs = extractSignals({ context: 'all systems nominal' });
  assert.deepEqual(sigs, ['stable_success_plateau']);
});

test('extractSignals: dedup path returns evolution_stagnation when all signals suppressed', () => {
  // 4 prior events all carrying perf_bottleneck → suppressedSignals contains
  // 'perf_bottleneck'. Current context only re-detects perf_bottleneck, so
  // after dedup the signal set becomes empty and the function falls back to
  // ['evolution_stagnation_detected', 'stable_success_plateau'].
  const recentEvents = Array.from({ length: 4 }, () => ({
    intent: 'innovate',
    signals: ['perf_bottleneck'],
  }));
  const sigs = extractSignals({ context: 'slow', recentEvents });
  assert.ok(sigs.includes('evolution_stagnation_detected'));
  assert.ok(sigs.includes('stable_success_plateau'));
});

test('extractSignals: 3 consecutive repair triggers force_innovation_after_repair_loop', () => {
  const recentEvents = [
    { intent: 'repair', signals: [] },
    { intent: 'repair', signals: [] },
    { intent: 'repair', signals: [] },
  ];
  const sigs = extractSignals({ context: 'all good', recentEvents });
  assert.ok(sigs.includes('force_innovation_after_repair_loop'));
});

test('hasOpportunitySignal: detects bare opportunity name', () => {
  assert.equal(hasOpportunitySignal(['perf_bottleneck']), true);
  assert.equal(hasOpportunitySignal(['log_error']), false);
});

test('hasOpportunitySignal: detects opportunity name with snippet suffix', () => {
  assert.equal(hasOpportunitySignal(['user_feature_request:add a feature']), true);
});

test('analyzeRecentHistory: empty input returns zero defaults', () => {
  const r = analyzeRecentHistory([]);
  assert.equal(r.consecutiveRepairCount, 0);
  assert.equal(r.suppressedSignals.size, 0);
  assert.equal(r.consecutiveFailureCount, 0);
  assert.equal(r.recentFailureRatio, 0);
  assert.deepEqual(r.signalFreq, {});
});

test('analyzeRecentHistory: counts consecutive repair tail', () => {
  const r = analyzeRecentHistory([
    { intent: 'innovate' },
    { intent: 'repair' },
    { intent: 'repair' },
  ]);
  assert.equal(r.consecutiveRepairCount, 2);
});

test('analyzeRecentHistory: counts consecutive failure tail (v1.1.0)', () => {
  const r = analyzeRecentHistory([
    { outcome: { status: 'success' } },
    { outcome: { status: 'failed' } },
    { outcome: { status: 'failed' } },
    { outcome: { status: 'failed' } },
  ]);
  assert.equal(r.consecutiveFailureCount, 3);
});

test('analyzeRecentHistory: recentFailureRatio over last 8 (v1.1.0)', () => {
  const events = [
    { outcome: { status: 'success' } },
    { outcome: { status: 'success' } },
    { outcome: { status: 'success' } },
    { outcome: { status: 'success' } },
    { outcome: { status: 'failed' } },
    { outcome: { status: 'failed' } },
    { outcome: { status: 'failed' } },
    { outcome: { status: 'success' } },
  ];
  const r = analyzeRecentHistory(events);
  assert.equal(r.recentFailureRatio, 3 / 8);
});

test('analyzeRecentHistory: signalFreq normalizes prefixes (v1.1.0)', () => {
  const r = analyzeRecentHistory([
    { signals: ['user_feature_request:add foo'] },
    { signals: ['user_feature_request:add bar'] },
    { signals: ['log_error', 'errsig:Error: x'] },
  ]);
  assert.equal(r.signalFreq.user_feature_request, 2);
  assert.equal(r.signalFreq.log_error, 1);
  assert.equal(r.signalFreq.errsig, 1);
});

test('OPPORTUNITY_SIGNALS: contains baseline names', () => {
  for (const name of ['user_feature_request', 'perf_bottleneck', 'capability_gap', 'stable_success_plateau']) {
    assert.ok(OPPORTUNITY_SIGNALS.includes(name), `${name} should be in OPPORTUNITY_SIGNALS`);
  }
});
