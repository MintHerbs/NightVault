#!/usr/bin/env node
// Augments the Database Systems notes without rewriting them.
//
//   node scripts/augment-database-notes.mjs
//
// Reads the originals from preview-notes-original/ and writes augmented copies
// to preview-notes/. Every change is an INSERT at a named anchor, never a
// rewrite: the anchor is a line that must already exist in the note, and the
// script fails loudly if it does not, so a note being edited upstream can never
// silently lose its augmentation or get one in the wrong place.
//
// The one exception is lecture-6, which is empty in the database (0 bytes) and
// so is authored here in full.

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const ROOT = new URL('..', import.meta.url)
const SRC = new URL('preview-notes-original/', ROOT)
const OUT = new URL('preview-notes/', ROOT)

/** Insert `text` immediately BEFORE the line that starts with `anchor`. */
const before = (anchor, text) => ({ kind: 'before', anchor, text })
/** Insert `text` immediately AFTER the section that starts with `anchor`,
 *  meaning just before the next heading at the same level or above. */
const afterSection = (anchor, text) => ({ kind: 'afterSection', anchor, text })
/** Replace the whole file. Only for notes that are empty upstream. */
const replaceAll = (text) => ({ kind: 'replaceAll', text })
/** Add to the end of the note. */
const append = (text) => ({ kind: 'append', text })
/** Swap one exact line for another. Used only to correct a factual error. */
const replaceLine = (from, to) => ({ kind: 'replaceLine', from, to })
/** Splice in a file written by one of the figure builders. */
const include = (file) => ({ kind: 'include', file })

const PLAN = {
  'Semester_1_lecture-3-Data Definition Language.md': [
    before(
      '### The three faces of SQL',
      `### The tables we are going to build

Everything in this lecture, and in the three that follow it, is built on one
small database: **DreamHome**, an estate agency with branches, staff, properties
and clients. Rather than meet a new toy table every week, you will watch this
one be created here, be queried in lectures 4 and 5, and have views built over
it in lecture 6.

Two of its tables are enough to start with.

::anim{id="db-dreamhome-schema"}

So the order matters. \`Branch\` has to exist before \`Staff\` can reference it,
which is the first thing the console below will show you.

`
    ),
    afterSection(
      '### Creating tables',
      `Here is that table being built for real. Press **Run** to execute the whole
script, or **Step** to take one statement at a time and read the result before
moving on. This is genuine PostgreSQL running inside your browser, not a
recording: the tables really are created, the rows really are inserted, and the
panels underneath show the actual contents after every statement.

::sqlrun{id="ddl-build-branch-staff"}

Four of those ten statements are :color[rejected]{hex="#c08a2e"}, and that is
the point of them. Each one breaks a different integrity constraint from the
five families above, and what comes back is the error the database itself
raised:

| Statement | Constraint broken | Family |
| :--- | :--- | :--- |
| \`branchNo = 'B999'\` | \`staff_branchno_fkey\` | Referential integrity |
| \`sex = 'Z'\` | \`staff_sex_check\` | Domain constraint |
| A second \`SL21\` | \`staff_pkey\` | Entity integrity |
| \`salary = 5000\` | \`salary_floor\` | General constraint |

Try editing one of them with **Edit SQL** so that it succeeds. That is the
fastest way to convince yourself what each constraint is actually checking.

`
    ),
  ],

  'Semester_1_lecture-4 Data ManIpulation Language.md': [
    afterSection(
      '### Modifying data: INSERT, UPDATE, DELETE',
      `#### Watch it happen

The same \`Staff\` table from lecture 3, with all six rows already in it. Step
through and watch the \`Staff\` panel change after each statement. New rows are
highlighted as they arrive.

::sqlrun{id="dml-insert-update-delete"}

Two things worth stopping on. The \`UPDATE\` with :color[no \`WHERE\` clause]{hex="#ef4444"}
touches **every** row, which is the single most common way to destroy a table by
accident. And the column-list \`INSERT\` leaves \`sex\` and \`DOB\` unset, so
they fall to \`NULL\`, which the full-row form would not have allowed you to do.

`
    ),
  ],

  'Semester_1_lecture-5 Data Manipulation Language.md': [
    before(
      '### Grouping data',
      `### Run every query in this lecture

Every statement below appears in this console, in the order the lecture
introduces them, against the DreamHome data from lecture 3. Step through it
alongside the explanations and compare what you predicted against what Postgres
actually returned.

::sqlrun{id="dml-grouping-and-joins"}

`
    ),
  ],

  'Semester_1_lecture-6 Sql Views Access Privileges.md': [
    replaceAll(`# SQL: Views and Access Privileges

### What a view is

A **view** is a stored *query*, not stored data. It has a name and a column list
like a table, and you select from it like a table, but nothing is copied when
you create one. Every time you query a view the database re-runs the query
underneath it, which is why a view is always current with the tables it draws
from.

That single fact explains almost everything else about views, including the
things that surprise people.

### Creating and using one

\`\`\`
CREATE VIEW Manager3Staff AS
SELECT staffNo, fName, lName, position, salary
FROM   Staff
WHERE  branchNo = 'B003';
\`\`\`

From then on \`Manager3Staff\` can be selected from, joined to, and even built
on by further views, exactly as if it were a table.

::sqlrun{id="views-and-privileges"}

Step 3 in that console is the one to watch. It changes a salary in the
underlying \`Staff\` table, and the very next query of the view shows the new
figure without the view being touched. Nothing propagated; there was never a
copy to propagate to.

### Why views exist

* **Security.** A view can expose some rows and columns while hiding others.
  Granting someone access to a view instead of a table is how you let them see
  what a branch costs in total without letting them see what any one colleague
  earns.
* **Simplicity.** A join across four tables can be given a name once and then
  used as if it were a single table.
* **Insulation.** If the underlying tables are reorganised, a view can be
  redefined to present the old shape, so existing queries keep working.

### Updatable and non-updatable views

Some views can be written through, some cannot. The rule follows from what a
view *is*: the database has to be able to work out exactly which underlying row
your change refers to.

A view is generally **not** updatable if it contains:

* an aggregate function (\`SUM\`, \`COUNT\`, \`AVG\`, \`MIN\`, \`MAX\`)
* \`GROUP BY\` or \`HAVING\`
* \`DISTINCT\`
* a join, in most implementations

The \`BranchSalaries\` view in the console is aggregated, and the attempt to
update it fails with :color[cannot update view]{hex="#c08a2e"}. There is no
single row behind a \`SUM\` to change, so the request has no meaning.

#### WITH CHECK OPTION

An updatable view can still be written through in a way that makes a row vanish
from it. If \`Manager3Staff\` shows only \`branchNo = 'B003'\` and you update a
row's \`branchNo\` to \`'B005'\`, the row leaves the view.

\`\`\`
CREATE VIEW Manager3Staff AS
SELECT staffNo, fName, lName, position, salary, branchNo
FROM   Staff
WHERE  branchNo = 'B003'
WITH CHECK OPTION;
\`\`\`

\`WITH CHECK OPTION\` rejects any insert or update through the view that would
produce a row the view cannot see.

### Dropping a view

\`\`\`
DROP VIEW BranchSalaries;
\`\`\`

This removes the definition only. The rows in \`Staff\` are untouched, which is
the last step in the console and worth confirming for yourself.

### Access privileges

Access control is the **DCL** part of SQL: \`GRANT\` and \`REVOKE\`.

\`\`\`
GRANT SELECT, UPDATE (salary) ON Staff TO PayrollClerk;
GRANT ALL PRIVILEGES ON Branch TO DirectorD WITH GRANT OPTION;
REVOKE SELECT ON Staff FROM PayrollClerk;
\`\`\`

| Privilege | Allows |
| :--- | :--- |
| \`SELECT\` | Read rows |
| \`INSERT\` | Add rows |
| \`UPDATE\` | Change rows, optionally restricted to named columns |
| \`DELETE\` | Remove rows |
| \`REFERENCES\` | Create a foreign key pointing at this table |
| \`ALL PRIVILEGES\` | Every one of the above |

Two clauses matter for exams:

* **\`WITH GRANT OPTION\`** lets the recipient pass the privilege on to others.
  Without it the privilege stops with them.
* **\`REVOKE ... CASCADE\`** withdraws the privilege from anyone the recipient
  passed it on to as well. \`RESTRICT\` refuses the revoke if anyone would be
  affected.

Privileges are granted to **authorization identifiers**, which are usually users
but are more often roles in practice: grant to a role once, then add and remove
people from the role rather than re-granting per person.

### Views and privileges together

The two halves of this lecture are really one idea. A view defines *what* a
subset of the database looks like; a grant defines *who* may see it. Neither is
a security mechanism on its own, and the combination is:

\`\`\`
CREATE VIEW BranchSalaries AS
SELECT branchNo, COUNT(staffNo) AS salCount, SUM(salary) AS mySum
FROM   Staff
GROUP  BY branchNo;

GRANT SELECT ON BranchSalaries TO BranchManager;
\`\`\`

A branch manager can now see totals and headcounts, and has no route at all to
an individual salary, because the only object they hold a privilege on never
exposes one.
`),
  ],

  'Semester_1_lecture-7 Entity Relationship Modelling.md': [
    afterSection(
      '### ERD notation cheat-sheet',
      `The full vocabulary is worth learning as shapes rather than as words,
because an exam question gives you a paragraph of English and expects a picture
back. Step through this and read the outline of each symbol, not just its name.

::anim{id="db-erd-components"}

`
    ),
    append(`
## A full question, worked one sentence at a time

Exam ERD questions are a paragraph of English. The way through is to take one
sentence at a time, decide what it adds, and draw only that before moving on.

Here is a complete question done that way. The sentence being worked on is
:color[highlighted]{hex="#ff5fa2"} and the diagram underneath grows to match it.
Use the controls to stop on a step and check you would have drawn the same thing.

::anim{id="db-erd-stepwise"}

What each sentence was worth:

| Sentence | What it told you |
| :--- | :--- |
| 1 | An entity, a key attribute, and a multivalued attribute |
| 2 | A 1:1 relationship, with total participation on one side |
| 3 | A derived attribute, drawn dashed |
| 4 | A 1:M relationship, total on the many side |
| 5 | An M:N relationship, so the date belongs to the relationship |
| 6 | An ISA hierarchy, marked disjoint |

Two habits worth building from this. Ask "must every one of these take part?"
at every relationship, because that is what decides the double line and it is
the mark most often dropped. And when an attribute will not sit comfortably on
either entity, that is the signal it belongs to the relationship between them.

`),
    include('erd-questions.md'),
  ],

  'Semester_2_lecture-5 Multilevel Indexes & B+-Trees.md': [
    before(
      '## **Checkpoint 1**',
      `## Drawing one, step by step

Before working the checkpoint by hand, watch the same insertion sequence build
itself. Every tree here comes from an implementation of the split rule this
module uses, so it is worth trusting over a hand-drawn attempt.

::anim{id="db-bplus-construction"}

The two rules that decide every step:

* A leaf that would hold more than \`pleaf\` keys **splits**. The left half
  keeps the larger share, and its :color[last key is copied up]{hex="#ff5fa2"}
  to the parent. The key stays in the leaf as well, which is why every key in a
  B+ tree is always reachable in a leaf.
* An internal node that would hold more than \`p - 1\` keys also splits, but its
  :color[middle key moves up]{hex="#a78bfa"} and does **not** stay behind. That
  is the only way the tree gains height.

`
    ),
    // The comparison row for leaf links said "Leaf nodes linked together" on
    // BOTH sides, so the row showed no difference at all. A B-tree does not
    // chain its leaves; that chain is exactly what a B+ tree adds, and it is
    // the reason a range scan on a B+ tree costs one descent plus a walk.
    replaceLine(
      '| Leaf nodes are linked together like a linked list | Leaf nodes linked together                       |',
      '| Leaf nodes are linked together like a linked list | Leaf nodes are **not** linked                     |'
    ),
    afterSection(
      '# **B+ Trees vs B-Trees**',
      `That last row is the one that matters most in practice. Because a B+ tree
chains its leaves, a range query such as "every key between 11 and 29" costs one
descent to find 11 and then a straight walk along the chain. A B-tree has to
climb back up and down again for each step, because there is no sideways link to
follow. It is also why a B+ tree keeps :color[every]{hex="#ff5fa2"} key in the
leaves even when a copy already sits in an internal node: the leaf level has to
be a complete, ordered list on its own.

`
    ),
    // The checkpoint's own worked example is right, but one heading is wrong:
    // the tree printed under "After inserting 23" is the tree after 29, and the
    // real state after 23 is missing. Verified against scripts/anim/bplus.mjs,
    // which reproduces every other step of her example exactly.
    replaceLine(
      '### **After inserting 23**  ',
      `### **After inserting 23**

23 goes into the leaf holding 19, which has room, so nothing splits:

\`\`\`
             [7]
           /     \\
        [3]      [17]
       /  \\      /   \\
 [2 3] [5 7] [11 17] [19 23]
\`\`\`

### **After inserting 29**`
    ),
    append(`
`),
    include('bplus-questions.md'),
  ],

  'Semester_1_lecture-10 Normalisation.md': [
    before(
      '### Starting point: the unnormalized relation (0NF)',
      `### The whole journey, one step at a time

Before the definitions, watch the process happen. This is the \`CARE\` table
used throughout the rest of this note, taken from unnormalised all the way to
3NF. Let it play, or use the controls to stop on a step and read it properly.

::anim{id="db-normalisation-care"}

Colour is doing work in that figure and it is worth learning to read:
:color[the primary key]{hex="#ff5fa2"},
:color[a partial dependency]{hex="#eab308"},
:color[a transitive dependency]{hex="#a78bfa"}, and
:color[the relations that come out]{hex="#22c55e"}.

`
    ),
    append(`
## The method, in five steps

Exam questions hand you a table and its dependencies and ask for 3NF. The same
five steps work every time:

1. **Find the key.** Usually composite. If no single attribute identifies a
   row, the key is the combination that does.
2. **Look for partial dependencies.** Anything determined by *part* of the key
   only. Peel each one off with its determinant, and take with it everything
   that determinant determines.
3. **You are now in 2NF.** Every non-key attribute needs the whole key.
4. **Look for transitive dependencies.** A non-key attribute determined by
   another non-key attribute. Peel those off the same way. They often turn up
   inside a relation step 2 created, not in what is left of the original.
5. **You are now in 3NF.** Every attribute depends on the key, the whole key,
   and nothing but the key.

The mark most often dropped is at step 2. When you move a determinant out, its
own dependants have to travel with it, or you leave an attribute behind in a
relation that no longer contains what determines it.

`),
    include('normalisation-questions.md'),
  ],
}

// ---------------------------------------------------------------- apply

function applyAfterSection(lines, anchor, text) {
  const start = lines.findIndex((l) => l.trim().startsWith(anchor))
  if (start === -1) return -1
  const level = (anchor.match(/^#+/) || ['###'])[0].length
  let end = lines.length
  for (let i = start + 1; i < lines.length; i += 1) {
    const m = lines[i].match(/^(#+)\s/)
    if (m && m[1].length <= level) {
      end = i
      break
    }
  }
  lines.splice(end, 0, ...text.split('\n'))
  return end
}

await mkdir(OUT, { recursive: true })

// First run seeds preview-notes-original/ from whatever is in preview-notes/.
if (!existsSync(SRC)) {
  await mkdir(SRC, { recursive: true })
  for (const name of await readdir(OUT)) {
    await writeFile(new URL(name, SRC), await readFile(new URL(name, OUT), 'utf8'), 'utf8')
  }
  console.log('seeded preview-notes-original/ from preview-notes/')
}

let changed = 0
let failures = 0

for (const name of await readdir(SRC)) {
  const original = await readFile(new URL(name, SRC), 'utf8')
  const key = name.replace(/_/g, ' ').replace(/^Semester (\d) /, 'Semester_$1_')
  const plan = PLAN[name] ?? PLAN[key] ?? null

  if (!plan) {
    await writeFile(new URL(name, OUT), original, 'utf8')
    continue
  }

  let lines = original.split('\n')
  let ok = true

  for (const op of plan) {
    if (op.kind === 'replaceAll') {
      lines = op.text.split('\n')
      continue
    }
    if (op.kind === 'before') {
      const at = lines.findIndex((l) => l.trim().startsWith(op.anchor))
      if (at === -1) {
        console.error(`  MISSING ANCHOR in ${name}: "${op.anchor}"`)
        ok = false
        failures += 1
        continue
      }
      lines.splice(at, 0, ...op.text.split('\n'))
      continue
    }
    if (op.kind === 'afterSection') {
      const at = applyAfterSection(lines, op.anchor, op.text)
      if (at === -1) {
        console.error(`  MISSING ANCHOR in ${name}: "${op.anchor}"`)
        ok = false
        failures += 1
      }
      continue
    }
    if (op.kind === 'append') {
      lines.push(...op.text.split('\n'))
      continue
    }
    if (op.kind === 'replaceLine') {
      const at = lines.findIndex((l) => l === op.from)
      if (at === -1) {
        console.error(`  MISSING LINE in ${name}: ${JSON.stringify(op.from)}`)
        ok = false
        failures += 1
        continue
      }
      lines.splice(at, 1, ...op.to.split('\n'))
      continue
    }
    if (op.kind === 'include') {
      const path = new URL(`generated/${op.file}`, ROOT)
      if (!existsSync(path)) {
        console.error(`  MISSING INCLUDE in ${name}: generated/${op.file} (run the figure builders first)`)
        ok = false
        failures += 1
        continue
      }
      lines.push('', ...(await readFile(path, 'utf8')).split('\n'))
    }
  }

  const out = lines.join('\n')
  await writeFile(new URL(name, OUT), out, 'utf8')
  if (ok) changed += 1
  const delta = out.length - original.length
  console.log(
    `${name.replace(/\.md$/, '').padEnd(56)} ${String(original.length).padStart(6)} -> ${String(out.length).padStart(6)}  ${delta >= 0 ? '+' : ''}${delta}`
  )
}

console.log(`\n${changed} note(s) augmented, ${failures} missing anchor(s).`)
process.exit(failures > 0 ? 1 : 0)
