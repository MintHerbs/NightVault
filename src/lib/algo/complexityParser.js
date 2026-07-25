// Parse raw Python source into typed line objects
// Also exports expression and range analysers

import { symbolTerm, dominantOf } from './complexityAlgebra.js';

const IDENT = '[A-Za-z_]\\w*';

// ============================================================================
// LINE PARSING
// ============================================================================

export function parseLines(code) {
  const lines = code.split('\n');
  return lines.map((raw, idx) => {
    const stripped = raw.trimStart();
    const indent = raw.length - stripped.length;

    if (stripped === '' || stripped.startsWith('#')) {
      return { lineNum: idx + 1, raw, stripped, indent, kind: 'empty', meta: {} };
    }

    // Apply classification patterns in order
    let match;

    // for_range: for i in range(...)
    match = stripped.match(/^for\s+(\w+)\s+in\s+range\s*\((.+)\)\s*:/);
    if (match) {
      return { lineNum: idx + 1, raw, stripped, indent, kind: 'for_range', meta: { var: match[1], rangeArgs: match[2] } };
    }

    // for_iter: for x in some_list
    match = stripped.match(/^for\s+(\w+)\s+in\s+(.+)\s*:/);
    if (match) {
      return { lineNum: idx + 1, raw, stripped, indent, kind: 'for_iter', meta: { var: match[1], iterable: match[2] } };
    }

    // while
    match = stripped.match(/^while\s+(.+?)\s*:/);
    if (match) {
      return { lineNum: idx + 1, raw, stripped, indent, kind: 'while', meta: { condition: match[1] } };
    }

    // if
    match = stripped.match(/^if\s+(.+?)\s*:/);
    if (match) {
      return { lineNum: idx + 1, raw, stripped, indent, kind: 'if', meta: { condition: match[1] } };
    }

    // elif
    match = stripped.match(/^elif\s+(.+?)\s*:/);
    if (match) {
      return { lineNum: idx + 1, raw, stripped, indent, kind: 'elif', meta: { condition: match[1] } };
    }

    // else
    match = stripped.match(/^else\s*:/);
    if (match) {
      return { lineNum: idx + 1, raw, stripped, indent, kind: 'else', meta: {} };
    }

    // def
    match = stripped.match(/^def\s+(\w+)\s*\(([^)]*)\)\s*:/);
    if (match) {
      return { lineNum: idx + 1, raw, stripped, indent, kind: 'def', meta: { name: match[1], params: match[2] } };
    }

    // update: i *= 2, i //= 2, etc.
    match = stripped.match(/^(\w+)\s*(\*=|\/\/=|\/=|\+=|-=)\s*(.+)/);
    if (match) {
      return { lineNum: idx + 1, raw, stripped, indent, kind: 'update', meta: { var: match[1], op: match[2], value: match[3] } };
    }

    // update: i = i * 2 / i = i + 1 style (same variable on both sides)
    match = stripped.match(/^(\w+)\s*=\s*\1\s*([*/+-])\s*(.+)/);
    if (match) {
      const op = { '*': '*=', '/': '/=', '+': '+=', '-': '-=' }[match[2]];
      return { lineNum: idx + 1, raw, stripped, indent, kind: 'update', meta: { var: match[1], op, value: match[3] } };
    }

    // return
    match = stripped.match(/^return\b\s*(.*)/);
    if (match) {
      return { lineNum: idx + 1, raw, stripped, indent, kind: 'return', meta: { value: match[1] } };
    }

    // assign
    match = stripped.match(/^(\w+)\s*=\s*(.+)/);
    if (match) {
      return { lineNum: idx + 1, raw, stripped, indent, kind: 'assign', meta: { var: match[1], value: match[2] } };
    }

    // stmt: any other line
    return { lineNum: idx + 1, raw, stripped, indent, kind: 'stmt', meta: {} };
  });
}

// ============================================================================
// EXPRESSION ANALYSIS
// ============================================================================

// Returns either:
//   - a bare identifier string (deferred -- the caller resolves it against loop-variable
//     context, or promotes it to a symbol term if it's a genuine size parameter), or
//   - a complexity value (flat key like 'n2', or a symbolTerm(...) compound/flat result).
// True when the outermost '(' of `e` closes at its final character, i.e. the
// whole expression is wrapped in one redundant pair of parens.
function isFullyWrapped(e) {
  if (!e.startsWith('(') || !e.endsWith(')')) return false;
  let depth = 0;
  for (let i = 0; i < e.length; i++) {
    if (e[i] === '(') depth++;
    else if (e[i] === ')') {
      depth--;
      if (depth === 0) return i === e.length - 1;
    }
  }
  return false;
}

// Strips the parts of an expression that don't change its growth rate: a
// trailing +/- constant, redundant parens, and int()/abs() wrappers. Without
// this, `len(arr) - 1` and `int(n**0.5) + 1` fall through every rule and get
// mistaken for variables literally named `len` and `int`.
function normalizeExpr(e) {
  let prev;
  do {
    prev = e;
    if (isFullyWrapped(e)) e = e.slice(1, -1);
    e = e.replace(/^(?:int|abs|float|round)\((.*)\)$/, '$1');
    e = e.replace(/[+-]\d+(?:\.\d+)?$/, '');
  } while (e !== prev && e.length > 0);
  return e;
}

export function analyzeExpression(expr) {
  const e = normalizeExpr(expr.replace(/\s+/g, ''));

  if (e === '') return '1';
  if (/^\d+(\.\d+)?$/.test(e)) return '1';

  // bare identifier -- defer to the caller (resolveExpr) for loop-var substitution
  // or promotion to a symbol term.
  if (new RegExp(`^${IDENT}$`).test(e)) return e;

  let m;

  // X+c, c+X, X-c
  m = e.match(new RegExp(`^(${IDENT})[+-]\\d+$`)) || e.match(new RegExp(`^\\d+\\+(${IDENT})$`));
  if (m) return m[1];

  // c*X, X*c
  m = e.match(new RegExp(`^\\d+\\*(${IDENT})$`)) || e.match(new RegExp(`^(${IDENT})\\*\\d+$`));
  if (m) return m[1];

  // X//c, X/c
  m = e.match(new RegExp(`^(${IDENT})\\/\\/?\\d+$`));
  if (m) return m[1];

  // X**2, X*X
  m = e.match(new RegExp(`^(${IDENT})\\*\\*2$`)) || e.match(new RegExp(`^(${IDENT})\\*\\1$`));
  if (m) return symbolTerm(m[1], 2);

  // X**3
  m = e.match(new RegExp(`^(${IDENT})\\*\\*3$`));
  if (m) return symbolTerm(m[1], 3);

  // X**0.5, X**(0.5), X**(1/2)
  m = e.match(new RegExp(`^(${IDENT})\\*\\*0\\.5$`))
    || e.match(new RegExp(`^(${IDENT})\\*\\*\\(0\\.5\\)$`))
    || e.match(new RegExp(`^(${IDENT})\\*\\*\\(1\\/2\\)$`));
  if (m) return symbolTerm(m[1], 0.5);

  // math.sqrt(X), int(X**0.5)
  m = e.match(new RegExp(`^math\\.sqrt\\((${IDENT})\\)$`)) || e.match(new RegExp(`^int\\((${IDENT})\\*\\*0\\.5\\)$`));
  if (m) return symbolTerm(m[1], 0.5);

  // 2**X, 2^X
  m = e.match(new RegExp(`^\\d+\\*\\*(${IDENT})$`)) || e.match(new RegExp(`^\\d+\\^(${IDENT})$`));
  if (m) return 'exp_n';

  // len(X), len(X.Y)
  m = e.match(new RegExp(`^len\\((${IDENT}(?:\\.${IDENT})*)\\)$`));
  if (m) return m[1];

  // sorted(X), X.sort(
  if (e.startsWith('sorted(') || e.includes('.sort(')) {
    m = e.match(new RegExp(`sorted\\((${IDENT})`)) || e.match(new RegExp(`(${IDENT})\\.sort\\(`));
    const sym = m ? m[1] : 'n';
    return symbolTerm(sym, 1, 1);
  }

  // math.log(X), math.log2(X)
  m = e.match(new RegExp(`^math\\.log2?\\((${IDENT})\\)$`));
  if (m) return symbolTerm(m[1], 0, 1);

  // fallback: pull out the first identifier and assume linear growth in it
  m = e.match(new RegExp(IDENT));
  if (m) return symbolTerm(m[0], 1);

  return '1';
}

// ============================================================================
// ARGUMENT SPLITTING
// ============================================================================

export function splitArgs(argsStr) {
  const args = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if (ch === '(' || ch === '[') {
      depth++;
      current += ch;
    } else if (ch === ')' || ch === ']') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

// ============================================================================
// RANGE ANALYSIS
// ============================================================================

export function analyzeRangeArgs(rangeArgs) {
  const args = splitArgs(rangeArgs);

  if (args.length === 1) {
    // range(stop)
    return analyzeExpression(args[0]);
  } else if (args.length === 2) {
    // range(start, stop)
    return analyzeExpression(args[1]);
  } else if (args.length === 3) {
    // range(start, stop, step) -- may be a descending range (step < 0), where the
    // "n"-like bound can legitimately be either the start or the stop argument
    // (e.g. range(n, 0, -1)). Take whichever side actually grows.
    return dominantOf(analyzeExpression(args[0]), analyzeExpression(args[1]));
  }

  return '1';
}

// ============================================================================
// WHILE CONDITION PARSING
// ============================================================================

// Returns a structured view of the loop condition. Deliberately does NOT decide
// which side is the loop variable: for `j >= 0` or `i > 1` the variable is on the
// left, for `n >= i` it's on the right, and only the loop body reveals which one
// actually changes. The engine makes that call using the body's update lines.
export function parseWhileCondition(condition) {
  const c = condition.replace(/\s+/g, '');

  // i*i <= n / i*i < n -- the loop runs ~sqrt(n) times
  let match = c.match(/^(\w+)\*\1(<=?|>=?|<|>)(.+)$/);
  if (match) {
    return { kind: 'sqrt_product', var: match[1], bound: match[3] };
  }

  // any two-sided comparison; non-greedy left so `j>=0` splits as j / >= / 0
  match = c.match(/^(.+?)(<=|>=|<|>|!=)(.+)$/);
  if (match) {
    return { kind: 'compare', left: match[1], op: match[2], right: match[3] };
  }

  return null;
}
