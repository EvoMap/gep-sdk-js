const VALID_CATEGORIES = ['repair', 'optimize', 'innovate'];
const VALID_RISK_LEVELS = ['low', 'medium', 'high'];

export function buildMutation({ signals, selectedGene, category, riskLevel }) {
  const cat = category && VALID_CATEGORIES.includes(category)
    ? category
    : inferCategory(signals);

  const base = {
    type: 'Mutation',
    id: `mut_${Date.now()}`,
    category: cat,
    trigger_signals: uniqueStrings(signals),
    target: selectedGene?.id ? `gene:${selectedGene.id}` : 'behavior:protocol',
    expected_effect: effectFromCategory(cat),
    risk_level: riskLevel || (cat === 'innovate' ? 'medium' : 'low'),
  };

  return base;
}

export function validateMutation(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.type !== 'Mutation') return false;
  if (!obj.id || typeof obj.id !== 'string') return false;
  if (!VALID_CATEGORIES.includes(String(obj.category))) return false;
  if (!Array.isArray(obj.trigger_signals)) return false;
  if (!obj.target || typeof obj.target !== 'string') return false;
  if (!obj.expected_effect || typeof obj.expected_effect !== 'string') return false;
  if (!VALID_RISK_LEVELS.includes(String(obj.risk_level))) return false;
  return true;
}

function inferCategory(signals) {
  const list = Array.isArray(signals) ? signals.map(s => String(s)) : [];
  const ERROR_MARKERS = ['log_error', 'errsig:', 'errsig_norm:'];
  const hasError = list.some(s => ERROR_MARKERS.some(m => s.includes(m)));
  if (hasError) return 'repair';

  const OPPORTUNITY_MARKERS = [
    'user_feature_request', 'user_improvement_suggestion', 'capability_gap',
    'stable_success_plateau', 'external_opportunity', 'force_innovation_after_repair_loop',
  ];
  if (list.some(s => OPPORTUNITY_MARKERS.some(m => s === m || s.startsWith(m + ':')))) return 'innovate';
  return 'optimize';
}

function effectFromCategory(category) {
  if (category === 'repair') return 'reduce runtime errors, increase stability, and lower failure rate';
  if (category === 'optimize') return 'improve success rate and reduce repeated operational cost';
  if (category === 'innovate') return 'explore new strategy combinations to escape local optimum';
  return 'improve robustness and success probability';
}

function uniqueStrings(list) {
  const seen = new Set();
  const out = [];
  for (const x of Array.isArray(list) ? list : []) {
    const s = String(x || '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}
