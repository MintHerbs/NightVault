// src/lib/logic/formulaParser.js
// Pure JS recursive descent parser for propositional logic. No React imports.

/**
 * A parse failure that knows where in the input it happened, so the UI can point at the
 * offending span instead of only quoting the message (T-084).
 *
 * @property {number} position - 0-based index into the original string
 * @property {number} length   - how many characters to underline
 * @property {string} hint     - a concrete next action, or '' when there isn't one
 */
export class FormulaError extends Error {
  constructor(message, { position = 0, length = 1, hint = '' } = {}) {
    super(message);
    this.name = 'FormulaError';
    this.position = position;
    this.length = length;
    this.hint = hint;
  }
}

/** Characters offered by the symbol bar that this parser has no meaning for. */
const UNSUPPORTED = {
  '∴': 'The ∴ symbol states a conclusion in an argument. A tableau takes a single formula.',
  '⊤': 'Constants ⊤ and ⊥ are not supported. Use a tautology like P∨¬P, or a contradiction like P∧¬P.',
  '⊥': 'Constants ⊤ and ⊥ are not supported. Use a tautology like P∨¬P, or a contradiction like P∧¬P.',
  ',': 'Enter one formula. Join several with ∧ if you meant all of them at once.'
};

/**
 * Tokenizes a propositional logic string.
 * Atoms: A-Z   Negation: ¬ ~   Conjunction: ∧ &   Disjunction: ∨ |
 * Implication: → ->   Biconditional: ↔ <->   Grouping: ( )
 * Whitespace is silently ignored.
 *
 * Each token carries the source index it started at, so parse errors downstream can be
 * located in the original string.
 */
function tokenize(input) {
  const tokens = [];
  // `at` is the source index the token starts at and `len` how many characters it spans,
  // so a caret can underline `<->` as one thing rather than just its first character.
  const push = (token, at, len = 1) => tokens.push(typeof token === 'object'
    ? { ...token, at, len }
    : { kind: token, at, len });
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '<' && input.slice(i, i + 3) === '<->') {
      push('IFF', i, 3); i += 3;
    } else if (ch === '-' && input[i + 1] === '>') {
      push('IMPLIES', i, 2); i += 2;
    } else if (ch === '¬' || ch === '~') {
      push('NOT', i); i++;
    } else if (ch === '∧' || ch === '&') {
      push('AND', i); i++;
    } else if (ch === '∨' || ch === '|') {
      push('OR', i); i++;
    } else if (ch === '→') {
      push('IMPLIES', i); i++;
    } else if (ch === '↔') {
      push('IFF', i); i++;
    } else if (ch === '(' || ch === ')') {
      push(ch, i); i++;
    } else if (/[A-Z]/.test(ch)) {
      push({ kind: 'ATOM', name: ch }, i); i++;
    } else if (/[a-z]/.test(ch)) {
      throw new FormulaError(`Propositions must be capital letters, so '${ch}' is not one.`, {
        position: i,
        hint: `Write ${ch.toUpperCase()} instead of ${ch}.`
      });
    } else if (UNSUPPORTED[ch]) {
      throw new FormulaError(`'${ch}' cannot be used here.`, { position: i, hint: UNSUPPORTED[ch] });
    } else {
      throw new FormulaError(`'${ch}' is not a logic symbol.`, {
        position: i,
        hint: 'Use propositions A to Z with ¬ ∧ ∨ → ↔ and parentheses.'
      });
    }
  }
  return tokens;
}

/**
 * Parses a token array into an AST.
 *
 * Grammar, precedence lowest to highest:
 *   iff      : implies (IFF implies)*          (left-assoc)
 *   implies  : or (IMPLIES implies)?           (right-assoc)
 *   or       : and (OR and)*                   (left-assoc)
 *   and      : not (AND not)*                  (left-assoc)
 *   not      : NOT not | primary
 *   primary  : ATOM | '(' iff ')'
 */
function parse(tokens, source) {
  let pos = 0;

  function peek() { return tokens[pos]; }
  function consume() { return tokens[pos++]; }

  const SYMBOL = {
    NOT: '¬', AND: '∧', OR: '∨', IMPLIES: '→', IFF: '↔', '(': '(', ')': ')'
  };

  function label(tok) {
    if (tok === undefined) return 'the formula ended';
    if (tok.kind === 'ATOM') return `'${tok.name}'`;
    return `'${SYMBOL[tok.kind]}'`;
  }

  /**
   * The source span to underline for a failure at `tok`. When the input simply ran out
   * there is no token to point at, so it points at the last character instead: the thing
   * that needed something after it.
   */
  function span(tok) {
    if (tok === undefined) {
      return { position: Math.max(0, source.length - 1), length: source.length > 0 ? 1 : 0 };
    }
    return { position: tok.at, length: tok.len };
  }

  function fail(tok, message, hint) {
    throw new FormulaError(message, { ...span(tok), hint });
  }

  function parseIff() {
    let left = parseImplies();
    while (peek()?.kind === 'IFF') {
      consume();
      const right = parseImplies();
      left = { type: 'iff', left, right };
    }
    return left;
  }

  function parseImplies() {
    const left = parseOr();
    if (peek()?.kind === 'IMPLIES') {
      consume();
      const right = parseImplies(); // right-recursive → right-associative
      return { type: 'implies', left, right };
    }
    return left;
  }

  function parseOr() {
    let left = parseAnd();
    while (peek()?.kind === 'OR') {
      consume();
      const right = parseAnd();
      left = { type: 'or', left, right };
    }
    return left;
  }

  function parseAnd() {
    let left = parseNot();
    while (peek()?.kind === 'AND') {
      consume();
      const right = parseNot();
      left = { type: 'and', left, right };
    }
    return left;
  }

  function parseNot() {
    if (peek()?.kind === 'NOT') {
      consume();
      const child = parseNot();
      return { type: 'not', child };
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const tok = peek();

    if (tok?.kind === '(') {
      const open = consume();
      const node = parseIff();
      if (peek()?.kind !== ')') {
        throw new FormulaError('This bracket is never closed.', {
          position: open.at,
          length: 1,
          hint: 'Add a matching ) to the end of the group.'
        });
      }
      consume();
      return node;
    }

    if (tok?.kind === 'ATOM') {
      consume();
      return { type: 'atom', name: tok.name };
    }

    if (tok === undefined) {
      fail(tok, 'The formula stops early: a connective is missing its right-hand side.',
        'Finish it with a proposition, for example P.');
    }

    if (tok.kind === ')') {
      fail(tok, 'This bracket closes a group that has nothing in it.',
        'Put a formula between ( and ), or delete the brackets.');
    }

    fail(tok, `${label(tok)} needs a proposition before it.`,
      'A connective joins two formulas, so something has to sit on each side of it.');
  }

  const root = parseIff();
  if (pos < tokens.length) {
    const tok = tokens[pos];
    if (tok.kind === ')') {
      fail(tok, 'This closing bracket has no opening bracket to match.',
        'Delete it, or add a ( earlier in the formula.');
    }
    fail(tok, `${label(tok)} comes after the formula is already complete.`,
      'Two formulas side by side need a connective between them, such as ∧ or →.');
  }
  return root;
}

/**
 * Parses a propositional logic formula string into an AST.
 *
 * Node shapes:
 *   { type: 'atom', name: 'P' }
 *   { type: 'not',  child: node }
 *   { type: 'and' | 'or' | 'implies' | 'iff', left: node, right: node }
 *
 * @param {string} formula
 * @returns {object} AST root node
 * @throws {FormulaError} on malformed input, carrying position/length/hint
 */
export function parseFormula(formula) {
  if (typeof formula !== 'string' || formula.trim() === '') {
    throw new FormulaError('Enter a formula first.', {
      position: 0,
      length: 0,
      hint: 'For example: ¬(P∧Q)↔(¬P∨¬Q)'
    });
  }
  return parse(tokenize(formula), formula);
}
