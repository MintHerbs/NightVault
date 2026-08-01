// src/lib/logic/proofEngine.js
// Forward-chaining proof engine for propositional logic. Pure JS, no React imports.

import { parseFormula } from './formulaParser.js';

/**
 * Converts an AST node back to a canonical string using Unicode symbols.
 * Used for formula equality checking via string comparison.
 * @param {object} node - AST node
 * @returns {string} - normalized formula string
 */
function normalise(node) {
  if (node.type === 'atom') return node.name;
  if (node.type === 'not') return `¬${normalise(node.child)}`;
  
  const left = normalise(node.left);
  const right = normalise(node.right);
  
  // Always add parentheses for binary operators to ensure canonical form
  if (node.type === 'and') return `(${left}∧${right})`;
  if (node.type === 'or') return `(${left}∨${right})`;
  if (node.type === 'implies') return `(${left}→${right})`;
  if (node.type === 'iff') return `(${left}↔${right})`;
  
  throw new Error(`Unknown node type: ${node.type}`);
}

/**
 * Checks if two AST nodes are equal by comparing their normalized strings.
 * @param {object} node1
 * @param {object} node2
 * @returns {boolean}
 */
function formulasEqual(node1, node2) {
  return normalise(node1) === normalise(node2);
}

/**
 * Converts an AST node to a display string (without excessive parentheses).
 * @param {object} node - AST node
 * @returns {string} - formatted formula string
 */
function astToString(node) {
  if (node.type === 'atom') return node.name;
  if (node.type === 'not') return `¬${astToString(node.child)}`;
  
  const left = astToString(node.left);
  const right = astToString(node.right);
  
  // Add parentheses only when needed for clarity
  const needsParens = (n) => n.type !== 'atom' && n.type !== 'not';
  const leftStr = needsParens(node.left) ? `(${left})` : left;
  const rightStr = needsParens(node.right) ? `(${right})` : right;
  
  if (node.type === 'and') return `${leftStr}∧${rightStr}`;
  if (node.type === 'or') return `${leftStr}∨${rightStr}`;
  if (node.type === 'implies') return `${leftStr}→${rightStr}`;
  if (node.type === 'iff') return `${leftStr}↔${rightStr}`;
  
  throw new Error(`Unknown node type: ${node.type}`);
}

/**
 * Calculates the depth of an AST node (for complexity constraints).
 * @param {object} node
 * @returns {number}
 */
function getDepth(node) {
  if (node.type === 'atom') return 0;
  if (node.type === 'not') return 1 + getDepth(node.child);
  return 1 + Math.max(getDepth(node.left), getDepth(node.right));
}

/**
 * Checks if a formula is an atom.
 * @param {object} node
 * @returns {boolean}
 */
function isAtom(node) {
  return node.type === 'atom';
}

/**
 * Checks if a derived formula is useful for reaching the conclusion.
 * A formula is useful if:
 * - It IS the conclusion, OR
 * - It appears as an antecedent in an implication in the KB (f→X exists), OR
 * - It is a literal that appears in a disjunction in the KB
 */
function isUseful(formulaNode, conclusion, knowledgeBase) {
  // Check if it's the conclusion
  if (formulasEqual(formulaNode, conclusion)) {
    return true;
  }
  
  const normalized = normalise(formulaNode);
  
  // Check if any formula in KB has this as an antecedent
  for (const step of knowledgeBase.values()) {
    const kb = step.formulaNode;
    
    // Check if kb is an implication with formulaNode as antecedent
    if (kb.type === 'implies' && formulasEqual(kb.left, formulaNode)) {
      return true;
    }
    
    // Check if formulaNode appears in a disjunction
    if (kb.type === 'or') {
      if (formulasEqual(kb.left, formulaNode) || formulasEqual(kb.right, formulaNode)) {
        return true;
      }
    }
    
    // Check if negation of formulaNode appears (useful for M.T. and D.S.)
    if (formulaNode.type === 'not' && formulasEqual(kb, formulaNode.child)) {
      return true;
    }
    if (kb.type === 'not' && formulasEqual(kb.child, formulaNode)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Runs the forward-chaining proof algorithm.
 * @param {string[]} premisesArray - array of premise formula strings
 * @param {string} conclusionString - target conclusion formula string
 * @returns {object} - { success: boolean, steps: [], error: string | null }
 */
export function runProof(premisesArray, conclusionString) {
  // Parse all premises and conclusion
  let premises;
  let conclusion;
  
  try {
    premises = premisesArray.map(p => parseFormula(p));
    conclusion = parseFormula(conclusionString);
  } catch (err) {
    return {
      success: false,
      steps: [],
      error: `Parse error: ${err.message}`
    };
  }
  
  // Initialize knowledge base with premises
  const knowledgeBase = new Map(); // normalized string -> { id, formula, formulaNode, rule, fromIds, isPremise }
  const steps = [];
  let stepIdCounter = 0;
  
  // Add premises to knowledge base
  for (let i = 0; i < premises.length; i++) {
    const node = premises[i];
    const normalized = normalise(node);
    const step = {
      id: `p${i + 1}`,
      formula: astToString(node),
      formulaNode: node,
      rule: 'Premise',
      fromIds: [],
      isPremise: true
    };
    knowledgeBase.set(normalized, step);
    steps.push(step);
  }
  
  // Check if conclusion is already in premises
  const conclusionNorm = normalise(conclusion);
  if (knowledgeBase.has(conclusionNorm)) {
    return {
      success: true,
      steps,
      error: null
    };
  }
  
  const MAX_STEPS = 20;
  const MAX_ITERATIONS = 50;
  let iteration = 0;
  
  /**
   * Adds a new derived formula to the knowledge base if it's useful.
   * Returns true if the formula was new and useful, false otherwise.
   */
  function addDerivedFormula(formulaNode, rule, fromIds) {
    const normalized = normalise(formulaNode);
    
    if (knowledgeBase.has(normalized)) {
      return false; // Already known
    }
    
    // Check if this formula is useful for reaching the conclusion
    if (!isUseful(formulaNode, conclusion, knowledgeBase)) {
      return false; // Not useful, skip it
    }
    
    const step = {
      id: `s${++stepIdCounter}`,
      formula: astToString(formulaNode),
      formulaNode,
      rule,
      fromIds,
      isPremise: false
    };
    
    knowledgeBase.set(normalized, step);
    steps.push(step);
    
    return true;
  }
  
  /**
   * Gets all formulas from the knowledge base as an array.
   */
  function getAllFormulas() {
    return Array.from(knowledgeBase.values());
  }
  
  // Main forward-chaining loop
  while (iteration < MAX_ITERATIONS) {
    iteration++;
    
    // Check step limit
    if (steps.length > MAX_STEPS) {
      return {
        success: false,
        steps,
        error: 'Proof too long or conclusion not reachable with available rules'
      };
    }
    
    const formulas = getAllFormulas();
    let newFormulaAdded = false;
    
    // Apply rules in preferred order for shortest readable proofs
    
    // Priority 1: Double Negation (simplifies formulas)
    for (const f of formulas) {
      if (f.formulaNode.type === 'not' && f.formulaNode.child.type === 'not') {
        const derived = f.formulaNode.child.child;
        
        if (addDerivedFormula(derived, 'D.N.', [f.id])) {
          newFormulaAdded = true;
          
          if (formulasEqual(derived, conclusion)) {
            return { success: true, steps, error: null };
          }
        }
      }
    }
    
    // Priority 2: Simplification (breaks down conjunctions)
    for (const f of formulas) {
      if (f.formulaNode.type === 'and') {
        const left = f.formulaNode.left;
        const right = f.formulaNode.right;
        
        if (addDerivedFormula(left, 'Simp.', [f.id])) {
          newFormulaAdded = true;
          
          if (formulasEqual(left, conclusion)) {
            return { success: true, steps, error: null };
          }
        }
        
        if (addDerivedFormula(right, 'Simp.', [f.id])) {
          newFormulaAdded = true;
          
          if (formulasEqual(right, conclusion)) {
            return { success: true, steps, error: null };
          }
        }
      }
    }
    
    // Priority 3: Modus Ponens (most common inference)
    for (const f1 of formulas) {
      if (f1.formulaNode.type === 'implies') {
        const antecedent = f1.formulaNode.left;
        const consequent = f1.formulaNode.right;
        
        for (const f2 of formulas) {
          if (formulasEqual(f2.formulaNode, antecedent)) {
            if (addDerivedFormula(consequent, 'M.P.', [f1.id, f2.id])) {
              newFormulaAdded = true;
              
              if (formulasEqual(consequent, conclusion)) {
                return { success: true, steps, error: null };
              }
            }
          }
        }
      }
    }
    
    // Priority 4: Modus Tollens
    for (const f1 of formulas) {
      if (f1.formulaNode.type === 'implies') {
        const antecedent = f1.formulaNode.left;
        const consequent = f1.formulaNode.right;
        
        for (const f2 of formulas) {
          if (f2.formulaNode.type === 'not' && formulasEqual(f2.formulaNode.child, consequent)) {
            const derived = { type: 'not', child: antecedent };
            if (addDerivedFormula(derived, 'M.T.', [f1.id, f2.id])) {
              newFormulaAdded = true;
              
              if (formulasEqual(derived, conclusion)) {
                return { success: true, steps, error: null };
              }
            }
          }
        }
      }
    }
    
    // Priority 5: Hypothetical Syllogism
    for (const f1 of formulas) {
      if (f1.formulaNode.type === 'implies') {
        const p = f1.formulaNode.left;
        const q = f1.formulaNode.right;
        
        for (const f2 of formulas) {
          if (f2.formulaNode.type === 'implies' && formulasEqual(f2.formulaNode.left, q)) {
            const r = f2.formulaNode.right;
            const derived = { type: 'implies', left: p, right: r };
            
            if (addDerivedFormula(derived, 'H.S.', [f1.id, f2.id])) {
              newFormulaAdded = true;
              
              if (formulasEqual(derived, conclusion)) {
                return { success: true, steps, error: null };
              }
            }
          }
        }
      }
    }
    
    // Priority 6: Disjunctive Syllogism
    for (const f1 of formulas) {
      if (f1.formulaNode.type === 'or') {
        const left = f1.formulaNode.left;
        const right = f1.formulaNode.right;
        
        for (const f2 of formulas) {
          if (f2.formulaNode.type === 'not') {
            // ¬P ⊢ Q
            if (formulasEqual(f2.formulaNode.child, left)) {
              if (addDerivedFormula(right, 'D.S.', [f1.id, f2.id])) {
                newFormulaAdded = true;
                
                if (formulasEqual(right, conclusion)) {
                  return { success: true, steps, error: null };
                }
              }
            }
            // ¬Q ⊢ P
            if (formulasEqual(f2.formulaNode.child, right)) {
              if (addDerivedFormula(left, 'D.S.', [f1.id, f2.id])) {
                newFormulaAdded = true;
                
                if (formulasEqual(left, conclusion)) {
                  return { success: true, steps, error: null };
                }
              }
            }
          }
        }
      }
    }
    
    // Priority 7: Biconditional Elimination (last resort)
    for (const f of formulas) {
      if (f.formulaNode.type === 'iff') {
        const left = f.formulaNode.left;
        const right = f.formulaNode.right;
        
        const derived1 = { type: 'implies', left, right };
        if (addDerivedFormula(derived1, 'Bicond. Elim.', [f.id])) {
          newFormulaAdded = true;
          
          if (formulasEqual(derived1, conclusion)) {
            return { success: true, steps, error: null };
          }
        }
        
        const derived2 = { type: 'implies', left: right, right: left };
        if (addDerivedFormula(derived2, 'Bicond. Elim.', [f.id])) {
          newFormulaAdded = true;
          
          if (formulasEqual(derived2, conclusion)) {
            return { success: true, steps, error: null };
          }
        }
      }
    }
    
    // If no new formulas were added in this iteration, we cannot proceed
    if (!newFormulaAdded) {
      return {
        success: false,
        steps,
        error: 'Could not derive conclusion from given premises'
      };
    }
  }
  
  // Exceeded max iterations
  return {
    success: false,
    steps,
    error: 'Proof too long or conclusion not reachable with available rules'
  };
}

// --- TEST ---
(function runTests() {
  const assert = (cond, msg) => { if (!cond) throw new Error(`TEST FAILED: ${msg}`); };
  
  // Test 1: Premises: ["¬S∧C", "¬S→¬W", "¬W→A", "A→E"], conclusion: "E"
  // Should succeed via Simp, M.P., M.P., M.P. (exactly 8 steps: 4 premises + 4 derived)
  const t1 = runProof(['¬S∧C', '¬S→¬W', '¬W→A', 'A→E'], 'E');
  assert(t1.success === true, '1: should succeed');
  assert(t1.error === null, '1: no error');
  const derivedSteps1 = t1.steps.filter(s => !s.isPremise);
  assert(derivedSteps1.length === 4, `1: should have exactly 4 derived steps, got ${derivedSteps1.length}`);
  assert(derivedSteps1[0].rule === 'Simp.', '1: first derived step should be Simp.');
  assert(derivedSteps1.slice(1).every(s => s.rule === 'M.P.'), '1: remaining steps should be M.P.');
  
  // Test 2: Premises: ["P→Q", "Q→R"], conclusion: "P→R"
  // Should succeed via H.S.
  const t2 = runProof(['P→Q', 'Q→R'], 'P→R');
  assert(t2.success === true, '2: should succeed');
  assert(t2.error === null, '2: no error');
  assert(t2.steps.some(s => s.rule === 'H.S.'), '2: uses H.S.');
  
  // Test 3: Premises: ["P∨Q", "¬P"], conclusion: "Q"
  // Should succeed via D.S.
  const t3 = runProof(['P∨Q', '¬P'], 'Q');
  assert(t3.success === true, '3: should succeed');
  assert(t3.error === null, '3: no error');
  assert(t3.steps.some(s => s.rule === 'D.S.'), '3: uses D.S.');
  
  // Test 4: Premises: ["P"], conclusion: "R"
  // Should fail gracefully
  const t4 = runProof(['P'], 'R');
  assert(t4.success === false, '4: should fail');
  assert(t4.error !== null, '4: has error message');
  assert(t4.error.includes('Could not derive') || t4.error.includes('not reachable'), '4: correct error message');
})();
