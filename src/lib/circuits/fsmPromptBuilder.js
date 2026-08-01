/**
 * Builds the Gemini prompt for FSM extraction (T-089 phase 3).
 *
 * The model is asked for the state machine and nothing else. No encoding, no
 * excitation table, no K-maps, no gates: all of that is derivable from the FSM
 * and is done by fsmSynthesis.js, where it can be tested. Asking a model for
 * work that has a right answer is how you get a plausible wrong one.
 *
 * Built server-side from the student's question, never accepted as a prompt, so
 * the endpoint cannot be used as a general-purpose LLM proxy on the project's
 * quota.
 */

export function buildFSMPrompt(question) {
  return `You are converting an exam question into a finite state machine.

Return ONLY JSON matching this shape. No prose, no markdown fences.

{
  "title": "short name for the machine",
  "machineType": "moore" or "mealy",
  "inputs":  [{ "name": "X", "description": "what this input is" }],
  "outputs": [{ "name": "Z", "description": "what this output means" }],
  "reset": "id of the starting state",
  "states": [{ "id": "S0", "label": "what has been seen so far", "output": { "Z": 0 } }],
  "transitions": [{ "from": "S0", "to": "S1", "input": { "X": 1 }, "output": { "Z": 0 } }]
}

Rules that make the machine usable:

1. COMPLETENESS. Every state must have a transition for EVERY combination of
   the input signals. With one input X that is two transitions per state; with
   two inputs it is four. A missing combination makes the machine impossible to
   build, so list them all even when the answer is "stay where you are".

2. DETERMINISM. Never give a state two transitions with the same input values.

3. MOORE vs MEALY. In a Moore machine the output belongs to the STATE: give
   every state an "output" object and leave it off the transitions. In a Mealy
   machine the output belongs to the TRANSITION: give every transition an
   "output" object and leave it off the states. Pick whichever the question
   describes; if it does not say, use Moore.

4. SIGNAL NAMES. Use the letters the question uses. If it does not name them,
   use X for the input and Z for the output. Names must be a letter followed by
   letters or digits, with no spaces.

5. OVERLAP. For a sequence detector, decide from the question whether detections
   may overlap. "1011" seen in "1011011" is two detections if overlapping is
   allowed and one if it is not. Reflect that in where the transitions go after
   a detection.

6. STATE COUNT. Use the fewest states that answer the question. Every state
   should stand for something you can name in its "label", such as "saw 10".

7. Values in "input" and "output" are the numbers 0 and 1, never strings and
   never booleans.

Question:
${question}`
}
