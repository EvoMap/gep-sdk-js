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

  const errorHit = /\[error\]|error:|exception:|iserror":true|"status":\s*"error"|"status":\s*"failed"|错误\s*[：:]|异常\s*[：:]|报错\s*[：:]|失败\s*[：:]/.test(lower);
  if (errorHit) signals.push('log_error');

  try {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const errLine = lines.find(l => /\b(typeerror|referenceerror|syntaxerror)\b\s*:|error\s*:|exception\s*:|\[error|错误\s*[：:]|异常\s*[：:]|报错\s*[：:]|失败\s*[：:]/i.test(l));
    if (errLine) {
      signals.push('errsig:' + errLine.replace(/\s+/g, ' ').slice(0, 260));
    }
  } catch { /* ignore */ }

  // --- Opportunity signals: EN, ZH-CN, ZH-TW, JA with snippet context ---

  let featureRequestSnippet = '';
  const featEn = text.match(/\b(add|implement|create|build|make|develop|write|design)\b[^.?!\n]{3,120}\b(feature|function|module|capability|tool|support|endpoint|command|option|mode)\b/i);
  if (featEn) featureRequestSnippet = featEn[0].replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!featureRequestSnippet && /\b(i want|i need|we need|please add|can you add|could you add|let'?s add)\b/i.test(lower)) {
    const featWant = text.match(/.{0,80}\b(i want|i need|we need|please add|can you add|could you add|let'?s add)\b.{0,80}/i);
    featureRequestSnippet = featWant ? featWant[0].replace(/\s+/g, ' ').trim().slice(0, 200) : 'feature request';
  }
  if (!featureRequestSnippet && /加个|实现一下|做个|想要\s*一个|需要\s*一个|帮我加|帮我开发|加一下|新增一个|加个功能|做个功能|我想/.test(text)) {
    const featZh = text.match(/.{0,100}(加个|实现一下|做个|想要\s*一个|需要\s*一个|帮我加|帮我开发|加一下|新增一个|加个功能|做个功能).{0,100}/);
    if (featZh) featureRequestSnippet = featZh[0].replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!featureRequestSnippet && /我想/.test(text)) {
      const featWantZh = text.match(/我想\s*[，,\.。、\s]*([\s\S]{0,400})/);
      featureRequestSnippet = featWantZh ? (featWantZh[1].replace(/\s+/g, ' ').trim().slice(0, 200) || '功能需求') : '功能需求';
    }
    if (!featureRequestSnippet) featureRequestSnippet = '功能需求';
  }
  if (!featureRequestSnippet && /加個|實現一下|做個|想要一個|請加|新增一個|加個功能|做個功能|幫我加/.test(text)) {
    const featTw = text.match(/.{0,100}(加個|實現一下|做個|想要一個|請加|新增一個|加個功能|做個功能|幫我加).{0,100}/);
    featureRequestSnippet = featTw ? featTw[0].replace(/\s+/g, ' ').trim().slice(0, 200) : '功能需求';
  }
  if (!featureRequestSnippet && /追加|実装|作って|機能を|追加して|が欲しい|を追加|してほしい/.test(text)) {
    const featJa = text.match(/.{0,100}(追加|実装|作って|機能を|追加して|が欲しい|を追加|してほしい).{0,100}/);
    featureRequestSnippet = featJa ? featJa[0].replace(/\s+/g, ' ').trim().slice(0, 200) : '機能要望';
  }
  const hasFeatureRequest = featureRequestSnippet ||
    /\b(add|implement|create|build|make|develop|write|design)\b[^.?!\n]{3,60}\b(feature|function|module|capability|tool|support|endpoint|command|option|mode)\b/i.test(text) ||
    /\b(i want|i need|we need|please add|can you add|could you add|let'?s add)\b/i.test(lower) ||
    /加个|实现一下|做个|想要\s*一个|需要\s*一个|帮我加|帮我开发|加一下|新增一个|加个功能|做个功能|我想/.test(text) ||
    /加個|實現一下|做個|想要一個|請加|新增一個|加個功能|做個功能|幫我加/.test(text) ||
    /追加|実装|作って|機能を|追加して|が欲しい|を追加|してほしい/.test(text);
  if (hasFeatureRequest) {
    signals.push('user_feature_request:' + (featureRequestSnippet || ''));
  }

  let improvementSnippet = '';
  if (!errorHit) {
    const impEn = text.match(/.{0,80}\b(should be|could be better|improve|enhance|upgrade|refactor|clean up|simplify|streamline)\b.{0,80}/i);
    if (impEn) improvementSnippet = impEn[0].replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!improvementSnippet && /改进一下|优化一下|简化|重构|整理一下|弄得更好/.test(text)) {
      const impZh = text.match(/.{0,100}(改进一下|优化一下|简化|重构|整理一下|弄得更好).{0,100}/);
      improvementSnippet = impZh ? impZh[0].replace(/\s+/g, ' ').trim().slice(0, 200) : '改进建议';
    }
    if (!improvementSnippet && /改進一下|優化一下|簡化|重構|整理一下|弄得更好/.test(text)) {
      const impTw = text.match(/.{0,100}(改進一下|優化一下|簡化|重構|整理一下|弄得更好).{0,100}/);
      improvementSnippet = impTw ? impTw[0].replace(/\s+/g, ' ').trim().slice(0, 200) : '改進建議';
    }
    if (!improvementSnippet && /改善|最適化|簡素化|リファクタ|良くして|改良/.test(text)) {
      const impJa = text.match(/.{0,100}(改善|最適化|簡素化|リファクタ|良くして|改良).{0,100}/);
      improvementSnippet = impJa ? impJa[0].replace(/\s+/g, ' ').trim().slice(0, 200) : '改善要望';
    }
    const hasImprovement = improvementSnippet ||
      /\b(should be|could be better|improve|enhance|upgrade|refactor|clean up|simplify|streamline)\b/i.test(lower) ||
      /改进一下|优化一下|简化|重构|整理一下|弄得更好/.test(text) ||
      /改進一下|優化一下|簡化|重構|整理一下|弄得更好/.test(text) ||
      /改善|最適化|簡素化|リファクタ|良くして|改良/.test(text);
    if (hasImprovement) {
      signals.push('user_improvement_suggestion:' + (improvementSnippet || ''));
    }
  }

  if (/\b(slow|timeout|timed?\s*out|latency|bottleneck|took too long|performance issue|high cpu|high memory|oom|out of memory)\b/i.test(lower)) {
    signals.push('perf_bottleneck');
  }
  if (/\b(not supported|cannot|doesn'?t support|no way to|missing feature|unsupported|not available|not implemented|no support for)\b/i.test(lower)) {
    signals.push('capability_gap');
  }

  // --- De-duplication ---
  const history = analyzeRecentHistory(recentEvents || []);
  if (history.suppressedSignals.size > 0) {
    const before = signals.length;
    const filtered = signals.filter(s => {
      const key = s.startsWith('errsig:') ? 'errsig'
        : s.startsWith('user_feature_request:') ? 'user_feature_request'
        : s.startsWith('user_improvement_suggestion:') ? 'user_improvement_suggestion'
        : s;
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
  return OPPORTUNITY_SIGNALS.some(name =>
    list.includes(name) || list.some(s => String(s).startsWith(name + ':'))
  );
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
      const key = String(s).startsWith('errsig:') ? 'errsig'
        : String(s).startsWith('user_feature_request:') ? 'user_feature_request'
        : String(s).startsWith('user_improvement_suggestion:') ? 'user_improvement_suggestion'
        : String(s);
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
