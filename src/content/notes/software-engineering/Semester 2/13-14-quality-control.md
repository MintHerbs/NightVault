<br />

# Quality Control

**PART I — REVIEWS & INSPECTIONS**

## 1. What Quality Control Actually Is

* Quality control is the whole run of inspections, reviews, and tests threaded through the development cycle, all aimed at checking that each work product actually meets what was required of it.

### Verification vs. Validation

* **Verification:** checking whether what came out of a development phase actually satisfies the conditions that phase started with — the IEEE framing of "did we build it right?"
* **Validation:** checking, during or at the end of development, whether the system satisfies the requirements it was meant to meet — "did we build the right thing?"
* Boehm's version of the same split: Verification asks "are we building the product right?"; Validation asks "are we building the right product?"
* V\&V as a category covers a lot of ground — formal technical reviews, quality and configuration audits, performance monitoring, various flavors of testing, feasibility studies, and simulation all fall under it.

### Dynamic vs. Static Analysis

* **Dynamic analysis (testing):** based on behavior during execution — you run the components, you run the software.
* **Static analysis:** based on form, structure, content, or documentation — investigation without running anything. Pencil-and-paper reviews and mathematical modelling both count.
* The two are contrasted directly with each other: dynamic analysis is demonstration/testing; static analysis is inspection/walk-through.

### Where Each Technique Applies Across the Life Cycle

| Life cycle phase    | Dynamic analysis | Static analysis |
| :------------------ | :--------------- | :-------------- |
| Requirements        | <br />           | ✓               |
| Top-level design    | <br />           | ✓               |
| Detailed design     | <br />           | ✓               |
| Implementation      | ✓                | ✓               |
| Integration testing | ✓                | ✓               |
| System validation   | ✓                | <br />          |

Static analysis carries the load early on, when there's nothing running yet to test — dynamic analysis only enters once there's code to execute.

## 2. Reviews and Inspections

* Static analysis techniques break down into: walkthroughs, inspections, and personal reviews on one side, and formal technical reviews on the other.

### Why Bother — Purpose & Objectives

* Verify that the software meets its requirements, follows predefined standards, and is developed in a uniform manner.
* Catch errors sooner, catch more of them, and catch them before the frame of reference for the work is lost.
* Keep projects manageable and identify new risks likely to affect the project.
* Improve communication across organizational boundaries, provide education, and make the software itself more visible.

### Personal Review

* **Features:** informal, done by the producer.
* **Implications:** not objective, available to any developer, and prone to a different mindset — the reviewer needs to review but also wants to declare the product complete, which limits screening efficiency.

### Inspections

* **Features:** the team reviews materials separately; the team and producers then meet to discuss; may cover only selected aspects of the product.
* **Implications:** focus stays on important issues (assuming you know what they are), more material gets covered per meeting, and less preparation time is needed.

### Walkthroughs

* **Features:** less formal; the producer presents or provides information (an educational bent).
* **Implications:** larger groups can attend, more material per meeting, less preparation time.
* **Disadvantage:** harder to separate the product itself from the presenter — explanation and justification tend to blur together with the actual review.

### Walkthrough vs. Inspection

* Inspection is the more formal of the two.
* Inspection is oriented toward corrective action; a walkthrough's findings stay limited to comments on the document under review.
* Inspection findings also feed back into improving development methods generally — walkthrough findings don't.
* Because of that, inspections are considered to contribute more to the overall level of software quality assurance than walkthroughs do.

### The Infrastructure Behind a Real Inspection Program

* Inspection checklists built for each design-document type, plus coding language and tool — kept periodically updated.
* Defect-type frequency tables built from past findings, used to point inspectors at likely "defect concentration areas."
* Training for professionals specifically in inspection-process issues.
* Periodic review of how effective past inspections actually were, to refine the methodology.
* Scheduled inspections built into the project plan, with resources allocated — including resources for fixing what gets found.

### Who Shows Up to a Peer Review

* A review leader.
* The author.
* Specialized professionals.

#### The Review Leader

* Called the "moderator" in inspections and the "coordinator" in walkthroughs — the role barely changes by review type.
* Needs solid experience with the current type of project and its technologies (prior familiarity with this specific project isn't required).
* Needs to maintain a good relationship with the author and the development team, while coming from outside the project team.
* Needs proven experience coordinating and leading professional meetings.
* Inspections additionally require formal training as a moderator.

#### The Author

* Always present — the author takes part in every type of peer review.

#### Specialized Professionals — Inspections

* **A designer:** the systems analyst who did the analysis and design of the system under review.
* **A coder/implementer:** ideally the lead of the coding team — brings expertise toward catching defects that would otherwise become coding errors or implementation headaches.
* **A tester:** ideally the lead of the testing team — focused on catching design errors of the kind that normally only surface during testing.

#### Specialized Professionals — Walkthroughs

* **A standards enforcer:** focused on development standards and procedures, hunting for deviations.
* **A maintenance expert:** focused on maintainability, flexibility, and testability, watching for design defects that would make future fixes or changes harder.
* **A user representative:** internal or external, whose presence strengthens the validity of the walkthrough.

### Modelling Inspections: The ETVX Technique

* ETVX stands for Entry–Task–Validation/Verification–eXit — a structured way to model a software process so every step is clearly defined and has to clear a quality bar before the process moves on.
* Worked example — a software testing process modelled with ETVX:
  * **Entry:** test cases, test environment, and requirements are prepared.
  * **Task:** execute the test cases and log the results.
  * **Validation/Verification:** compare actual results against expected outcomes.
  * **eXit:** a test summary report is generated, defects are logged, and approval is obtained.

### Why Inspections Get Skipped Anyway

* People resist them because they're seen as genuinely hard to do well.
* Management often treats them as pure added cost, missing that they actually cut overall project cost.
* Newer tools and environments compete for attention instead.
* Inspection just isn't as enjoyable an engineering task as designing or coding.
* They're labour-intensive and low-tech.
* Programmers and designers tend to feel possessive about what they've built, which makes external scrutiny unwelcome.

## 3. Static Code Analysis

Ten techniques, each aimed at a different class of defect:

1. Control Flow Analysis
2. Data Flow Analysis
3. Information Flow Analysis
4. Symbolic (Flow) Execution
5. Formal Code Verification
6. Range Checking
7. Stack Usage Analysis
8. Timing Analysis
9. Other Memory Usage Analysis
10. Object Code Analysis

### Control Flow Analysis

* **Conducted to:** confirm code executes in the right sequence, confirm it's well structured, find semantically unreachable code, and flag spots where termination genuinely needs thinking through (loops, recursion).
* **Analyses:** sequencing analysis (checked against the design); call tree analysis (catches dead code, direct recursion, indirect recursion); structure analysis (GOTOs, loop control variable use, placement of exit/return statements, etc.).

### Data Flow Analysis

* **Conducted to:** ensure no execution path leaves software in a state that would break it — every variable that's read has been set, no input-only parameters are set, all output parameters actually get set (for both procedures and functions) — and that global data is shared properly.
* **Analyses:** confirming all data is set before it's used (never used before it's defined); evaluating read-or-write access to variables; identifying data that's shared globally without protection.

### Information Flow Analysis

* **Conducted to:** confirm the dependencies between inputs and outputs match the specification.
* **Analyses:** at the internal-to-a-module level (procedure or function), across modules, and across the entire system.

### Symbolic Execution

* **Conducted to:** verify properties by algebraically manipulating the source text itself.

### Formal Code Verification

* **Conducted to:** prove a program's code is correct relative to the formal specification of its requirements, and explore every possible program execution — something dynamic testing alone can't feasibly do.
* **Analyses:** pre-condition/post-condition analysis, demonstrating a particular safety or security property, termination of every loop and recursion, and proof of the absence of run-time errors.

### Range Checking

* **Conducted to:** ensure data values stay within specified ranges and maintain their specified accuracy.
* **Analyses:** overflow/underflow analysis, range checking, array bounds checking, rounding-error analysis.

### Stack Usage Analysis

* **Conducted to:** ensure there's enough physical memory for the maximum stack size (for each stack), and that stack/heap collision can't happen at run time.
* **Analyses:** verifying stack memory requirements for every subprogram, block, task, or other construct; identifying the system's maximum possible stack size; confirming dynamic heap allocation is prohibited.

### Timing Analysis

* **Conducted to:** confirm the temporal properties of input/output dependencies hold up.
* **Analyses:** worst-case timing analysis, and identifying infinite loops (which is often the actual point of the check).

### Other Memory Usage Analysis

* **Conducted to:** confirm memory usage stays within capacity.
* **Analyses:** heap memory, I/O ports, and special-purpose hardware.

### Object Code Analysis

* **Conducted to:** confirm the object code is a faithful, direct translation of the source code — that no errors crept in from a compiler bug.
* **Analyses:** manual inspection of the critical areas of the object code.

**PART II — SOFTWARE AUDIT**

## 4. What a Software Audit Is

* A software audit is a type of review where auditors who are *not* part of the development organization independently examine a software product, process, or set of processes to check compliance with specifications, standards, contractual agreements, or other criteria.
* Audits are distinct from peer reviews and management reviews.
* They're run by people external to and independent of the development organization, and they focus on compliance — not on the technical content, technical quality, or managerial merits of the work.
* Software audit is described formally in IEEE Std. 1028.

### Who's Involved

* **The Initiator** — could be a manager in the audited organization, a customer/user representative, or a third party. Decides an audit is needed, sets its purpose and scope, specifies evaluation criteria, picks the audit personnel, decides on required follow-up actions, and distributes the audit report.
* **The Lead Auditor** — must be free from bias and influence that could compromise independent, objective judgment. Handles administrative tasks like preparing the audit plan and assembling the team, and ensures the audit actually meets its objectives.
* **The Recorder** — documents anomalies, action items, decisions, and recommendations the audit team makes.
* **The Auditors** — also required to be free of bias, like the Lead Auditor. They examine the products defined in the audit plan, document observations, and recommend corrective action. There may be only a single auditor. They gather evidence of conformance and non-conformance by interviewing the audited organization's staff, examining documents, and witnessing processes directly.
* **The Audited Organization** — provides a liaison to the auditors and supplies whatever information is requested. Once the audit wraps, it's on them to implement the corrective actions and recommendations.

### Core Principles of a Software Audit

* **Timeliness** — audits should be performed frequently, not as a one-off.
* **Source openness** — needs an explicit stance, especially for encrypted programs, on how open-source handling is to be understood.
* **Elaborateness** — audit processes should be held to a certain minimum standard.
* **The financial context** — transparency about whether the software was developed commercially and whether the audit itself was funded commercially (a "paid audit"). It matters whether this is a private hobby or community project versus a commercial company standing behind it.
* **Scientific referencing of learning perspectives** — each audit should describe findings in detail and in context, and highlight both progress and development needs constructively. An auditor isn't the "parent" of the program, but functions more like a mentor if treated as part of a PDCA (Plan–Do–Check–Act) learning loop.
* **Literature-inclusion** — a reader shouldn't rely on a single review's results alone, but judge them within a broader management-system loop that confirms the development team was, and remains, prepared to carry out further analysis.
* **Inclusion of user manuals & documentation** — check whether manuals and technical documentation exist, and whether they're kept up to expanded/current.
* **Identify references to innovations** — e.g., an application combining offline and online messaging (chat and email together) should get high-priority testing. The auditor should highlight innovation-relevant findings and underline where further R\&D is needed.

### Tools

* Parts of a software audit can be handled with static analysis tools that scan application code and score its conformance against standards, guidelines, and best practices.
* Example static code analysis tools: Checkstyle, FindBugs, IntelliJ IDEA.

## 5. Comparing the Three Review Types

| <br />                             | Inspection                                              | Walk-through                                             | Audit                                                                         |
| :--------------------------------- | :------------------------------------------------------ | :------------------------------------------------------- | :---------------------------------------------------------------------------- |
| **Objective**                      | Find anomalies                                          | Find anomalies / examine & improve                       | Evaluate compliance                                                           |
| **Number of members**              | 3–6                                                     | 2–7                                                      | 1–5                                                                           |
| **Material size**                  | Relatively low                                          | Relatively low                                           | Moderate to high                                                              |
| **Leadership**                     | Trained facilitator                                     | Facilitator or author                                    | Lead auditor                                                                  |
| **Management present?**            | No                                                      | No                                                       | Yes                                                                           |
| **Volume of material**             | Low                                                     | Low                                                      | Moderate to high                                                              |
| **Checklist?**                     | Yes                                                     | No                                                       | Yes                                                                           |
| **Output**                         | Defect list                                             | Report                                                   | Defect / audit report                                                         |
| **Presenter**                      | A reader                                                | Author                                                   | Auditors collect and examine information provided by the audited organization |
| **Data collection**                | Strongly recommended                                    | Recommended                                              | Not a formal project requirement; may be done locally                         |
| **Output detail**                  | Anomaly list, anomaly summary, inspection documentation | Anomaly list, action items, decision, follow-up proposal | Formal audit report — observation, feeding deficiencies                       |
| **Formal facilitator training**    | Yes                                                     | No                                                       | Yes (formal auditing training)                                                |
| **Defined participant roles**      | Yes                                                     | Yes                                                      | Yes                                                                           |
| **Use of defect checklists**       | Yes                                                     | No                                                       | Yes                                                                           |
| **Management participates**        | No                                                      | No                                                       | Yes                                                                           |
| **Customer/user rep participates** | Optional                                                | Optional                                                 | Optional                                                                      |

## 6. The Whole Topic in Six Lines

* Quality control runs V\&V — verification asks "did we build it right," validation asks "did we build the right thing."
* Static analysis (paper-based, no execution) and dynamic analysis (testing, requires running code) cover the process from requirements through system validation.
* Reviews and inspections — personal review, inspection, walkthrough — trade off formality, objectivity, and how much they feed back into improving development methods.
* Ten static code analysis techniques dig into specific defect classes: control flow, data flow, information flow, symbolic execution, formal verification, range checking, stack usage, timing, memory usage, and object code.
* A software audit is external, independent, and compliance-focused — distinct from peer or management reviews, with its own Initiator/Lead Auditor/Auditors/Recorder cast and a set of core principles (timeliness, openness, elaborateness, and more).
* Inspections, walkthroughs, and audits differ sharply in group size, leadership, formality, checklist use, and whether management is in the room.
