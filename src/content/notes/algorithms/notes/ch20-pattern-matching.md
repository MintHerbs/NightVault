# Chapter 20: Pattern Matching

Find every place a short **pattern** appears inside a long **text**. Every editor's find command, every `grep`, every DNA search and every intrusion detector is doing this, usually millions of times a second.

The obvious method works and is too slow. The two classic improvements both come from the same observation, which is worth stating before either algorithm:

:mark[**A failed comparison tells you something. Throwing that away is what makes brute force slow.**]{hex="#1B4A46"}

KMP uses what it learned about the **pattern**. Boyer-Moore uses what it learned about the **text**. That one sentence is the whole chapter.

> The chapter runs on six colours, and each one keeps its meaning to the last page.
>
> | Colour | What it is |
> | --- | --- |
> | **:color[being compared]{hex="#FF5FA2"}** | the pair of characters being looked at now |
> | **:color[matched]{hex="#22C55E"}** | a comparison that succeeded |
> | **:color[mismatched]{hex="#EF4444"}** | the comparison that failed |
> | **:color[already known]{hex="#A78BFA"}** | known to match without comparing it again |
> | **:color[the shift]{hex="#2DD4BF"}** | how far the pattern jumps |
> | **:color[a table entry]{hex="#EAB308"}** | precomputed, before the search starts |

## The problem, exactly

Throughout this chapter the text is `ABABDABACDABABCABAB` and the pattern is `ABABCABAB`.

![A text, a pattern and the single alignment where they match](/notes/img/algorithms/ch20-the-problem.svg)

Two words are used constantly and are worth pinning down:

- A **shift** (or alignment) is a position in the text where the pattern is currently lined up. Shift 0 means the pattern's first character sits over the text's first character.
- A **comparison** means one character against one character. That is the unit everything is counted in, and it is what an exam asks you to total.

There are $n - m + 1$ possible shifts for a text of length $n$ and a pattern of length $m$. Every algorithm here is a different answer to: **after a mismatch, how many of those shifts can be skipped without checking them?**

---

# Brute force

Line the pattern up at shift 0. Compare left to right until either the pattern runs out, which is a match, or a character disagrees. Then slide **one** place and start again from the pattern's first character.

```
for s in 0 .. n - m:
    j = 0
    while j < m and text[s + j] == pat[j]:
        j += 1
    if j == m: report an occurrence at s
```

![An animation of brute force pattern matching sliding one place at a time](/notes/img/algorithms/ch20-brute-force.svg)

On the running example that is **11 alignments** and **29 comparisons** to find one occurrence.

### What is wrong with it

Watch the animation at shift 0. Four characters match, then the fifth fails. Brute force then slides to shift 1 and compares the first character again, having just proved a moment ago what the text says there.

:mark[**Everything learned at one alignment is discarded before the next.**]{hex="#3A3A3E"}

The worst case makes the cost obvious. Take a text of `AAAAAAAAAA` against the pattern `AAAAB`:

every alignment matches 4 characters and then fails on the last one, so it does the maximum work at every position and finds nothing. That is 30 comparisons over 6 alignments, against KMP's 16.

| | Cost |
| --- | --- |
| Best case | :color[O(n)]{hex="#22C55E"}, when the first character usually fails |
| Worst case | **:color[O(n × m)]{hex="#EF4444"}** |
| Extra space | :color[O(1)]{hex="#9CA3AF"} |

It is still worth knowing, and worth using, when the pattern is very short or the text is tiny: there is nothing to precompute and no table to carry around.

---

# Knuth-Morris-Pratt

KMP fixes the waste by asking a question about the **pattern alone**, before it ever looks at the text:

:mark[**If a match fails after j characters, how many of those j characters are still usable?**]{hex="#1B4A46"}

## The failure table

The answer lives in a table with one entry per pattern character. It has several names, all the same thing: the **failure function**, the **prefix function**, or the **LPS array**, for longest proper prefix which is also a suffix.

:mark[**lps[j] = the length of the longest run that is both a prefix and a suffix of pattern[0..j], not counting the whole thing.**]{hex="#3A3A3E"}

![Three entries of the failure table with the repeated prefix and suffix highlighted](/notes/img/algorithms/ch20-lps-idea.svg)

For `ABABCABAB` the table is:

| | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **pattern** | `A` | `B` | `A` | `B` | `C` | `A` | `B` | `A` | `B` |
| **lps** | **0** | **0** | **1** | **2** | **0** | **1** | **2** | **3** | **4** |

Two entries are always worth checking on any table you build:

- **lps[0] is always 0.** A single character has no proper prefix.
- **No entry can be larger than its index.** A run has to be shorter than the thing it sits inside, so lps[j] ≤ j always.

### Building it

![An animation building the KMP failure table from the pattern alone](/notes/img/algorithms/ch20-lps-build.svg)

The build compares the pattern with itself using two pointers: `j` walks forward, and `k` is the length of the run matched so far.

- If `pat[j]` equals `pat[k]`, the run grows: set `lps[j] = k + 1` and move both on.
- If not, and `k` is more than 0, **fall back**: set `k = lps[k-1]` and try again without moving `j`. This is the same jump the search does, applied to the pattern itself.
- If not, and `k` is already 0, there is nowhere to fall back to, so `lps[j] = 0` and move on.

Cost: **:color[O(m)]{hex="#22C55E"}**, and it never touches the text, so it can be built once and reused across every text you search.

## The search

![A KMP mismatch, showing the pattern jumping forward while the text pointer stays put](/notes/img/algorithms/ch20-kmp-jump.svg)

On a mismatch at `pat[j]`, set `j = lps[j-1]` and **leave `i` alone**. The pattern slides forward under a stationary text pointer.

:mark[**The text pointer never moves backwards. Every character of the text is read at most once.**]{hex="#1B4A46"}

That single property is where the guarantee comes from, and it is the answer to "why is KMP linear" in an exam.

![An animation of a KMP search across the text](/notes/img/algorithms/ch20-kmp-search.svg)

On the running example: **23 comparisons**, against brute force's **29**.

> **After a full match, KMP does not stop or restart.** It sets `j = lps[m-1]` and carries on, which is how it finds overlapping occurrences. Searching for `AAA` in `AAAAA` correctly reports three.

| | Cost |
| --- | --- |
| Building the table | :color[O(m)]{hex="#22C55E"} |
| The search | :color[O(n)]{hex="#22C55E"} |
| **Total, worst case** | **:color[O(n + m)]{hex="#22C55E"}** |
| Extra space | :color[O(m)]{hex="#9CA3AF"}, the table |

Note that this is the **worst** case, not an average. KMP has no bad input.

---

# Boyer-Moore

Boyer-Moore makes one change that sounds trivial and is not:

:mark[**Compare the pattern right to left, not left to right.**]{hex="#1B4A46"}

![Boyer-Moore comparing right to left, with its bad character table](/notes/img/algorithms/ch20-bad-character.svg)

The pattern is still aligned left to right along the text, but within an alignment the comparisons start at the **last** character of the pattern. That means a mismatch is usually discovered deep into the alignment, which in turn means the algorithm has learned about a text character far ahead of where the pattern currently starts, and can use it to jump a long way.

## The bad character rule

When `text[s + j]` fails against `pat[j]`, look at the offending text character `c`:

- **If `c` occurs in the pattern**, slide the pattern so its **last** occurrence of `c` lines up with that text position. The shift is `j − last[c]`.
- **If `c` does not occur in the pattern at all**, no alignment that covers this position can possibly match, so slide the pattern **completely past it**.

That second case is the one that makes Boyer-Moore fast on real text, and it is why the algorithm gets **better** as the alphabet gets larger: the more distinct characters there are, the more often the mismatched one is absent from the pattern.

For the pattern `ABABCABAB` the table is the last index of each character:

| Character | `A` | `B` | `C` | anything else |
| --- | --- | --- | --- | --- |
| **Last index** | :color[7]{hex="#EAB308"} | :color[8]{hex="#EAB308"} | :color[4]{hex="#EAB308"} | :color[−1]{hex="#EF4444"} |

> The shift is always taken as **at least 1**. If the rule ever suggests moving backwards, which it can when `c` occurs later in the pattern than the mismatch, ignore it and move one.

## The good suffix rule

The second rule uses the characters that **did** match, at the right hand end of the alignment, before the mismatch.

If a suffix of the pattern has just matched and then a character failed, slide the pattern so that suffix lines up with another copy of itself further left in the pattern. If there is no other copy, slide past it entirely.

:mark[**Boyer-Moore computes both rules and shifts by whichever is larger.**]{hex="#3A3A3E"}

Both are safe on their own, so taking the larger is still safe, and it is what makes the jumps as long as they are. Many courses teach only the bad character rule, in which case the algorithm is usually called **Horspool**. Check which one your paper wants; the trace differs.

## The search

![An animation of a Boyer-Moore search jumping across the text](/notes/img/algorithms/ch20-bm-search.svg)

On the running example: **4 alignments** and **16 comparisons**, against brute force's 11 and 29.

| | Cost |
| --- | --- |
| Best case | **:color[O(n / m)]{hex="#2DD4BF"}**, sublinear: it does not read most of the text |
| Average, ordinary text | :color[O(n / m)]{hex="#2DD4BF"}ish, the reason it is the practical choice |
| Worst case, both rules | :color[O(n + m)]{hex="#22C55E"} |
| Worst case, bad character only | :color[O(n × m)]{hex="#EF4444"} |
| Extra space | :color[O(m + alphabet)]{hex="#9CA3AF"} |

:mark[**Boyer-Moore is the only string search here that can be faster than reading the text.**]{hex="#3A3A3E"} If the pattern is long and the alphabet is wide, most text characters are never looked at at all. That is not a trick of notation, it is genuinely skipping them.

---

# Choosing between them

![Comparison counts for brute force, KMP and Boyer-Moore on the same input](/notes/img/algorithms/ch20-compare.svg)

| | Preprocessing | Search, worst case | Extra space | Reads every character? |
| --- | --- | --- | --- | --- |
| **Brute force** | none | :color[O(n × m)]{hex="#EF4444"} | :color[O(1)]{hex="#9CA3AF"} | yes, repeatedly |
| **KMP** | :color[O(m)]{hex="#22C55E"} | :color[O(n + m)]{hex="#22C55E"} | :color[O(m)]{hex="#9CA3AF"} | yes, once each |
| **Boyer-Moore** | :color[O(m + alphabet)]{hex="#22C55E"} | :color[O(n + m)]{hex="#22C55E"} | :color[O(m + alphabet)]{hex="#9CA3AF"} | **:color[no]{hex="#2DD4BF"}** |

The short version of when to use which:

- **Brute force** when the text is tiny or the pattern is one or two characters. There is nothing to set up.
- **KMP** when you need a **guarantee**, when the alphabet is small (DNA, binary), or when the data arrives as a stream and cannot be re-read. It never backs up over the text.
- **Boyer-Moore** for ordinary text with a large alphabet and a pattern of reasonable length. It is what a real `grep` is built on.

## The marks: what to write down

1. **Build the table first and show it**, for KMP or Boyer-Moore. It is usually worth marks on its own, and a wrong table makes every later step wrong for a reason the examiner can see.
2. **One row per alignment**, or per step for KMP. Give the shift, what matched, and where it failed.
3. **Say which character mismatched and against what.** "pat[4] fails against text[4]" is a whole mark that "mismatch" is not.
4. **For Boyer-Moore, show both rules and which one won.** If the question only taught the bad character rule, say that is the one you are using.
5. **Count comparisons as you go**, not at the end. A running total is much harder to get wrong and shows the working.
6. **State the complexity with the reason.** "O(n + m) because the text pointer never moves backwards" is the answer; the formula alone is half of it.

And the check worth doing: **lps[0] must be 0, and no entry may exceed its own index.** If either fails, the table is wrong and everything after it is too.

---

# 30 practice questions

Every table here was checked against the definition entry by entry, and every search against a direct slice comparison, before it was allowed into the chapter.

| Part | Shape | Questions |
| --- | --- | --- |
| **A** | build the failure table | Q1 to Q12 |
| **B** | trace a search, count comparisons | Q13 to Q22 |
| **C** | Boyer-Moore, table and shifts | Q23 to Q30 |

## Part A: the failure table

The most commonly asked part of this topic, and the fastest marks in it. One of these twelve has an all-zero table, which is worth seeing once.

### Q1. The failure table for `ABAB`

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

**(a)** Construct the **KMP failure table** for the pattern `ABAB`. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** Explain what the entry at index **3** means. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** What does the table cost to build, and does it depend on the text? &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The table.**

Each entry is the length of the longest run that is both a **prefix** and a **suffix** of the pattern up to and including that index. A run cannot be the whole thing, so index 0 is always 0.

| Index | Prefix so far | Longest prefix that is also a suffix | Entry |
| --- | --- | --- | --- |
| 0 | `A` | none | :color[0]{hex="#EAB308"} |
| 1 | `AB` | none | :color[0]{hex="#EAB308"} |
| 2 | `ABA` | `A` | :color[1]{hex="#EAB308"} |
| 3 | `ABAB` | `AB` | :color[2]{hex="#EAB308"} |

| | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| **pattern** | `A` | `B` | `A` | `B` |
| **lps** | **0** | **0** | **1** | **2** |

:mark[**0, 0, 1, 2**]{hex="#204A2E"}

**(b) What index 3 means.**

The entry is **2**. The run **:color[AB]{hex="#2DD4BF"}** both starts and ends `ABAB`. So if a match runs to index 3 and then fails at index 4, those 2 characters are **already known to match** the text, and the pattern can jump so that its first 2 characters sit over them, without comparing them again and without moving back through the text.

:mark[**lps[3] = 2**]{hex="#204A2E"}

**(c) Cost.**

The pattern is compared only against **itself**, in a single pass with a pointer that never goes backwards, so the table costs **:color[O(m)]{hex="#22C55E"}** where $m$ is the pattern length. It does **not** depend on the text at all, which is why it can be built once and reused for every text you search.

### Q2. The failure table for `AABA`

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

**(a)** Construct the **KMP failure table** for the pattern `AABA`. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** Explain what the entry at index **1** means. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** What does the table cost to build, and does it depend on the text? &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The table.**

Each entry is the length of the longest run that is both a **prefix** and a **suffix** of the pattern up to and including that index. A run cannot be the whole thing, so index 0 is always 0.

| Index | Prefix so far | Longest prefix that is also a suffix | Entry |
| --- | --- | --- | --- |
| 0 | `A` | none | :color[0]{hex="#EAB308"} |
| 1 | `AA` | `A` | :color[1]{hex="#EAB308"} |
| 2 | `AAB` | none | :color[0]{hex="#EAB308"} |
| 3 | `AABA` | `A` | :color[1]{hex="#EAB308"} |

| | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| **pattern** | `A` | `A` | `B` | `A` |
| **lps** | **0** | **1** | **0** | **1** |

:mark[**0, 1, 0, 1**]{hex="#204A2E"}

**(b) What index 1 means.**

The entry is **1**. The run **:color[A]{hex="#2DD4BF"}** both starts and ends `AA`. So if a match runs to index 1 and then fails at index 2, those 1 characters are **already known to match** the text, and the pattern can jump so that its first 1 characters sit over them, without comparing them again and without moving back through the text.

:mark[**lps[1] = 1**]{hex="#204A2E"}

**(c) Cost.**

The pattern is compared only against **itself**, in a single pass with a pointer that never goes backwards, so the table costs **:color[O(m)]{hex="#22C55E"}** where $m$ is the pattern length. It does **not** depend on the text at all, which is why it can be built once and reused for every text you search.

### Q3. The failure table for `ABCD`

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

**(a)** Construct the **KMP failure table** for the pattern `ABCD`. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** Explain what the entry at index **0** means. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** What does the table cost to build, and does it depend on the text? &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The table.**

Each entry is the length of the longest run that is both a **prefix** and a **suffix** of the pattern up to and including that index. A run cannot be the whole thing, so index 0 is always 0.

| Index | Prefix so far | Longest prefix that is also a suffix | Entry |
| --- | --- | --- | --- |
| 0 | `A` | none | :color[0]{hex="#EAB308"} |
| 1 | `AB` | none | :color[0]{hex="#EAB308"} |
| 2 | `ABC` | none | :color[0]{hex="#EAB308"} |
| 3 | `ABCD` | none | :color[0]{hex="#EAB308"} |

| | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| **pattern** | `A` | `B` | `C` | `D` |
| **lps** | **0** | **0** | **0** | **0** |

:mark[**0, 0, 0, 0**]{hex="#204A2E"}

**(b) What index 0 means.**

The entry is **0**. Nothing that starts `A` also ends it, so on a mismatch just past here there is nothing already known to match, and the comparison has to restart from the first character of the pattern.

:mark[**lps[0] = 0**]{hex="#204A2E"}

**(c) Cost.**

The pattern is compared only against **itself**, in a single pass with a pointer that never goes backwards, so the table costs **:color[O(m)]{hex="#22C55E"}** where $m$ is the pattern length. It does **not** depend on the text at all, which is why it can be built once and reused for every text you search.

### Q4. The failure table for `ABCAB`

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

**(a)** Construct the **KMP failure table** for the pattern `ABCAB`. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** Explain what the entry at index **4** means. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** What does the table cost to build, and does it depend on the text? &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The table.**

Each entry is the length of the longest run that is both a **prefix** and a **suffix** of the pattern up to and including that index. A run cannot be the whole thing, so index 0 is always 0.

| Index | Prefix so far | Longest prefix that is also a suffix | Entry |
| --- | --- | --- | --- |
| 0 | `A` | none | :color[0]{hex="#EAB308"} |
| 1 | `AB` | none | :color[0]{hex="#EAB308"} |
| 2 | `ABC` | none | :color[0]{hex="#EAB308"} |
| 3 | `ABCA` | `A` | :color[1]{hex="#EAB308"} |
| 4 | `ABCAB` | `AB` | :color[2]{hex="#EAB308"} |

| | 0 | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- | --- |
| **pattern** | `A` | `B` | `C` | `A` | `B` |
| **lps** | **0** | **0** | **0** | **1** | **2** |

:mark[**0, 0, 0, 1, 2**]{hex="#204A2E"}

**(b) What index 4 means.**

The entry is **2**. The run **:color[AB]{hex="#2DD4BF"}** both starts and ends `ABCAB`. So if a match runs to index 4 and then fails at index 5, those 2 characters are **already known to match** the text, and the pattern can jump so that its first 2 characters sit over them, without comparing them again and without moving back through the text.

:mark[**lps[4] = 2**]{hex="#204A2E"}

**(c) Cost.**

The pattern is compared only against **itself**, in a single pass with a pointer that never goes backwards, so the table costs **:color[O(m)]{hex="#22C55E"}** where $m$ is the pattern length. It does **not** depend on the text at all, which is why it can be built once and reused for every text you search.

### Q5. The failure table for `ABABCA`

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

**(a)** Construct the **KMP failure table** for the pattern `ABABCA`. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** Explain what the entry at index **3** means. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** What does the table cost to build, and does it depend on the text? &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The table.**

Each entry is the length of the longest run that is both a **prefix** and a **suffix** of the pattern up to and including that index. A run cannot be the whole thing, so index 0 is always 0.

| Index | Prefix so far | Longest prefix that is also a suffix | Entry |
| --- | --- | --- | --- |
| 0 | `A` | none | :color[0]{hex="#EAB308"} |
| 1 | `AB` | none | :color[0]{hex="#EAB308"} |
| 2 | `ABA` | `A` | :color[1]{hex="#EAB308"} |
| 3 | `ABAB` | `AB` | :color[2]{hex="#EAB308"} |
| 4 | `ABABC` | none | :color[0]{hex="#EAB308"} |
| 5 | `ABABCA` | `A` | :color[1]{hex="#EAB308"} |

| | 0 | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- | --- |
| **pattern** | `A` | `B` | `A` | `B` | `C` | `A` |
| **lps** | **0** | **0** | **1** | **2** | **0** | **1** |

:mark[**0, 0, 1, 2, 0, 1**]{hex="#204A2E"}

**(b) What index 3 means.**

The entry is **2**. The run **:color[AB]{hex="#2DD4BF"}** both starts and ends `ABAB`. So if a match runs to index 3 and then fails at index 4, those 2 characters are **already known to match** the text, and the pattern can jump so that its first 2 characters sit over them, without comparing them again and without moving back through the text.

:mark[**lps[3] = 2**]{hex="#204A2E"}

**(c) Cost.**

The pattern is compared only against **itself**, in a single pass with a pointer that never goes backwards, so the table costs **:color[O(m)]{hex="#22C55E"}** where $m$ is the pattern length. It does **not** depend on the text at all, which is why it can be built once and reused for every text you search.

### Q6. The failure table for `AABAACAA`

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

**(a)** Construct the **KMP failure table** for the pattern `AABAACAA`. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** Explain what the entry at index **4** means. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** What does the table cost to build, and does it depend on the text? &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The table.**

Each entry is the length of the longest run that is both a **prefix** and a **suffix** of the pattern up to and including that index. A run cannot be the whole thing, so index 0 is always 0.

| Index | Prefix so far | Longest prefix that is also a suffix | Entry |
| --- | --- | --- | --- |
| 0 | `A` | none | :color[0]{hex="#EAB308"} |
| 1 | `AA` | `A` | :color[1]{hex="#EAB308"} |
| 2 | `AAB` | none | :color[0]{hex="#EAB308"} |
| 3 | `AABA` | `A` | :color[1]{hex="#EAB308"} |
| 4 | `AABAA` | `AA` | :color[2]{hex="#EAB308"} |
| 5 | `AABAAC` | none | :color[0]{hex="#EAB308"} |
| 6 | `AABAACA` | `A` | :color[1]{hex="#EAB308"} |
| 7 | `AABAACAA` | `AA` | :color[2]{hex="#EAB308"} |

| | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **pattern** | `A` | `A` | `B` | `A` | `A` | `C` | `A` | `A` |
| **lps** | **0** | **1** | **0** | **1** | **2** | **0** | **1** | **2** |

:mark[**0, 1, 0, 1, 2, 0, 1, 2**]{hex="#204A2E"}

**(b) What index 4 means.**

The entry is **2**. The run **:color[AA]{hex="#2DD4BF"}** both starts and ends `AABAA`. So if a match runs to index 4 and then fails at index 5, those 2 characters are **already known to match** the text, and the pattern can jump so that its first 2 characters sit over them, without comparing them again and without moving back through the text.

:mark[**lps[4] = 2**]{hex="#204A2E"}

**(c) Cost.**

The pattern is compared only against **itself**, in a single pass with a pointer that never goes backwards, so the table costs **:color[O(m)]{hex="#22C55E"}** where $m$ is the pattern length. It does **not** depend on the text at all, which is why it can be built once and reused for every text you search.

### Q7. The failure table for `ABACABAD`

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

**(a)** Construct the **KMP failure table** for the pattern `ABACABAD`. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** Explain what the entry at index **6** means. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** What does the table cost to build, and does it depend on the text? &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The table.**

Each entry is the length of the longest run that is both a **prefix** and a **suffix** of the pattern up to and including that index. A run cannot be the whole thing, so index 0 is always 0.

| Index | Prefix so far | Longest prefix that is also a suffix | Entry |
| --- | --- | --- | --- |
| 0 | `A` | none | :color[0]{hex="#EAB308"} |
| 1 | `AB` | none | :color[0]{hex="#EAB308"} |
| 2 | `ABA` | `A` | :color[1]{hex="#EAB308"} |
| 3 | `ABAC` | none | :color[0]{hex="#EAB308"} |
| 4 | `ABACA` | `A` | :color[1]{hex="#EAB308"} |
| 5 | `ABACAB` | `AB` | :color[2]{hex="#EAB308"} |
| 6 | `ABACABA` | `ABA` | :color[3]{hex="#EAB308"} |
| 7 | `ABACABAD` | none | :color[0]{hex="#EAB308"} |

| | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **pattern** | `A` | `B` | `A` | `C` | `A` | `B` | `A` | `D` |
| **lps** | **0** | **0** | **1** | **0** | **1** | **2** | **3** | **0** |

:mark[**0, 0, 1, 0, 1, 2, 3, 0**]{hex="#204A2E"}

**(b) What index 6 means.**

The entry is **3**. The run **:color[ABA]{hex="#2DD4BF"}** both starts and ends `ABACABA`. So if a match runs to index 6 and then fails at index 7, those 3 characters are **already known to match** the text, and the pattern can jump so that its first 3 characters sit over them, without comparing them again and without moving back through the text.

:mark[**lps[6] = 3**]{hex="#204A2E"}

**(c) Cost.**

The pattern is compared only against **itself**, in a single pass with a pointer that never goes backwards, so the table costs **:color[O(m)]{hex="#22C55E"}** where $m$ is the pattern length. It does **not** depend on the text at all, which is why it can be built once and reused for every text you search.

### Q8. The failure table for `ABABCABAB`

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

**(a)** Construct the **KMP failure table** for the pattern `ABABCABAB`. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** Explain what the entry at index **8** means. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** What does the table cost to build, and does it depend on the text? &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The table.**

Each entry is the length of the longest run that is both a **prefix** and a **suffix** of the pattern up to and including that index. A run cannot be the whole thing, so index 0 is always 0.

| Index | Prefix so far | Longest prefix that is also a suffix | Entry |
| --- | --- | --- | --- |
| 0 | `A` | none | :color[0]{hex="#EAB308"} |
| 1 | `AB` | none | :color[0]{hex="#EAB308"} |
| 2 | `ABA` | `A` | :color[1]{hex="#EAB308"} |
| 3 | `ABAB` | `AB` | :color[2]{hex="#EAB308"} |
| 4 | `ABABC` | none | :color[0]{hex="#EAB308"} |
| 5 | `ABABCA` | `A` | :color[1]{hex="#EAB308"} |
| 6 | `ABABCAB` | `AB` | :color[2]{hex="#EAB308"} |
| 7 | `ABABCABA` | `ABA` | :color[3]{hex="#EAB308"} |
| 8 | `ABABCABAB` | `ABAB` | :color[4]{hex="#EAB308"} |

| | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **pattern** | `A` | `B` | `A` | `B` | `C` | `A` | `B` | `A` | `B` |
| **lps** | **0** | **0** | **1** | **2** | **0** | **1** | **2** | **3** | **4** |

:mark[**0, 0, 1, 2, 0, 1, 2, 3, 4**]{hex="#204A2E"}

**(b) What index 8 means.**

The entry is **4**. The run **:color[ABAB]{hex="#2DD4BF"}** both starts and ends `ABABCABAB`. So if a match runs to index 8 and then fails at index 9, those 4 characters are **already known to match** the text, and the pattern can jump so that its first 4 characters sit over them, without comparing them again and without moving back through the text.

:mark[**lps[8] = 4**]{hex="#204A2E"}

**(c) Cost.**

The pattern is compared only against **itself**, in a single pass with a pointer that never goes backwards, so the table costs **:color[O(m)]{hex="#22C55E"}** where $m$ is the pattern length. It does **not** depend on the text at all, which is why it can be built once and reused for every text you search.

### Q9. The failure table for `AAABAAAB`

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

**(a)** Construct the **KMP failure table** for the pattern `AAABAAAB`. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** Explain what the entry at index **7** means. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** What does the table cost to build, and does it depend on the text? &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The table.**

Each entry is the length of the longest run that is both a **prefix** and a **suffix** of the pattern up to and including that index. A run cannot be the whole thing, so index 0 is always 0.

| Index | Prefix so far | Longest prefix that is also a suffix | Entry |
| --- | --- | --- | --- |
| 0 | `A` | none | :color[0]{hex="#EAB308"} |
| 1 | `AA` | `A` | :color[1]{hex="#EAB308"} |
| 2 | `AAA` | `AA` | :color[2]{hex="#EAB308"} |
| 3 | `AAAB` | none | :color[0]{hex="#EAB308"} |
| 4 | `AAABA` | `A` | :color[1]{hex="#EAB308"} |
| 5 | `AAABAA` | `AA` | :color[2]{hex="#EAB308"} |
| 6 | `AAABAAA` | `AAA` | :color[3]{hex="#EAB308"} |
| 7 | `AAABAAAB` | `AAAB` | :color[4]{hex="#EAB308"} |

| | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **pattern** | `A` | `A` | `A` | `B` | `A` | `A` | `A` | `B` |
| **lps** | **0** | **1** | **2** | **0** | **1** | **2** | **3** | **4** |

:mark[**0, 1, 2, 0, 1, 2, 3, 4**]{hex="#204A2E"}

**(b) What index 7 means.**

The entry is **4**. The run **:color[AAAB]{hex="#2DD4BF"}** both starts and ends `AAABAAAB`. So if a match runs to index 7 and then fails at index 8, those 4 characters are **already known to match** the text, and the pattern can jump so that its first 4 characters sit over them, without comparing them again and without moving back through the text.

:mark[**lps[7] = 4**]{hex="#204A2E"}

**(c) Cost.**

The pattern is compared only against **itself**, in a single pass with a pointer that never goes backwards, so the table costs **:color[O(m)]{hex="#22C55E"}** where $m$ is the pattern length. It does **not** depend on the text at all, which is why it can be built once and reused for every text you search.

### Q10. The failure table for `ABCABCABD`

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

**(a)** Construct the **KMP failure table** for the pattern `ABCABCABD`. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** Explain what the entry at index **7** means. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** What does the table cost to build, and does it depend on the text? &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The table.**

Each entry is the length of the longest run that is both a **prefix** and a **suffix** of the pattern up to and including that index. A run cannot be the whole thing, so index 0 is always 0.

| Index | Prefix so far | Longest prefix that is also a suffix | Entry |
| --- | --- | --- | --- |
| 0 | `A` | none | :color[0]{hex="#EAB308"} |
| 1 | `AB` | none | :color[0]{hex="#EAB308"} |
| 2 | `ABC` | none | :color[0]{hex="#EAB308"} |
| 3 | `ABCA` | `A` | :color[1]{hex="#EAB308"} |
| 4 | `ABCAB` | `AB` | :color[2]{hex="#EAB308"} |
| 5 | `ABCABC` | `ABC` | :color[3]{hex="#EAB308"} |
| 6 | `ABCABCA` | `ABCA` | :color[4]{hex="#EAB308"} |
| 7 | `ABCABCAB` | `ABCAB` | :color[5]{hex="#EAB308"} |
| 8 | `ABCABCABD` | none | :color[0]{hex="#EAB308"} |

| | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **pattern** | `A` | `B` | `C` | `A` | `B` | `C` | `A` | `B` | `D` |
| **lps** | **0** | **0** | **0** | **1** | **2** | **3** | **4** | **5** | **0** |

:mark[**0, 0, 0, 1, 2, 3, 4, 5, 0**]{hex="#204A2E"}

**(b) What index 7 means.**

The entry is **5**. The run **:color[ABCAB]{hex="#2DD4BF"}** both starts and ends `ABCABCAB`. So if a match runs to index 7 and then fails at index 8, those 5 characters are **already known to match** the text, and the pattern can jump so that its first 5 characters sit over them, without comparing them again and without moving back through the text.

:mark[**lps[7] = 5**]{hex="#204A2E"}

**(c) Cost.**

The pattern is compared only against **itself**, in a single pass with a pointer that never goes backwards, so the table costs **:color[O(m)]{hex="#22C55E"}** where $m$ is the pattern length. It does **not** depend on the text at all, which is why it can be built once and reused for every text you search.

### Q11. The failure table for `AABAABAAA`

> :mark[**Very hard**]{hex="#5C2323"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

**(a)** Construct the **KMP failure table** for the pattern `AABAABAAA`. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** Explain what the entry at index **7** means. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** What does the table cost to build, and does it depend on the text? &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The table.**

Each entry is the length of the longest run that is both a **prefix** and a **suffix** of the pattern up to and including that index. A run cannot be the whole thing, so index 0 is always 0.

| Index | Prefix so far | Longest prefix that is also a suffix | Entry |
| --- | --- | --- | --- |
| 0 | `A` | none | :color[0]{hex="#EAB308"} |
| 1 | `AA` | `A` | :color[1]{hex="#EAB308"} |
| 2 | `AAB` | none | :color[0]{hex="#EAB308"} |
| 3 | `AABA` | `A` | :color[1]{hex="#EAB308"} |
| 4 | `AABAA` | `AA` | :color[2]{hex="#EAB308"} |
| 5 | `AABAAB` | `AAB` | :color[3]{hex="#EAB308"} |
| 6 | `AABAABA` | `AABA` | :color[4]{hex="#EAB308"} |
| 7 | `AABAABAA` | `AABAA` | :color[5]{hex="#EAB308"} |
| 8 | `AABAABAAA` | `AA` | :color[2]{hex="#EAB308"} |

| | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **pattern** | `A` | `A` | `B` | `A` | `A` | `B` | `A` | `A` | `A` |
| **lps** | **0** | **1** | **0** | **1** | **2** | **3** | **4** | **5** | **2** |

:mark[**0, 1, 0, 1, 2, 3, 4, 5, 2**]{hex="#204A2E"}

**(b) What index 7 means.**

The entry is **5**. The run **:color[AABAA]{hex="#2DD4BF"}** both starts and ends `AABAABAA`. So if a match runs to index 7 and then fails at index 8, those 5 characters are **already known to match** the text, and the pattern can jump so that its first 5 characters sit over them, without comparing them again and without moving back through the text.

:mark[**lps[7] = 5**]{hex="#204A2E"}

**(c) Cost.**

The pattern is compared only against **itself**, in a single pass with a pointer that never goes backwards, so the table costs **:color[O(m)]{hex="#22C55E"}** where $m$ is the pattern length. It does **not** depend on the text at all, which is why it can be built once and reused for every text you search.

### Q12. The failure table for `ABAABABABA`

> :mark[**Very hard**]{hex="#5C2323"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

**(a)** Construct the **KMP failure table** for the pattern `ABAABABABA`. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** Explain what the entry at index **5** means. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** What does the table cost to build, and does it depend on the text? &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The table.**

Each entry is the length of the longest run that is both a **prefix** and a **suffix** of the pattern up to and including that index. A run cannot be the whole thing, so index 0 is always 0.

| Index | Prefix so far | Longest prefix that is also a suffix | Entry |
| --- | --- | --- | --- |
| 0 | `A` | none | :color[0]{hex="#EAB308"} |
| 1 | `AB` | none | :color[0]{hex="#EAB308"} |
| 2 | `ABA` | `A` | :color[1]{hex="#EAB308"} |
| 3 | `ABAA` | `A` | :color[1]{hex="#EAB308"} |
| 4 | `ABAAB` | `AB` | :color[2]{hex="#EAB308"} |
| 5 | `ABAABA` | `ABA` | :color[3]{hex="#EAB308"} |
| 6 | `ABAABAB` | `AB` | :color[2]{hex="#EAB308"} |
| 7 | `ABAABABA` | `ABA` | :color[3]{hex="#EAB308"} |
| 8 | `ABAABABAB` | `AB` | :color[2]{hex="#EAB308"} |
| 9 | `ABAABABABA` | `ABA` | :color[3]{hex="#EAB308"} |

| | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **pattern** | `A` | `B` | `A` | `A` | `B` | `A` | `B` | `A` | `B` | `A` |
| **lps** | **0** | **0** | **1** | **1** | **2** | **3** | **2** | **3** | **2** | **3** |

:mark[**0, 0, 1, 1, 2, 3, 2, 3, 2, 3**]{hex="#204A2E"}

**(b) What index 5 means.**

The entry is **3**. The run **:color[ABA]{hex="#2DD4BF"}** both starts and ends `ABAABA`. So if a match runs to index 5 and then fails at index 6, those 3 characters are **already known to match** the text, and the pattern can jump so that its first 3 characters sit over them, without comparing them again and without moving back through the text.

:mark[**lps[5] = 3**]{hex="#204A2E"}

**(c) Cost.**

The pattern is compared only against **itself**, in a single pass with a pointer that never goes backwards, so the table costs **:color[O(m)]{hex="#22C55E"}** where $m$ is the pattern length. It does **not** depend on the text at all, which is why it can be built once and reused for every text you search.

## Part B: trace a search

Brute force or KMP, named in the question. Two of these have no occurrence at all, and several have more than one.

### Q13. Trace brute force

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

**Text:** `A B A B A B C` &nbsp; (7 characters)

**Pattern:** `A B A B C` &nbsp; (5 characters)

**(i)** Trace **brute force** over the text. Give every occurrence and count the character comparisons. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(ii)** State the worst case time complexity of brute force. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The trace.**

Every alignment is tried in turn, left to right, and each one starts again from the pattern's first character.

| Shift | Matched | Outcome |
| --- | --- | --- |
| 0 | 4 | 4 matched, then :color[pat[4] fails against text[4]]{hex="#EF4444"} |
| 1 | 0 | :color[pat[0] fails at once]{hex="#EF4444"} |
| 2 | 5 | :color[all 5 match, occurrence]{hex="#22C55E"} |

:mark[**1 occurrence, at shift 2. 11 character comparisons.**]{hex="#204A2E"}

> For comparison on this same input: brute force takes **11** comparisons, KMP **8**, Boyer-Moore **6**.

**(ii) Complexity.**

There are $n - m + 1$ alignments and each may compare up to $m$ characters, so the worst case is **:color[O(n × m)]{hex="#EF4444"}**. It is reached when the pattern almost matches everywhere, such as a text of all `A` against a pattern of `AAAB`.

### Q14. Trace brute force

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

**Text:** `A A B A A C A A D A A B A A B A` &nbsp; (16 characters)

**Pattern:** `A A B A` &nbsp; (4 characters)

**(i)** Trace **brute force** over the text. Give every occurrence and count the character comparisons. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(ii)** State the worst case time complexity of brute force. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The trace.**

Every alignment is tried in turn, left to right, and each one starts again from the pattern's first character.

| Shift | Matched | Outcome |
| --- | --- | --- |
| 0 | 4 | :color[all 4 match, occurrence]{hex="#22C55E"} |
| 1 | 1 | 1 matched, then :color[pat[1] fails against text[2]]{hex="#EF4444"} |
| 2 | 0 | :color[pat[0] fails at once]{hex="#EF4444"} |
| 3 | 2 | 2 matched, then :color[pat[2] fails against text[5]]{hex="#EF4444"} |
| 4 | 1 | 1 matched, then :color[pat[1] fails against text[5]]{hex="#EF4444"} |
| 5 | 0 | :color[pat[0] fails at once]{hex="#EF4444"} |
| 6 | 2 | 2 matched, then :color[pat[2] fails against text[8]]{hex="#EF4444"} |
| 7 | 1 | 1 matched, then :color[pat[1] fails against text[8]]{hex="#EF4444"} |
| 8 | 0 | :color[pat[0] fails at once]{hex="#EF4444"} |
| 9 | 4 | :color[all 4 match, occurrence]{hex="#22C55E"} |
| 10 | 1 | 1 matched, then :color[pat[1] fails against text[11]]{hex="#EF4444"} |
| 11 | 0 | :color[pat[0] fails at once]{hex="#EF4444"} |
| 12 | 4 | :color[all 4 match, occurrence]{hex="#22C55E"} |

:mark[**3 occurrences, at shifts 0, 9, 12. 30 character comparisons.**]{hex="#204A2E"}

> For comparison on this same input: brute force takes **30** comparisons, KMP **20**, Boyer-Moore **16**.

**(ii) Complexity.**

There are $n - m + 1$ alignments and each may compare up to $m$ characters, so the worst case is **:color[O(n × m)]{hex="#EF4444"}**. It is reached when the pattern almost matches everywhere, such as a text of all `A` against a pattern of `AAAB`.

### Q15. Trace KMP

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**14 marks**]{hex="#3A3A3E"}

**Text:** `A B A B D A B A C D A B A B C A B A B` &nbsp; (19 characters)

**Pattern:** `A B A B C A B A B` &nbsp; (9 characters)

**(i)** State the failure table for the pattern. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Trace **KMP** over the text. Give every occurrence and count the character comparisons. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(iii)** State the worst case time complexity of KMP. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The failure table.**

| | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **pattern** | `A` | `B` | `A` | `B` | `C` | `A` | `B` | `A` | `B` |
| **lps** | **0** | **0** | **1** | **2** | **0** | **1** | **2** | **3** | **4** |

**(ii) The trace.**

`i` walks the text and never goes backwards. `j` walks the pattern and falls back to the failure table on a mismatch.

| Step | i | j | What happens |
| --- | --- | --- | --- |
| 1 | 0 | 0 | :color[text[0] = 'A' matches pat[0]]{hex="#22C55E"} |
| 2 | 1 | 1 | :color[text[1] = 'B' matches pat[1]]{hex="#22C55E"} |
| 3 | 2 | 2 | :color[text[2] = 'A' matches pat[2]]{hex="#22C55E"} |
| 4 | 3 | 3 | :color[text[3] = 'B' matches pat[3]]{hex="#22C55E"} |
| 5 | 4 | 4 | :color[mismatch at pat[4]; jump j to lps[3] = 2 without moving i, because the first 2 characters are known to match already]{hex="#A78BFA"} |
| 6 | 4 | 2 | :color[mismatch at pat[2]; jump j to lps[1] = 0 without moving i, because the first 0 characters are known to match already]{hex="#A78BFA"} |
| 7 | 4 | 0 | :color[text[4] = 'D' does not match pat[0], and j is already 0, so advance the text by one]{hex="#EF4444"} |
| 8 | 5 | 0 | :color[text[5] = 'A' matches pat[0]]{hex="#22C55E"} |
| 9 | 6 | 1 | :color[text[6] = 'B' matches pat[1]]{hex="#22C55E"} |
| 10 | 7 | 2 | :color[text[7] = 'A' matches pat[2]]{hex="#22C55E"} |
| 11 | 8 | 3 | :color[mismatch at pat[3]; jump j to lps[2] = 1 without moving i, because the first 1 characters are known to match already]{hex="#A78BFA"} |
| 12 | 8 | 1 | :color[mismatch at pat[1]; jump j to lps[0] = 0 without moving i, because the first 0 characters are known to match already]{hex="#A78BFA"} |
| 13 | 8 | 0 | :color[text[8] = 'C' does not match pat[0], and j is already 0, so advance the text by one]{hex="#EF4444"} |
| 14 | 9 | 0 | :color[text[9] = 'D' does not match pat[0], and j is already 0, so advance the text by one]{hex="#EF4444"} |
| 15 | 10 | 0 | :color[text[10] = 'A' matches pat[0]]{hex="#22C55E"} |
| 16 | 11 | 1 | :color[text[11] = 'B' matches pat[1]]{hex="#22C55E"} |
| 17 | 12 | 2 | :color[text[12] = 'A' matches pat[2]]{hex="#22C55E"} |
| 18 | 13 | 3 | :color[text[13] = 'B' matches pat[3]]{hex="#22C55E"} |
| 19 | 14 | 4 | :color[text[14] = 'C' matches pat[4]]{hex="#22C55E"} |
| 20 | 15 | 5 | :color[text[15] = 'A' matches pat[5]]{hex="#22C55E"} |
| 21 | 16 | 6 | :color[text[16] = 'B' matches pat[6]]{hex="#22C55E"} |
| 22 | 17 | 7 | :color[text[17] = 'A' matches pat[7]]{hex="#22C55E"} |
| 23 | 18 | 8 | :color[text[18] = 'B' matches pat[8]]{hex="#22C55E"} |
| 24 | 19 | 9 | :color[the whole pattern matched at shift 10; jump j to lps[8] = 4 and keep going]{hex="#22C55E"} |

:mark[**1 occurrence, at shift 10. 23 character comparisons.**]{hex="#204A2E"}

> For comparison on this same input: brute force takes **29** comparisons, KMP **23**, Boyer-Moore **16**.

**(iii) Complexity.**

Building the table is $O(m)$ and the search is $O(n)$, because `i` only ever moves forwards and `j` decreases at most as many times as it increases. Total **:color[O(n + m)]{hex="#22C55E"}**, in the **worst** case, not on average.

### Q16. Trace KMP

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**14 marks**]{hex="#3A3A3E"}

**Text:** `A A B A A C A A D A A B A A B A` &nbsp; (16 characters)

**Pattern:** `A A B A` &nbsp; (4 characters)

**(i)** State the failure table for the pattern. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Trace **KMP** over the text. Give every occurrence and count the character comparisons. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(iii)** State the worst case time complexity of KMP. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The failure table.**

| | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| **pattern** | `A` | `A` | `B` | `A` |
| **lps** | **0** | **1** | **0** | **1** |

**(ii) The trace.**

`i` walks the text and never goes backwards. `j` walks the pattern and falls back to the failure table on a mismatch.

| Step | i | j | What happens |
| --- | --- | --- | --- |
| 1 | 0 | 0 | :color[text[0] = 'A' matches pat[0]]{hex="#22C55E"} |
| 2 | 1 | 1 | :color[text[1] = 'A' matches pat[1]]{hex="#22C55E"} |
| 3 | 2 | 2 | :color[text[2] = 'B' matches pat[2]]{hex="#22C55E"} |
| 4 | 3 | 3 | :color[text[3] = 'A' matches pat[3]]{hex="#22C55E"} |
| 5 | 4 | 4 | :color[the whole pattern matched at shift 0; jump j to lps[3] = 1 and keep going]{hex="#22C55E"} |
| 6 | 4 | 1 | :color[text[4] = 'A' matches pat[1]]{hex="#22C55E"} |
| 7 | 5 | 2 | :color[mismatch at pat[2]; jump j to lps[1] = 1 without moving i, because the first 1 characters are known to match already]{hex="#A78BFA"} |
| 8 | 5 | 1 | :color[mismatch at pat[1]; jump j to lps[0] = 0 without moving i, because the first 0 characters are known to match already]{hex="#A78BFA"} |
| 9 | 5 | 0 | :color[text[5] = 'C' does not match pat[0], and j is already 0, so advance the text by one]{hex="#EF4444"} |
| 10 | 6 | 0 | :color[text[6] = 'A' matches pat[0]]{hex="#22C55E"} |
| 11 | 7 | 1 | :color[text[7] = 'A' matches pat[1]]{hex="#22C55E"} |
| 12 | 8 | 2 | :color[mismatch at pat[2]; jump j to lps[1] = 1 without moving i, because the first 1 characters are known to match already]{hex="#A78BFA"} |
| 13 | 8 | 1 | :color[mismatch at pat[1]; jump j to lps[0] = 0 without moving i, because the first 0 characters are known to match already]{hex="#A78BFA"} |
| 14 | 8 | 0 | :color[text[8] = 'D' does not match pat[0], and j is already 0, so advance the text by one]{hex="#EF4444"} |
| 15 | 9 | 0 | :color[text[9] = 'A' matches pat[0]]{hex="#22C55E"} |
| 16 | 10 | 1 | :color[text[10] = 'A' matches pat[1]]{hex="#22C55E"} |
| 17 | 11 | 2 | :color[text[11] = 'B' matches pat[2]]{hex="#22C55E"} |
| 18 | 12 | 3 | :color[text[12] = 'A' matches pat[3]]{hex="#22C55E"} |
| 19 | 13 | 4 | :color[the whole pattern matched at shift 9; jump j to lps[3] = 1 and keep going]{hex="#22C55E"} |
| 20 | 13 | 1 | :color[text[13] = 'A' matches pat[1]]{hex="#22C55E"} |
| 21 | 14 | 2 | :color[text[14] = 'B' matches pat[2]]{hex="#22C55E"} |
| 22 | 15 | 3 | :color[text[15] = 'A' matches pat[3]]{hex="#22C55E"} |
| 23 | 16 | 4 | :color[the whole pattern matched at shift 12; jump j to lps[3] = 1 and keep going]{hex="#22C55E"} |

:mark[**3 occurrences, at shifts 0, 9, 12. 20 character comparisons.**]{hex="#204A2E"}

> For comparison on this same input: brute force takes **30** comparisons, KMP **20**, Boyer-Moore **16**.

**(iii) Complexity.**

Building the table is $O(m)$ and the search is $O(n)$, because `i` only ever moves forwards and `j` decreases at most as many times as it increases. Total **:color[O(n + m)]{hex="#22C55E"}**, in the **worst** case, not on average.

### Q17. Trace KMP

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**14 marks**]{hex="#3A3A3E"}

**Text:** `A B C A B C A B C A B D` &nbsp; (12 characters)

**Pattern:** `A B C A B D` &nbsp; (6 characters)

**(i)** State the failure table for the pattern. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Trace **KMP** over the text. Give every occurrence and count the character comparisons. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(iii)** State the worst case time complexity of KMP. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The failure table.**

| | 0 | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- | --- |
| **pattern** | `A` | `B` | `C` | `A` | `B` | `D` |
| **lps** | **0** | **0** | **0** | **1** | **2** | **0** |

**(ii) The trace.**

`i` walks the text and never goes backwards. `j` walks the pattern and falls back to the failure table on a mismatch.

| Step | i | j | What happens |
| --- | --- | --- | --- |
| 1 | 0 | 0 | :color[text[0] = 'A' matches pat[0]]{hex="#22C55E"} |
| 2 | 1 | 1 | :color[text[1] = 'B' matches pat[1]]{hex="#22C55E"} |
| 3 | 2 | 2 | :color[text[2] = 'C' matches pat[2]]{hex="#22C55E"} |
| 4 | 3 | 3 | :color[text[3] = 'A' matches pat[3]]{hex="#22C55E"} |
| 5 | 4 | 4 | :color[text[4] = 'B' matches pat[4]]{hex="#22C55E"} |
| 6 | 5 | 5 | :color[mismatch at pat[5]; jump j to lps[4] = 2 without moving i, because the first 2 characters are known to match already]{hex="#A78BFA"} |
| 7 | 5 | 2 | :color[text[5] = 'C' matches pat[2]]{hex="#22C55E"} |
| 8 | 6 | 3 | :color[text[6] = 'A' matches pat[3]]{hex="#22C55E"} |
| 9 | 7 | 4 | :color[text[7] = 'B' matches pat[4]]{hex="#22C55E"} |
| 10 | 8 | 5 | :color[mismatch at pat[5]; jump j to lps[4] = 2 without moving i, because the first 2 characters are known to match already]{hex="#A78BFA"} |
| 11 | 8 | 2 | :color[text[8] = 'C' matches pat[2]]{hex="#22C55E"} |
| 12 | 9 | 3 | :color[text[9] = 'A' matches pat[3]]{hex="#22C55E"} |
| 13 | 10 | 4 | :color[text[10] = 'B' matches pat[4]]{hex="#22C55E"} |
| 14 | 11 | 5 | :color[text[11] = 'D' matches pat[5]]{hex="#22C55E"} |
| 15 | 12 | 6 | :color[the whole pattern matched at shift 6; jump j to lps[5] = 0 and keep going]{hex="#22C55E"} |

:mark[**1 occurrence, at shift 6. 14 character comparisons.**]{hex="#204A2E"}

> For comparison on this same input: brute force takes **22** comparisons, KMP **14**, Boyer-Moore **8**.

**(iii) Complexity.**

Building the table is $O(m)$ and the search is $O(n)$, because `i` only ever moves forwards and `j` decreases at most as many times as it increases. Total **:color[O(n + m)]{hex="#22C55E"}**, in the **worst** case, not on average.

### Q18. Trace KMP

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**14 marks**]{hex="#3A3A3E"}

**Text:** `G C A T C G C A G A G A G T A T A C A G T A C G` &nbsp; (24 characters)

**Pattern:** `G C A G A G A G` &nbsp; (8 characters)

**(i)** State the failure table for the pattern. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Trace **KMP** over the text. Give every occurrence and count the character comparisons. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(iii)** State the worst case time complexity of KMP. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The failure table.**

| | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **pattern** | `G` | `C` | `A` | `G` | `A` | `G` | `A` | `G` |
| **lps** | **0** | **0** | **0** | **1** | **0** | **1** | **0** | **1** |

**(ii) The trace.**

`i` walks the text and never goes backwards. `j` walks the pattern and falls back to the failure table on a mismatch.

| Step | i | j | What happens |
| --- | --- | --- | --- |
| 1 | 0 | 0 | :color[text[0] = 'G' matches pat[0]]{hex="#22C55E"} |
| 2 | 1 | 1 | :color[text[1] = 'C' matches pat[1]]{hex="#22C55E"} |
| 3 | 2 | 2 | :color[text[2] = 'A' matches pat[2]]{hex="#22C55E"} |
| 4 | 3 | 3 | :color[mismatch at pat[3]; jump j to lps[2] = 0 without moving i, because the first 0 characters are known to match already]{hex="#A78BFA"} |
| 5 | 3 | 0 | :color[text[3] = 'T' does not match pat[0], and j is already 0, so advance the text by one]{hex="#EF4444"} |
| 6 | 4 | 0 | :color[text[4] = 'C' does not match pat[0], and j is already 0, so advance the text by one]{hex="#EF4444"} |
| 7 | 5 | 0 | :color[text[5] = 'G' matches pat[0]]{hex="#22C55E"} |
| 8 | 6 | 1 | :color[text[6] = 'C' matches pat[1]]{hex="#22C55E"} |
| 9 | 7 | 2 | :color[text[7] = 'A' matches pat[2]]{hex="#22C55E"} |
| 10 | 8 | 3 | :color[text[8] = 'G' matches pat[3]]{hex="#22C55E"} |
| 11 | 9 | 4 | :color[text[9] = 'A' matches pat[4]]{hex="#22C55E"} |
| 12 | 10 | 5 | :color[text[10] = 'G' matches pat[5]]{hex="#22C55E"} |
| 13 | 11 | 6 | :color[text[11] = 'A' matches pat[6]]{hex="#22C55E"} |
| 14 | 12 | 7 | :color[text[12] = 'G' matches pat[7]]{hex="#22C55E"} |
| 15 | 13 | 8 | :color[the whole pattern matched at shift 5; jump j to lps[7] = 1 and keep going]{hex="#22C55E"} |
| 16 | 13 | 1 | :color[mismatch at pat[1]; jump j to lps[0] = 0 without moving i, because the first 0 characters are known to match already]{hex="#A78BFA"} |
| 17 | 13 | 0 | :color[text[13] = 'T' does not match pat[0], and j is already 0, so advance the text by one]{hex="#EF4444"} |
| 18 | 14 | 0 | :color[text[14] = 'A' does not match pat[0], and j is already 0, so advance the text by one]{hex="#EF4444"} |
| 19 | 15 | 0 | :color[text[15] = 'T' does not match pat[0], and j is already 0, so advance the text by one]{hex="#EF4444"} |
| 20 | 16 | 0 | :color[text[16] = 'A' does not match pat[0], and j is already 0, so advance the text by one]{hex="#EF4444"} |
| 21 | 17 | 0 | :color[text[17] = 'C' does not match pat[0], and j is already 0, so advance the text by one]{hex="#EF4444"} |
| 22 | 18 | 0 | :color[text[18] = 'A' does not match pat[0], and j is already 0, so advance the text by one]{hex="#EF4444"} |
| 23 | 19 | 0 | :color[text[19] = 'G' matches pat[0]]{hex="#22C55E"} |
| 24 | 20 | 1 | :color[mismatch at pat[1]; jump j to lps[0] = 0 without moving i, because the first 0 characters are known to match already]{hex="#A78BFA"} |
| 25 | 20 | 0 | :color[text[20] = 'T' does not match pat[0], and j is already 0, so advance the text by one]{hex="#EF4444"} |
| 26 | 21 | 0 | :color[text[21] = 'A' does not match pat[0], and j is already 0, so advance the text by one]{hex="#EF4444"} |
| 27 | 22 | 0 | :color[text[22] = 'C' does not match pat[0], and j is already 0, so advance the text by one]{hex="#EF4444"} |
| 28 | 23 | 0 | :color[text[23] = 'G' matches pat[0]]{hex="#22C55E"} |

:mark[**1 occurrence, at shift 5. 27 character comparisons.**]{hex="#204A2E"}

> For comparison on this same input: brute force takes **30** comparisons, KMP **27**, Boyer-Moore **17**.

**(iii) Complexity.**

Building the table is $O(m)$ and the search is $O(n)$, because `i` only ever moves forwards and `j` decreases at most as many times as it increases. Total **:color[O(n + m)]{hex="#22C55E"}**, in the **worst** case, not on average.

### Q19. Trace brute force

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

**Text:** `A A A A A A A A A B` &nbsp; (10 characters)

**Pattern:** `A A A B` &nbsp; (4 characters)

**(i)** Trace **brute force** over the text. Give every occurrence and count the character comparisons. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(ii)** State the worst case time complexity of brute force. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The trace.**

Every alignment is tried in turn, left to right, and each one starts again from the pattern's first character.

| Shift | Matched | Outcome |
| --- | --- | --- |
| 0 | 3 | 3 matched, then :color[pat[3] fails against text[3]]{hex="#EF4444"} |
| 1 | 3 | 3 matched, then :color[pat[3] fails against text[4]]{hex="#EF4444"} |
| 2 | 3 | 3 matched, then :color[pat[3] fails against text[5]]{hex="#EF4444"} |
| 3 | 3 | 3 matched, then :color[pat[3] fails against text[6]]{hex="#EF4444"} |
| 4 | 3 | 3 matched, then :color[pat[3] fails against text[7]]{hex="#EF4444"} |
| 5 | 3 | 3 matched, then :color[pat[3] fails against text[8]]{hex="#EF4444"} |
| 6 | 4 | :color[all 4 match, occurrence]{hex="#22C55E"} |

:mark[**1 occurrence, at shift 6. 28 character comparisons.**]{hex="#204A2E"}

> For comparison on this same input: brute force takes **28** comparisons, KMP **16**, Boyer-Moore **10**.

**(ii) Complexity.**

There are $n - m + 1$ alignments and each may compare up to $m$ characters, so the worst case is **:color[O(n × m)]{hex="#EF4444"}**. It is reached when the pattern almost matches everywhere, such as a text of all `A` against a pattern of `AAAB`.

### Q20. Trace KMP

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**14 marks**]{hex="#3A3A3E"}

**Text:** `A B C A B C A B C A B C` &nbsp; (12 characters)

**Pattern:** `A B C A B D` &nbsp; (6 characters)

**(i)** State the failure table for the pattern. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Trace **KMP** over the text. Give every occurrence and count the character comparisons. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(iii)** State the worst case time complexity of KMP. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The failure table.**

| | 0 | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- | --- |
| **pattern** | `A` | `B` | `C` | `A` | `B` | `D` |
| **lps** | **0** | **0** | **0** | **1** | **2** | **0** |

**(ii) The trace.**

`i` walks the text and never goes backwards. `j` walks the pattern and falls back to the failure table on a mismatch.

| Step | i | j | What happens |
| --- | --- | --- | --- |
| 1 | 0 | 0 | :color[text[0] = 'A' matches pat[0]]{hex="#22C55E"} |
| 2 | 1 | 1 | :color[text[1] = 'B' matches pat[1]]{hex="#22C55E"} |
| 3 | 2 | 2 | :color[text[2] = 'C' matches pat[2]]{hex="#22C55E"} |
| 4 | 3 | 3 | :color[text[3] = 'A' matches pat[3]]{hex="#22C55E"} |
| 5 | 4 | 4 | :color[text[4] = 'B' matches pat[4]]{hex="#22C55E"} |
| 6 | 5 | 5 | :color[mismatch at pat[5]; jump j to lps[4] = 2 without moving i, because the first 2 characters are known to match already]{hex="#A78BFA"} |
| 7 | 5 | 2 | :color[text[5] = 'C' matches pat[2]]{hex="#22C55E"} |
| 8 | 6 | 3 | :color[text[6] = 'A' matches pat[3]]{hex="#22C55E"} |
| 9 | 7 | 4 | :color[text[7] = 'B' matches pat[4]]{hex="#22C55E"} |
| 10 | 8 | 5 | :color[mismatch at pat[5]; jump j to lps[4] = 2 without moving i, because the first 2 characters are known to match already]{hex="#A78BFA"} |
| 11 | 8 | 2 | :color[text[8] = 'C' matches pat[2]]{hex="#22C55E"} |
| 12 | 9 | 3 | :color[text[9] = 'A' matches pat[3]]{hex="#22C55E"} |
| 13 | 10 | 4 | :color[text[10] = 'B' matches pat[4]]{hex="#22C55E"} |
| 14 | 11 | 5 | :color[mismatch at pat[5]; jump j to lps[4] = 2 without moving i, because the first 2 characters are known to match already]{hex="#A78BFA"} |
| 15 | 11 | 2 | :color[text[11] = 'C' matches pat[2]]{hex="#22C55E"} |

:mark[**The pattern does not occur in the text. 15 character comparisons.**]{hex="#5C2323"}

> For comparison on this same input: brute force takes **22** comparisons, KMP **15**, Boyer-Moore **3**.

**(iii) Complexity.**

Building the table is $O(m)$ and the search is $O(n)$, because `i` only ever moves forwards and `j` decreases at most as many times as it increases. Total **:color[O(n + m)]{hex="#22C55E"}**, in the **worst** case, not on average.

### Q21. Trace KMP

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**14 marks**]{hex="#3A3A3E"}

**Text:** `A B A A A B C D A B A B C A B C` &nbsp; (16 characters)

**Pattern:** `A B A B C A B C` &nbsp; (8 characters)

**(i)** State the failure table for the pattern. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Trace **KMP** over the text. Give every occurrence and count the character comparisons. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(iii)** State the worst case time complexity of KMP. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The failure table.**

| | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **pattern** | `A` | `B` | `A` | `B` | `C` | `A` | `B` | `C` |
| **lps** | **0** | **0** | **1** | **2** | **0** | **1** | **2** | **0** |

**(ii) The trace.**

`i` walks the text and never goes backwards. `j` walks the pattern and falls back to the failure table on a mismatch.

| Step | i | j | What happens |
| --- | --- | --- | --- |
| 1 | 0 | 0 | :color[text[0] = 'A' matches pat[0]]{hex="#22C55E"} |
| 2 | 1 | 1 | :color[text[1] = 'B' matches pat[1]]{hex="#22C55E"} |
| 3 | 2 | 2 | :color[text[2] = 'A' matches pat[2]]{hex="#22C55E"} |
| 4 | 3 | 3 | :color[mismatch at pat[3]; jump j to lps[2] = 1 without moving i, because the first 1 characters are known to match already]{hex="#A78BFA"} |
| 5 | 3 | 1 | :color[mismatch at pat[1]; jump j to lps[0] = 0 without moving i, because the first 0 characters are known to match already]{hex="#A78BFA"} |
| 6 | 3 | 0 | :color[text[3] = 'A' matches pat[0]]{hex="#22C55E"} |
| 7 | 4 | 1 | :color[mismatch at pat[1]; jump j to lps[0] = 0 without moving i, because the first 0 characters are known to match already]{hex="#A78BFA"} |
| 8 | 4 | 0 | :color[text[4] = 'A' matches pat[0]]{hex="#22C55E"} |
| 9 | 5 | 1 | :color[text[5] = 'B' matches pat[1]]{hex="#22C55E"} |
| 10 | 6 | 2 | :color[mismatch at pat[2]; jump j to lps[1] = 0 without moving i, because the first 0 characters are known to match already]{hex="#A78BFA"} |
| 11 | 6 | 0 | :color[text[6] = 'C' does not match pat[0], and j is already 0, so advance the text by one]{hex="#EF4444"} |
| 12 | 7 | 0 | :color[text[7] = 'D' does not match pat[0], and j is already 0, so advance the text by one]{hex="#EF4444"} |
| 13 | 8 | 0 | :color[text[8] = 'A' matches pat[0]]{hex="#22C55E"} |
| 14 | 9 | 1 | :color[text[9] = 'B' matches pat[1]]{hex="#22C55E"} |
| 15 | 10 | 2 | :color[text[10] = 'A' matches pat[2]]{hex="#22C55E"} |
| 16 | 11 | 3 | :color[text[11] = 'B' matches pat[3]]{hex="#22C55E"} |
| 17 | 12 | 4 | :color[text[12] = 'C' matches pat[4]]{hex="#22C55E"} |
| 18 | 13 | 5 | :color[text[13] = 'A' matches pat[5]]{hex="#22C55E"} |
| 19 | 14 | 6 | :color[text[14] = 'B' matches pat[6]]{hex="#22C55E"} |
| 20 | 15 | 7 | :color[text[15] = 'C' matches pat[7]]{hex="#22C55E"} |
| 21 | 16 | 8 | :color[the whole pattern matched at shift 8; jump j to lps[7] = 0 and keep going]{hex="#22C55E"} |

:mark[**1 occurrence, at shift 8. 20 character comparisons.**]{hex="#204A2E"}

> For comparison on this same input: brute force takes **23** comparisons, KMP **20**, Boyer-Moore **9**.

**(iii) Complexity.**

Building the table is $O(m)$ and the search is $O(n)$, because `i` only ever moves forwards and `j` decreases at most as many times as it increases. Total **:color[O(n + m)]{hex="#22C55E"}**, in the **worst** case, not on average.

### Q22. Trace KMP

> :mark[**Very hard**]{hex="#5C2323"} &nbsp; :mark[**14 marks**]{hex="#3A3A3E"}

**Text:** `A A B A A B A A A B A A B A A B` &nbsp; (16 characters)

**Pattern:** `A A B A A B` &nbsp; (6 characters)

**(i)** State the failure table for the pattern. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Trace **KMP** over the text. Give every occurrence and count the character comparisons. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(iii)** State the worst case time complexity of KMP. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The failure table.**

| | 0 | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- | --- |
| **pattern** | `A` | `A` | `B` | `A` | `A` | `B` |
| **lps** | **0** | **1** | **0** | **1** | **2** | **3** |

**(ii) The trace.**

`i` walks the text and never goes backwards. `j` walks the pattern and falls back to the failure table on a mismatch.

| Step | i | j | What happens |
| --- | --- | --- | --- |
| 1 | 0 | 0 | :color[text[0] = 'A' matches pat[0]]{hex="#22C55E"} |
| 2 | 1 | 1 | :color[text[1] = 'A' matches pat[1]]{hex="#22C55E"} |
| 3 | 2 | 2 | :color[text[2] = 'B' matches pat[2]]{hex="#22C55E"} |
| 4 | 3 | 3 | :color[text[3] = 'A' matches pat[3]]{hex="#22C55E"} |
| 5 | 4 | 4 | :color[text[4] = 'A' matches pat[4]]{hex="#22C55E"} |
| 6 | 5 | 5 | :color[text[5] = 'B' matches pat[5]]{hex="#22C55E"} |
| 7 | 6 | 6 | :color[the whole pattern matched at shift 0; jump j to lps[5] = 3 and keep going]{hex="#22C55E"} |
| 8 | 6 | 3 | :color[text[6] = 'A' matches pat[3]]{hex="#22C55E"} |
| 9 | 7 | 4 | :color[text[7] = 'A' matches pat[4]]{hex="#22C55E"} |
| 10 | 8 | 5 | :color[mismatch at pat[5]; jump j to lps[4] = 2 without moving i, because the first 2 characters are known to match already]{hex="#A78BFA"} |
| 11 | 8 | 2 | :color[mismatch at pat[2]; jump j to lps[1] = 1 without moving i, because the first 1 characters are known to match already]{hex="#A78BFA"} |
| 12 | 8 | 1 | :color[text[8] = 'A' matches pat[1]]{hex="#22C55E"} |
| 13 | 9 | 2 | :color[text[9] = 'B' matches pat[2]]{hex="#22C55E"} |
| 14 | 10 | 3 | :color[text[10] = 'A' matches pat[3]]{hex="#22C55E"} |
| 15 | 11 | 4 | :color[text[11] = 'A' matches pat[4]]{hex="#22C55E"} |
| 16 | 12 | 5 | :color[text[12] = 'B' matches pat[5]]{hex="#22C55E"} |
| 17 | 13 | 6 | :color[the whole pattern matched at shift 7; jump j to lps[5] = 3 and keep going]{hex="#22C55E"} |
| 18 | 13 | 3 | :color[text[13] = 'A' matches pat[3]]{hex="#22C55E"} |
| 19 | 14 | 4 | :color[text[14] = 'A' matches pat[4]]{hex="#22C55E"} |
| 20 | 15 | 5 | :color[text[15] = 'B' matches pat[5]]{hex="#22C55E"} |
| 21 | 16 | 6 | :color[the whole pattern matched at shift 10; jump j to lps[5] = 3 and keep going]{hex="#22C55E"} |

:mark[**3 occurrences, at shifts 0, 7, 10. 18 character comparisons.**]{hex="#204A2E"}

> For comparison on this same input: brute force takes **36** comparisons, KMP **18**, Boyer-Moore **23**.

**(iii) Complexity.**

Building the table is $O(m)$ and the search is $O(n)$, because `i` only ever moves forwards and `j` decreases at most as many times as it increases. Total **:color[O(n + m)]{hex="#22C55E"}**, in the **worst** case, not on average.

## Part C: Boyer-Moore

The bad character table, then the alignments and the shifts. These use the larger of the two rules; if your course teaches the bad character rule alone, the shifts can be smaller and the alignment count higher.

### Q23. Boyer-Moore

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**13 marks**]{hex="#3A3A3E"}

**Text:** `A B C A B C A B D` &nbsp; (9 characters)

**Pattern:** `A B D` &nbsp; (3 characters)

**(i)** Give the **bad character table** for the pattern. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Trace **Boyer-Moore**. For each alignment give the mismatch and the shift applied. &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

**(iii)** Why does Boyer-Moore do well here? &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The bad character table.**

The last index at which each character appears in the pattern.

| Character | `A` | `B` | `D` | anything else |
| --- | --- | --- | --- | --- |
| **Last index** | :color[0]{hex="#EAB308"} | :color[1]{hex="#EAB308"} | :color[2]{hex="#EAB308"} | :color[−1]{hex="#EF4444"} |

**(ii) The trace.**

Line the pattern up at shift 0 and compare **:color[right to left]{hex="#FF5FA2"}**. On a mismatch, shift by the larger of the two rules.

| Shift | Matched from the right | Mismatch | Shift by |
| --- | --- | --- | --- |
| 0 | 0 | :color[pat[2] vs `C`]{hex="#EF4444"} | :color[3]{hex="#2DD4BF"} |
| 3 | 0 | :color[pat[2] vs `C`]{hex="#EF4444"} | :color[3]{hex="#2DD4BF"} |
| 6 | :color[all 3]{hex="#22C55E"} | :color[none, an occurrence]{hex="#22C55E"} | :color[3]{hex="#2DD4BF"} |

:mark[**1 occurrence, at shift 6. 3 alignments, 5 character comparisons.**]{hex="#204A2E"}

**(iii) Why it does well.**

It examined only **5** characters of a 9 character text, against **13** for brute force and **11** for KMP, and it did it in **3** alignments.

The reason is that comparing from the right means a mismatch is usually on a character near the **end** of the alignment, and the bad character rule can then jump the pattern a long way in one move. A character that is not in the pattern at all lets it skip the whole pattern length. The text here uses 4 distinct characters; the larger that number, the more often that happens, which is why Boyer-Moore is the practical choice for ordinary text.

### Q24. Boyer-Moore

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**13 marks**]{hex="#3A3A3E"}

**Text:** `T H I S   I S   A   T E S T` &nbsp; (14 characters)

**Pattern:** `T E S T` &nbsp; (4 characters)

**(i)** Give the **bad character table** for the pattern. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Trace **Boyer-Moore**. For each alignment give the mismatch and the shift applied. &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

**(iii)** Why does Boyer-Moore do well here? &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The bad character table.**

The last index at which each character appears in the pattern.

| Character | `E` | `S` | `T` | anything else |
| --- | --- | --- | --- | --- |
| **Last index** | :color[1]{hex="#EAB308"} | :color[2]{hex="#EAB308"} | :color[3]{hex="#EAB308"} | :color[−1]{hex="#EF4444"} |

**(ii) The trace.**

Line the pattern up at shift 0 and compare **:color[right to left]{hex="#FF5FA2"}**. On a mismatch, shift by the larger of the two rules.

| Shift | Matched from the right | Mismatch | Shift by |
| --- | --- | --- | --- |
| 0 | 0 | :color[pat[3] vs `S`]{hex="#EF4444"} | :color[1]{hex="#2DD4BF"} |
| 1 | 0 | :color[pat[3] vs ` `]{hex="#EF4444"} | :color[4]{hex="#2DD4BF"} |
| 5 | 0 | :color[pat[3] vs `A`]{hex="#EF4444"} | :color[4]{hex="#2DD4BF"} |
| 9 | 0 | :color[pat[3] vs `S`]{hex="#EF4444"} | :color[1]{hex="#2DD4BF"} |
| 10 | :color[all 4]{hex="#22C55E"} | :color[none, an occurrence]{hex="#22C55E"} | :color[3]{hex="#2DD4BF"} |

:mark[**1 occurrence, at shift 10. 5 alignments, 8 character comparisons.**]{hex="#204A2E"}

**(iii) Why it does well.**

It examined only **8** characters of a 14 character text, against **15** for brute force and **15** for KMP, and it did it in **5** alignments.

The reason is that comparing from the right means a mismatch is usually on a character near the **end** of the alignment, and the bad character rule can then jump the pattern a long way in one move. A character that is not in the pattern at all lets it skip the whole pattern length. The text here uses 7 distinct characters; the larger that number, the more often that happens, which is why Boyer-Moore is the practical choice for ordinary text.

### Q25. Boyer-Moore

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**13 marks**]{hex="#3A3A3E"}

**Text:** `A B A B D A B A C D A B A B C A B A B` &nbsp; (19 characters)

**Pattern:** `A B A B C A B A B` &nbsp; (9 characters)

**(i)** Give the **bad character table** for the pattern. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Trace **Boyer-Moore**. For each alignment give the mismatch and the shift applied. &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

**(iii)** Why does Boyer-Moore do well here? &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The bad character table.**

The last index at which each character appears in the pattern.

| Character | `A` | `B` | `C` | anything else |
| --- | --- | --- | --- | --- |
| **Last index** | :color[7]{hex="#EAB308"} | :color[8]{hex="#EAB308"} | :color[4]{hex="#EAB308"} | :color[−1]{hex="#EF4444"} |

**(ii) The trace.**

Line the pattern up at shift 0 and compare **:color[right to left]{hex="#FF5FA2"}**. On a mismatch, shift by the larger of the two rules.

| Shift | Matched from the right | Mismatch | Shift by |
| --- | --- | --- | --- |
| 0 | 0 | :color[pat[8] vs `C`]{hex="#EF4444"} | :color[4]{hex="#2DD4BF"} |
| 4 | 0 | :color[pat[8] vs `A`]{hex="#EF4444"} | :color[1]{hex="#2DD4BF"} |
| 5 | 4 | :color[pat[4] vs `D`]{hex="#EF4444"} | :color[5]{hex="#2DD4BF"} |
| 10 | :color[all 9]{hex="#22C55E"} | :color[none, an occurrence]{hex="#22C55E"} | :color[5]{hex="#2DD4BF"} |

:mark[**1 occurrence, at shift 10. 4 alignments, 16 character comparisons.**]{hex="#204A2E"}

**(iii) Why it does well.**

It examined only **16** characters of a 19 character text, against **29** for brute force and **23** for KMP, and it did it in **4** alignments.

The reason is that comparing from the right means a mismatch is usually on a character near the **end** of the alignment, and the bad character rule can then jump the pattern a long way in one move. A character that is not in the pattern at all lets it skip the whole pattern length. The text here uses 4 distinct characters; the larger that number, the more often that happens, which is why Boyer-Moore is the practical choice for ordinary text.

### Q26. Boyer-Moore

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**13 marks**]{hex="#3A3A3E"}

**Text:** `G C A T C G C A G A G A G T A T A C A G T A C G` &nbsp; (24 characters)

**Pattern:** `G C A G A G A G` &nbsp; (8 characters)

**(i)** Give the **bad character table** for the pattern. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Trace **Boyer-Moore**. For each alignment give the mismatch and the shift applied. &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

**(iii)** Why does Boyer-Moore do well here? &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The bad character table.**

The last index at which each character appears in the pattern.

| Character | `A` | `C` | `G` | anything else |
| --- | --- | --- | --- | --- |
| **Last index** | :color[6]{hex="#EAB308"} | :color[1]{hex="#EAB308"} | :color[7]{hex="#EAB308"} | :color[−1]{hex="#EF4444"} |

**(ii) The trace.**

Line the pattern up at shift 0 and compare **:color[right to left]{hex="#FF5FA2"}**. On a mismatch, shift by the larger of the two rules.

| Shift | Matched from the right | Mismatch | Shift by |
| --- | --- | --- | --- |
| 0 | 0 | :color[pat[7] vs `A`]{hex="#EF4444"} | :color[1]{hex="#2DD4BF"} |
| 1 | 2 | :color[pat[5] vs `C`]{hex="#EF4444"} | :color[4]{hex="#2DD4BF"} |
| 5 | :color[all 8]{hex="#22C55E"} | :color[none, an occurrence]{hex="#22C55E"} | :color[7]{hex="#2DD4BF"} |
| 12 | 2 | :color[pat[5] vs `C`]{hex="#EF4444"} | :color[4]{hex="#2DD4BF"} |
| 16 | 1 | :color[pat[6] vs `C`]{hex="#EF4444"} | :color[7]{hex="#2DD4BF"} |

:mark[**1 occurrence, at shift 5. 5 alignments, 17 character comparisons.**]{hex="#204A2E"}

**(iii) Why it does well.**

It examined only **17** characters of a 24 character text, against **30** for brute force and **27** for KMP, and it did it in **5** alignments.

The reason is that comparing from the right means a mismatch is usually on a character near the **end** of the alignment, and the bad character rule can then jump the pattern a long way in one move. A character that is not in the pattern at all lets it skip the whole pattern length. The text here uses 4 distinct characters; the larger that number, the more often that happens, which is why Boyer-Moore is the practical choice for ordinary text.

### Q27. Boyer-Moore

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**13 marks**]{hex="#3A3A3E"}

**Text:** `T H I S   I S   A   S I M P L E   E X A M P L E` &nbsp; (24 characters)

**Pattern:** `E X A M P L E` &nbsp; (7 characters)

**(i)** Give the **bad character table** for the pattern. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Trace **Boyer-Moore**. For each alignment give the mismatch and the shift applied. &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

**(iii)** Why does Boyer-Moore do well here? &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The bad character table.**

The last index at which each character appears in the pattern.

| Character | `A` | `E` | `L` | `M` | `P` | `X` | anything else |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Last index** | :color[2]{hex="#EAB308"} | :color[6]{hex="#EAB308"} | :color[5]{hex="#EAB308"} | :color[3]{hex="#EAB308"} | :color[4]{hex="#EAB308"} | :color[1]{hex="#EAB308"} | :color[−1]{hex="#EF4444"} |

**(ii) The trace.**

Line the pattern up at shift 0 and compare **:color[right to left]{hex="#FF5FA2"}**. On a mismatch, shift by the larger of the two rules.

| Shift | Matched from the right | Mismatch | Shift by |
| --- | --- | --- | --- |
| 0 | 0 | :color[pat[6] vs `S`]{hex="#EF4444"} | :color[7]{hex="#2DD4BF"} |
| 7 | 0 | :color[pat[6] vs `P`]{hex="#EF4444"} | :color[2]{hex="#2DD4BF"} |
| 9 | 4 | :color[pat[2] vs `I`]{hex="#EF4444"} | :color[6]{hex="#2DD4BF"} |
| 15 | 0 | :color[pat[6] vs `P`]{hex="#EF4444"} | :color[2]{hex="#2DD4BF"} |
| 17 | :color[all 7]{hex="#22C55E"} | :color[none, an occurrence]{hex="#22C55E"} | :color[6]{hex="#2DD4BF"} |

:mark[**1 occurrence, at shift 17. 5 alignments, 15 character comparisons.**]{hex="#204A2E"}

**(iii) Why it does well.**

It examined only **15** characters of a 24 character text, against **25** for brute force and **25** for KMP, and it did it in **5** alignments.

The reason is that comparing from the right means a mismatch is usually on a character near the **end** of the alignment, and the bad character rule can then jump the pattern a long way in one move. A character that is not in the pattern at all lets it skip the whole pattern length. The text here uses 11 distinct characters; the larger that number, the more often that happens, which is why Boyer-Moore is the practical choice for ordinary text.

### Q28. Boyer-Moore

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**13 marks**]{hex="#3A3A3E"}

**Text:** `A B A B A B A B A B A B` &nbsp; (12 characters)

**Pattern:** `A B A B C` &nbsp; (5 characters)

**(i)** Give the **bad character table** for the pattern. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Trace **Boyer-Moore**. For each alignment give the mismatch and the shift applied. &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

**(iii)** Why does Boyer-Moore do well here? &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The bad character table.**

The last index at which each character appears in the pattern.

| Character | `A` | `B` | `C` | anything else |
| --- | --- | --- | --- | --- |
| **Last index** | :color[2]{hex="#EAB308"} | :color[3]{hex="#EAB308"} | :color[4]{hex="#EAB308"} | :color[−1]{hex="#EF4444"} |

**(ii) The trace.**

Line the pattern up at shift 0 and compare **:color[right to left]{hex="#FF5FA2"}**. On a mismatch, shift by the larger of the two rules.

| Shift | Matched from the right | Mismatch | Shift by |
| --- | --- | --- | --- |
| 0 | 0 | :color[pat[4] vs `A`]{hex="#EF4444"} | :color[2]{hex="#2DD4BF"} |
| 2 | 0 | :color[pat[4] vs `A`]{hex="#EF4444"} | :color[2]{hex="#2DD4BF"} |
| 4 | 0 | :color[pat[4] vs `A`]{hex="#EF4444"} | :color[2]{hex="#2DD4BF"} |
| 6 | 0 | :color[pat[4] vs `A`]{hex="#EF4444"} | :color[2]{hex="#2DD4BF"} |

:mark[**The pattern does not occur. 4 alignments, 4 character comparisons.**]{hex="#5C2323"}

**(iii) Why it does well.**

It examined only **4** characters of a 12 character text, against **24** for brute force and **16** for KMP, and it did it in **4** alignments.

The reason is that comparing from the right means a mismatch is usually on a character near the **end** of the alignment, and the bad character rule can then jump the pattern a long way in one move. A character that is not in the pattern at all lets it skip the whole pattern length. The text here uses 2 distinct characters; the larger that number, the more often that happens, which is why Boyer-Moore is the practical choice for ordinary text.

### Q29. Boyer-Moore

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**13 marks**]{hex="#3A3A3E"}

**Text:** `A B A A A B C D A B A B C A B C` &nbsp; (16 characters)

**Pattern:** `A B A B C A B C` &nbsp; (8 characters)

**(i)** Give the **bad character table** for the pattern. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Trace **Boyer-Moore**. For each alignment give the mismatch and the shift applied. &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

**(iii)** Why does Boyer-Moore do well here? &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The bad character table.**

The last index at which each character appears in the pattern.

| Character | `A` | `B` | `C` | anything else |
| --- | --- | --- | --- | --- |
| **Last index** | :color[5]{hex="#EAB308"} | :color[6]{hex="#EAB308"} | :color[7]{hex="#EAB308"} | :color[−1]{hex="#EF4444"} |

**(ii) The trace.**

Line the pattern up at shift 0 and compare **:color[right to left]{hex="#FF5FA2"}**. On a mismatch, shift by the larger of the two rules.

| Shift | Matched from the right | Mismatch | Shift by |
| --- | --- | --- | --- |
| 0 | 0 | :color[pat[7] vs `D`]{hex="#EF4444"} | :color[8]{hex="#2DD4BF"} |
| 8 | :color[all 8]{hex="#22C55E"} | :color[none, an occurrence]{hex="#22C55E"} | :color[8]{hex="#2DD4BF"} |

:mark[**1 occurrence, at shift 8. 2 alignments, 9 character comparisons.**]{hex="#204A2E"}

**(iii) Why it does well.**

It examined only **9** characters of a 16 character text, against **23** for brute force and **20** for KMP, and it did it in **2** alignments.

The reason is that comparing from the right means a mismatch is usually on a character near the **end** of the alignment, and the bad character rule can then jump the pattern a long way in one move. A character that is not in the pattern at all lets it skip the whole pattern length. The text here uses 4 distinct characters; the larger that number, the more often that happens, which is why Boyer-Moore is the practical choice for ordinary text.

### Q30. Boyer-Moore

> :mark[**Very hard**]{hex="#5C2323"} &nbsp; :mark[**13 marks**]{hex="#3A3A3E"}

**Text:** `A A B A A B A A A B A A B A A B` &nbsp; (16 characters)

**Pattern:** `A A B A A B` &nbsp; (6 characters)

**(i)** Give the **bad character table** for the pattern. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Trace **Boyer-Moore**. For each alignment give the mismatch and the shift applied. &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

**(iii)** Why does Boyer-Moore do well here? &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The bad character table.**

The last index at which each character appears in the pattern.

| Character | `A` | `B` | anything else |
| --- | --- | --- | --- |
| **Last index** | :color[4]{hex="#EAB308"} | :color[5]{hex="#EAB308"} | :color[−1]{hex="#EF4444"} |

**(ii) The trace.**

Line the pattern up at shift 0 and compare **:color[right to left]{hex="#FF5FA2"}**. On a mismatch, shift by the larger of the two rules.

| Shift | Matched from the right | Mismatch | Shift by |
| --- | --- | --- | --- |
| 0 | :color[all 6]{hex="#22C55E"} | :color[none, an occurrence]{hex="#22C55E"} | :color[3]{hex="#2DD4BF"} |
| 3 | 0 | :color[pat[5] vs `A`]{hex="#EF4444"} | :color[1]{hex="#2DD4BF"} |
| 4 | 3 | :color[pat[2] vs `A`]{hex="#EF4444"} | :color[3]{hex="#2DD4BF"} |
| 7 | :color[all 6]{hex="#22C55E"} | :color[none, an occurrence]{hex="#22C55E"} | :color[3]{hex="#2DD4BF"} |
| 10 | :color[all 6]{hex="#22C55E"} | :color[none, an occurrence]{hex="#22C55E"} | :color[3]{hex="#2DD4BF"} |

:mark[**3 occurrences, at shifts 0, 7, 10. 5 alignments, 23 character comparisons.**]{hex="#204A2E"}

**(iii) Why it does well.**

It examined only **23** characters of a 16 character text, against **36** for brute force and **18** for KMP, and it did it in **5** alignments.

The reason is that comparing from the right means a mismatch is usually on a character near the **end** of the alignment, and the bad character rule can then jump the pattern a long way in one move. A character that is not in the pattern at all lets it skip the whole pattern length. The text here uses 2 distinct characters; the larger that number, the more often that happens, which is why Boyer-Moore is the practical choice for ordinary text.

---

# Self test

1. What is a shift, and how many are there for a text of $n$ and a pattern of $m$?
2. What exactly does brute force throw away after a mismatch?
3. Give a text and pattern that force brute force into its worst case.
4. Define lps[j] in one sentence, using the words prefix and suffix.
5. Why is lps[0] always 0, and why can lps[j] never exceed j?
6. Does building the failure table look at the text?
7. On a mismatch at pat[j], what happens to j, and what happens to i?
8. Why is KMP O(n + m) in the worst case? Give the reason, not the formula.
9. What does KMP do after a full match, and why does that matter for overlaps?
10. Which direction does Boyer-Moore compare in, and why does that help?
11. State the bad character rule, including what happens when the character is absent.
12. Why is the shift always taken as at least 1?
13. What does the good suffix rule use, and how are the two rules combined?
14. Which algorithm can be sublinear, and what does that mean?
15. Which algorithm would you pick for DNA, and which for English prose? Why?
16. Which algorithm never needs to re-read a character of the text?

# Summary

| Idea | The short version |
| --- | --- |
| The problem | find every shift where the pattern matches the text |
| Brute force | slide one, restart from pat[0]. $O(n \times m)$ worst case |
| Its flaw | discards everything it learned at the previous alignment |
| lps[j] | longest run that is both a prefix and a suffix of pattern[0..j] |
| lps[0] | always 0. And lps[j] ≤ j, always |
| Building it | pattern against itself, $O(m)$, never touches the text |
| KMP on mismatch | `j = lps[j-1]`, and `i` does not move |
| Why KMP is linear | the text pointer never goes backwards |
| KMP cost | $O(n + m)$ worst case, no bad input |
| Boyer-Moore | compares right to left within the alignment |
| Bad character | shift so the last occurrence lines up; skip the lot if absent |
| Good suffix | realign the matched suffix with another copy of itself |
| Combining them | take the larger shift, always at least 1 |
| Boyer-Moore cost | sublinear at best, better with a larger alphabet |
| Bad character only | called Horspool, and $O(n \times m)$ in the worst case |
| Picking one | small alphabet or a stream: KMP. Ordinary text: Boyer-Moore. |
