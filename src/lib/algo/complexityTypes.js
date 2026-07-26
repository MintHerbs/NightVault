// Ordered lowest → highest (used for dominance comparison)
export const COMPLEXITY_ORDER = [
  '1', 'log_log_n', 'log_n', 'log2_n', 'sqrt_n', 'sqrt_n_log_n',
  'n', 'n_log_n', 'n_sqrt_n', 'n2', 'n2_log_n',
  'n3', 'n3_log_n', 'exp_n', 'unknown',
];

// Full O(...) strings
export const COMPLEXITY_DISPLAY = {
  '1':            'O(1)',
  'log_log_n':    'O(log log n)',
  'log_n':        'O(log n)',
  'log2_n':       'O(log² n)',
  'sqrt_n':       'O(√n)',
  'sqrt_n_log_n': 'O(√n · log n)',
  'n':            'O(n)',
  'n_log_n':      'O(n log n)',
  'n_sqrt_n':     'O(n√n)',
  'n2':           'O(n²)',
  'n2_log_n':     'O(n² log n)',
  'n3':           'O(n³)',
  'n3_log_n':     'O(n³ log n)',
  'exp_n':        'O(2ⁿ)',
  'unknown':      'O(?)',
};

// Short inner labels for step strings like "O(n) × O(log n) = O(n log n)"
export const COMPLEXITY_SHORT = {
  '1':            '1',
  'log_log_n':    'log log n',
  'log_n':        'log n',
  'log2_n':       'log² n',
  'sqrt_n':       '√n',
  'sqrt_n_log_n': '√n·log n',
  'n':            'n',
  'n_log_n':      'n log n',
  'n_sqrt_n':     'n√n',
  'n2':           'n²',
  'n2_log_n':     'n² log n',
  'n3':           'n³',
  'n3_log_n':     'n³ log n',
  'exp_n':        '2ⁿ',
  'unknown':      '?',
};

// Colour by complexity key/shape -- shared by ComplexityCodeView and ComplexityTerminal.
export const COMPLEXITY_COLORS = {
  '1':            '#6b7280',
  'log_log_n':    '#10b981',
  'log_n':        '#10b981',
  'log2_n':       '#10b981',
  'sqrt_n':       '#06b6d4',
  'sqrt_n_log_n': '#06b6d4',
  'n':            '#3b82f6',
  // Literal, not themed (T-062): this is a semantic growth-rate scale
  // (log → sqrt → n → n log n → n² → n³), where each step must stay
  // distinguishable from its neighbours regardless of the app theme.
  'n_log_n':      '#ffa31a',
  'n_sqrt_n':     '#ffa31a',
  'n2':           '#f59e0b',
  'n2_log_n':     '#f59e0b',
  'n3':           '#ef4444',
  'n3_log_n':     '#ef4444',
  'exp_n':        '#be123c',
  'unknown':      '#6b7280',
};

// Approximate total degree per flat key, used only to bucket a colour for
// compound (multi-symbol) values that have no exact entry above.
const FLAT_DEGREE = {
  '1': 0, 'log_log_n': 0.1, 'log_n': 0.2, 'log2_n': 0.3, 'sqrt_n': 0.5, 'sqrt_n_log_n': 0.6,
  'n': 1, 'n_log_n': 1.2, 'n_sqrt_n': 1.5, 'n2': 2, 'n2_log_n': 2.2,
  'n3': 3, 'n3_log_n': 3.2, 'exp_n': 10, 'unknown': 1,
};

function approxDegree(c) {
  if (typeof c === 'string') return FLAT_DEGREE[c] ?? 0;
  if (c && c.compound === 'sum') return Math.max(0, ...c.terms.map(approxDegree));
  if (c && c.compound === 'product') {
    const varDeg = Object.values(c.vars || {}).reduce((a, b) => a + b, 0);
    const logDeg = Object.values(c.logVars || {}).reduce((a, b) => a + b, 0) * 0.1;
    return varDeg + logDeg;
  }
  return 0;
}

// Colour for ANY complexity value, flat or compound.
export function colorForComplexity(c) {
  if (typeof c === 'string') return COMPLEXITY_COLORS[c] || '#6b7280';
  const deg = approxDegree(c);
  if (deg >= 3) return COMPLEXITY_COLORS.n3;
  if (deg >= 2) return COMPLEXITY_COLORS.n2;
  if (deg >= 1) return COMPLEXITY_COLORS.n_log_n;
  return COMPLEXITY_COLORS.log_n;
}

// ============================================================================
// COMPOUND (multi-symbol) RENDERING
// ============================================================================

const SUPER = { 2: '²', 3: '³', 4: '⁴', 5: '⁵' };

function formatPow(sym, pow) {
  if (pow === 1) return sym;
  if (pow === 0.5) return `√${sym}`;
  if (pow === 1.5) return `${sym}√${sym}`;
  if (Number.isInteger(pow) && SUPER[pow]) return `${sym}${SUPER[pow]}`;
  return `${sym}^${pow}`;
}

function formatLogPow(sym, pow) {
  if (pow === 1) return `log ${sym}`;
  if (SUPER[pow]) return `log${SUPER[pow]} ${sym}`;
  return `log^${pow} ${sym}`;
}

function formatProductTerm(term) {
  const parts = [];
  for (const sym of Object.keys(term.vars || {}).sort()) {
    if (term.vars[sym]) parts.push(formatPow(sym, term.vars[sym]));
  }
  for (const sym of Object.keys(term.logVars || {}).sort()) {
    if (term.logVars[sym]) parts.push(formatLogPow(sym, term.logVars[sym]));
  }
  return parts.length ? parts.join(' · ') : '1';
}

function shortOfCompound(c) {
  if (c.compound === 'product') return formatProductTerm(c);
  if (c.compound === 'sum') return c.terms.map(shortComplexity).join(' + ');
  return '?';
}

export const displayComplexity = c => {
  if (typeof c === 'string') return COMPLEXITY_DISPLAY[c] ?? 'O(?)';
  if (c && (c.compound === 'product' || c.compound === 'sum')) return `O(${shortOfCompound(c)})`;
  return 'O(?)';
};

export const shortComplexity = c => {
  if (typeof c === 'string') return COMPLEXITY_SHORT[c] ?? '?';
  if (c && (c.compound === 'product' || c.compound === 'sum')) return shortOfCompound(c);
  return '?';
};
