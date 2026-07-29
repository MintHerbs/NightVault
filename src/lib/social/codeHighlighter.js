const LANGUAGE_ALIASES = {
  auto: 'auto',
  js: 'javascript',
  javascript: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  typescript: 'typescript',
  tsx: 'tsx',
  py: 'python',
  python: 'python',
  java: 'java',
  cpp: 'cpp',
  'c++': 'cpp',
  c: 'c',
  sql: 'sql',
  html: 'html',
  css: 'css',
  json: 'json',
  // Shell transcripts and raw HTTP messages have no keyword set below, so they
  // fall through to the generic tokenizer. They are aliased anyway because
  // getLanguageLabel echoes an unknown language verbatim, which would print a
  // lowercase "bash" in the block header instead of a real label.
  bash: 'bash',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  terminal: 'bash',
  http: 'http',
  text: 'text',
  plaintext: 'text',
  other: 'auto',
}

const LABELS = {
  auto: 'auto',
  javascript: 'JavaScript',
  jsx: 'JSX',
  typescript: 'TypeScript',
  tsx: 'TSX',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
  sql: 'SQL',
  html: 'HTML',
  css: 'CSS',
  json: 'JSON',
  bash: 'Shell',
  http: 'HTTP',
  text: 'Text',
}

const KEYWORDS = {
  javascript: new Set('async await break case catch class const continue default do else export extends finally for from function if import in let new of return switch throw try typeof var void while yield'.split(' ')),
  jsx: new Set('async await break case catch class const continue default do else export extends finally for from function if import in let new of return switch throw try typeof var void while yield'.split(' ')),
  typescript: new Set('abstract any as async await boolean break case catch class const continue default do else enum export extends finally for from function if implements import in interface let namespace new of private protected public readonly return string switch throw try type typeof var void while yield'.split(' ')),
  tsx: new Set('abstract any as async await boolean break case catch class const continue default do else enum export extends finally for from function if implements import in interface let namespace new of private protected public readonly return string switch throw try type typeof var void while yield'.split(' ')),
  python: new Set('and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return self True try while with yield'.split(' ')),
  java: new Set('abstract boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long new null package private protected public return short static super switch this throw throws try void while'.split(' ')),
  cpp: new Set('auto bool break case catch char class const continue default delete do double else enum false float for if include int long namespace new nullptr private protected public return short static std struct switch template this throw true try typedef using void while'.split(' ')),
  c: new Set('auto break case char const continue default do double else enum extern float for if include int long return short signed sizeof static struct switch typedef union unsigned void volatile while'.split(' ')),
  sql: new Set('select from where and or join left right inner outer on group by order having limit insert into update delete create table alter drop values set null not primary key foreign references as distinct'.split(' ')),
  css: new Set('align-items animation background border color display flex font grid height justify-content margin padding position transform transition width'.split(' ')),
}

function score(patterns, value) {
  return patterns.reduce((total, pattern) => total + (pattern.test(value) ? 1 : 0), 0)
}

export function normalizeLanguage(language) {
  const key = String(language || 'auto').trim().toLowerCase()
  return LANGUAGE_ALIASES[key] || key || 'auto'
}

export function getLanguageLabel(language) {
  return LABELS[normalizeLanguage(language)] || String(language || 'Text')
}

export function detectCodeLanguage(code, fallback = 'text') {
  const value = String(code || '')
  if (!value.trim()) return fallback

  const scores = {
    tsx: score([/\binterface\s+\w+/, /\btype\s+\w+\s*=/, /<\w+[^>]*\bclassName=/, /:\s*(string|number|boolean)\b/], value),
    jsx: score([/<\w+[^>]*\bclassName=/, /<\/\w+>/, /\{[A-Za-z_$][\w$]*\}/, /\bReact\b/], value),
    typescript: score([/\binterface\s+\w+/, /\btype\s+\w+\s*=/, /:\s*(string|number|boolean)\b/, /\bimplements\b/], value),
    javascript: score([/\b(const|let|var)\s+\w+/, /=>/, /\bconsole\.log\b/, /\b(import|export)\b/, /\bfunction\s+\w+/], value),
    python: score([/\bdef\s+\w+\s*\(/, /\bclass\s+\w+:/, /\bfrom\s+\w+\s+import\b/, /\bprint\s*\(/, /\bself\b/, /:\s*(#.*)?$/m], value),
    java: score([/\bpublic\s+class\b/, /\bSystem\.out\.println\b/, /\bstatic\s+void\s+main\b/, /\bprivate\s+\w+/, /\bnew\s+\w+\(/], value),
    cpp: score([/#include\s*<[^>]+>/, /\bstd::/, /\bcout\s*<</, /\bcin\s*>>/, /\busing\s+namespace\s+std\b/], value),
    c: score([/#include\s*<[^>]+>/, /\bprintf\s*\(/, /\bscanf\s*\(/, /\bint\s+main\s*\(/], value),
    sql: score([/\bSELECT\b[\s\S]+\bFROM\b/i, /\bJOIN\b/i, /\bWHERE\b/i, /\bINSERT\s+INTO\b/i, /\bCREATE\s+TABLE\b/i], value),
    html: score([/<!doctype html>/i, /<html\b/i, /<div\b/i, /<\/[a-z][\w-]*>/i], value),
    css: score([/[.#][\w-]+\s*\{/, /\b(display|position|color|background|padding|margin)\s*:/, /@media\b/], value),
    json: score([/^\s*\{[\s\S]*"[^"]+"\s*:/, /^\s*\[[\s\S]*\]\s*$/], value),
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
  return best && best[1] > 0 ? best[0] : fallback
}

function tokenType(token, language, nextToken = '') {
  const normalized = normalizeLanguage(language)
  if (/^\/\/|^#|^\/\*/.test(token)) return 'comment'
  if (/^(['"`])[\s\S]*\1$/.test(token)) return 'string'
  if (/^\d+(\.\d+)?$/.test(token)) return 'number'
  if (/^(true|false|null|undefined|None|True|False)$/.test(token)) return 'literal'
  if (KEYWORDS[normalized]?.has(token.toLowerCase())) return 'keyword'
  if (/^[A-Z][A-Za-z0-9_]*$/.test(token) && ['java', 'cpp', 'c', 'typescript', 'tsx'].includes(normalized)) return 'type'
  if (/^[A-Za-z_$][\w$]*$/.test(token) && nextToken === '(') return 'function'
  if (/^<\/?[A-Za-z][\w-]*$/.test(token)) return 'tag'
  if (/^[A-Za-z-]+=$/.test(token)) return 'attr'
  if (/^[{}()[\];,.<>:+\-*/%=!&|?]+$/.test(token)) return 'operator'
  return 'plain'
}

export function tokenizeCodeLine(line, language) {
  const parts = String(line).match(/\/\/.*|#.*|\/\*.*?\*\/|(['"`])(?:\\.|(?!\1).)*\1|<\/?[A-Za-z][\w-]*|[A-Za-z_$][\w$-]*=|\d+\.\d+|\d+|[A-Za-z_$][\w$]*|[{}()[\];,.<>:+\-*/%=!&|?]+|\s+|./g) || []
  return parts.map((value, index) => ({
    value,
    type: /^\s+$/.test(value) ? 'plain' : tokenType(value, language, parts[index + 1]),
  }))
}
