# Chapter 9: Dynamic Programming

Chapters 3, 4 and 5 were about working out what a recursive algorithm costs. This chapter is
about a family of algorithms that exist because the obvious recursion costs far too much.

**Dynamic programming** is one idea: if a problem breaks into subproblems and the same
subproblems keep coming back, solve each one once and write the answer down. Everything else,
the tables, the tracebacks, the notation, is bookkeeping around that sentence.

In an exam this subject usually arrives without any code at all. You are handed a recurrence,
some data, and an empty row of cells, and you are marked on whether you can fill it in and then
read an answer back out of it. This chapter is about doing exactly that, quickly and without
losing marks.

> The whole chapter runs on six colours, and each one keeps its meaning to the last page.
>
> | Colour | What it is |
> | --- | --- |
> | **:color[i]{hex="#5B8CFF"}** | the cell being filled right now |
> | **:color[j]{hex="#FF5FA2"}** | the cells to its left that it is allowed to look at |
> | **:color[the condition]{hex="#A78BFA"}** | the rule that decides which of them count |
> | **:color[the entry]{hex="#EAB308"}** | the number that goes in the cell |
> | **:color[the base case]{hex="#2DD4BF"}** | what happens when nothing qualifies |
> | **:color[the traceback]{hex="#22C55E"}** | the cells the answer is actually made of |

## What the question is really asking

Every question of this shape hands you a recurrence that looks worse than it is. Read it in
pieces and it says something very ordinary.

![The anatomy of a subsequence recurrence, with each part numbered and explained](/notes/img/algorithms/ch09-anatomy.svg)

Say it in English once and you will never misread it again:

:mark[**How long a run can I finish with, if this element is the last one in it?**]{hex="#3A3A3E"}

That is what a cell holds. Not the answer to the whole question, the answer to the whole
question *ending here*. Which is why the final answer is never simply the last cell.

## Filling one cell

Take the array `2, 10, 4, 5, 13, 3, 15, 20, 11, 1` and the decreasing condition, so a value at
$j$ counts only if it is **larger** than the value at $i$.

![How one cell of the table is computed from the cells to its left](/notes/img/algorithms/ch09-one-cell.svg)

Three moves, in this order, every time:

1. Look at every $j$ to the **left** of $i$. Never to the right, and never at $i$ itself.
2. Keep the ones where the :color[condition]{hex="#A78BFA"} holds.
3. Take the **biggest entry** among those, and add one. If you kept none, write **1**.

That is the entire algorithm. Repeat it left to right and the table fills itself.

![An animation filling the table one cell at a time from left to right](/notes/img/algorithms/ch09-fill.svg)

> **Why is it always 1 and never 0?** Because a single element on its own is already a run of
> length one. A cell holding 0 would be claiming there is no run ending there, and there always is.

### The two mistakes that cost the most marks

> **Looking right.** A cell may only depend on cells already filled. If you find yourself reading
> a cell that is still empty, you have read the condition backwards.
>
> **Taking the last cell as the answer.** The answer is the **largest entry anywhere in the table**.
> The run that gives it may well finish in the middle of the array.

## Walking back out: the traceback

Filling the table gives you a number. The traceback gives you the elements, and it is usually
worth as many marks as the table.

![The traceback, hopping from the biggest entry back down to one](/notes/img/algorithms/ch09-traceback.svg)

The rule is mechanical:

1. Find the **largest entry**. Its index is where the run ends, and its value is the answer.
2. Look **left** for a cell whose entry is exactly **one smaller** and which satisfies the
   condition against the element you are standing on.
3. Move there. Repeat until you reach a cell holding **1**.
4. Read the elements you visited, left to right.

> Ties are normal. Two cells may both hold the entry you are looking for, and either gives a
> correct answer. Say which one you took. Throughout this chapter the traceback takes the
> **leftmost** cell that works, so the tables here are reproducible, but the mark scheme accepts
> any valid chain.

## The four conditions

The condition line is the only thing that separates most of these questions from each other.
Change it and everything else, the filling, the traceback, the cost, stays exactly the same.

![The same array solved under four different conditions](/notes/img/algorithms/ch09-four-conditions.svg)

| The question says | The condition is | Watch for |
| --- | --- | --- |
| increasing, rising, growing, improving | **:color[array[j] < array[i]]{hex="#A78BFA"}** | strictly, so equal values do not chain |
| decreasing, falling, dropping | **:color[array[j] > array[i]]{hex="#A78BFA"}** | same, the other way round |
| non decreasing, never fell, at least as much | **:color[array[j] <= array[i]]{hex="#A78BFA"}** | equal values **do** chain |
| non increasing, never rose, at most | **:color[array[j] >= array[i]]{hex="#A78BFA"}** | same |

> Faster, cheaper and lighter are all **decreasing**. Read the units before you pick the sign.
> A lap time falling is an improvement, and the recurrence has no idea what a lap time is.

## Why not divide and conquer

Part (b) of Example 1 asks this about Fibonacci, and the answer is the same for every
problem in the chapter.

![The Fibonacci recursion tree repeating subproblems beside the table that computes each once](/notes/img/algorithms/ch09-overlap.svg)

Divide and conquer splits a problem into subproblems that are **independent**. Merge sort's two
halves never share anything, so solving them separately wastes nothing.

Here the subproblems **overlap**. $fib(n-1)$ and $fib(n-2)$ both need $fib(n-3)$, and that goes
all the way down, so the recursion tree recomputes the same values an exponential number of
times: $\Theta(\phi^n)$, roughly $O(2^n)$. There are only $n$ distinct subproblems in the whole
tree. Writing each one down once turns that into $O(n)$.

:mark[**Overlapping subproblems is the condition for dynamic programming. Independent subproblems is the condition for divide and conquer.**]{hex="#3A3A3E"}

## Bottom up or memoisation

Both store answers. They differ in who decides which answers get computed.

![A bottom up table beside a memoised recursion, with what each is good for](/notes/img/algorithms/ch09-dp-vs-memo.svg)

| | Bottom up, a table | Top down, memoisation |
| --- | --- | --- |
| How | fill from the smallest subproblem up | recurse, but check a cache first |
| Which subproblems | **all** of them | only those actually reached |
| Recursion | none | yes, so the stack can run out |
| Wins when | you need most of the table anyway | most of the table is never needed |

For a subsequence question, every cell $lds(0) \dots lds(n-1)$ is needed to find the maximum,
so memoisation would compute the same set of values with extra function call overhead on top.
**Bottom up is the better answer here**, and that is what a part (iii) is asking you to say.

## What everything costs

| | Cost | Why |
| --- | --- | --- |
| Filling one cell | **:color[O(n)]{hex="#22C55E"}** | it looks at every cell to its left |
| Filling the table | **:color[O(n²)]{hex="#F97316"}** | $n$ cells, each costing $O(n)$ |
| Traceback | **:color[O(n)]{hex="#22C55E"}** | at most one hop per element |
| Space | **:color[O(n)]{hex="#22C55E"}** | one row of cells |
| The same problem by plain recursion | **:color[O(2ⁿ)]{hex="#EF4444"}** | every subproblem recomputed |

> There is an $O(n \log n)$ method for the longest increasing subsequence using binary search,
> but it does not fill this table and it will not answer a question that asks for one. Use it
> only when the question asks for the fastest possible method.

## The marks: what to write down

An examiner cannot give marks for a number they cannot follow. In order:

1. **State the condition** you are using, in symbols. One line.
2. **The working**, one row per cell: which $j$ qualified, what they held, what you took.
3. **The filled table**, with the index above each cell.
4. **The maximum**, said out loud, with the index it sits at.
5. **The traceback**, as a list of indices and then as a list of elements.
6. **A sentence** checking the answer really does satisfy the condition.

Step 6 costs ten seconds and catches almost every arithmetic slip.

---

# Examples

Both come from ICT 2019(3), Algorithms and Complexities. They are worked here exactly as they
would be marked, and every question in Parts A and B that follows is built to the same pattern.

## Example 1: Longest Decreasing Subsequence

> The Longest Decreasing Subsequence problem is to find the length of the longest subsequence of
> a given sequence such that all elements of the subsequence are sorted in decreasing order.
>
> Sample input `17, 29, 15, 41, 67, 57, 45, 69, 93`, output **3**, because `67, 57, 45` is the
> longest decreasing subsequence.

$$
lds(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lds(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] > array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

Take $array = 2, 10, 4, 5, 13, 3, 15, 20, 11, 1$.

### (a)(i) Fill the table and state the length of the LDS &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

The condition is **:color[array[j] > array[i]]{hex="#A78BFA"}**, so a value counts only if it is **larger** than the one being filled.

| $i$ | value | qualifying $j$ (its entry) | best | $lds(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 2 | none | - | 1, on its own |
| 1 | 10 | none | - | 1, on its own |
| 2 | 4 | 1 (1) | 1 | 1 + 1 = 2 |
| 3 | 5 | 1 (1) | 1 | 1 + 1 = 2 |
| 4 | 13 | none | - | 1, on its own |
| 5 | 3 | 1 (1), 2 (2), 3 (2), 4 (1) | 2 | 1 + 2 = 3 |
| 6 | 15 | none | - | 1, on its own |
| 7 | 20 | none | - | 1, on its own |
| 8 | 11 | 4 (1), 6 (1), 7 (1) | 1 | 1 + 1 = 2 |
| 9 | 1 | 0 (1), 1 (1), 2 (2), 3 (2), 4 (1), 5 (3), 6 (1), 7 (1), 8 (2) | 3 | 1 + 3 = 4 |

Which fills the row the question printed:

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | 2 | :mark[**10**]{hex="#204A2E"} | :mark[**4**]{hex="#204A2E"} | 5 | 13 | :mark[**3**]{hex="#204A2E"} | 15 | 20 | 11 | :mark[**1**]{hex="#204A2E"} |
| **lds** | 1 | :mark[**1**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | 2 | 1 | :mark[**3**]{hex="#204A2E"} | 1 | 1 | 2 | :mark[**4**]{hex="#204A2E"} |

The largest entry is **4**, at $i = 9$. Not the last cell because it happens to be last: it is the last cell because that is where the maximum is. Check the whole row.

:mark[**The length of the LDS is 4.**]{hex="#204A2E"}

### (a)(ii) Perform a traceback to identify the elements &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

Start at the largest entry, $i = 9$ holding **4**, and hop left to an entry one smaller that is also **larger in value**.

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 9$ | 4 | 1 | looking for an entry of 3 with a value above 1; $i = 5$ holds 3 and 3 > 1 |
| $i = 5$ | 3 | 3 | looking for an entry of 2 with a value above 3; $i = 2$ holds 2 and 4 > 3 |
| $i = 2$ | 2 | 4 | looking for an entry of 1 with a value above 4; $i = 1$ holds 1 and 10 > 4 |
| $i = 1$ | 1 | 10 | entry is 1, so this element starts the run and the walk stops |

Read left to right, the indices are $1, 2, 5, 9$ and the elements are $10, 4, 3, 1$.

**Check.** $10 > 4 > 3 > 1$, which is decreasing, and there are 4 of them. That agrees with the table.

:mark[**The LDS is 10, 4, 3, 1.**]{hex="#204A2E"}

### (a)(iii) Dynamic programming or memoisation? &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Bottom up dynamic programming.**

Every cell $lds(0)$ to $lds(n-1)$ has to be computed anyway, because the answer is the maximum
over the whole table and you cannot know which cell holds it until they are all filled. When the
entire subproblem space is needed, memoisation computes the same values and pays function call
and cache lookup overhead on top, and it recurses to a depth of $n$, which can overflow the stack.

> Memoisation would be the better answer if only a small part of the table were ever reached.
> That is not the case here, and saying **why** is where the two marks are.

### (b) Why dynamic programming for Fibonacci, not divide and conquer? &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

Because the subproblems **overlap**.

$fib(n) = fib(n-1) + fib(n-2)$, and those two branches both need $fib(n-2)$, $fib(n-3)$ and so on
all the way down. Divide and conquer assumes the subproblems are independent, so it solves each
branch from scratch and recomputes the same values over and over, taking $O(2^n)$ time. There are
only $n+1$ distinct values in the whole tree. Storing each one the first time it is computed
brings the cost down to $O(n)$ time.

:mark[**Divide and conquer is for independent subproblems. Overlapping subproblems is exactly what dynamic programming is for.**]{hex="#3A3A3E"}

---

## Example 2: Smartphones, price falling while rating rises

> Some people think that the more expensive a smartphone is, the better the quality of its camera.
> To disprove this, sort the dataset in **decreasing order of price** and find the **longest
> increasing subsequence** of camera ratings, so that prices are decreasing but ratings are
> increasing.

$$
LIS(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(LIS(\textcolor{#FF5FA2}{j})\big) &
\text{where } 0 \le \textcolor{#FF5FA2}{j} < \textcolor{#5B8CFF}{i}
\text{ and } \textcolor{#A78BFA}{array[j].rating < array[i].rating} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

The dataset as given, price in rupees and camera rating from 1 to 50:

| Model | Price | Camera rating |
| --- | --- | --- |
| P10354 | 15,000 | 28 |
| P10596 | 35,499 | 29 |
| P13465 | 35,000 | 10 |
| P10633 | 65,499 | 15 |
| P10435 | 39,999 | 16 |
| P17634 | 35,100 | 30 |
| P19083 | 18,499 | 45 |
| P18774 | 12,999 | 11 |
| P10876 | 21,499 | 20 |

### The step before the table: sort

The recurrence only compares ratings. It knows nothing about price, so the **price ordering has
to be built into the order of the array** before a single cell is filled. Sort by decreasing price:

| $i$ | Model | Price | Rating |
| --- | --- | --- | --- |
| 0 | P10633 | 65,499 | 15 |
| 1 | P10435 | 39,999 | 16 |
| 2 | P10596 | 35,499 | 29 |
| 3 | P17634 | 35,100 | 30 |
| 4 | P13465 | 35,000 | 10 |
| 5 | P10876 | 21,499 | 20 |
| 6 | P19083 | 18,499 | 45 |
| 7 | P10354 | 15,000 | 28 |
| 8 | P18774 | 12,999 | 11 |

> This is the whole trick of the question, and it is worth stating explicitly in an exam. Two
> quantities vary at once. Sorting pins one of them down, and the table then only has to think
> about the other.

### (a)(i) Fill the table &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

The condition is **:color[rating[j] < rating[i]]{hex="#A78BFA"}**, applied to the sorted order above.

| $i$ | value | qualifying $j$ (its entry) | best | $LIS(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 15 | none | - | 1, on its own |
| 1 | 16 | 0 (1) | 1 | 1 + 1 = 2 |
| 2 | 29 | 0 (1), 1 (2) | 2 | 1 + 2 = 3 |
| 3 | 30 | 0 (1), 1 (2), 2 (3) | 3 | 1 + 3 = 4 |
| 4 | 10 | none | - | 1, on its own |
| 5 | 20 | 0 (1), 1 (2), 4 (1) | 2 | 1 + 2 = 3 |
| 6 | 45 | 0 (1), 1 (2), 2 (3), 3 (4), 4 (1), 5 (3) | 4 | 1 + 4 = 5 |
| 7 | 28 | 0 (1), 1 (2), 4 (1), 5 (3) | 3 | 1 + 3 = 4 |
| 8 | 11 | 4 (1) | 1 | 1 + 1 = 2 |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**15**]{hex="#204A2E"} | :mark[**16**]{hex="#204A2E"} | :mark[**29**]{hex="#204A2E"} | :mark[**30**]{hex="#204A2E"} | 10 | 20 | :mark[**45**]{hex="#204A2E"} | 28 | 11 |
| **LIS** | :mark[**1**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | :mark[**3**]{hex="#204A2E"} | :mark[**4**]{hex="#204A2E"} | 1 | 3 | :mark[**5**]{hex="#204A2E"} | 4 | 2 |

The largest entry is **5**, at $i = 6$, which is model **P19083**.

:mark[**The longest increasing subsequence of ratings has length 5.**]{hex="#204A2E"}

### (a)(ii) Traceback, and list the smartphone references &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

| at | entry | model | rating | what happens next |
| --- | --- | --- | --- | --- |
| $i = 6$ | 5 | P19083 | 45 | need an entry of 4 with a rating below 45; $i = 3$ has 30 |
| $i = 3$ | 4 | P17634 | 30 | need an entry of 3 with a rating below 30; $i = 2$ has 29 |
| $i = 2$ | 3 | P10596 | 29 | need an entry of 2 with a rating below 29; $i = 1$ has 16 |
| $i = 1$ | 2 | P10435 | 16 | need an entry of 1 with a rating below 16; $i = 0$ has 15 |
| $i = 0$ | 1 | P10633 | 15 | entry is 1, the chain starts here |

Read forwards, that is:

| Model | Price | Rating |
| --- | --- | --- |
| P10633 | 65,499 | 15 |
| P10435 | 39,999 | 16 |
| P10596 | 35,499 | 29 |
| P17634 | 35,100 | 30 |
| P19083 | 18,499 | 45 |

**Check.** The prices fall at every step and the ratings rise at every step, which is what the question asked for.

:mark[**Answer: 5 smartphones** &nbsp; P10633, P10435, P10596, P17634, P19083]{hex="#204A2E"}

> **What it shows.** Five of the nine phones get cheaper and better at the same time, so the claim that a dearer phone has a better camera does not hold on this dataset. Say that in one sentence: the question asked you to disprove something, not just to fill a table.

---

# 50 practice questions

Every question below is solved the same way, in the same order, because that is the point: the
ritual does not change. Work each one on paper first, then check the table.

> **Parts A and B**, questions 1 to 25, are written as **whole exam questions**: a scenario, the
> recurrence in a brace, a sample input, then parts (i), (ii), (iii) and (b) carrying marks,
> exactly like the two examples above. Work them on paper, then read the solution.
>
> **Part C** drops the scaffolding and changes the recurrence instead. **Part D** moves to a two
> dimensional table, which is the same thing again with one more index.
>
> The traceback always takes the **leftmost** qualifying cell, so your table should match these
> exactly, even if your traceback picks a different valid chain.

## Part A: the four conditions

Full exam questions on a bare array, so nothing is in the way of the recurrence. Parts (iii) and
(b) rotate through the discussion questions this topic is actually asked, so read them even when
the table was easy: those four marks are the ones most often left on the table.

### Q1. Longest increasing subsequence

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

**(a)** The **Longest Increasing Subsequence (LIS)** problem is to find the length of the longest subsequence of a given sequence such that all elements of the subsequence are sorted in increasing order.

The following is a sample input and the corresponding output:

> **Input array:** $\{8, 3, 12, 6, 14, 9, 2\}$  
> **Output:** 3  
> **Explanation:** the longest strictly increasing subsequence is $\{8, 12, 14\}$

The recurrence relation for the LIS problem is as follows:

$$
lis(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lis(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] < array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

Assume that $array = \{3, 4, 1, 5, 9, 2, 6, 8, 7\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 8, where the indices show up to which element in the array is being considered. State the length of the LIS. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 3 | 4 | 1 | 5 | 9 | 2 | 6 | 8 | 7 |
| **lis(i)** |  |  |  |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] < array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lis(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 3 | none | - | 1, on its own |
| 1 | 4 | 0 (1) | 1 | 1 + 1 = 2 |
| 2 | 1 | none | - | 1, on its own |
| 3 | 5 | 0 (1), 1 (2), 2 (1) | 2 | 1 + 2 = 3 |
| 4 | 9 | 0 (1), 1 (2), 2 (1), 3 (3) | 3 | 1 + 3 = 4 |
| 5 | 2 | 2 (1) | 1 | 1 + 1 = 2 |
| 6 | 6 | 0 (1), 1 (2), 2 (1), 3 (3), 5 (2) | 3 | 1 + 3 = 4 |
| 7 | 8 | 0 (1), 1 (2), 2 (1), 3 (3), 5 (2), 6 (4) | 4 | 1 + 4 = 5 |
| 8 | 7 | 0 (1), 1 (2), 2 (1), 3 (3), 5 (2), 6 (4) | 4 | 1 + 4 = 5 |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**3**]{hex="#204A2E"} | :mark[**4**]{hex="#204A2E"} | 1 | :mark[**5**]{hex="#204A2E"} | 9 | 2 | :mark[**6**]{hex="#204A2E"} | :mark[**8**]{hex="#204A2E"} | 7 |
| **lis** | :mark[**1**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | 1 | :mark[**3**]{hex="#204A2E"} | 4 | 2 | :mark[**4**]{hex="#204A2E"} | :mark[**5**]{hex="#204A2E"} | 5 |

The largest entry is **5**, at $i = 7$.

:mark[**The length of the LIS is 5.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LIS. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 7$ | 5 | 8 | look left for an entry of 4 that also satisfies the condition against 8; $i = 6$ holds 4 |
| $i = 6$ | 4 | 6 | look left for an entry of 3 that also satisfies the condition against 6; $i = 3$ holds 3 |
| $i = 3$ | 3 | 5 | look left for an entry of 2 that also satisfies the condition against 5; $i = 1$ holds 2 |
| $i = 1$ | 2 | 4 | look left for an entry of 1 that also satisfies the condition against 4; $i = 0$ holds 1 |
| $i = 0$ | 1 | 3 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0, 1, 3, 6, 7$, so the LIS is $\{3, 4, 5, 6, 8\}$.

**Check.** $3 < 4 < 5 < 6 < 8$, which is strictly increasing, and there are 5 of them.

:mark[**The LIS is 3, 4, 5, 6, 8.**]{hex="#204A2E"}

**(iii)** Is it better to use *dynamic programming* or *memoisation* to solve this problem? Briefly explain your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> **Bottom up dynamic programming.** All 9 cells have to be computed anyway, because the answer is the largest entry in the table and you cannot know which cell holds it until every cell is filled. Memoisation would work out the same 9 values, pay a function call and a cache lookup for each, and recurse 9 deep. Memoisation is the better choice only when a large part of the subproblem space is never reached, which is not the case here.

**(b)** Dynamic programming can be used to compute the $n$th term in the Fibonacci sequence. Briefly explain **why** dynamic programming, rather than divide and conquer, is the right approach to solve the problem. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> Because the subproblems **overlap**. $fib(n)$ needs $fib(n-1)$ and $fib(n-2)$, and those two both need $fib(n-3)$, and so on all the way down. Divide and conquer assumes subproblems are independent, so it solves each branch from scratch and recomputes the same values an exponential number of times, :color[O(2ⁿ)]{hex="#EF4444"}. There are only $n+1$ distinct values in the whole tree, so storing each one the first time it is computed brings it down to :color[O(n)]{hex="#22C55E"}.

### Q2. Longest decreasing subsequence

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

**(a)** The **Longest Decreasing Subsequence (LDS)** problem is to find the length of the longest subsequence of a given sequence such that all elements of the subsequence are sorted in decreasing order.

The following is a sample input and the corresponding output:

> **Input array:** $\{23, 19, 31, 15, 27, 11, 35\}$  
> **Output:** 4  
> **Explanation:** the longest strictly decreasing subsequence is $\{23, 19, 15, 11\}$

The recurrence relation for the LDS problem is as follows:

$$
lds(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lds(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] > array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

Assume that $array = \{9, 2, 7, 4, 8, 3, 6, 1, 5\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 8, where the indices show up to which element in the array is being considered. State the length of the LDS. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 9 | 2 | 7 | 4 | 8 | 3 | 6 | 1 | 5 |
| **lds(i)** |  |  |  |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] > array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lds(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 9 | none | - | 1, on its own |
| 1 | 2 | 0 (1) | 1 | 1 + 1 = 2 |
| 2 | 7 | 0 (1) | 1 | 1 + 1 = 2 |
| 3 | 4 | 0 (1), 2 (2) | 2 | 1 + 2 = 3 |
| 4 | 8 | 0 (1) | 1 | 1 + 1 = 2 |
| 5 | 3 | 0 (1), 2 (2), 3 (3), 4 (2) | 3 | 1 + 3 = 4 |
| 6 | 6 | 0 (1), 2 (2), 4 (2) | 2 | 1 + 2 = 3 |
| 7 | 1 | 0 (1), 1 (2), 2 (2), 3 (3), 4 (2), 5 (4), 6 (3) | 4 | 1 + 4 = 5 |
| 8 | 5 | 0 (1), 2 (2), 4 (2), 6 (3) | 3 | 1 + 3 = 4 |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**9**]{hex="#204A2E"} | 2 | :mark[**7**]{hex="#204A2E"} | :mark[**4**]{hex="#204A2E"} | 8 | :mark[**3**]{hex="#204A2E"} | 6 | :mark[**1**]{hex="#204A2E"} | 5 |
| **lds** | :mark[**1**]{hex="#204A2E"} | 2 | :mark[**2**]{hex="#204A2E"} | :mark[**3**]{hex="#204A2E"} | 2 | :mark[**4**]{hex="#204A2E"} | 3 | :mark[**5**]{hex="#204A2E"} | 4 |

The largest entry is **5**, at $i = 7$.

:mark[**The length of the LDS is 5.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LDS. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 7$ | 5 | 1 | look left for an entry of 4 that also satisfies the condition against 1; $i = 5$ holds 4 |
| $i = 5$ | 4 | 3 | look left for an entry of 3 that also satisfies the condition against 3; $i = 3$ holds 3 |
| $i = 3$ | 3 | 4 | look left for an entry of 2 that also satisfies the condition against 4; $i = 2$ holds 2 |
| $i = 2$ | 2 | 7 | look left for an entry of 1 that also satisfies the condition against 7; $i = 0$ holds 1 |
| $i = 0$ | 1 | 9 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0, 2, 3, 5, 7$, so the LDS is $\{9, 7, 4, 3, 1\}$.

**Check.** $9 > 7 > 4 > 3 > 1$, which is strictly decreasing, and there are 5 of them.

:mark[**The LDS is 9, 7, 4, 3, 1.**]{hex="#204A2E"}

**(iii)** State the *time* and *space* complexity of the tabulated solution, and justify each briefly. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> **Time :color[O(n²)]{hex="#F97316"}.** There are $n$ cells, and filling cell $i$ scans the $i$ cells to its left, so the work is $1 + 2 + \dots + (n-1)$, which is $\frac{n(n-1)}{2}$. With $n = 9$ that is 36 comparisons in the worst case.
>
> **Space :color[O(n)]{hex="#22C55E"}.** One entry per element. The traceback reads the same row and needs nothing extra.

**(b)** State the two properties a problem must have before dynamic programming can be applied, and show that the problem in part (a) has both. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> **Optimal substructure**: the best answer is built from the best answers to smaller versions of the same problem. Here the best run ending at $i$ is the best run ending at some earlier $j$, plus one element, so it is built from a smaller optimum.
>
> **Overlapping subproblems**: the same smaller problem is asked for repeatedly. Here the entry at $j$ is read by every later index whose condition it satisfies, so without a table it would be recomputed each time.

### Q3. Longest non decreasing subsequence

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

**(a)** The **Longest Non Decreasing Subsequence (LNDS)** problem is to find the length of the longest subsequence of a given sequence in which no element is smaller than the one before it. Unlike the LIS problem, elements of equal value may sit next to each other.

The following is a sample input and the corresponding output:

> **Input array:** $\{5, 14, 7, 20, 9, 16, 4\}$  
> **Output:** 4  
> **Explanation:** the longest non decreasing subsequence is $\{5, 7, 9, 16\}$

The recurrence relation for the LNDS problem is as follows:

$$
lnds(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lnds(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] <= array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

Assume that $array = \{4, 4, 2, 6, 6, 3, 7, 7, 5\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 8, where the indices show up to which element in the array is being considered. State the length of the LNDS. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 4 | 4 | 2 | 6 | 6 | 3 | 7 | 7 | 5 |
| **lnds(i)** |  |  |  |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] <= array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lnds(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 4 | none | - | 1, on its own |
| 1 | 4 | 0 (1) | 1 | 1 + 1 = 2 |
| 2 | 2 | none | - | 1, on its own |
| 3 | 6 | 0 (1), 1 (2), 2 (1) | 2 | 1 + 2 = 3 |
| 4 | 6 | 0 (1), 1 (2), 2 (1), 3 (3) | 3 | 1 + 3 = 4 |
| 5 | 3 | 2 (1) | 1 | 1 + 1 = 2 |
| 6 | 7 | 0 (1), 1 (2), 2 (1), 3 (3), 4 (4), 5 (2) | 4 | 1 + 4 = 5 |
| 7 | 7 | 0 (1), 1 (2), 2 (1), 3 (3), 4 (4), 5 (2), 6 (5) | 5 | 1 + 5 = 6 |
| 8 | 5 | 0 (1), 1 (2), 2 (1), 5 (2) | 2 | 1 + 2 = 3 |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**4**]{hex="#204A2E"} | :mark[**4**]{hex="#204A2E"} | 2 | :mark[**6**]{hex="#204A2E"} | :mark[**6**]{hex="#204A2E"} | 3 | :mark[**7**]{hex="#204A2E"} | :mark[**7**]{hex="#204A2E"} | 5 |
| **lnds** | :mark[**1**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | 1 | :mark[**3**]{hex="#204A2E"} | :mark[**4**]{hex="#204A2E"} | 2 | :mark[**5**]{hex="#204A2E"} | :mark[**6**]{hex="#204A2E"} | 3 |

The largest entry is **6**, at $i = 7$.

:mark[**The length of the LNDS is 6.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LNDS. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 7$ | 6 | 7 | look left for an entry of 5 that also satisfies the condition against 7; $i = 6$ holds 5 |
| $i = 6$ | 5 | 7 | look left for an entry of 4 that also satisfies the condition against 7; $i = 4$ holds 4 |
| $i = 4$ | 4 | 6 | look left for an entry of 3 that also satisfies the condition against 6; $i = 3$ holds 3 |
| $i = 3$ | 3 | 6 | look left for an entry of 2 that also satisfies the condition against 6; $i = 1$ holds 2 |
| $i = 1$ | 2 | 4 | look left for an entry of 1 that also satisfies the condition against 4; $i = 0$ holds 1 |
| $i = 0$ | 1 | 4 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0, 1, 3, 4, 6, 7$, so the LNDS is $\{4, 4, 6, 6, 7, 7\}$.

**Check.** $4 \le 4 \le 6 \le 6 \le 7 \le 7$, which is non decreasing, and there are 6 of them.

:mark[**The LNDS is 4, 4, 6, 6, 7, 7.**]{hex="#204A2E"}

**(iii)** A student claims the answer is always the value held in the **last** cell of the table. Explain why this is wrong, referring to your table. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> A cell holds the length of the best run **ending at that index**, not the best run overall. In this table the last cell holds **3**, while the answer is **6** and sits at $i = 7$. The best run finishes in the middle of the array, so the last cell knows nothing about it. Always scan the whole row.

**(b)** Explain the difference between a **subsequence** and a **substring**, giving one example of each from the array in part (a). &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> A **substring** is contiguous: it has to be a block of neighbouring elements, such as $\{4, 4, 2\}$. A **subsequence** only has to keep the original left to right order, so elements may be skipped, such as $\{4, 2\}$. Every substring is a subsequence; the reverse is not true. This question asks for a subsequence, which is why the recurrence looks at **every** $j$ to the left rather than only at $i - 1$.

> **Worth noticing.** Compare this with Q1. The only change is `<` becoming `<=`, and it is worth two extra elements here.

### Q4. Longest non increasing subsequence

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

**(a)** The **Longest Non Increasing Subsequence (LNIS)** problem is to find the length of the longest subsequence of a given sequence in which no element is larger than the one before it. Elements of equal value may sit next to each other.

The following is a sample input and the corresponding output:

> **Input array:** $\{40, 22, 55, 31, 48, 18, 60\}$  
> **Output:** 3  
> **Explanation:** the longest non increasing subsequence is $\{40, 22, 18\}$

The recurrence relation for the LNIS problem is as follows:

$$
lnis(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lnis(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] >= array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

Assume that $array = \{5, 8, 5, 3, 8, 3, 2, 6, 2\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 8, where the indices show up to which element in the array is being considered. State the length of the LNIS. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 5 | 8 | 5 | 3 | 8 | 3 | 2 | 6 | 2 |
| **lnis(i)** |  |  |  |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] >= array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lnis(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 5 | none | - | 1, on its own |
| 1 | 8 | none | - | 1, on its own |
| 2 | 5 | 0 (1), 1 (1) | 1 | 1 + 1 = 2 |
| 3 | 3 | 0 (1), 1 (1), 2 (2) | 2 | 1 + 2 = 3 |
| 4 | 8 | 1 (1) | 1 | 1 + 1 = 2 |
| 5 | 3 | 0 (1), 1 (1), 2 (2), 3 (3), 4 (2) | 3 | 1 + 3 = 4 |
| 6 | 2 | 0 (1), 1 (1), 2 (2), 3 (3), 4 (2), 5 (4) | 4 | 1 + 4 = 5 |
| 7 | 6 | 1 (1), 4 (2) | 2 | 1 + 2 = 3 |
| 8 | 2 | 0 (1), 1 (1), 2 (2), 3 (3), 4 (2), 5 (4), 6 (5), 7 (3) | 5 | 1 + 5 = 6 |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**5**]{hex="#204A2E"} | 8 | :mark[**5**]{hex="#204A2E"} | :mark[**3**]{hex="#204A2E"} | 8 | :mark[**3**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | 6 | :mark[**2**]{hex="#204A2E"} |
| **lnis** | :mark[**1**]{hex="#204A2E"} | 1 | :mark[**2**]{hex="#204A2E"} | :mark[**3**]{hex="#204A2E"} | 2 | :mark[**4**]{hex="#204A2E"} | :mark[**5**]{hex="#204A2E"} | 3 | :mark[**6**]{hex="#204A2E"} |

The largest entry is **6**, at $i = 8$.

:mark[**The length of the LNIS is 6.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LNIS. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 8$ | 6 | 2 | look left for an entry of 5 that also satisfies the condition against 2; $i = 6$ holds 5 |
| $i = 6$ | 5 | 2 | look left for an entry of 4 that also satisfies the condition against 2; $i = 5$ holds 4 |
| $i = 5$ | 4 | 3 | look left for an entry of 3 that also satisfies the condition against 3; $i = 3$ holds 3 |
| $i = 3$ | 3 | 3 | look left for an entry of 2 that also satisfies the condition against 3; $i = 2$ holds 2 |
| $i = 2$ | 2 | 5 | look left for an entry of 1 that also satisfies the condition against 5; $i = 0$ holds 1 |
| $i = 0$ | 1 | 5 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0, 2, 3, 5, 6, 8$, so the LNIS is $\{5, 5, 3, 3, 2, 2\}$.

**Check.** $5 \ge 5 \ge 3 \ge 3 \ge 2 \ge 2$, which is non increasing, and there are 6 of them.

:mark[**The LNIS is 5, 5, 3, 3, 2, 2.**]{hex="#204A2E"}

**(iii)** How would the recurrence change if equal values were **no longer** allowed to sit together? State the new condition and its effect on your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> Only the condition line changes, to **:color[array[j] > array[i]]{hex="#A78BFA"}**. Everything else, the fill order, the base value of 1 and the traceback, is untouched. Refilling the table under that condition gives **4** instead of **6**, from $\{8, 5, 3, 2\}$.

**(b)** Merge sort is solved by divide and conquer. Explain why dynamic programming would give it no advantage. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> Merge sort splits the array into two halves that share no elements, so the two subproblems are **independent**. Nothing is ever computed twice, and there is nothing for a table to save. Dynamic programming only pays for itself when subproblems overlap; here it would add the cost of storing results and return none of it.

### Q5. The answer is not in the last cell

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

**(a)** The **Longest Increasing Subsequence (LIS)** problem is to find the length of the longest subsequence of a given sequence such that all elements of the subsequence are sorted in increasing order. In this instance the run that gives the answer does **not** reach the end of the array.

The following is a sample input and the corresponding output:

> **Input array:** $\{12, 26, 9, 33, 21, 7, 30\}$  
> **Output:** 3  
> **Explanation:** the longest strictly increasing subsequence is $\{12, 26, 33\}$

The recurrence relation for the LIS problem is as follows:

$$
lis(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lis(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] < array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

Assume that $array = \{2, 5, 7, 9, 11, 1, 3\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 6, where the indices show up to which element in the array is being considered. State the length of the LIS. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 2 | 5 | 7 | 9 | 11 | 1 | 3 |
| **lis(i)** |  |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] < array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lis(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 2 | none | - | 1, on its own |
| 1 | 5 | 0 (1) | 1 | 1 + 1 = 2 |
| 2 | 7 | 0 (1), 1 (2) | 2 | 1 + 2 = 3 |
| 3 | 9 | 0 (1), 1 (2), 2 (3) | 3 | 1 + 3 = 4 |
| 4 | 11 | 0 (1), 1 (2), 2 (3), 3 (4) | 4 | 1 + 4 = 5 |
| 5 | 1 | none | - | 1, on its own |
| 6 | 3 | 0 (1), 5 (1) | 1 | 1 + 1 = 2 |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**2**]{hex="#204A2E"} | :mark[**5**]{hex="#204A2E"} | :mark[**7**]{hex="#204A2E"} | :mark[**9**]{hex="#204A2E"} | :mark[**11**]{hex="#204A2E"} | 1 | 3 |
| **lis** | :mark[**1**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | :mark[**3**]{hex="#204A2E"} | :mark[**4**]{hex="#204A2E"} | :mark[**5**]{hex="#204A2E"} | 1 | 2 |

The largest entry is **5**, at $i = 4$.

:mark[**The length of the LIS is 5.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LIS. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 4$ | 5 | 11 | look left for an entry of 4 that also satisfies the condition against 11; $i = 3$ holds 4 |
| $i = 3$ | 4 | 9 | look left for an entry of 3 that also satisfies the condition against 9; $i = 2$ holds 3 |
| $i = 2$ | 3 | 7 | look left for an entry of 2 that also satisfies the condition against 7; $i = 1$ holds 2 |
| $i = 1$ | 2 | 5 | look left for an entry of 1 that also satisfies the condition against 5; $i = 0$ holds 1 |
| $i = 0$ | 1 | 2 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0, 1, 2, 3, 4$, so the LIS is $\{2, 5, 7, 9, 11\}$.

**Check.** $2 < 5 < 7 < 9 < 11$, which is strictly increasing, and there are 5 of them.

:mark[**The LIS is 2, 5, 7, 9, 11.**]{hex="#204A2E"}

**(iii)** Would a greedy method that starts at index 0 and extends the run whenever the condition allows produce the same answer? Justify with reference to your array. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> It gives **5** here, which happens to match the correct answer of **5**, but that is luck rather than correctness. Greedy commits to the first element and can never reconsider, so on an array beginning with a value that belongs to no long run it fails. Dynamic programming asks the question separately for every ending point.

**(b)** Briefly explain the difference between the **top down** and **bottom up** formulations of a dynamic programming solution. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> **Bottom up** fills a table starting from the smallest subproblem and works upwards, with no recursion, and computes every cell. **Top down**, or memoisation, writes the recursion as it stands but checks a cache before doing any work, so it only computes the subproblems it actually reaches, at the cost of recursion depth. Both store each answer once, and both turn exponential into polynomial.

> **Worth noticing.** The last cell holds **2**, and the answer is **5**. Scan the whole table for the maximum. This is the single most common way to lose the marks you have already earned.

### Q6. Strict beats a plateau

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

**(a)** The **Longest Increasing Subsequence (LIS)** problem requires the elements of the subsequence to be **strictly** increasing. Consider what this means for a sequence in which every element is identical.

The following is a sample input and the corresponding output:

> **Input array:** $\{61, 44, 72, 38, 56, 29, 65\}$  
> **Output:** 3  
> **Explanation:** the longest strictly increasing subsequence is $\{44, 56, 65\}$

The recurrence relation for the LIS problem is as follows:

$$
lis(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lis(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] < array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

Assume that $array = \{6, 6, 6, 6, 6, 6\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 5, where the indices show up to which element in the array is being considered. State the length of the LIS. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 6 | 6 | 6 | 6 | 6 | 6 |
| **lis(i)** |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] < array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lis(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 6 | none | - | 1, on its own |
| 1 | 6 | none | - | 1, on its own |
| 2 | 6 | none | - | 1, on its own |
| 3 | 6 | none | - | 1, on its own |
| 4 | 6 | none | - | 1, on its own |
| 5 | 6 | none | - | 1, on its own |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**6**]{hex="#204A2E"} | 6 | 6 | 6 | 6 | 6 |
| **lis** | :mark[**1**]{hex="#204A2E"} | 1 | 1 | 1 | 1 | 1 |

The largest entry is **1**, at $i = 0$.

:mark[**The length of the LIS is 1.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LIS. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 0$ | 1 | 6 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0$, so the LIS is $\{6\}$.

**Check.** $6$, which is strictly increasing, and there are 1 of them.

:mark[**The LIS is 6.**]{hex="#204A2E"}

**(iii)** How many distinct subproblems does this solution solve, and how much work does each one do? &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> **6 subproblems**, one per index: *the length of the best qualifying run ending at $i$*, for $i = 0$ to $5$. Subproblem $i$ inspects the $i$ entries to its left, so it costs $O(i)$. Summed over all of them that is :color[O(n²)]{hex="#F97316"}. The plain recursion solves the same 6 subproblems an exponential number of times.

**(b)** What is the worst case running time of a plain recursive solution to the problem in part (a), and why is it so much worse than the tabulated one? &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> :color[O(2ⁿ)]{hex="#EF4444"}. Each call branches over every earlier index, and none of the results are kept, so the same subproblem is re-entered along every path that reaches it. The tabulated version solves each of the $n$ subproblems exactly once at a cost of $O(n)$ each, giving :color[O(n²)]{hex="#F97316"}. The saving is entirely in writing answers down, not in a better algorithm.

> **Worth noticing.** Nothing is strictly larger than anything, so every cell stands alone at 1. Under the non decreasing condition the same array would answer **6**.

### Q7. Increasing subsequence of a falling array

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

**(a)** The **Longest Increasing Subsequence (LIS)** problem is to find the length of the longest subsequence sorted in increasing order. Consider a sequence that never rises.

The following is a sample input and the corresponding output:

> **Input array:** $\{3, 18, 11, 25, 14, 6, 21\}$  
> **Output:** 4  
> **Explanation:** the longest strictly increasing subsequence is $\{3, 11, 14, 21\}$

The recurrence relation for the LIS problem is as follows:

$$
lis(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lis(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] < array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

Assume that $array = \{20, 17, 14, 11, 8, 5\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 5, where the indices show up to which element in the array is being considered. State the length of the LIS. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 20 | 17 | 14 | 11 | 8 | 5 |
| **lis(i)** |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] < array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lis(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 20 | none | - | 1, on its own |
| 1 | 17 | none | - | 1, on its own |
| 2 | 14 | none | - | 1, on its own |
| 3 | 11 | none | - | 1, on its own |
| 4 | 8 | none | - | 1, on its own |
| 5 | 5 | none | - | 1, on its own |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**20**]{hex="#204A2E"} | 17 | 14 | 11 | 8 | 5 |
| **lis** | :mark[**1**]{hex="#204A2E"} | 1 | 1 | 1 | 1 | 1 |

The largest entry is **1**, at $i = 0$.

:mark[**The length of the LIS is 1.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LIS. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 0$ | 1 | 20 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0$, so the LIS is $\{20\}$.

**Check.** $20$, which is strictly increasing, and there are 1 of them.

:mark[**The LIS is 20.**]{hex="#204A2E"}

**(iii)** If the array were **reversed** before the table was filled, would the answer change? Explain. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> Reversing turns every *strictly increasing* run into a run of the opposite kind, so this recurrence no longer finds the same thing. Filling the table on the reversed array gives **6** rather than **1**. To get the original answer from the reversed array you would have to flip the condition as well.

**(b)** Define **optimal substructure** and identify where it appears in the recurrence given in part (a). &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> A problem has optimal substructure when an optimal solution contains within it optimal solutions to its subproblems. In the recurrence it is the :color[max]{hex="#EAB308"} term: the best run ending at $i$ is formed by taking the **best** run ending at some earlier $j$ and extending it. If that inner run were not itself optimal, a better one could be substituted and the outer answer would improve, which contradicts it being the best.

> **Worth noticing.** A table of all ones is a correct answer, not a mistake. Write it out anyway, because the marks are for the table.

### Q8. Negative numbers change nothing

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

**(a)** The **Longest Increasing Subsequence (LIS)** problem is to find the length of the longest subsequence sorted in increasing order. The comparison is unaffected by the sign of the values.

The following is a sample input and the corresponding output:

> **Input array:** $\{50, 36, 64, 28, 47, 20, 58\}$  
> **Output:** 3  
> **Explanation:** the longest strictly increasing subsequence is $\{36, 47, 58\}$

The recurrence relation for the LIS problem is as follows:

$$
lis(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lis(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] < array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

Assume that $array = \{-5, -2, -8, -1, -6, 0, -3\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 6, where the indices show up to which element in the array is being considered. State the length of the LIS. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | -5 | -2 | -8 | -1 | -6 | 0 | -3 |
| **lis(i)** |  |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] < array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lis(i)$ |
| --- | --- | --- | --- | --- |
| 0 | -5 | none | - | 1, on its own |
| 1 | -2 | 0 (1) | 1 | 1 + 1 = 2 |
| 2 | -8 | none | - | 1, on its own |
| 3 | -1 | 0 (1), 1 (2), 2 (1) | 2 | 1 + 2 = 3 |
| 4 | -6 | 2 (1) | 1 | 1 + 1 = 2 |
| 5 | 0 | 0 (1), 1 (2), 2 (1), 3 (3), 4 (2) | 3 | 1 + 3 = 4 |
| 6 | -3 | 0 (1), 2 (1), 4 (2) | 2 | 1 + 2 = 3 |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**-5**]{hex="#204A2E"} | :mark[**-2**]{hex="#204A2E"} | -8 | :mark[**-1**]{hex="#204A2E"} | -6 | :mark[**0**]{hex="#204A2E"} | -3 |
| **lis** | :mark[**1**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | 1 | :mark[**3**]{hex="#204A2E"} | 2 | :mark[**4**]{hex="#204A2E"} | 3 |

The largest entry is **4**, at $i = 5$.

:mark[**The length of the LIS is 4.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LIS. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 5$ | 4 | 0 | look left for an entry of 3 that also satisfies the condition against 0; $i = 3$ holds 3 |
| $i = 3$ | 3 | -1 | look left for an entry of 2 that also satisfies the condition against -1; $i = 1$ holds 2 |
| $i = 1$ | 2 | -2 | look left for an entry of 1 that also satisfies the condition against -2; $i = 0$ holds 1 |
| $i = 0$ | 1 | -5 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0, 1, 3, 5$, so the LIS is $\{-5, -2, -1, 0\}$.

**Check.** $-5 < -2 < -1 < 0$, which is strictly increasing, and there are 4 of them.

:mark[**The LIS is -5, -2, -1, 0.**]{hex="#204A2E"}

**(iii)** Explain why the table has to be filled from index 0 upwards, and what would go wrong if it were filled from the right. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> Cell $i$ is defined in terms of cells $0$ to $i-1$, so those have to hold their final values before cell $i$ is written. Filling from the right means every cell reads entries that are still empty, and the recurrence would fall through to the base case every time, producing a row of ones. The fill order is the whole meaning of the phrase *bottom up*: smallest subproblem first, largest last.

**(b)** Dynamic programming can be used to compute the $n$th term in the Fibonacci sequence. Briefly explain **why** dynamic programming, rather than divide and conquer, is the right approach to solve the problem. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> Because the subproblems **overlap**. $fib(n)$ needs $fib(n-1)$ and $fib(n-2)$, and those two both need $fib(n-3)$, and so on all the way down. Divide and conquer assumes subproblems are independent, so it solves each branch from scratch and recomputes the same values an exponential number of times, :color[O(2ⁿ)]{hex="#EF4444"}. There are only $n+1$ distinct values in the whole tree, so storing each one the first time it is computed brings it down to :color[O(n)]{hex="#22C55E"}.

> **Worth noticing.** The comparison is the same comparison. Only the ordering of the numbers on the page looks unfamiliar.

### Q9. Longest decreasing subsequence over ten elements

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

**(a)** The **Longest Decreasing Subsequence (LDS)** problem is to find the length of the longest subsequence of a given sequence such that all elements of the subsequence are sorted in decreasing order.

The following is a sample input and the corresponding output:

> **Input array:** $\{9, 24, 16, 37, 13, 30, 5\}$  
> **Output:** 4  
> **Explanation:** the longest strictly decreasing subsequence is $\{24, 16, 13, 5\}$

The recurrence relation for the LDS problem is as follows:

$$
lds(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lds(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] > array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

Assume that $array = \{12, 30, 9, 25, 8, 22, 7, 20, 6, 18\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 9, where the indices show up to which element in the array is being considered. State the length of the LDS. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 12 | 30 | 9 | 25 | 8 | 22 | 7 | 20 | 6 | 18 |
| **lds(i)** |  |  |  |  |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] > array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lds(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 12 | none | - | 1, on its own |
| 1 | 30 | none | - | 1, on its own |
| 2 | 9 | 0 (1), 1 (1) | 1 | 1 + 1 = 2 |
| 3 | 25 | 1 (1) | 1 | 1 + 1 = 2 |
| 4 | 8 | 0 (1), 1 (1), 2 (2), 3 (2) | 2 | 1 + 2 = 3 |
| 5 | 22 | 1 (1), 3 (2) | 2 | 1 + 2 = 3 |
| 6 | 7 | 0 (1), 1 (1), 2 (2), 3 (2), 4 (3), 5 (3) | 3 | 1 + 3 = 4 |
| 7 | 20 | 1 (1), 3 (2), 5 (3) | 3 | 1 + 3 = 4 |
| 8 | 6 | 0 (1), 1 (1), 2 (2), 3 (2), 4 (3), 5 (3), 6 (4), 7 (4) | 4 | 1 + 4 = 5 |
| 9 | 18 | 1 (1), 3 (2), 5 (3), 7 (4) | 4 | 1 + 4 = 5 |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**12**]{hex="#204A2E"} | 30 | :mark[**9**]{hex="#204A2E"} | 25 | :mark[**8**]{hex="#204A2E"} | 22 | :mark[**7**]{hex="#204A2E"} | 20 | :mark[**6**]{hex="#204A2E"} | 18 |
| **lds** | :mark[**1**]{hex="#204A2E"} | 1 | :mark[**2**]{hex="#204A2E"} | 2 | :mark[**3**]{hex="#204A2E"} | 3 | :mark[**4**]{hex="#204A2E"} | 4 | :mark[**5**]{hex="#204A2E"} | 5 |

The largest entry is **5**, at $i = 8$.

:mark[**The length of the LDS is 5.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LDS. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 8$ | 5 | 6 | look left for an entry of 4 that also satisfies the condition against 6; $i = 6$ holds 4 |
| $i = 6$ | 4 | 7 | look left for an entry of 3 that also satisfies the condition against 7; $i = 4$ holds 3 |
| $i = 4$ | 3 | 8 | look left for an entry of 2 that also satisfies the condition against 8; $i = 2$ holds 2 |
| $i = 2$ | 2 | 9 | look left for an entry of 1 that also satisfies the condition against 9; $i = 0$ holds 1 |
| $i = 0$ | 1 | 12 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0, 2, 4, 6, 8$, so the LDS is $\{12, 9, 8, 7, 6\}$.

**Check.** $12 > 9 > 8 > 7 > 6$, which is strictly decreasing, and there are 5 of them.

:mark[**The LDS is 12, 9, 8, 7, 6.**]{hex="#204A2E"}

**(iii)** Is it better to use *dynamic programming* or *memoisation* to solve this problem? Briefly explain your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> **Bottom up dynamic programming.** All 10 cells have to be computed anyway, because the answer is the largest entry in the table and you cannot know which cell holds it until every cell is filled. Memoisation would work out the same 10 values, pay a function call and a cache lookup for each, and recurse 10 deep. Memoisation is the better choice only when a large part of the subproblem space is never reached, which is not the case here.

**(b)** State the two properties a problem must have before dynamic programming can be applied, and show that the problem in part (a) has both. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> **Optimal substructure**: the best answer is built from the best answers to smaller versions of the same problem. Here the best run ending at $i$ is the best run ending at some earlier $j$, plus one element, so it is built from a smaller optimum.
>
> **Overlapping subproblems**: the same smaller problem is asked for repeatedly. Here the entry at $j$ is read by every later index whose condition it satisfies, so without a table it would be recomputed each time.

### Q10. A plateau under the non decreasing rule

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

**(a)** The **Longest Non Decreasing Subsequence (LNDS)** problem is to find the length of the longest subsequence in which no element is smaller than the one before it. Repeated values are common in this instance, so read the condition carefully.

The following is a sample input and the corresponding output:

> **Input array:** $\{17, 29, 15, 41, 67, 57, 45\}$  
> **Output:** 4  
> **Explanation:** the longest non decreasing subsequence is $\{17, 29, 41, 67\}$

The recurrence relation for the LNDS problem is as follows:

$$
lnds(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lnds(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] <= array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

Assume that $array = \{1, 3, 3, 2, 3, 5, 5, 4, 6, 6\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 9, where the indices show up to which element in the array is being considered. State the length of the LNDS. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 1 | 3 | 3 | 2 | 3 | 5 | 5 | 4 | 6 | 6 |
| **lnds(i)** |  |  |  |  |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] <= array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lnds(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 1 | none | - | 1, on its own |
| 1 | 3 | 0 (1) | 1 | 1 + 1 = 2 |
| 2 | 3 | 0 (1), 1 (2) | 2 | 1 + 2 = 3 |
| 3 | 2 | 0 (1) | 1 | 1 + 1 = 2 |
| 4 | 3 | 0 (1), 1 (2), 2 (3), 3 (2) | 3 | 1 + 3 = 4 |
| 5 | 5 | 0 (1), 1 (2), 2 (3), 3 (2), 4 (4) | 4 | 1 + 4 = 5 |
| 6 | 5 | 0 (1), 1 (2), 2 (3), 3 (2), 4 (4), 5 (5) | 5 | 1 + 5 = 6 |
| 7 | 4 | 0 (1), 1 (2), 2 (3), 3 (2), 4 (4) | 4 | 1 + 4 = 5 |
| 8 | 6 | 0 (1), 1 (2), 2 (3), 3 (2), 4 (4), 5 (5), 6 (6), 7 (5) | 6 | 1 + 6 = 7 |
| 9 | 6 | 0 (1), 1 (2), 2 (3), 3 (2), 4 (4), 5 (5), 6 (6), 7 (5), 8 (7) | 7 | 1 + 7 = 8 |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**1**]{hex="#204A2E"} | :mark[**3**]{hex="#204A2E"} | :mark[**3**]{hex="#204A2E"} | 2 | :mark[**3**]{hex="#204A2E"} | :mark[**5**]{hex="#204A2E"} | :mark[**5**]{hex="#204A2E"} | 4 | :mark[**6**]{hex="#204A2E"} | :mark[**6**]{hex="#204A2E"} |
| **lnds** | :mark[**1**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | :mark[**3**]{hex="#204A2E"} | 2 | :mark[**4**]{hex="#204A2E"} | :mark[**5**]{hex="#204A2E"} | :mark[**6**]{hex="#204A2E"} | 5 | :mark[**7**]{hex="#204A2E"} | :mark[**8**]{hex="#204A2E"} |

The largest entry is **8**, at $i = 9$.

:mark[**The length of the LNDS is 8.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LNDS. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 9$ | 8 | 6 | look left for an entry of 7 that also satisfies the condition against 6; $i = 8$ holds 7 |
| $i = 8$ | 7 | 6 | look left for an entry of 6 that also satisfies the condition against 6; $i = 6$ holds 6 |
| $i = 6$ | 6 | 5 | look left for an entry of 5 that also satisfies the condition against 5; $i = 5$ holds 5 |
| $i = 5$ | 5 | 5 | look left for an entry of 4 that also satisfies the condition against 5; $i = 4$ holds 4 |
| $i = 4$ | 4 | 3 | look left for an entry of 3 that also satisfies the condition against 3; $i = 2$ holds 3 |
| $i = 2$ | 3 | 3 | look left for an entry of 2 that also satisfies the condition against 3; $i = 1$ holds 2 |
| $i = 1$ | 2 | 3 | look left for an entry of 1 that also satisfies the condition against 3; $i = 0$ holds 1 |
| $i = 0$ | 1 | 1 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0, 1, 2, 4, 5, 6, 8, 9$, so the LNDS is $\{1, 3, 3, 3, 5, 5, 6, 6\}$.

**Check.** $1 \le 3 \le 3 \le 3 \le 5 \le 5 \le 6 \le 6$, which is non decreasing, and there are 8 of them.

:mark[**The LNDS is 1, 3, 3, 3, 5, 5, 6, 6.**]{hex="#204A2E"}

**(iii)** State the *time* and *space* complexity of the tabulated solution, and justify each briefly. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> **Time :color[O(n²)]{hex="#F97316"}.** There are $n$ cells, and filling cell $i$ scans the $i$ cells to its left, so the work is $1 + 2 + \dots + (n-1)$, which is $\frac{n(n-1)}{2}$. With $n = 10$ that is 45 comparisons in the worst case.
>
> **Space :color[O(n)]{hex="#22C55E"}.** One entry per element. The traceback reads the same row and needs nothing extra.

**(b)** Explain the difference between a **subsequence** and a **substring**, giving one example of each from the array in part (a). &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> A **substring** is contiguous: it has to be a block of neighbouring elements, such as $\{1, 3, 3\}$. A **subsequence** only has to keep the original left to right order, so elements may be skipped, such as $\{1, 3\}$. Every substring is a subsequence; the reverse is not true. This question asks for a subsequence, which is why the recurrence looks at **every** $j$ to the left rather than only at $i - 1$.

### Q11. Two cells tie for the maximum

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

**(a)** The **Longest Increasing Subsequence (LIS)** problem is to find the length of the longest subsequence sorted in increasing order. In this instance more than one cell of the completed table holds the maximum, so more than one traceback is correct.

The following is a sample input and the corresponding output:

> **Input array:** $\{8, 3, 12, 6, 14, 9, 2\}$  
> **Output:** 3  
> **Explanation:** the longest strictly increasing subsequence is $\{8, 12, 14\}$

The recurrence relation for the LIS problem is as follows:

$$
lis(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lis(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] < array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

Assume that $array = \{1, 6, 2, 7, 3, 8, 4, 9\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 7, where the indices show up to which element in the array is being considered. State the length of the LIS. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 1 | 6 | 2 | 7 | 3 | 8 | 4 | 9 |
| **lis(i)** |  |  |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] < array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lis(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 1 | none | - | 1, on its own |
| 1 | 6 | 0 (1) | 1 | 1 + 1 = 2 |
| 2 | 2 | 0 (1) | 1 | 1 + 1 = 2 |
| 3 | 7 | 0 (1), 1 (2), 2 (2) | 2 | 1 + 2 = 3 |
| 4 | 3 | 0 (1), 2 (2) | 2 | 1 + 2 = 3 |
| 5 | 8 | 0 (1), 1 (2), 2 (2), 3 (3), 4 (3) | 3 | 1 + 3 = 4 |
| 6 | 4 | 0 (1), 2 (2), 4 (3) | 3 | 1 + 3 = 4 |
| 7 | 9 | 0 (1), 1 (2), 2 (2), 3 (3), 4 (3), 5 (4), 6 (4) | 4 | 1 + 4 = 5 |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**1**]{hex="#204A2E"} | :mark[**6**]{hex="#204A2E"} | 2 | :mark[**7**]{hex="#204A2E"} | 3 | :mark[**8**]{hex="#204A2E"} | 4 | :mark[**9**]{hex="#204A2E"} |
| **lis** | :mark[**1**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | 2 | :mark[**3**]{hex="#204A2E"} | 3 | :mark[**4**]{hex="#204A2E"} | 4 | :mark[**5**]{hex="#204A2E"} |

The largest entry is **5**, at $i = 7$.

:mark[**The length of the LIS is 5.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LIS. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 7$ | 5 | 9 | look left for an entry of 4 that also satisfies the condition against 9; $i = 5$ holds 4 |
| $i = 5$ | 4 | 8 | look left for an entry of 3 that also satisfies the condition against 8; $i = 3$ holds 3 |
| $i = 3$ | 3 | 7 | look left for an entry of 2 that also satisfies the condition against 7; $i = 1$ holds 2 |
| $i = 1$ | 2 | 6 | look left for an entry of 1 that also satisfies the condition against 6; $i = 0$ holds 1 |
| $i = 0$ | 1 | 1 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0, 1, 3, 5, 7$, so the LIS is $\{1, 6, 7, 8, 9\}$.

**Check.** $1 < 6 < 7 < 8 < 9$, which is strictly increasing, and there are 5 of them.

:mark[**The LIS is 1, 6, 7, 8, 9.**]{hex="#204A2E"}

**(iii)** A student claims the answer is always the value held in the **last** cell of the table. Explain why this is wrong, referring to your table. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> A cell holds the length of the best run **ending at that index**, not the best run overall. In this table the last cell holds **5**, while the answer is **5** and sits at $i = 7$. The two agree here only by coincidence, because the best run happens to finish at the last element. Change one value and they part company.

**(b)** Merge sort is solved by divide and conquer. Explain why dynamic programming would give it no advantage. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> Merge sort splits the array into two halves that share no elements, so the two subproblems are **independent**. Nothing is ever computed twice, and there is nothing for a table to save. Dynamic programming only pays for itself when subproblems overlap; here it would add the cost of storing results and return none of it.

> **Worth noticing.** When two cells hold the same maximum, either traceback earns full marks. State which cell you started from so the examiner can follow you.

### Q12. Twelve elements, one pass

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

**(a)** The **Longest Increasing Subsequence (LIS)** problem is to find the length of the longest subsequence of a given sequence such that all elements of the subsequence are sorted in increasing order.

The following is a sample input and the corresponding output:

> **Input array:** $\{23, 19, 31, 15, 27, 11, 35\}$  
> **Output:** 3  
> **Explanation:** the longest strictly increasing subsequence is $\{23, 31, 35\}$

The recurrence relation for the LIS problem is as follows:

$$
lis(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lis(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] < array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

Assume that $array = \{10, 22, 9, 33, 21, 50, 41, 60, 80, 3, 55, 70\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 11, where the indices show up to which element in the array is being considered. State the length of the LIS. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 10 | 22 | 9 | 33 | 21 | 50 | 41 | 60 | 80 | 3 | 55 | 70 |
| **lis(i)** |  |  |  |  |  |  |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] < array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lis(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 10 | none | - | 1, on its own |
| 1 | 22 | 0 (1) | 1 | 1 + 1 = 2 |
| 2 | 9 | none | - | 1, on its own |
| 3 | 33 | 0 (1), 1 (2), 2 (1) | 2 | 1 + 2 = 3 |
| 4 | 21 | 0 (1), 2 (1) | 1 | 1 + 1 = 2 |
| 5 | 50 | 0 (1), 1 (2), 2 (1), 3 (3), 4 (2) | 3 | 1 + 3 = 4 |
| 6 | 41 | 0 (1), 1 (2), 2 (1), 3 (3), 4 (2) | 3 | 1 + 3 = 4 |
| 7 | 60 | 0 (1), 1 (2), 2 (1), 3 (3), 4 (2), 5 (4), 6 (4) | 4 | 1 + 4 = 5 |
| 8 | 80 | 0 (1), 1 (2), 2 (1), 3 (3), 4 (2), 5 (4), 6 (4), 7 (5) | 5 | 1 + 5 = 6 |
| 9 | 3 | none | - | 1, on its own |
| 10 | 55 | 0 (1), 1 (2), 2 (1), 3 (3), 4 (2), 5 (4), 6 (4), 9 (1) | 4 | 1 + 4 = 5 |
| 11 | 70 | 0 (1), 1 (2), 2 (1), 3 (3), 4 (2), 5 (4), 6 (4), 7 (5), 9 (1), 10 (5) | 5 | 1 + 5 = 6 |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**10**]{hex="#204A2E"} | :mark[**22**]{hex="#204A2E"} | 9 | :mark[**33**]{hex="#204A2E"} | 21 | :mark[**50**]{hex="#204A2E"} | 41 | :mark[**60**]{hex="#204A2E"} | :mark[**80**]{hex="#204A2E"} | 3 | 55 | 70 |
| **lis** | :mark[**1**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | 1 | :mark[**3**]{hex="#204A2E"} | 2 | :mark[**4**]{hex="#204A2E"} | 4 | :mark[**5**]{hex="#204A2E"} | :mark[**6**]{hex="#204A2E"} | 1 | 5 | 6 |

The largest entry is **6**, at $i = 8$.

:mark[**The length of the LIS is 6.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LIS. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 8$ | 6 | 80 | look left for an entry of 5 that also satisfies the condition against 80; $i = 7$ holds 5 |
| $i = 7$ | 5 | 60 | look left for an entry of 4 that also satisfies the condition against 60; $i = 5$ holds 4 |
| $i = 5$ | 4 | 50 | look left for an entry of 3 that also satisfies the condition against 50; $i = 3$ holds 3 |
| $i = 3$ | 3 | 33 | look left for an entry of 2 that also satisfies the condition against 33; $i = 1$ holds 2 |
| $i = 1$ | 2 | 22 | look left for an entry of 1 that also satisfies the condition against 22; $i = 0$ holds 1 |
| $i = 0$ | 1 | 10 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0, 1, 3, 5, 7, 8$, so the LIS is $\{10, 22, 33, 50, 60, 80\}$.

**Check.** $10 < 22 < 33 < 50 < 60 < 80$, which is strictly increasing, and there are 6 of them.

:mark[**The LIS is 10, 22, 33, 50, 60, 80.**]{hex="#204A2E"}

**(iii)** How would the recurrence change if elements of **equal** value were allowed to sit together in the subsequence? State the new condition and its effect on your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> Only the condition line changes, to **:color[array[j] <= array[i]]{hex="#A78BFA"}**. Everything else, the fill order, the base value of 1 and the traceback, is untouched. Refilling the table under that condition gives **6**, the same answer, because this array has no repeated values that would chain.

**(b)** Briefly explain the difference between the **top down** and **bottom up** formulations of a dynamic programming solution. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> **Bottom up** fills a table starting from the smallest subproblem and works upwards, with no recursion, and computes every cell. **Top down**, or memoisation, writes the recursion as it stands but checks a cache before doing any work, so it only computes the subproblems it actually reaches, at the cost of recursion depth. Both store each answer once, and both turn exponential into polynomial.

## Part B: the same thing wearing a story

Full exam questions again, this time dressed as data about something. The wording changes, the
recurrence does not. Three of these need a **sort** before the table can start, which is the
single most examined idea in this topic.

### Q13. Noon temperatures

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

**(a)** The temperature at noon was recorded for nine days: `12, 15, 11, 14, 18, 13, 17, 20, 16` degrees. Find the longest run of days, not necessarily consecutive, on which the temperature was strictly rising.

The following is a sample input and the corresponding output:

> **Input array:** $\{5, 14, 7, 20, 9, 16, 4\}$  
> **Output:** 4  
> **Explanation:** the longest strictly increasing subsequence is $\{5, 7, 9, 16\}$

The recurrence relation for the LIS problem is as follows:

$$
lis(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lis(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] < array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

Assume that $array = \{12, 15, 11, 14, 18, 13, 17, 20, 16\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 8, where the indices show up to which element in the array is being considered. State the length of the LIS. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 12 | 15 | 11 | 14 | 18 | 13 | 17 | 20 | 16 |
| **lis(i)** |  |  |  |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] < array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lis(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 12 | none | - | 1, on its own |
| 1 | 15 | 0 (1) | 1 | 1 + 1 = 2 |
| 2 | 11 | none | - | 1, on its own |
| 3 | 14 | 0 (1), 2 (1) | 1 | 1 + 1 = 2 |
| 4 | 18 | 0 (1), 1 (2), 2 (1), 3 (2) | 2 | 1 + 2 = 3 |
| 5 | 13 | 0 (1), 2 (1) | 1 | 1 + 1 = 2 |
| 6 | 17 | 0 (1), 1 (2), 2 (1), 3 (2), 5 (2) | 2 | 1 + 2 = 3 |
| 7 | 20 | 0 (1), 1 (2), 2 (1), 3 (2), 4 (3), 5 (2), 6 (3) | 3 | 1 + 3 = 4 |
| 8 | 16 | 0 (1), 1 (2), 2 (1), 3 (2), 5 (2) | 2 | 1 + 2 = 3 |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**12**]{hex="#204A2E"} | :mark[**15**]{hex="#204A2E"} | 11 | 14 | :mark[**18**]{hex="#204A2E"} | 13 | 17 | :mark[**20**]{hex="#204A2E"} | 16 |
| **lis** | :mark[**1**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | 1 | 2 | :mark[**3**]{hex="#204A2E"} | 2 | 3 | :mark[**4**]{hex="#204A2E"} | 3 |

The largest entry is **4**, at $i = 7$.

:mark[**The length of the LIS is 4.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LIS. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 7$ | 4 | 20 | look left for an entry of 3 that also satisfies the condition against 20; $i = 4$ holds 3 |
| $i = 4$ | 3 | 18 | look left for an entry of 2 that also satisfies the condition against 18; $i = 1$ holds 2 |
| $i = 1$ | 2 | 15 | look left for an entry of 1 that also satisfies the condition against 15; $i = 0$ holds 1 |
| $i = 0$ | 1 | 12 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0, 1, 4, 7$, so the LIS is $\{12, 15, 18, 20\}$.

**Check.** $12 < 15 < 18 < 20$, which is strictly increasing, and there are 4 of them.

:mark[**The LIS is 12, 15, 18, 20.**]{hex="#204A2E"}

**(iii)** Would a greedy method that starts at index 0 and extends the run whenever the condition allows produce the same answer? Justify with reference to your array. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> It gives **4** here, which happens to match the correct answer of **4**, but that is luck rather than correctness. Greedy commits to the first element and can never reconsider, so on an array beginning with a value that belongs to no long run it fails. Dynamic programming asks the question separately for every ending point.

**(b)** What is the worst case running time of a plain recursive solution to the problem in part (a), and why is it so much worse than the tabulated one? &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> :color[O(2ⁿ)]{hex="#EF4444"}. Each call branches over every earlier index, and none of the results are kept, so the same subproblem is re-entered along every path that reaches it. The tabulated version solves each of the $n$ subproblems exactly once at a cost of $O(n)$ each, giving :color[O(n²)]{hex="#F97316"}. The saving is entirely in writing answers down, not in a better algorithm.

### Q14. Rainfall tailing off

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

**(a)** Monthly rainfall in millimetres: `210, 190, 240, 160, 200, 140, 180, 120, 150`. Find the longest strictly falling run of months.

The following is a sample input and the corresponding output:

> **Input array:** $\{40, 22, 55, 31, 48, 18, 60\}$  
> **Output:** 3  
> **Explanation:** the longest strictly decreasing subsequence is $\{40, 22, 18\}$

The recurrence relation for the LDS problem is as follows:

$$
lds(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lds(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] > array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

Assume that $array = \{210, 190, 240, 160, 200, 140, 180, 120, 150\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 8, where the indices show up to which element in the array is being considered. State the length of the LDS. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 210 | 190 | 240 | 160 | 200 | 140 | 180 | 120 | 150 |
| **lds(i)** |  |  |  |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] > array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lds(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 210 | none | - | 1, on its own |
| 1 | 190 | 0 (1) | 1 | 1 + 1 = 2 |
| 2 | 240 | none | - | 1, on its own |
| 3 | 160 | 0 (1), 1 (2), 2 (1) | 2 | 1 + 2 = 3 |
| 4 | 200 | 0 (1), 2 (1) | 1 | 1 + 1 = 2 |
| 5 | 140 | 0 (1), 1 (2), 2 (1), 3 (3), 4 (2) | 3 | 1 + 3 = 4 |
| 6 | 180 | 0 (1), 1 (2), 2 (1), 4 (2) | 2 | 1 + 2 = 3 |
| 7 | 120 | 0 (1), 1 (2), 2 (1), 3 (3), 4 (2), 5 (4), 6 (3) | 4 | 1 + 4 = 5 |
| 8 | 150 | 0 (1), 1 (2), 2 (1), 3 (3), 4 (2), 6 (3) | 3 | 1 + 3 = 4 |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**210**]{hex="#204A2E"} | :mark[**190**]{hex="#204A2E"} | 240 | :mark[**160**]{hex="#204A2E"} | 200 | :mark[**140**]{hex="#204A2E"} | 180 | :mark[**120**]{hex="#204A2E"} | 150 |
| **lds** | :mark[**1**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | 1 | :mark[**3**]{hex="#204A2E"} | 2 | :mark[**4**]{hex="#204A2E"} | 3 | :mark[**5**]{hex="#204A2E"} | 4 |

The largest entry is **5**, at $i = 7$.

:mark[**The length of the LDS is 5.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LDS. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 7$ | 5 | 120 | look left for an entry of 4 that also satisfies the condition against 120; $i = 5$ holds 4 |
| $i = 5$ | 4 | 140 | look left for an entry of 3 that also satisfies the condition against 140; $i = 3$ holds 3 |
| $i = 3$ | 3 | 160 | look left for an entry of 2 that also satisfies the condition against 160; $i = 1$ holds 2 |
| $i = 1$ | 2 | 190 | look left for an entry of 1 that also satisfies the condition against 190; $i = 0$ holds 1 |
| $i = 0$ | 1 | 210 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0, 1, 3, 5, 7$, so the LDS is $\{210, 190, 160, 140, 120\}$.

**Check.** $210 > 190 > 160 > 140 > 120$, which is strictly decreasing, and there are 5 of them.

:mark[**The LDS is 210, 190, 160, 140, 120.**]{hex="#204A2E"}

**(iii)** How many distinct subproblems does this solution solve, and how much work does each one do? &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> **9 subproblems**, one per index: *the length of the best qualifying run ending at $i$*, for $i = 0$ to $8$. Subproblem $i$ inspects the $i$ entries to its left, so it costs $O(i)$. Summed over all of them that is :color[O(n²)]{hex="#F97316"}. The plain recursion solves the same 9 subproblems an exponential number of times.

**(b)** Define **optimal substructure** and identify where it appears in the recurrence given in part (a). &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> A problem has optimal substructure when an optimal solution contains within it optimal solutions to its subproblems. In the recurrence it is the :color[max]{hex="#EAB308"} term: the best run ending at $i$ is formed by taking the **best** run ending at some earlier $j$ and extending it. If that inner run were not itself optimal, a better one could be substituted and the outer answer would improve, which contradicts it being the best.

### Q15. Exam marks that never went backwards

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

**(a)** A student's marks across nine assessments: `52, 58, 58, 49, 61, 61, 55, 67, 70`. Find the longest selection of assessments, in order, on which the mark never dropped.

The following is a sample input and the corresponding output:

> **Input array:** $\{12, 26, 9, 33, 21, 7, 30\}$  
> **Output:** 3  
> **Explanation:** the longest non decreasing subsequence is $\{12, 26, 33\}$

The recurrence relation for the LNDS problem is as follows:

$$
lnds(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lnds(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] <= array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

Assume that $array = \{52, 58, 58, 49, 61, 61, 55, 67, 70\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 8, where the indices show up to which element in the array is being considered. State the length of the LNDS. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 52 | 58 | 58 | 49 | 61 | 61 | 55 | 67 | 70 |
| **lnds(i)** |  |  |  |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] <= array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lnds(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 52 | none | - | 1, on its own |
| 1 | 58 | 0 (1) | 1 | 1 + 1 = 2 |
| 2 | 58 | 0 (1), 1 (2) | 2 | 1 + 2 = 3 |
| 3 | 49 | none | - | 1, on its own |
| 4 | 61 | 0 (1), 1 (2), 2 (3), 3 (1) | 3 | 1 + 3 = 4 |
| 5 | 61 | 0 (1), 1 (2), 2 (3), 3 (1), 4 (4) | 4 | 1 + 4 = 5 |
| 6 | 55 | 0 (1), 3 (1) | 1 | 1 + 1 = 2 |
| 7 | 67 | 0 (1), 1 (2), 2 (3), 3 (1), 4 (4), 5 (5), 6 (2) | 5 | 1 + 5 = 6 |
| 8 | 70 | 0 (1), 1 (2), 2 (3), 3 (1), 4 (4), 5 (5), 6 (2), 7 (6) | 6 | 1 + 6 = 7 |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**52**]{hex="#204A2E"} | :mark[**58**]{hex="#204A2E"} | :mark[**58**]{hex="#204A2E"} | 49 | :mark[**61**]{hex="#204A2E"} | :mark[**61**]{hex="#204A2E"} | 55 | :mark[**67**]{hex="#204A2E"} | :mark[**70**]{hex="#204A2E"} |
| **lnds** | :mark[**1**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | :mark[**3**]{hex="#204A2E"} | 1 | :mark[**4**]{hex="#204A2E"} | :mark[**5**]{hex="#204A2E"} | 2 | :mark[**6**]{hex="#204A2E"} | :mark[**7**]{hex="#204A2E"} |

The largest entry is **7**, at $i = 8$.

:mark[**The length of the LNDS is 7.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LNDS. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 8$ | 7 | 70 | look left for an entry of 6 that also satisfies the condition against 70; $i = 7$ holds 6 |
| $i = 7$ | 6 | 67 | look left for an entry of 5 that also satisfies the condition against 67; $i = 5$ holds 5 |
| $i = 5$ | 5 | 61 | look left for an entry of 4 that also satisfies the condition against 61; $i = 4$ holds 4 |
| $i = 4$ | 4 | 61 | look left for an entry of 3 that also satisfies the condition against 61; $i = 2$ holds 3 |
| $i = 2$ | 3 | 58 | look left for an entry of 2 that also satisfies the condition against 58; $i = 1$ holds 2 |
| $i = 1$ | 2 | 58 | look left for an entry of 1 that also satisfies the condition against 58; $i = 0$ holds 1 |
| $i = 0$ | 1 | 52 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0, 1, 2, 4, 5, 7, 8$, so the LNDS is $\{52, 58, 58, 61, 61, 67, 70\}$.

**Check.** $52 \le 58 \le 58 \le 61 \le 61 \le 67 \le 70$, which is non decreasing, and there are 7 of them.

:mark[**The LNDS is 52, 58, 58, 61, 61, 67, 70.**]{hex="#204A2E"}

**(iii)** If the array were **reversed** before the table was filled, would the answer change? Explain. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> Reversing turns every *non decreasing* run into a run of the opposite kind, so this recurrence no longer finds the same thing. Filling the table on the reversed array gives **3** rather than **7**. To get the original answer from the reversed array you would have to flip the condition as well.

**(b)** Dynamic programming can be used to compute the $n$th term in the Fibonacci sequence. Briefly explain **why** dynamic programming, rather than divide and conquer, is the right approach to solve the problem. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> Because the subproblems **overlap**. $fib(n)$ needs $fib(n-1)$ and $fib(n-2)$, and those two both need $fib(n-3)$, and so on all the way down. Divide and conquer assumes subproblems are independent, so it solves each branch from scratch and recomputes the same values an exponential number of times, :color[O(2ⁿ)]{hex="#EF4444"}. There are only $n+1$ distinct values in the whole tree, so storing each one the first time it is computed brings it down to :color[O(n)]{hex="#22C55E"}.

> **Worth noticing.** Never dropped means non decreasing, so the condition is `<=` and not `<`. Reading this wrongly costs the whole question.

### Q16. A share price on the way down

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

**(a)** A share closed at `88, 92, 85, 90, 80, 86, 78, 84, 75, 82` over ten days. Find the longest strictly falling sequence of closing prices.

The following is a sample input and the corresponding output:

> **Input array:** $\{61, 44, 72, 38, 56, 29, 65\}$  
> **Output:** 4  
> **Explanation:** the longest strictly decreasing subsequence is $\{61, 44, 38, 29\}$

The recurrence relation for the LDS problem is as follows:

$$
lds(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lds(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] > array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

Assume that $array = \{88, 92, 85, 90, 80, 86, 78, 84, 75, 82\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 9, where the indices show up to which element in the array is being considered. State the length of the LDS. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 88 | 92 | 85 | 90 | 80 | 86 | 78 | 84 | 75 | 82 |
| **lds(i)** |  |  |  |  |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] > array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lds(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 88 | none | - | 1, on its own |
| 1 | 92 | none | - | 1, on its own |
| 2 | 85 | 0 (1), 1 (1) | 1 | 1 + 1 = 2 |
| 3 | 90 | 1 (1) | 1 | 1 + 1 = 2 |
| 4 | 80 | 0 (1), 1 (1), 2 (2), 3 (2) | 2 | 1 + 2 = 3 |
| 5 | 86 | 0 (1), 1 (1), 3 (2) | 2 | 1 + 2 = 3 |
| 6 | 78 | 0 (1), 1 (1), 2 (2), 3 (2), 4 (3), 5 (3) | 3 | 1 + 3 = 4 |
| 7 | 84 | 0 (1), 1 (1), 2 (2), 3 (2), 5 (3) | 3 | 1 + 3 = 4 |
| 8 | 75 | 0 (1), 1 (1), 2 (2), 3 (2), 4 (3), 5 (3), 6 (4), 7 (4) | 4 | 1 + 4 = 5 |
| 9 | 82 | 0 (1), 1 (1), 2 (2), 3 (2), 5 (3), 7 (4) | 4 | 1 + 4 = 5 |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**88**]{hex="#204A2E"} | 92 | :mark[**85**]{hex="#204A2E"} | 90 | :mark[**80**]{hex="#204A2E"} | 86 | :mark[**78**]{hex="#204A2E"} | 84 | :mark[**75**]{hex="#204A2E"} | 82 |
| **lds** | :mark[**1**]{hex="#204A2E"} | 1 | :mark[**2**]{hex="#204A2E"} | 2 | :mark[**3**]{hex="#204A2E"} | 3 | :mark[**4**]{hex="#204A2E"} | 4 | :mark[**5**]{hex="#204A2E"} | 5 |

The largest entry is **5**, at $i = 8$.

:mark[**The length of the LDS is 5.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LDS. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 8$ | 5 | 75 | look left for an entry of 4 that also satisfies the condition against 75; $i = 6$ holds 4 |
| $i = 6$ | 4 | 78 | look left for an entry of 3 that also satisfies the condition against 78; $i = 4$ holds 3 |
| $i = 4$ | 3 | 80 | look left for an entry of 2 that also satisfies the condition against 80; $i = 2$ holds 2 |
| $i = 2$ | 2 | 85 | look left for an entry of 1 that also satisfies the condition against 85; $i = 0$ holds 1 |
| $i = 0$ | 1 | 88 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0, 2, 4, 6, 8$, so the LDS is $\{88, 85, 80, 78, 75\}$.

**Check.** $88 > 85 > 80 > 78 > 75$, which is strictly decreasing, and there are 5 of them.

:mark[**The LDS is 88, 85, 80, 78, 75.**]{hex="#204A2E"}

**(iii)** Explain why the table has to be filled from index 0 upwards, and what would go wrong if it were filled from the right. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> Cell $i$ is defined in terms of cells $0$ to $i-1$, so those have to hold their final values before cell $i$ is written. Filling from the right means every cell reads entries that are still empty, and the recurrence would fall through to the base case every time, producing a row of ones. The fill order is the whole meaning of the phrase *bottom up*: smallest subproblem first, largest last.

**(b)** State the two properties a problem must have before dynamic programming can be applied, and show that the problem in part (a) has both. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> **Optimal substructure**: the best answer is built from the best answers to smaller versions of the same problem. Here the best run ending at $i$ is the best run ending at some earlier $j$, plus one element, so it is built from a smaller optimum.
>
> **Overlapping subproblems**: the same smaller problem is asked for repeatedly. Here the entry at $j$ is read by every later index whose condition it satisfies, so without a table it would be recomputed each time.

### Q17. Skyline

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

**(a)** Buildings along one side of a street have heights `14, 9, 20, 11, 25, 16, 30, 22, 35`. Find the longest set of buildings, read left to right, whose heights strictly increase.

The following is a sample input and the corresponding output:

> **Input array:** $\{3, 18, 11, 25, 14, 6, 21\}$  
> **Output:** 4  
> **Explanation:** the longest strictly increasing subsequence is $\{3, 11, 14, 21\}$

The recurrence relation for the LIS problem is as follows:

$$
lis(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lis(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] < array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

Assume that $array = \{14, 9, 20, 11, 25, 16, 30, 22, 35\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 8, where the indices show up to which element in the array is being considered. State the length of the LIS. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 14 | 9 | 20 | 11 | 25 | 16 | 30 | 22 | 35 |
| **lis(i)** |  |  |  |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] < array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lis(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 14 | none | - | 1, on its own |
| 1 | 9 | none | - | 1, on its own |
| 2 | 20 | 0 (1), 1 (1) | 1 | 1 + 1 = 2 |
| 3 | 11 | 1 (1) | 1 | 1 + 1 = 2 |
| 4 | 25 | 0 (1), 1 (1), 2 (2), 3 (2) | 2 | 1 + 2 = 3 |
| 5 | 16 | 0 (1), 1 (1), 3 (2) | 2 | 1 + 2 = 3 |
| 6 | 30 | 0 (1), 1 (1), 2 (2), 3 (2), 4 (3), 5 (3) | 3 | 1 + 3 = 4 |
| 7 | 22 | 0 (1), 1 (1), 2 (2), 3 (2), 5 (3) | 3 | 1 + 3 = 4 |
| 8 | 35 | 0 (1), 1 (1), 2 (2), 3 (2), 4 (3), 5 (3), 6 (4), 7 (4) | 4 | 1 + 4 = 5 |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**14**]{hex="#204A2E"} | 9 | :mark[**20**]{hex="#204A2E"} | 11 | :mark[**25**]{hex="#204A2E"} | 16 | :mark[**30**]{hex="#204A2E"} | 22 | :mark[**35**]{hex="#204A2E"} |
| **lis** | :mark[**1**]{hex="#204A2E"} | 1 | :mark[**2**]{hex="#204A2E"} | 2 | :mark[**3**]{hex="#204A2E"} | 3 | :mark[**4**]{hex="#204A2E"} | 4 | :mark[**5**]{hex="#204A2E"} |

The largest entry is **5**, at $i = 8$.

:mark[**The length of the LIS is 5.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LIS. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 8$ | 5 | 35 | look left for an entry of 4 that also satisfies the condition against 35; $i = 6$ holds 4 |
| $i = 6$ | 4 | 30 | look left for an entry of 3 that also satisfies the condition against 30; $i = 4$ holds 3 |
| $i = 4$ | 3 | 25 | look left for an entry of 2 that also satisfies the condition against 25; $i = 2$ holds 2 |
| $i = 2$ | 2 | 20 | look left for an entry of 1 that also satisfies the condition against 20; $i = 0$ holds 1 |
| $i = 0$ | 1 | 14 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0, 2, 4, 6, 8$, so the LIS is $\{14, 20, 25, 30, 35\}$.

**Check.** $14 < 20 < 25 < 30 < 35$, which is strictly increasing, and there are 5 of them.

:mark[**The LIS is 14, 20, 25, 30, 35.**]{hex="#204A2E"}

**(iii)** Is it better to use *dynamic programming* or *memoisation* to solve this problem? Briefly explain your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> **Bottom up dynamic programming.** All 9 cells have to be computed anyway, because the answer is the largest entry in the table and you cannot know which cell holds it until every cell is filled. Memoisation would work out the same 9 values, pay a function call and a cache lookup for each, and recurse 9 deep. Memoisation is the better choice only when a large part of the subproblem space is never reached, which is not the case here.

**(b)** Explain the difference between a **subsequence** and a **substring**, giving one example of each from the array in part (a). &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> A **substring** is contiguous: it has to be a block of neighbouring elements, such as $\{14, 9, 20\}$. A **subsequence** only has to keep the original left to right order, so elements may be skipped, such as $\{14, 20\}$. Every substring is a subsequence; the reverse is not true. This question asks for a subsequence, which is why the recurrence looks at **every** $j$ to the left rather than only at $i - 1$.

### Q18. Laptops: cheaper but better

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**19 marks**]{hex="#3A3A3E"}

**(a)** Nine laptops are listed with a price in rupees and a benchmark score. Find the largest set that can be ordered so that price **falls** while score **rises**.

The following is a sample input and the corresponding output:

> **Input array:** $\{50, 36, 64, 28, 47, 20, 58\}$  
> **Output:** 3  
> **Explanation:** the longest strictly increasing subsequence is $\{36, 47, 58\}$

The recurrence relation for the LIS problem is as follows:

$$
lis(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lis(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] < array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

**Sort first.** Two things vary at once, so fix one of them: list the laptops in **decreasing price** order, then the question becomes a plain increasing subsequence on score.

| $i$ | Price | Benchmark score |
| --- | --- | --- |
| 0 | 92,000 | 41 |
| 1 | 78,500 | 44 |
| 2 | 71,000 | 62 |
| 3 | 70,400 | 65 |
| 4 | 66,000 | 38 |
| 5 | 54,900 | 51 |
| 6 | 48,000 | 88 |
| 7 | 39,500 | 57 |
| 8 | 31,000 | 33 |

So the array the recurrence works on, in order, is $\{41, 44, 62, 65, 38, 51, 88, 57, 33\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 8, where the indices show up to which element in the array is being considered. State the length of the LIS. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 41 | 44 | 62 | 65 | 38 | 51 | 88 | 57 | 33 |
| **lis(i)** |  |  |  |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] < array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lis(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 41 | none | - | 1, on its own |
| 1 | 44 | 0 (1) | 1 | 1 + 1 = 2 |
| 2 | 62 | 0 (1), 1 (2) | 2 | 1 + 2 = 3 |
| 3 | 65 | 0 (1), 1 (2), 2 (3) | 3 | 1 + 3 = 4 |
| 4 | 38 | none | - | 1, on its own |
| 5 | 51 | 0 (1), 1 (2), 4 (1) | 2 | 1 + 2 = 3 |
| 6 | 88 | 0 (1), 1 (2), 2 (3), 3 (4), 4 (1), 5 (3) | 4 | 1 + 4 = 5 |
| 7 | 57 | 0 (1), 1 (2), 4 (1), 5 (3) | 3 | 1 + 3 = 4 |
| 8 | 33 | none | - | 1, on its own |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**41**]{hex="#204A2E"} | :mark[**44**]{hex="#204A2E"} | :mark[**62**]{hex="#204A2E"} | :mark[**65**]{hex="#204A2E"} | 38 | 51 | :mark[**88**]{hex="#204A2E"} | 57 | 33 |
| **lis** | :mark[**1**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | :mark[**3**]{hex="#204A2E"} | :mark[**4**]{hex="#204A2E"} | 1 | 3 | :mark[**5**]{hex="#204A2E"} | 4 | 1 |

The largest entry is **5**, at $i = 6$.

:mark[**The length of the LIS is 5.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LIS. &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 6$ | 5 | 88 | look left for an entry of 4 that also satisfies the condition against 88; $i = 3$ holds 4 |
| $i = 3$ | 4 | 65 | look left for an entry of 3 that also satisfies the condition against 65; $i = 2$ holds 3 |
| $i = 2$ | 3 | 62 | look left for an entry of 2 that also satisfies the condition against 62; $i = 1$ holds 2 |
| $i = 1$ | 2 | 44 | look left for an entry of 1 that also satisfies the condition against 44; $i = 0$ holds 1 |
| $i = 0$ | 1 | 41 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0, 1, 2, 3, 6$, so the LIS is $\{41, 44, 62, 65, 88\}$.

**Check.** $41 < 44 < 62 < 65 < 88$, which is strictly increasing, and there are 5 of them.

:mark[**The LIS is 41, 44, 62, 65, 88.**]{hex="#204A2E"}

**(iii)** State the *time* and *space* complexity of the tabulated solution, and justify each briefly. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> **Time :color[O(n²)]{hex="#F97316"}.** There are $n$ cells, and filling cell $i$ scans the $i$ cells to its left, so the work is $1 + 2 + \dots + (n-1)$, which is $\frac{n(n-1)}{2}$. With $n = 9$ that is 36 comparisons in the worst case.
>
> **Space :color[O(n)]{hex="#22C55E"}.** One entry per element. The traceback reads the same row and needs nothing extra.

**(b)** Merge sort is solved by divide and conquer. Explain why dynamic programming would give it no advantage. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> Merge sort splits the array into two halves that share no elements, so the two subproblems are **independent**. Nothing is ever computed twice, and there is nothing for a table to save. Dynamic programming only pays for itself when subproblems overlap; here it would add the cost of storing results and return none of it.

> **Worth noticing.** The sort is the answer to the question. Once the prices are in order the recurrence has nothing left to think about.

### Q19. Envelopes inside envelopes

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**19 marks**]{hex="#3A3A3E"}

**(a)** Envelopes have width and height `(5,4) (6,7) (2,3) (9,11) (7,8) (3,2) (8,6) (4,5)`. One envelope fits inside another when both of its sides are strictly smaller. Find the longest nesting chain.

The following is a sample input and the corresponding output:

> **Input array:** $\{9, 24, 16, 37, 13, 30, 5\}$  
> **Output:** 3  
> **Explanation:** the longest strictly increasing subsequence is $\{9, 24, 37\}$

The recurrence relation for the LIS problem is as follows:

$$
lis(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lis(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] < array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

**Sort first**, this time by increasing width, so only the height still has to be checked:

| Width | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Height** | 3 | 2 | 5 | 4 | 7 | 8 | 6 | 11 |

So the array the recurrence works on, in order, is $\{3, 2, 5, 4, 7, 8, 6, 11\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 7, where the indices show up to which element in the array is being considered. State the length of the LIS. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 3 | 2 | 5 | 4 | 7 | 8 | 6 | 11 |
| **lis(i)** |  |  |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] < array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lis(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 3 | none | - | 1, on its own |
| 1 | 2 | none | - | 1, on its own |
| 2 | 5 | 0 (1), 1 (1) | 1 | 1 + 1 = 2 |
| 3 | 4 | 0 (1), 1 (1) | 1 | 1 + 1 = 2 |
| 4 | 7 | 0 (1), 1 (1), 2 (2), 3 (2) | 2 | 1 + 2 = 3 |
| 5 | 8 | 0 (1), 1 (1), 2 (2), 3 (2), 4 (3) | 3 | 1 + 3 = 4 |
| 6 | 6 | 0 (1), 1 (1), 2 (2), 3 (2) | 2 | 1 + 2 = 3 |
| 7 | 11 | 0 (1), 1 (1), 2 (2), 3 (2), 4 (3), 5 (4), 6 (3) | 4 | 1 + 4 = 5 |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**3**]{hex="#204A2E"} | 2 | :mark[**5**]{hex="#204A2E"} | 4 | :mark[**7**]{hex="#204A2E"} | :mark[**8**]{hex="#204A2E"} | 6 | :mark[**11**]{hex="#204A2E"} |
| **lis** | :mark[**1**]{hex="#204A2E"} | 1 | :mark[**2**]{hex="#204A2E"} | 2 | :mark[**3**]{hex="#204A2E"} | :mark[**4**]{hex="#204A2E"} | 3 | :mark[**5**]{hex="#204A2E"} |

The largest entry is **5**, at $i = 7$.

:mark[**The length of the LIS is 5.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LIS. &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 7$ | 5 | 11 | look left for an entry of 4 that also satisfies the condition against 11; $i = 5$ holds 4 |
| $i = 5$ | 4 | 8 | look left for an entry of 3 that also satisfies the condition against 8; $i = 4$ holds 3 |
| $i = 4$ | 3 | 7 | look left for an entry of 2 that also satisfies the condition against 7; $i = 2$ holds 2 |
| $i = 2$ | 2 | 5 | look left for an entry of 1 that also satisfies the condition against 5; $i = 0$ holds 1 |
| $i = 0$ | 1 | 3 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0, 2, 4, 5, 7$, so the LIS is $\{3, 5, 7, 8, 11\}$.

**Check.** $3 < 5 < 7 < 8 < 11$, which is strictly increasing, and there are 5 of them.

:mark[**The LIS is 3, 5, 7, 8, 11.**]{hex="#204A2E"}

**(iii)** A student claims the answer is always the value held in the **last** cell of the table. Explain why this is wrong, referring to your table. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> A cell holds the length of the best run **ending at that index**, not the best run overall. In this table the last cell holds **5**, while the answer is **5** and sits at $i = 7$. The two agree here only by coincidence, because the best run happens to finish at the last element. Change one value and they part company.

**(b)** Briefly explain the difference between the **top down** and **bottom up** formulations of a dynamic programming solution. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> **Bottom up** fills a table starting from the smallest subproblem and works upwards, with no recursion, and computes every cell. **Top down**, or memoisation, writes the recursion as it stands but checks a cache before doing any work, so it only computes the subproblems it actually reaches, at the cost of recursion depth. Both store each answer once, and both turn exponential into polynomial.

> **Worth noticing.** Sorting handles one dimension. The table handles the other. Two dimensions, one pass.

### Q20. River level falling back

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

**(a)** A river gauge read `7.2, 7.2, 8.0, 6.5, 6.5, 7.1, 5.9, 6.3, 5.4` metres. Find the longest run of readings that never rose.

The following is a sample input and the corresponding output:

> **Input array:** $\{17, 29, 15, 41, 67, 57, 45\}$  
> **Output:** 3  
> **Explanation:** the longest non increasing subsequence is $\{67, 57, 45\}$

The recurrence relation for the LNIS problem is as follows:

$$
lnis(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lnis(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] >= array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

Assume that $array = \{7.2, 7.2, 8, 6.5, 6.5, 7.1, 5.9, 6.3, 5.4\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 8, where the indices show up to which element in the array is being considered. State the length of the LNIS. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 7.2 | 7.2 | 8 | 6.5 | 6.5 | 7.1 | 5.9 | 6.3 | 5.4 |
| **lnis(i)** |  |  |  |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] >= array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lnis(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 7.2 | none | - | 1, on its own |
| 1 | 7.2 | 0 (1) | 1 | 1 + 1 = 2 |
| 2 | 8 | none | - | 1, on its own |
| 3 | 6.5 | 0 (1), 1 (2), 2 (1) | 2 | 1 + 2 = 3 |
| 4 | 6.5 | 0 (1), 1 (2), 2 (1), 3 (3) | 3 | 1 + 3 = 4 |
| 5 | 7.1 | 0 (1), 1 (2), 2 (1) | 2 | 1 + 2 = 3 |
| 6 | 5.9 | 0 (1), 1 (2), 2 (1), 3 (3), 4 (4), 5 (3) | 4 | 1 + 4 = 5 |
| 7 | 6.3 | 0 (1), 1 (2), 2 (1), 3 (3), 4 (4), 5 (3) | 4 | 1 + 4 = 5 |
| 8 | 5.4 | 0 (1), 1 (2), 2 (1), 3 (3), 4 (4), 5 (3), 6 (5), 7 (5) | 5 | 1 + 5 = 6 |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**7.2**]{hex="#204A2E"} | :mark[**7.2**]{hex="#204A2E"} | 8 | :mark[**6.5**]{hex="#204A2E"} | :mark[**6.5**]{hex="#204A2E"} | 7.1 | :mark[**5.9**]{hex="#204A2E"} | 6.3 | :mark[**5.4**]{hex="#204A2E"} |
| **lnis** | :mark[**1**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | 1 | :mark[**3**]{hex="#204A2E"} | :mark[**4**]{hex="#204A2E"} | 3 | :mark[**5**]{hex="#204A2E"} | 5 | :mark[**6**]{hex="#204A2E"} |

The largest entry is **6**, at $i = 8$.

:mark[**The length of the LNIS is 6.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LNIS. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 8$ | 6 | 5.4 | look left for an entry of 5 that also satisfies the condition against 5.4; $i = 6$ holds 5 |
| $i = 6$ | 5 | 5.9 | look left for an entry of 4 that also satisfies the condition against 5.9; $i = 4$ holds 4 |
| $i = 4$ | 4 | 6.5 | look left for an entry of 3 that also satisfies the condition against 6.5; $i = 3$ holds 3 |
| $i = 3$ | 3 | 6.5 | look left for an entry of 2 that also satisfies the condition against 6.5; $i = 1$ holds 2 |
| $i = 1$ | 2 | 7.2 | look left for an entry of 1 that also satisfies the condition against 7.2; $i = 0$ holds 1 |
| $i = 0$ | 1 | 7.2 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0, 1, 3, 4, 6, 8$, so the LNIS is $\{7.2, 7.2, 6.5, 6.5, 5.9, 5.4\}$.

**Check.** $7.2 \ge 7.2 \ge 6.5 \ge 6.5 \ge 5.9 \ge 5.4$, which is non increasing, and there are 6 of them.

:mark[**The LNIS is 7.2, 7.2, 6.5, 6.5, 5.9, 5.4.**]{hex="#204A2E"}

**(iii)** How would the recurrence change if equal values were **no longer** allowed to sit together? State the new condition and its effect on your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> Only the condition line changes, to **:color[array[j] > array[i]]{hex="#A78BFA"}**. Everything else, the fill order, the base value of 1 and the traceback, is untouched. Refilling the table under that condition gives **4** instead of **6**, from $\{7.2, 6.5, 5.9, 5.4\}$.

**(b)** What is the worst case running time of a plain recursive solution to the problem in part (a), and why is it so much worse than the tabulated one? &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> :color[O(2ⁿ)]{hex="#EF4444"}. Each call branches over every earlier index, and none of the results are kept, so the same subproblem is re-entered along every path that reaches it. The tabulated version solves each of the $n$ subproblems exactly once at a cost of $O(n)$ each, giving :color[O(n²)]{hex="#F97316"}. The saving is entirely in writing answers down, not in a better algorithm.

### Q21. Lap times coming down

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

**(a)** A runner's lap times in seconds: `74, 71, 76, 69, 72, 66, 70, 64, 68`. A lap counts as an improvement only if it is strictly faster. Find the longest improving sequence.

The following is a sample input and the corresponding output:

> **Input array:** $\{8, 3, 12, 6, 14, 9, 2\}$  
> **Output:** 3  
> **Explanation:** the longest strictly decreasing subsequence is $\{8, 3, 2\}$

The recurrence relation for the LDS problem is as follows:

$$
lds(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lds(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] > array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

Assume that $array = \{74, 71, 76, 69, 72, 66, 70, 64, 68\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 8, where the indices show up to which element in the array is being considered. State the length of the LDS. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 74 | 71 | 76 | 69 | 72 | 66 | 70 | 64 | 68 |
| **lds(i)** |  |  |  |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] > array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lds(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 74 | none | - | 1, on its own |
| 1 | 71 | 0 (1) | 1 | 1 + 1 = 2 |
| 2 | 76 | none | - | 1, on its own |
| 3 | 69 | 0 (1), 1 (2), 2 (1) | 2 | 1 + 2 = 3 |
| 4 | 72 | 0 (1), 2 (1) | 1 | 1 + 1 = 2 |
| 5 | 66 | 0 (1), 1 (2), 2 (1), 3 (3), 4 (2) | 3 | 1 + 3 = 4 |
| 6 | 70 | 0 (1), 1 (2), 2 (1), 4 (2) | 2 | 1 + 2 = 3 |
| 7 | 64 | 0 (1), 1 (2), 2 (1), 3 (3), 4 (2), 5 (4), 6 (3) | 4 | 1 + 4 = 5 |
| 8 | 68 | 0 (1), 1 (2), 2 (1), 3 (3), 4 (2), 6 (3) | 3 | 1 + 3 = 4 |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**74**]{hex="#204A2E"} | :mark[**71**]{hex="#204A2E"} | 76 | :mark[**69**]{hex="#204A2E"} | 72 | :mark[**66**]{hex="#204A2E"} | 70 | :mark[**64**]{hex="#204A2E"} | 68 |
| **lds** | :mark[**1**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | 1 | :mark[**3**]{hex="#204A2E"} | 2 | :mark[**4**]{hex="#204A2E"} | 3 | :mark[**5**]{hex="#204A2E"} | 4 |

The largest entry is **5**, at $i = 7$.

:mark[**The length of the LDS is 5.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LDS. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 7$ | 5 | 64 | look left for an entry of 4 that also satisfies the condition against 64; $i = 5$ holds 4 |
| $i = 5$ | 4 | 66 | look left for an entry of 3 that also satisfies the condition against 66; $i = 3$ holds 3 |
| $i = 3$ | 3 | 69 | look left for an entry of 2 that also satisfies the condition against 69; $i = 1$ holds 2 |
| $i = 1$ | 2 | 71 | look left for an entry of 1 that also satisfies the condition against 71; $i = 0$ holds 1 |
| $i = 0$ | 1 | 74 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0, 1, 3, 5, 7$, so the LDS is $\{74, 71, 69, 66, 64\}$.

**Check.** $74 > 71 > 69 > 66 > 64$, which is strictly decreasing, and there are 5 of them.

:mark[**The LDS is 74, 71, 69, 66, 64.**]{hex="#204A2E"}

**(iii)** Would a greedy method that starts at index 0 and extends the run whenever the condition allows produce the same answer? Justify with reference to your array. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> It gives **5** here, which happens to match the correct answer of **5**, but that is luck rather than correctness. Greedy commits to the first element and can never reconsider, so on an array beginning with a value that belongs to no long run it fails. Dynamic programming asks the question separately for every ending point.

**(b)** Define **optimal substructure** and identify where it appears in the recurrence given in part (a). &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> A problem has optimal substructure when an optimal solution contains within it optimal solutions to its subproblems. In the recurrence it is the :color[max]{hex="#EAB308"} term: the best run ending at $i$ is formed by taking the **best** run ending at some earlier $j$ and extending it. If that inner run were not itself optimal, a better one could be substituted and the outer answer would improve, which contradicts it being the best.

> **Worth noticing.** Faster means a smaller number, so improvement is the **decreasing** condition. Read the units before you pick the comparison.

### Q22. Population by census

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

**(a)** A town's population in thousands across ten censuses: `18, 21, 21, 19, 24, 24, 22, 27, 27, 25`. Find the longest run of censuses on which it never fell.

The following is a sample input and the corresponding output:

> **Input array:** $\{23, 19, 31, 15, 27, 11, 35\}$  
> **Output:** 3  
> **Explanation:** the longest non decreasing subsequence is $\{23, 31, 35\}$

The recurrence relation for the LNDS problem is as follows:

$$
lnds(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lnds(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] <= array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

Assume that $array = \{18, 21, 21, 19, 24, 24, 22, 27, 27, 25\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 9, where the indices show up to which element in the array is being considered. State the length of the LNDS. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 18 | 21 | 21 | 19 | 24 | 24 | 22 | 27 | 27 | 25 |
| **lnds(i)** |  |  |  |  |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] <= array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lnds(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 18 | none | - | 1, on its own |
| 1 | 21 | 0 (1) | 1 | 1 + 1 = 2 |
| 2 | 21 | 0 (1), 1 (2) | 2 | 1 + 2 = 3 |
| 3 | 19 | 0 (1) | 1 | 1 + 1 = 2 |
| 4 | 24 | 0 (1), 1 (2), 2 (3), 3 (2) | 3 | 1 + 3 = 4 |
| 5 | 24 | 0 (1), 1 (2), 2 (3), 3 (2), 4 (4) | 4 | 1 + 4 = 5 |
| 6 | 22 | 0 (1), 1 (2), 2 (3), 3 (2) | 3 | 1 + 3 = 4 |
| 7 | 27 | 0 (1), 1 (2), 2 (3), 3 (2), 4 (4), 5 (5), 6 (4) | 5 | 1 + 5 = 6 |
| 8 | 27 | 0 (1), 1 (2), 2 (3), 3 (2), 4 (4), 5 (5), 6 (4), 7 (6) | 6 | 1 + 6 = 7 |
| 9 | 25 | 0 (1), 1 (2), 2 (3), 3 (2), 4 (4), 5 (5), 6 (4) | 5 | 1 + 5 = 6 |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**18**]{hex="#204A2E"} | :mark[**21**]{hex="#204A2E"} | :mark[**21**]{hex="#204A2E"} | 19 | :mark[**24**]{hex="#204A2E"} | :mark[**24**]{hex="#204A2E"} | 22 | :mark[**27**]{hex="#204A2E"} | :mark[**27**]{hex="#204A2E"} | 25 |
| **lnds** | :mark[**1**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | :mark[**3**]{hex="#204A2E"} | 2 | :mark[**4**]{hex="#204A2E"} | :mark[**5**]{hex="#204A2E"} | 4 | :mark[**6**]{hex="#204A2E"} | :mark[**7**]{hex="#204A2E"} | 6 |

The largest entry is **7**, at $i = 8$.

:mark[**The length of the LNDS is 7.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LNDS. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 8$ | 7 | 27 | look left for an entry of 6 that also satisfies the condition against 27; $i = 7$ holds 6 |
| $i = 7$ | 6 | 27 | look left for an entry of 5 that also satisfies the condition against 27; $i = 5$ holds 5 |
| $i = 5$ | 5 | 24 | look left for an entry of 4 that also satisfies the condition against 24; $i = 4$ holds 4 |
| $i = 4$ | 4 | 24 | look left for an entry of 3 that also satisfies the condition against 24; $i = 2$ holds 3 |
| $i = 2$ | 3 | 21 | look left for an entry of 2 that also satisfies the condition against 21; $i = 1$ holds 2 |
| $i = 1$ | 2 | 21 | look left for an entry of 1 that also satisfies the condition against 21; $i = 0$ holds 1 |
| $i = 0$ | 1 | 18 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0, 1, 2, 4, 5, 7, 8$, so the LNDS is $\{18, 21, 21, 24, 24, 27, 27\}$.

**Check.** $18 \le 21 \le 21 \le 24 \le 24 \le 27 \le 27$, which is non decreasing, and there are 7 of them.

:mark[**The LNDS is 18, 21, 21, 24, 24, 27, 27.**]{hex="#204A2E"}

**(iii)** How many distinct subproblems does this solution solve, and how much work does each one do? &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> **10 subproblems**, one per index: *the length of the best qualifying run ending at $i$*, for $i = 0$ to $9$. Subproblem $i$ inspects the $i$ entries to its left, so it costs $O(i)$. Summed over all of them that is :color[O(n²)]{hex="#F97316"}. The plain recursion solves the same 10 subproblems an exponential number of times.

**(b)** Dynamic programming can be used to compute the $n$th term in the Fibonacci sequence. Briefly explain **why** dynamic programming, rather than divide and conquer, is the right approach to solve the problem. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> Because the subproblems **overlap**. $fib(n)$ needs $fib(n-1)$ and $fib(n-2)$, and those two both need $fib(n-3)$, and so on all the way down. Divide and conquer assumes subproblems are independent, so it solves each branch from scratch and recomputes the same values an exponential number of times, :color[O(2ⁿ)]{hex="#EF4444"}. There are only $n+1$ distinct values in the whole tree, so storing each one the first time it is computed brings it down to :color[O(n)]{hex="#22C55E"}.

### Q23. Jobs by deadline

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**19 marks**]{hex="#3A3A3E"}

**(a)** Eight jobs have a deadline and a reward. Find the largest set that can be taken in deadline order with rewards strictly increasing.

The following is a sample input and the corresponding output:

> **Input array:** $\{5, 14, 7, 20, 9, 16, 4\}$  
> **Output:** 4  
> **Explanation:** the longest strictly increasing subsequence is $\{5, 7, 9, 16\}$

The recurrence relation for the LIS problem is as follows:

$$
lis(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lis(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] < array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

**Sort by deadline** and the rewards become an ordinary array:

| Deadline | 2 | 3 | 5 | 6 | 8 | 9 | 11 | 13 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Reward** | 30 | 55 | 20 | 60 | 45 | 75 | 50 | 90 |

So the array the recurrence works on, in order, is $\{30, 55, 20, 60, 45, 75, 50, 90\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 7, where the indices show up to which element in the array is being considered. State the length of the LIS. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 30 | 55 | 20 | 60 | 45 | 75 | 50 | 90 |
| **lis(i)** |  |  |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] < array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lis(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 30 | none | - | 1, on its own |
| 1 | 55 | 0 (1) | 1 | 1 + 1 = 2 |
| 2 | 20 | none | - | 1, on its own |
| 3 | 60 | 0 (1), 1 (2), 2 (1) | 2 | 1 + 2 = 3 |
| 4 | 45 | 0 (1), 2 (1) | 1 | 1 + 1 = 2 |
| 5 | 75 | 0 (1), 1 (2), 2 (1), 3 (3), 4 (2) | 3 | 1 + 3 = 4 |
| 6 | 50 | 0 (1), 2 (1), 4 (2) | 2 | 1 + 2 = 3 |
| 7 | 90 | 0 (1), 1 (2), 2 (1), 3 (3), 4 (2), 5 (4), 6 (3) | 4 | 1 + 4 = 5 |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**30**]{hex="#204A2E"} | :mark[**55**]{hex="#204A2E"} | 20 | :mark[**60**]{hex="#204A2E"} | 45 | :mark[**75**]{hex="#204A2E"} | 50 | :mark[**90**]{hex="#204A2E"} |
| **lis** | :mark[**1**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | 1 | :mark[**3**]{hex="#204A2E"} | 2 | :mark[**4**]{hex="#204A2E"} | 3 | :mark[**5**]{hex="#204A2E"} |

The largest entry is **5**, at $i = 7$.

:mark[**The length of the LIS is 5.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LIS. &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 7$ | 5 | 90 | look left for an entry of 4 that also satisfies the condition against 90; $i = 5$ holds 4 |
| $i = 5$ | 4 | 75 | look left for an entry of 3 that also satisfies the condition against 75; $i = 3$ holds 3 |
| $i = 3$ | 3 | 60 | look left for an entry of 2 that also satisfies the condition against 60; $i = 1$ holds 2 |
| $i = 1$ | 2 | 55 | look left for an entry of 1 that also satisfies the condition against 55; $i = 0$ holds 1 |
| $i = 0$ | 1 | 30 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0, 1, 3, 5, 7$, so the LIS is $\{30, 55, 60, 75, 90\}$.

**Check.** $30 < 55 < 60 < 75 < 90$, which is strictly increasing, and there are 5 of them.

:mark[**The LIS is 30, 55, 60, 75, 90.**]{hex="#204A2E"}

**(iii)** If the array were **reversed** before the table was filled, would the answer change? Explain. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> Reversing turns every *strictly increasing* run into a run of the opposite kind, so this recurrence no longer finds the same thing. Filling the table on the reversed array gives **2** rather than **5**. To get the original answer from the reversed array you would have to flip the condition as well.

**(b)** State the two properties a problem must have before dynamic programming can be applied, and show that the problem in part (a) has both. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> **Optimal substructure**: the best answer is built from the best answers to smaller versions of the same problem. Here the best run ending at $i$ is the best run ending at some earlier $j$, plus one element, so it is built from a smaller optimum.
>
> **Overlapping subproblems**: the same smaller problem is asked for repeatedly. Here the entry at $j$ is read by every later index whose condition it satisfies, so without a table it would be recomputed each time.

### Q24. Box office falling away

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

**(a)** A film's daily box office takings, in lakhs, over its first ten days were `92, 78, 85, 66, 74, 58, 70, 49, 61, 44`. A distributor wants the longest run of days, not necessarily consecutive, on which each day took strictly less than the day before it in the run.

The following is a sample input and the corresponding output:

> **Input array:** $\{40, 22, 55, 31, 48, 18, 60\}$  
> **Output:** 3  
> **Explanation:** the longest strictly decreasing subsequence is $\{40, 22, 18\}$

The recurrence relation for the LDS problem is as follows:

$$
lds(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lds(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] > array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

Assume that $array = \{92, 78, 85, 66, 74, 58, 70, 49, 61, 44\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 9, where the indices show up to which element in the array is being considered. State the length of the LDS. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 92 | 78 | 85 | 66 | 74 | 58 | 70 | 49 | 61 | 44 |
| **lds(i)** |  |  |  |  |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] > array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lds(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 92 | none | - | 1, on its own |
| 1 | 78 | 0 (1) | 1 | 1 + 1 = 2 |
| 2 | 85 | 0 (1) | 1 | 1 + 1 = 2 |
| 3 | 66 | 0 (1), 1 (2), 2 (2) | 2 | 1 + 2 = 3 |
| 4 | 74 | 0 (1), 1 (2), 2 (2) | 2 | 1 + 2 = 3 |
| 5 | 58 | 0 (1), 1 (2), 2 (2), 3 (3), 4 (3) | 3 | 1 + 3 = 4 |
| 6 | 70 | 0 (1), 1 (2), 2 (2), 4 (3) | 3 | 1 + 3 = 4 |
| 7 | 49 | 0 (1), 1 (2), 2 (2), 3 (3), 4 (3), 5 (4), 6 (4) | 4 | 1 + 4 = 5 |
| 8 | 61 | 0 (1), 1 (2), 2 (2), 3 (3), 4 (3), 6 (4) | 4 | 1 + 4 = 5 |
| 9 | 44 | 0 (1), 1 (2), 2 (2), 3 (3), 4 (3), 5 (4), 6 (4), 7 (5), 8 (5) | 5 | 1 + 5 = 6 |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**92**]{hex="#204A2E"} | :mark[**78**]{hex="#204A2E"} | 85 | :mark[**66**]{hex="#204A2E"} | 74 | :mark[**58**]{hex="#204A2E"} | 70 | :mark[**49**]{hex="#204A2E"} | 61 | :mark[**44**]{hex="#204A2E"} |
| **lds** | :mark[**1**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | 2 | :mark[**3**]{hex="#204A2E"} | 3 | :mark[**4**]{hex="#204A2E"} | 4 | :mark[**5**]{hex="#204A2E"} | 5 | :mark[**6**]{hex="#204A2E"} |

The largest entry is **6**, at $i = 9$.

:mark[**The length of the LDS is 6.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LDS. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 9$ | 6 | 44 | look left for an entry of 5 that also satisfies the condition against 44; $i = 7$ holds 5 |
| $i = 7$ | 5 | 49 | look left for an entry of 4 that also satisfies the condition against 49; $i = 5$ holds 4 |
| $i = 5$ | 4 | 58 | look left for an entry of 3 that also satisfies the condition against 58; $i = 3$ holds 3 |
| $i = 3$ | 3 | 66 | look left for an entry of 2 that also satisfies the condition against 66; $i = 1$ holds 2 |
| $i = 1$ | 2 | 78 | look left for an entry of 1 that also satisfies the condition against 78; $i = 0$ holds 1 |
| $i = 0$ | 1 | 92 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0, 1, 3, 5, 7, 9$, so the LDS is $\{92, 78, 66, 58, 49, 44\}$.

**Check.** $92 > 78 > 66 > 58 > 49 > 44$, which is strictly decreasing, and there are 6 of them.

:mark[**The LDS is 92, 78, 66, 58, 49, 44.**]{hex="#204A2E"}

**(iii)** Explain why the table has to be filled from index 0 upwards, and what would go wrong if it were filled from the right. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> Cell $i$ is defined in terms of cells $0$ to $i-1$, so those have to hold their final values before cell $i$ is written. Filling from the right means every cell reads entries that are still empty, and the recurrence would fall through to the base case every time, producing a row of ones. The fill order is the whole meaning of the phrase *bottom up*: smallest subproblem first, largest last.

**(b)** Explain the difference between a **subsequence** and a **substring**, giving one example of each from the array in part (a). &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> A **substring** is contiguous: it has to be a block of neighbouring elements, such as $\{92, 78, 85\}$. A **subsequence** only has to keep the original left to right order, so elements may be skipped, such as $\{92, 85\}$. Every substring is a subsequence; the reverse is not true. This question asks for a subsequence, which is why the recurrence looks at **every** $j$ to the left rather than only at $i - 1$.

### Q25. Chess ratings

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

**(a)** A player's rating after each of nine tournaments: `1420, 1465, 1440, 1490, 1455, 1510, 1480, 1530, 1500`. Find the longest strictly rising selection.

The following is a sample input and the corresponding output:

> **Input array:** $\{12, 26, 9, 33, 21, 7, 30\}$  
> **Output:** 3  
> **Explanation:** the longest strictly increasing subsequence is $\{12, 26, 33\}$

The recurrence relation for the LIS problem is as follows:

$$
lis(\textcolor{#5B8CFF}{i}) = \begin{cases}
\textcolor{#2DD4BF}{1} + \max\big(lis(\textcolor{#FF5FA2}{j})\big) &
\text{where } \textcolor{#5B8CFF}{i} > \textcolor{#FF5FA2}{j} \ge 0
\text{ and } \textcolor{#A78BFA}{array[j] < array[i]} \\
\textcolor{#2DD4BF}{1} & \text{if no such } \textcolor{#FF5FA2}{j} \text{ exists}
\end{cases}
$$

Assume that $array = \{1420, 1465, 1440, 1490, 1455, 1510, 1480, 1530, 1500\}$.

**(i)** A dynamic programming solution starts by filling out a table of solution values in a bottom up manner, from smallest subproblem to largest. You are required **to provide the values of the table** below for indices 0 to 8, where the indices show up to which element in the array is being considered. State the length of the LIS. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **array[i]** | 1420 | 1465 | 1440 | 1490 | 1455 | 1510 | 1480 | 1530 | 1500 |
| **lis(i)** |  |  |  |  |  |  |  |  |  |

**Solution.** The condition is **:color[array[j] < array[i]]{hex="#A78BFA"}**.

| $i$ | value | qualifying $j$ (its entry) | best | $lis(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 1420 | none | - | 1, on its own |
| 1 | 1465 | 0 (1) | 1 | 1 + 1 = 2 |
| 2 | 1440 | 0 (1) | 1 | 1 + 1 = 2 |
| 3 | 1490 | 0 (1), 1 (2), 2 (2) | 2 | 1 + 2 = 3 |
| 4 | 1455 | 0 (1), 2 (2) | 2 | 1 + 2 = 3 |
| 5 | 1510 | 0 (1), 1 (2), 2 (2), 3 (3), 4 (3) | 3 | 1 + 3 = 4 |
| 6 | 1480 | 0 (1), 1 (2), 2 (2), 4 (3) | 3 | 1 + 3 = 4 |
| 7 | 1530 | 0 (1), 1 (2), 2 (2), 3 (3), 4 (3), 5 (4), 6 (4) | 4 | 1 + 4 = 5 |
| 8 | 1500 | 0 (1), 1 (2), 2 (2), 3 (3), 4 (3), 6 (4) | 4 | 1 + 4 = 5 |

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**1420**]{hex="#204A2E"} | :mark[**1465**]{hex="#204A2E"} | 1440 | :mark[**1490**]{hex="#204A2E"} | 1455 | :mark[**1510**]{hex="#204A2E"} | 1480 | :mark[**1530**]{hex="#204A2E"} | 1500 |
| **lis** | :mark[**1**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | 2 | :mark[**3**]{hex="#204A2E"} | 3 | :mark[**4**]{hex="#204A2E"} | 4 | :mark[**5**]{hex="#204A2E"} | 5 |

The largest entry is **5**, at $i = 7$.

:mark[**The length of the LIS is 5.**]{hex="#204A2E"}

**(ii)** Perform a *traceback* to identify the elements of the LIS. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

| at | entry | value | what happens next |
| --- | --- | --- | --- |
| $i = 7$ | 5 | 1530 | look left for an entry of 4 that also satisfies the condition against 1530; $i = 5$ holds 4 |
| $i = 5$ | 4 | 1510 | look left for an entry of 3 that also satisfies the condition against 1510; $i = 3$ holds 3 |
| $i = 3$ | 3 | 1490 | look left for an entry of 2 that also satisfies the condition against 1490; $i = 1$ holds 2 |
| $i = 1$ | 2 | 1465 | look left for an entry of 1 that also satisfies the condition against 1465; $i = 0$ holds 1 |
| $i = 0$ | 1 | 1420 | the entry is 1, so this element starts the run and the walk stops |

Read left to right the indices are $0, 1, 3, 5, 7$, so the LIS is $\{1420, 1465, 1490, 1510, 1530\}$.

**Check.** $1420 < 1465 < 1490 < 1510 < 1530$, which is strictly increasing, and there are 5 of them.

:mark[**The LIS is 1420, 1465, 1490, 1510, 1530.**]{hex="#204A2E"}

**(iii)** Is it better to use *dynamic programming* or *memoisation* to solve this problem? Briefly explain your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> **Bottom up dynamic programming.** All 9 cells have to be computed anyway, because the answer is the largest entry in the table and you cannot know which cell holds it until every cell is filled. Memoisation would work out the same 9 values, pay a function call and a cache lookup for each, and recurse 9 deep. Memoisation is the better choice only when a large part of the subproblem space is never reached, which is not the case here.

**(b)** Merge sort is solved by divide and conquer. Explain why dynamic programming would give it no advantage. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

> Merge sort splits the array into two halves that share no elements, so the two subproblems are **independent**. Nothing is ever computed twice, and there is nothing for a table to save. Dynamic programming only pays for itself when subproblems overlap; here it would add the cost of storing results and return none of it.

## Part C: when the recurrence changes

From here the scaffolding comes off: these are stated compactly, because the point is no longer
the ritual but what the recurrence is doing. The condition is not always a comparison, the entry is not always a count, and $\max$ is not
always $\max$. What survives is the ritual: fill in order, look only backwards, scan for the
best entry, walk back out.

### Q26. Maximum sum increasing subsequence

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; For `4, 6, 1, 3, 8, 4, 6` find the increasing subsequence with the largest **total**, not the largest count.

The recurrence is the same shape with one word changed: a cell holds a **sum**, so the :color[1]{hex="#2DD4BF"} becomes :color[the value itself]{hex="#2DD4BF"}.

$$
mss(\textcolor{#5B8CFF}{i}) = \textcolor{#2DD4BF}{array[i]} + \max\big(mss(\textcolor{#FF5FA2}{j})\big) \qquad \text{where } \textcolor{#A78BFA}{array[j] < array[i]}
$$

The condition is **:color[array[j] < array[i]]{hex="#A78BFA"}**, so the run has to be strictly increasing, but the cells hold sums.

**Working.** One row per cell, filled left to right.

| $i$ | value | qualifying $j$ (its entry) | best | $mss(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 4 | none | - | 4, on its own |
| 1 | 6 | 0 (4) | 4 | 6 + 4 = 10 |
| 2 | 1 | none | - | 1, on its own |
| 3 | 3 | 2 (1) | 1 | 3 + 1 = 4 |
| 4 | 8 | 0 (4), 1 (10), 2 (1), 3 (4) | 10 | 8 + 10 = 18 |
| 5 | 4 | 2 (1), 3 (4) | 4 | 4 + 4 = 8 |
| 6 | 6 | 0 (4), 2 (1), 3 (4), 5 (8) | 8 | 6 + 8 = 14 |

**The filled table.** The marked cells are the ones the traceback keeps.

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**4**]{hex="#204A2E"} | :mark[**6**]{hex="#204A2E"} | 1 | 3 | :mark[**8**]{hex="#204A2E"} | 4 | 6 |
| **mss** | :mark[**4**]{hex="#204A2E"} | :mark[**10**]{hex="#204A2E"} | 1 | 4 | :mark[**18**]{hex="#204A2E"} | 8 | 14 |

**Traceback.** The biggest entry is **18**, at $i = 4$. Each hop looks left for an entry one smaller that also satisfies the condition, giving indices $0, 1, 4$.

:mark[**Answer: total 18** &nbsp; (4, 6, 8)]{hex="#204A2E"}

> The longest increasing subsequence here has length **4**, but the heaviest has length **3**. Longest and largest are different questions.

### Q27. Chain of divisibility

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; For `2, 3, 4, 8, 9, 12, 24, 27, 48` find the longest subsequence in which every element divides the one after it.

Only the condition changes. Instead of comparing sizes it asks whether one number goes into the next:

$$
chain(\textcolor{#5B8CFF}{i}) = \textcolor{#2DD4BF}{1} + \max\big(chain(\textcolor{#FF5FA2}{j})\big) \qquad \text{where } \textcolor{#A78BFA}{array[i] \bmod array[j] = 0}
$$

The condition is **:color[array[i] mod array[j] = 0]{hex="#A78BFA"}**, so the run has to be a divisibility chain.

**Working.** One row per cell, filled left to right.

| $i$ | value | qualifying $j$ (its entry) | best | $chain(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 2 | none | - | 1, on its own |
| 1 | 3 | none | - | 1, on its own |
| 2 | 4 | 0 (1) | 1 | 1 + 1 = 2 |
| 3 | 8 | 0 (1), 2 (2) | 2 | 1 + 2 = 3 |
| 4 | 9 | 1 (1) | 1 | 1 + 1 = 2 |
| 5 | 12 | 0 (1), 1 (1), 2 (2) | 2 | 1 + 2 = 3 |
| 6 | 24 | 0 (1), 1 (1), 2 (2), 3 (3), 5 (3) | 3 | 1 + 3 = 4 |
| 7 | 27 | 1 (1), 4 (2) | 2 | 1 + 2 = 3 |
| 8 | 48 | 0 (1), 1 (1), 2 (2), 3 (3), 5 (3), 6 (4) | 4 | 1 + 4 = 5 |

**The filled table.** The marked cells are the ones the traceback keeps.

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**2**]{hex="#204A2E"} | 3 | :mark[**4**]{hex="#204A2E"} | :mark[**8**]{hex="#204A2E"} | 9 | 12 | :mark[**24**]{hex="#204A2E"} | 27 | :mark[**48**]{hex="#204A2E"} |
| **chain** | :mark[**1**]{hex="#204A2E"} | 1 | :mark[**2**]{hex="#204A2E"} | :mark[**3**]{hex="#204A2E"} | 2 | 3 | :mark[**4**]{hex="#204A2E"} | 3 | :mark[**5**]{hex="#204A2E"} |

**Traceback.** The biggest entry is **5**, at $i = 8$. Each hop looks left for an entry one smaller that also satisfies the condition, giving indices $0, 2, 3, 6, 8$.

:mark[**Answer: length 5** &nbsp; (2, 4, 8, 24, 48)]{hex="#204A2E"}

> Everything else about the ritual is unchanged. That is the point of learning the shape rather than the problem.

### Q28. An arithmetic run

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; For `1, 4, 7, 3, 10, 6, 13, 9, 16` find the longest subsequence in which each element is exactly **3** more than the one before it.

$$
run(\textcolor{#5B8CFF}{i}) = \textcolor{#2DD4BF}{1} + \max\big(run(\textcolor{#FF5FA2}{j})\big) \qquad \text{where } \textcolor{#A78BFA}{array[i] - array[j] = 3}
$$

The condition is **:color[array[i] - array[j] = 3]{hex="#A78BFA"}**, so the run has to be a run rising by exactly 3 each time.

**Working.** One row per cell, filled left to right.

| $i$ | value | qualifying $j$ (its entry) | best | $run(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 1 | none | - | 1, on its own |
| 1 | 4 | 0 (1) | 1 | 1 + 1 = 2 |
| 2 | 7 | 1 (2) | 2 | 1 + 2 = 3 |
| 3 | 3 | none | - | 1, on its own |
| 4 | 10 | 2 (3) | 3 | 1 + 3 = 4 |
| 5 | 6 | 3 (1) | 1 | 1 + 1 = 2 |
| 6 | 13 | 4 (4) | 4 | 1 + 4 = 5 |
| 7 | 9 | 5 (2) | 2 | 1 + 2 = 3 |
| 8 | 16 | 6 (5) | 5 | 1 + 5 = 6 |

**The filled table.** The marked cells are the ones the traceback keeps.

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**1**]{hex="#204A2E"} | :mark[**4**]{hex="#204A2E"} | :mark[**7**]{hex="#204A2E"} | 3 | :mark[**10**]{hex="#204A2E"} | 6 | :mark[**13**]{hex="#204A2E"} | 9 | :mark[**16**]{hex="#204A2E"} |
| **run** | :mark[**1**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | :mark[**3**]{hex="#204A2E"} | 1 | :mark[**4**]{hex="#204A2E"} | 2 | :mark[**5**]{hex="#204A2E"} | 3 | :mark[**6**]{hex="#204A2E"} |

**Traceback.** The biggest entry is **6**, at $i = 8$. Each hop looks left for an entry one smaller that also satisfies the condition, giving indices $0, 1, 2, 4, 6, 8$.

:mark[**Answer: length 6** &nbsp; (1, 4, 7, 10, 13, 16)]{hex="#204A2E"}

### Q29. Longest bitonic subsequence

> :mark[**Very hard**]{hex="#5C2323"} &nbsp; For `1, 11, 2, 10, 4, 5, 2, 1` find the longest subsequence that rises and then falls. Either half may be empty.

Two tables, not one. Run the increasing recurrence left to right, run it again right to left, then every index is a candidate peak:

$$
bitonic(\textcolor{#5B8CFF}{i}) = \textcolor{#22C55E}{up(i)} + \textcolor{#FF5FA2}{down(i)} - 1
$$

The :color[- 1]{hex="#A78BFA"} is there because the peak is counted in both tables.

**Working.**

| $i$ | value | $up(i)$ | $down(i)$ | $up + down - 1$ |
| --- | --- | --- | --- | --- |
| 0 | 1 | 1 | 1 | 1 + 1 - 1 = 1 |
| 1 | 11 | 2 | 5 | 2 + 5 - 1 = 6 |
| 2 | 2 | 2 | 2 | 2 + 2 - 1 = 3 |
| 3 | 10 | 3 | 4 | 3 + 4 - 1 = 6 |
| 4 | 4 | 3 | 3 | 3 + 3 - 1 = 5 |
| 5 | 5 | 4 | 3 | 4 + 3 - 1 = 6 |
| 6 | 2 | 2 | 2 | 2 + 2 - 1 = 3 |
| 7 | 1 | 1 | 1 | 1 + 1 - 1 = 1 |

**The filled table.**

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | :mark[**1**]{hex="#204A2E"} | :mark[**11**]{hex="#204A2E"} | 2 | :mark[**10**]{hex="#204A2E"} | :mark[**4**]{hex="#204A2E"} | 5 | :mark[**2**]{hex="#204A2E"} | :mark[**1**]{hex="#204A2E"} |
| **up** | :mark[**1**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | 2 | :mark[**3**]{hex="#204A2E"} | :mark[**3**]{hex="#204A2E"} | 4 | :mark[**2**]{hex="#204A2E"} | :mark[**1**]{hex="#204A2E"} |
| **down** | :mark[**1**]{hex="#204A2E"} | :mark[**5**]{hex="#204A2E"} | 2 | :mark[**4**]{hex="#204A2E"} | :mark[**3**]{hex="#204A2E"} | 3 | :mark[**2**]{hex="#204A2E"} | :mark[**1**]{hex="#204A2E"} |
| **total** | :mark[**1**]{hex="#204A2E"} | :mark[**6**]{hex="#204A2E"} | 3 | :mark[**6**]{hex="#204A2E"} | :mark[**5**]{hex="#204A2E"} | 6 | :mark[**3**]{hex="#204A2E"} | :mark[**1**]{hex="#204A2E"} |

**Traceback.** The largest total is **6**, at $i = 1$, so that element is the peak. Trace the up table back to the left of it and the down table forward to the right of it.

:mark[**Answer: length 6 &nbsp; (1, 11, 10, 4, 2, 1)**]{hex="#204A2E"}

### Q30. No two adjacent

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; Houses along a street hold `6, 7, 1, 30, 8, 2, 4` in cash. You may not take from two houses next door to each other. Take as much as possible.

Each cell answers *the best I can do using the first i houses*. There are only two things you can do at house $i$:

$$
best(\textcolor{#5B8CFF}{i}) = \max\big(\;\textcolor{#A78BFA}{best(i-1)}\;,\;\textcolor{#EAB308}{value[i] + best(i-2)}\;\big)
$$

:color[Skip it]{hex="#A78BFA"} and carry the previous answer forward, or :color[take it]{hex="#EAB308"} and add the answer from two houses back.

**Working.**

| $i$ | value | take it | skip it | $best(i)$ |
| --- | --- | --- | --- | --- |
| 0 | 6 | 6 + 0 = 6 | 0 | max = 6 |
| 1 | 7 | 7 + 0 = 7 | 6 | max = 7 |
| 2 | 1 | 1 + 6 = 7 | 7 | max = 7 |
| 3 | 30 | 30 + 7 = 37 | 7 | max = 37 |
| 4 | 8 | 8 + 7 = 15 | 37 | max = 37 |
| 5 | 2 | 2 + 37 = 39 | 37 | max = 39 |
| 6 | 4 | 4 + 37 = 41 | 39 | max = 41 |

**The filled table.**

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | 6 | :mark[**7**]{hex="#204A2E"} | 1 | :mark[**30**]{hex="#204A2E"} | 8 | 2 | :mark[**4**]{hex="#204A2E"} |
| **best** | 6 | :mark[**7**]{hex="#204A2E"} | 7 | :mark[**37**]{hex="#204A2E"} | 37 | 39 | :mark[**41**]{hex="#204A2E"} |

**Traceback.** Walk back from the last cell. Where the entry changed, the house was taken and you jump back two. Where it did not, the house was skipped and you step back one.

:mark[**Answer: total 41 &nbsp; (house 1 (7), house 3 (30), house 6 (4))**]{hex="#204A2E"}

### Q31. Fewest coins

> :mark[**Medium**]{hex="#565426"} &nbsp; Coins of value `1, 5, 6, 9` are available in unlimited numbers. Make **11** with as few coins as possible.

The table runs over **amounts**, not over positions in an array:

$$
coins(\textcolor{#5B8CFF}{a}) = \textcolor{#2DD4BF}{1} + \min\big(coins(\textcolor{#FF5FA2}{a - d})\big) \qquad \text{for every coin } \textcolor{#A78BFA}{d \le a}
$$

**Working.**

| amount | coin that fits (entry it lands on) | best | $coins(a)$ |
| --- | --- | --- | --- |
| 1 | 1 (0) | 0 | 1 + 0 = 1 |
| 2 | 1 (1) | 1 | 1 + 1 = 2 |
| 3 | 1 (2) | 2 | 1 + 2 = 3 |
| 4 | 1 (3) | 3 | 1 + 3 = 4 |
| 5 | 1 (4), 5 (0) | 0 | 1 + 0 = 1 |
| 6 | 1 (1), 5 (1), 6 (0) | 0 | 1 + 0 = 1 |
| 7 | 1 (1), 5 (2), 6 (1) | 1 | 1 + 1 = 2 |
| 8 | 1 (2), 5 (3), 6 (2) | 2 | 1 + 2 = 3 |
| 9 | 1 (3), 5 (4), 6 (3), 9 (0) | 0 | 1 + 0 = 1 |
| 10 | 1 (1), 5 (1), 6 (4), 9 (1) | 1 | 1 + 1 = 2 |
| 11 | 1 (2), 5 (1), 6 (1), 9 (2) | 1 | 1 + 1 = 2 |

**The filled table.**

| **amount** | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **coins** | 0 | 1 | 2 | 3 | 4 | 1 | 1 | 2 | 3 | 1 | 2 | 2 |

**Traceback.** From amount **11**, subtract the coin the cell used and repeat until you reach 0.

:mark[**Answer: 2 coins &nbsp; (5 + 6)**]{hex="#204A2E"}

> Greedy takes 9 then 1 and 1, which is three coins. The table finds **two**. This is exactly the question an exam uses to show that greedy is not enough.

### Q32. Fewest coins, awkward denominations

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; Coins of value `1, 3, 4` are available. Make **13** with as few coins as possible, then say what greedy would have done.

**Working.**

| amount | coin that fits (entry it lands on) | best | $coins(a)$ |
| --- | --- | --- | --- |
| 1 | 1 (0) | 0 | 1 + 0 = 1 |
| 2 | 1 (1) | 1 | 1 + 1 = 2 |
| 3 | 1 (2), 3 (0) | 0 | 1 + 0 = 1 |
| 4 | 1 (1), 3 (1), 4 (0) | 0 | 1 + 0 = 1 |
| 5 | 1 (1), 3 (2), 4 (1) | 1 | 1 + 1 = 2 |
| 6 | 1 (2), 3 (1), 4 (2) | 1 | 1 + 1 = 2 |
| 7 | 1 (2), 3 (1), 4 (1) | 1 | 1 + 1 = 2 |
| 8 | 1 (2), 3 (2), 4 (1) | 1 | 1 + 1 = 2 |
| 9 | 1 (2), 3 (2), 4 (2) | 2 | 1 + 2 = 3 |
| 10 | 1 (3), 3 (2), 4 (2) | 2 | 1 + 2 = 3 |
| 11 | 1 (3), 3 (2), 4 (2) | 2 | 1 + 2 = 3 |
| 12 | 1 (3), 3 (3), 4 (2) | 2 | 1 + 2 = 3 |
| 13 | 1 (3), 3 (3), 4 (3) | 3 | 1 + 3 = 4 |

**The filled table.**

| **amount** | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **coins** | 0 | 1 | 2 | 1 | 1 | 2 | 2 | 2 | 2 | 3 | 3 | 3 | 3 | 4 |

**Traceback.** From amount **13**, subtract the coin the cell used and repeat until you reach 0.

:mark[**Answer: 4 coins &nbsp; (1 + 4 + 4 + 4)**]{hex="#204A2E"}

> Greedy takes 4, 4, 4 and then 1, which is four coins. So does the table here, but check amount **6**: greedy gives 4 then 1 and 1, three coins, where the table gives 3 and 3, two coins.

### Q33. Cutting a rod

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; A rod of length **8** can be cut into whole numbered pieces. A piece of length 1 to 8 sells for `1, 5, 8, 9, 10, 17, 17, 20`. Maximise the revenue.

$$
revenue(\textcolor{#5B8CFF}{L}) = \max_{1 \le k \le L}\big(\textcolor{#EAB308}{price[k]} + revenue(\textcolor{#FF5FA2}{L - k})\big)
$$

Every cell asks the same thing: :color[what is the first cut]{hex="#EAB308"}, and what is the best I can already do with the remainder.

**Working.**

| length | first cut of size $k$: price + rest | best | cut taken |
| --- | --- | --- | --- |
| 1 | 1: 1+0=1 | 1 | 1 |
| 2 | 1: 1+1=2, 2: 5+0=5 | 5 | 2 |
| 3 | 1: 1+5=6, 2: 5+1=6, 3: 8+0=8 | 8 | 3 |
| 4 | 1: 1+8=9, 2: 5+5=10, 3: 8+1=9, 4: 9+0=9 | 10 | 2 |
| 5 | 1: 1+10=11, 2: 5+8=13, 3: 8+5=13, 4: 9+1=10, 5: 10+0=10 | 13 | 2 |
| 6 | 1: 1+13=14, 2: 5+10=15, 3: 8+8=16, 4: 9+5=14, 5: 10+1=11, 6: 17+0=17 | 17 | 6 |
| 7 | 1: 1+17=18, 2: 5+13=18, 3: 8+10=18, 4: 9+8=17, 5: 10+5=15, 6: 17+1=18, 7: 17+0=17 | 18 | 1 |
| 8 | 1: 1+18=19, 2: 5+17=22, 3: 8+13=21, 4: 9+10=19, 5: 10+8=18, 6: 17+5=22, 7: 17+1=18, 8: 20+0=20 | 22 | 2 |

**The filled table.**

| **length** | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **revenue** | 0 | 1 | 5 | 8 | 10 | 13 | 17 | 18 | 22 |

**Traceback.** Read the cut off the last cell, subtract it, and read the next cut off the cell you land on.

:mark[**Answer: revenue 22 &nbsp; (cuts of 2, 6)**]{hex="#204A2E"}

### Q34. Fewest jumps to the end

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; From index $i$ you may hop forward by anything from 1 up to `array[i]`. For `2, 3, 1, 1, 4, 2, 1, 3` find the fewest hops from the first index to the last.

$$
jumps(\textcolor{#5B8CFF}{i}) = \textcolor{#2DD4BF}{1} + \min\big(jumps(\textcolor{#FF5FA2}{j})\big) \qquad \text{where } \textcolor{#A78BFA}{j + array[j] \ge i}
$$

Note the :color[min]{hex="#A78BFA"}. Fewest, not longest, so everything about the ritual is the same and the comparison flips.

**Working.**

| $i$ | $j$ that can reach $i$ | their entries | $jumps(i)$ |
| --- | --- | --- | --- |
| 1 | 0 | 0 | 1 |
| 2 | 0, 1 | 0, 1 | 1 |
| 3 | 1, 2 | 1, 1 | 2 |
| 4 | 1, 3 | 1, 2 | 2 |
| 5 | 4 | 2 | 3 |
| 6 | 4, 5 | 2, 3 | 3 |
| 7 | 4, 5, 6 | 2, 3, 3 | 3 |

**The filled table.**

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **reach** | :mark[**2**]{hex="#204A2E"} | :mark[**3**]{hex="#204A2E"} | 1 | 1 | :mark[**4**]{hex="#204A2E"} | 2 | 1 | :mark[**3**]{hex="#204A2E"} |
| **jumps** | :mark[**0**]{hex="#204A2E"} | :mark[**1**]{hex="#204A2E"} | 1 | 2 | :mark[**2**]{hex="#204A2E"} | 3 | 3 | :mark[**3**]{hex="#204A2E"} |

**Traceback.** From the last index, step back to the cell the entry was built on, and repeat.

:mark[**Answer: 3 jumps &nbsp; (indices 0, 1, 4, 7)**]{hex="#204A2E"}

### Q35. Largest sum of a run

> :mark[**Medium**]{hex="#565426"} &nbsp; For `-2, 1, -3, 4, -1, 2, 1, -5, 4` find the largest total of a **contiguous** run of elements.

Contiguous, so a cell has only one decision to make:

$$
best(\textcolor{#5B8CFF}{i}) = \max\big(\;\textcolor{#EAB308}{array[i]}\;,\;\textcolor{#A78BFA}{array[i] + best(i-1)}\;\big)
$$

:color[Start again here]{hex="#EAB308"}, or :color[extend the run that ends just before]{hex="#A78BFA"}. A negative running total is never worth carrying.

**Working.**

| $i$ | value | $best(i-1)$ | decision | $best(i)$ |
| --- | --- | --- | --- | --- |
| 0 | -2 | - | start again | -2 |
| 1 | 1 | -2 | start again | 1 |
| 2 | -3 | 1 | extend | -2 |
| 3 | 4 | -2 | start again | 4 |
| 4 | -1 | 4 | extend | 3 |
| 5 | 2 | 3 | extend | 5 |
| 6 | 1 | 5 | extend | 6 |
| 7 | -5 | 6 | extend | 1 |
| 8 | 4 | 1 | extend | 5 |

**The filled table.**

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | -2 | 1 | -3 | :mark[**4**]{hex="#204A2E"} | :mark[**-1**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | :mark[**1**]{hex="#204A2E"} | -5 | 4 |
| **best** | -2 | 1 | -2 | :mark[**4**]{hex="#204A2E"} | :mark[**3**]{hex="#204A2E"} | :mark[**5**]{hex="#204A2E"} | :mark[**6**]{hex="#204A2E"} | 1 | 5 |

**Traceback.** Find the biggest entry, then walk left for as long as the cells were extending rather than starting again. That is where the run began.

:mark[**Answer: total 6 &nbsp; (indices 3 to 6: 4, -1, 2, 1)**]{hex="#204A2E"}

### Q36. Largest run, all negative but one

> :mark[**Medium**]{hex="#565426"} &nbsp; For `-4, -2, -7, 3, -1, -6, -3` find the largest total of a contiguous run.

**Working.**

| $i$ | value | $best(i-1)$ | decision | $best(i)$ |
| --- | --- | --- | --- | --- |
| 0 | -4 | - | start again | -4 |
| 1 | -2 | -4 | start again | -2 |
| 2 | -7 | -2 | start again | -7 |
| 3 | 3 | -7 | start again | 3 |
| 4 | -1 | 3 | extend | 2 |
| 5 | -6 | 2 | extend | -4 |
| 6 | -3 | -4 | start again | -3 |

**The filled table.**

| $i$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **value** | -4 | -2 | -7 | :mark[**3**]{hex="#204A2E"} | -1 | -6 | -3 |
| **best** | -4 | -2 | -7 | :mark[**3**]{hex="#204A2E"} | 2 | -4 | -3 |

**Traceback.** Find the biggest entry, then walk left for as long as the cells were extending rather than starting again. That is where the run began.

:mark[**Answer: total 3 &nbsp; (indices 3 to 3: 3)**]{hex="#204A2E"}

### Q37. Counting ways up a staircase

> :mark[**Medium**]{hex="#565426"} &nbsp; A staircase has **10** steps. You may climb 1 or 2 steps at a time. How many different ways are there to the top?

$$
ways(\textcolor{#5B8CFF}{i}) = \sum_{s} ways(\textcolor{#FF5FA2}{i - s}) \qquad \text{for every step size } \textcolor{#A78BFA}{s \le i}, \quad ways(\textcolor{#2DD4BF}{0}) = \textcolor{#2DD4BF}{1}
$$

A counting question adds instead of taking a maximum. The shape does not change.

**Working.**

| rung | last step of size $s$ lands on (its entry) | $ways(i)$ |
| --- | --- | --- |
| 1 | 1 (1) | 1 = 1 |
| 2 | 1 (1), 2 (1) | 1 + 1 = 2 |
| 3 | 1 (2), 2 (1) | 2 + 1 = 3 |
| 4 | 1 (3), 2 (2) | 3 + 2 = 5 |
| 5 | 1 (5), 2 (3) | 5 + 3 = 8 |
| 6 | 1 (8), 2 (5) | 8 + 5 = 13 |
| 7 | 1 (13), 2 (8) | 13 + 8 = 21 |
| 8 | 1 (21), 2 (13) | 21 + 13 = 34 |
| 9 | 1 (34), 2 (21) | 34 + 21 = 55 |
| 10 | 1 (55), 2 (34) | 55 + 34 = 89 |

**The filled table.**

| **rung** | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **ways** | 1 | 1 | 2 | 3 | 5 | 8 | 13 | 21 | 34 | 55 | 89 |

:mark[**Answer: 89 ways**]{hex="#204A2E"}

> This is the Fibonacci sequence, offset by one. Which is why part (b) of the past paper asks about Fibonacci at all.

### Q38. Counting ways with three step sizes

> :mark[**Medium**]{hex="#565426"} &nbsp; The same staircase of **10** steps, but now you may climb 1, 3 or 5 steps at a time.

**Working.**

| rung | last step of size $s$ lands on (its entry) | $ways(i)$ |
| --- | --- | --- |
| 1 | 1 (1) | 1 = 1 |
| 2 | 1 (1) | 1 = 1 |
| 3 | 1 (1), 3 (1) | 1 + 1 = 2 |
| 4 | 1 (2), 3 (1) | 2 + 1 = 3 |
| 5 | 1 (3), 3 (1), 5 (1) | 3 + 1 + 1 = 5 |
| 6 | 1 (5), 3 (2), 5 (1) | 5 + 2 + 1 = 8 |
| 7 | 1 (8), 3 (3), 5 (1) | 8 + 3 + 1 = 12 |
| 8 | 1 (12), 3 (5), 5 (2) | 12 + 5 + 2 = 19 |
| 9 | 1 (19), 3 (8), 5 (3) | 19 + 8 + 3 = 30 |
| 10 | 1 (30), 3 (12), 5 (5) | 30 + 12 + 5 = 47 |

**The filled table.**

| **rung** | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **ways** | 1 | 1 | 1 | 2 | 3 | 5 | 8 | 12 | 19 | 30 | 47 |

:mark[**Answer: 47 ways**]{hex="#204A2E"}

## Part D: two dimensional tables

When **two** things vary at once, one index cannot hold the state. Everything else carries over,
including the traceback, which now walks diagonally out of a corner instead of leftwards out of a row.

![A cell in a two dimensional table and the three cells it can be built from](/notes/img/algorithms/ch09-grid-cell.svg)

> The fill order matters more here. A cell needs the ones above and to the left, so fill row by
> row, left to right, and the values you need are always already there.

### Q39. Longest common subsequence

> :mark[**Medium**]{hex="#565426"} &nbsp; Find the longest common subsequence of `AGGTAB` and `GXTXAYB`.

Two words, so the table is two dimensional. Row $i$ means *the first $i$ letters of the first word*, column $j$ the same for the second. The rule has two branches:

$$
t[\textcolor{#5B8CFF}{i}][\textcolor{#FF5FA2}{j}] = \begin{cases}\textcolor{#22C55E}{t[i-1][j-1] + 1} & \text{if the two letters match} \\\textcolor{#A78BFA}{\max(t[i-1][j],\; t[i][j-1])} & \text{otherwise}\end{cases}
$$

**The filled table.** `AGGTAB` down the side, `GXTXAYB` along the top.

|   | **-** | **G** | **X** | **T** | **X** | **A** | **Y** | **B** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **-** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **A** | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 1 |
| **G** | 0 | :mark[**1**]{hex="#204A2E"} | 1 | 1 | 1 | 1 | 1 | 1 |
| **G** | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| **T** | 0 | 1 | 1 | :mark[**2**]{hex="#204A2E"} | 2 | 2 | 2 | 2 |
| **A** | 0 | 1 | 1 | 2 | 2 | :mark[**3**]{hex="#204A2E"} | 3 | 3 |
| **B** | 0 | 1 | 1 | 2 | 2 | 3 | 3 | :mark[**4**]{hex="#204A2E"} |

Two cells worth reading aloud. At row **2**, column **1** the letters `G` and `G` match, so the cell takes the diagonal and adds one. Anywhere the letters differ, the cell copies the better of the neighbour above and the neighbour to the left, which is why long flat stretches appear in the table.

**Traceback.** Start at the bottom right. On a match, keep the letter and move diagonally. On a mismatch, move to whichever of up or left holds the larger value. The marked cells are the matches.

:mark[**Answer: length 4 &nbsp; (GTAB)**]{hex="#204A2E"}

### Q40. Longest common subsequence, a busier table

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; Find the longest common subsequence of `ABCBDAB` and `BDCABA`.

Two words, so the table is two dimensional. Row $i$ means *the first $i$ letters of the first word*, column $j$ the same for the second. The rule has two branches:

$$
t[\textcolor{#5B8CFF}{i}][\textcolor{#FF5FA2}{j}] = \begin{cases}\textcolor{#22C55E}{t[i-1][j-1] + 1} & \text{if the two letters match} \\\textcolor{#A78BFA}{\max(t[i-1][j],\; t[i][j-1])} & \text{otherwise}\end{cases}
$$

**The filled table.** `ABCBDAB` down the side, `BDCABA` along the top.

|   | **-** | **B** | **D** | **C** | **A** | **B** | **A** |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **-** | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **A** | 0 | 0 | 0 | 0 | 1 | 1 | 1 |
| **B** | 0 | :mark[**1**]{hex="#204A2E"} | 1 | 1 | 1 | 2 | 2 |
| **C** | 0 | 1 | 1 | :mark[**2**]{hex="#204A2E"} | 2 | 2 | 2 |
| **B** | 0 | 1 | 1 | 2 | 2 | :mark[**3**]{hex="#204A2E"} | 3 |
| **D** | 0 | 1 | 2 | 2 | 2 | 3 | 3 |
| **A** | 0 | 1 | 2 | 2 | 3 | 3 | :mark[**4**]{hex="#204A2E"} |
| **B** | 0 | 1 | 2 | 2 | 3 | 4 | 4 |

Two cells worth reading aloud. At row **2**, column **1** the letters `B` and `B` match, so the cell takes the diagonal and adds one. Anywhere the letters differ, the cell copies the better of the neighbour above and the neighbour to the left, which is why long flat stretches appear in the table.

**Traceback.** Start at the bottom right. On a match, keep the letter and move diagonally. On a mismatch, move to whichever of up or left holds the larger value. The marked cells are the matches.

:mark[**Answer: length 4 &nbsp; (BCBA)**]{hex="#204A2E"}

> Several tracebacks reach length 4 here. Any of them earns the marks, as long as the chain you write down really is a subsequence of both words.

### Q41. Longest common substring

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; Find the longest common **substring**, meaning contiguous, of `ALGORITHM` and `LOGARITHM`.

Contiguous, so a mismatch cannot inherit anything. It resets to **0**:

$$
t[\textcolor{#5B8CFF}{i}][\textcolor{#FF5FA2}{j}] = \begin{cases}\textcolor{#22C55E}{t[i-1][j-1] + 1} & \text{if the two letters match} \\\textcolor{#A78BFA}{0} & \text{otherwise}\end{cases}
$$

That single change is the whole difference between a substring and a subsequence.

**The filled table.** `ALGORITHM` down the side, `LOGARITHM` along the top.

|   | **-** | **L** | **O** | **G** | **A** | **R** | **I** | **T** | **H** | **M** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **-** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **A** | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| **L** | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **G** | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| **O** | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **R** | 0 | 0 | 0 | 0 | 0 | :mark[**1**]{hex="#204A2E"} | 0 | 0 | 0 | 0 |
| **I** | 0 | 0 | 0 | 0 | 0 | 0 | :mark[**2**]{hex="#204A2E"} | 0 | 0 | 0 |
| **T** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | :mark[**3**]{hex="#204A2E"} | 0 | 0 |
| **H** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | :mark[**4**]{hex="#204A2E"} | 0 |
| **M** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | :mark[**5**]{hex="#204A2E"} |

The answer is not in the corner this time. A run can end anywhere, so the answer is the **largest entry anywhere in the table**, exactly as it was in the one dimensional questions.

**Traceback.** From the largest entry, walk diagonally up and left while the entries count down.

:mark[**Answer: length 5 &nbsp; (RITHM)**]{hex="#204A2E"}

### Q42. Edit distance

> :mark[**Medium**]{hex="#565426"} &nbsp; Find the fewest single character insertions, deletions and replacements that turn `KITTEN` into `SITTING`.

The first row and first column are not zero here. Turning a word into nothing costs one deletion per letter, so they count **0, 1, 2, 3** and so on. After that:

$$
t[\textcolor{#5B8CFF}{i}][\textcolor{#FF5FA2}{j}] = \begin{cases}\textcolor{#22C55E}{t[i-1][j-1]} & \text{letters match, nothing to pay} \\\textcolor{#A78BFA}{1 + \min(t[i-1][j-1],\; t[i-1][j],\; t[i][j-1])} & \text{otherwise}\end{cases}
$$

The three cells in the :color[min]{hex="#A78BFA"} are replace, delete and insert, in that order.

**The filled table.** `KITTEN` down the side, `SITTING` along the top.

|   | **-** | **S** | **I** | **T** | **T** | **I** | **N** | **G** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **-** | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| **K** | 1 | :mark[**1**]{hex="#204A2E"} | 2 | 3 | 4 | 5 | 6 | 7 |
| **I** | 2 | 2 | :mark[**1**]{hex="#204A2E"} | 2 | 3 | 4 | 5 | 6 |
| **T** | 3 | 3 | 2 | :mark[**1**]{hex="#204A2E"} | 2 | 3 | 4 | 5 |
| **T** | 4 | 4 | 3 | 2 | :mark[**1**]{hex="#204A2E"} | 2 | 3 | 4 |
| **E** | 5 | 5 | 4 | 3 | 2 | :mark[**2**]{hex="#204A2E"} | 3 | 4 |
| **N** | 6 | 6 | 5 | 4 | 3 | 3 | :mark[**2**]{hex="#204A2E"} | :mark[**3**]{hex="#204A2E"} |

A matching pair of letters costs nothing at all, so the diagonal is copied straight across. Every other cell pays one, on top of the cheapest thing already known.

**Traceback.** From the bottom right, step to whichever cell the value came from. A diagonal step with no change in value was a match; anything else was an edit.

:mark[**Answer: 3 edits &nbsp; (replace K with S; replace E with I; insert G)**]{hex="#204A2E"}

### Q43. Edit distance, no shared letters at the ends

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; Find the edit distance between `SUNDAY` and `SATURDAY`.

The first row and first column are not zero here. Turning a word into nothing costs one deletion per letter, so they count **0, 1, 2, 3** and so on. After that:

$$
t[\textcolor{#5B8CFF}{i}][\textcolor{#FF5FA2}{j}] = \begin{cases}\textcolor{#22C55E}{t[i-1][j-1]} & \text{letters match, nothing to pay} \\\textcolor{#A78BFA}{1 + \min(t[i-1][j-1],\; t[i-1][j],\; t[i][j-1])} & \text{otherwise}\end{cases}
$$

The three cells in the :color[min]{hex="#A78BFA"} are replace, delete and insert, in that order.

**The filled table.** `SUNDAY` down the side, `SATURDAY` along the top.

|   | **-** | **S** | **A** | **T** | **U** | **R** | **D** | **A** | **Y** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **-** | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| **S** | 1 | :mark[**0**]{hex="#204A2E"} | :mark[**1**]{hex="#204A2E"} | :mark[**2**]{hex="#204A2E"} | 3 | 4 | 5 | 6 | 7 |
| **U** | 2 | 1 | 1 | 2 | :mark[**2**]{hex="#204A2E"} | 3 | 4 | 5 | 6 |
| **N** | 3 | 2 | 2 | 2 | 3 | :mark[**3**]{hex="#204A2E"} | 4 | 5 | 6 |
| **D** | 4 | 3 | 3 | 3 | 3 | 4 | :mark[**3**]{hex="#204A2E"} | 4 | 5 |
| **A** | 5 | 4 | 3 | 4 | 4 | 4 | 4 | :mark[**3**]{hex="#204A2E"} | 4 |
| **Y** | 6 | 5 | 4 | 4 | 5 | 5 | 5 | 4 | :mark[**3**]{hex="#204A2E"} |

A matching pair of letters costs nothing at all, so the diagonal is copied straight across. Every other cell pays one, on top of the cheapest thing already known.

**Traceback.** From the bottom right, step to whichever cell the value came from. A diagonal step with no change in value was a match; anything else was an edit.

:mark[**Answer: 3 edits &nbsp; (insert A; insert T; replace N with R)**]{hex="#204A2E"}

### Q44. 0/1 knapsack

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; A bag carries **10** kg. Items: A (5 kg, 60), B (3 kg, 50), C (4 kg, 70), D (2 kg, 30). Each item may be taken once. Maximise the value.

Two things vary, the item and the space left, so the table is two dimensional. Row $i$ means *only the first $i$ items are on offer*, column $c$ means *the bag holds $c$ kg*.

$$
t[\textcolor{#5B8CFF}{i}][\textcolor{#FF5FA2}{c}] = \max\big(\;\textcolor{#A78BFA}{t[i-1][c]}\;,\;\textcolor{#EAB308}{value_i + t[i-1][c - weight_i]}\;\big)
$$

:color[Leave the item]{hex="#A78BFA"}, or :color[take it]{hex="#EAB308"} and look up the best answer for the space that is left. The second branch only exists when the item fits.

**The filled table.** Capacity along the top, items down the side.

|   | **0** | **1** | **2** | **3** | **4** | **5** | **6** | **7** | **8** | **9** | **10** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **none** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **A (5kg, 60)** | 0 | 0 | 0 | 0 | 0 | 60 | 60 | 60 | 60 | 60 | 60 |
| **B (3kg, 50)** | 0 | 0 | 0 | 50 | :mark[**50**]{hex="#204A2E"} | 60 | 60 | 60 | 110 | 110 | 110 |
| **C (4kg, 70)** | 0 | 0 | 0 | 50 | 70 | 70 | 70 | 120 | :mark[**120**]{hex="#204A2E"} | 130 | 130 |
| **D (2kg, 30)** | 0 | 0 | 30 | 50 | 70 | 80 | 100 | 120 | 120 | 150 | :mark[**150**]{hex="#204A2E"} |

**Traceback.** Start at the bottom right. If the entry differs from the one directly above it, that item was taken: record it and move up one row and left by its weight. If the entry is the same, the item was left behind, so just move up.

:mark[**Answer: value 150 &nbsp; (take B, C, D, using 9 kg)**]{hex="#204A2E"}

### Q45. 0/1 knapsack, five items

> :mark[**Very hard**]{hex="#5C2323"} &nbsp; A bag carries **11** kg. Items: A (1 kg, 1), B (2 kg, 6), C (5 kg, 18), D (6 kg, 22), E (7 kg, 28). Maximise the value.

Two things vary, the item and the space left, so the table is two dimensional. Row $i$ means *only the first $i$ items are on offer*, column $c$ means *the bag holds $c$ kg*.

$$
t[\textcolor{#5B8CFF}{i}][\textcolor{#FF5FA2}{c}] = \max\big(\;\textcolor{#A78BFA}{t[i-1][c]}\;,\;\textcolor{#EAB308}{value_i + t[i-1][c - weight_i]}\;\big)
$$

:color[Leave the item]{hex="#A78BFA"}, or :color[take it]{hex="#EAB308"} and look up the best answer for the space that is left. The second branch only exists when the item fits.

**The filled table.** Capacity along the top, items down the side.

|   | **0** | **1** | **2** | **3** | **4** | **5** | **6** | **7** | **8** | **9** | **10** | **11** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **none** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **A (1kg, 1)** | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| **B (2kg, 6)** | 0 | 1 | 6 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 |
| **C (5kg, 18)** | 0 | 1 | 6 | 7 | 7 | :mark[**18**]{hex="#204A2E"} | 19 | 24 | 25 | 25 | 25 | 25 |
| **D (6kg, 22)** | 0 | 1 | 6 | 7 | 7 | 18 | 22 | 24 | 28 | 29 | 29 | :mark[**40**]{hex="#204A2E"} |
| **E (7kg, 28)** | 0 | 1 | 6 | 7 | 7 | 18 | 22 | 28 | 29 | 34 | 35 | 40 |

**Traceback.** Start at the bottom right. If the entry differs from the one directly above it, that item was taken: record it and move up one row and left by its weight. If the entry is the same, the item was left behind, so just move up.

:mark[**Answer: value 40 &nbsp; (take C, D, using 11 kg)**]{hex="#204A2E"}

### Q46. Subset sum

> :mark[**Medium**]{hex="#565426"} &nbsp; Can any subset of `3, 34, 4, 12, 5, 2` add up to exactly **9**?

A yes or no table. Row $i$ means *using only the first $i$ numbers*, column $s$ means *can they make $s$*.

$$
t[\textcolor{#5B8CFF}{i}][\textcolor{#FF5FA2}{s}] = \textcolor{#A78BFA}{t[i-1][s]} \;\text{ or }\; \textcolor{#EAB308}{t[i-1][s - value_i]}
$$

Column **0** is :color[yes]{hex="#22C55E"} all the way down, because the empty set makes zero.

**The filled table.**

|   | **0** | **1** | **2** | **3** | **4** | **5** | **6** | **7** | **8** | **9** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **none** | Y | N | N | N | N | N | N | N | N | N |
| **3** | Y | N | N | Y | N | N | N | N | N | N |
| **34** | Y | N | N | Y | N | N | N | N | N | N |
| **4** | Y | N | N | Y | :mark[**Y**]{hex="#204A2E"} | N | N | Y | N | N |
| **12** | Y | N | N | Y | Y | N | N | Y | N | N |
| **5** | Y | N | N | Y | Y | Y | N | Y | Y | :mark[**Y**]{hex="#204A2E"} |
| **2** | Y | N | Y | Y | Y | Y | Y | Y | Y | Y |

**Traceback.** From the bottom right, if the cell above is already yes then the number was not needed. If it is no, the number had to be used, so take it and move left by its value.

:mark[**Answer: yes &nbsp; (4 + 5 = 9)**]{hex="#204A2E"}

### Q47. Counting paths past obstacles

> :mark[**Medium**]{hex="#565426"} &nbsp; A robot starts at the top left of a 4 by 5 grid and may only move right or down. The cells marked X are blocked. How many paths reach the bottom right?

A cell can only be entered from above or from the left, so the count of routes into it is the sum of those two:

$$
t[\textcolor{#5B8CFF}{r}][\textcolor{#FF5FA2}{c}] = \textcolor{#A78BFA}{t[r-1][c]} + \textcolor{#EAB308}{t[r][c-1]} \qquad \text{and } \textcolor{#2DD4BF}{0} \text{ at a blocked cell}
$$

**The grid.**

|   | **0** | **1** | **2** | **3** | **4** |
| --- | --- | --- | --- | --- | --- |
| **0** | . | . | . | . | . |
| **1** | . | . | X | . | . |
| **2** | . | X | . | . | . |
| **3** | . | . | . | . | . |

**The filled table.**

|   | **0** | **1** | **2** | **3** | **4** |
| --- | --- | --- | --- | --- | --- |
| **0** | 1 | 1 | 1 | 1 | 1 |
| **1** | 1 | 2 | 0 | 1 | 2 |
| **2** | 1 | 0 | 0 | 1 | 3 |
| **3** | 1 | 1 | 1 | 2 | 5 |

**Reading it.** A blocked cell holds 0 and passes nothing on, which is why the zeros spread sideways and downwards until another route arrives.

:mark[**Answer: 5 paths**]{hex="#204A2E"}

### Q48. Cheapest path down a grid

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; Each cell of the grid below charges a toll. Starting top left and moving only right or down, find the cheapest route to the bottom right.

$$
t[\textcolor{#5B8CFF}{r}][\textcolor{#FF5FA2}{c}] = \textcolor{#EAB308}{cost[r][c]} + \min\big(\textcolor{#A78BFA}{t[r-1][c]},\; \textcolor{#A78BFA}{t[r][c-1]}\big)
$$

The top row and the left column have only one way in, so they are just running totals.

**The tolls.**

|   | **0** | **1** | **2** | **3** |
| --- | --- | --- | --- | --- |
| **0** | 1 | 3 | 1 | 8 |
| **1** | 1 | 5 | 1 | 2 |
| **2** | 4 | 2 | 1 | 6 |
| **3** | 2 | 7 | 3 | 1 |

**The filled table.** The marked cells are the cheapest route.

|   | **0** | **1** | **2** | **3** |
| --- | --- | --- | --- | --- |
| **0** | :mark[**1**]{hex="#204A2E"} | :mark[**4**]{hex="#204A2E"} | :mark[**5**]{hex="#204A2E"} | 13 |
| **1** | 2 | 7 | :mark[**6**]{hex="#204A2E"} | 8 |
| **2** | 6 | 8 | :mark[**7**]{hex="#204A2E"} | 13 |
| **3** | 8 | 15 | :mark[**10**]{hex="#204A2E"} | :mark[**11**]{hex="#204A2E"} |

**Traceback.** From the bottom right, step to whichever of the cell above and the cell to the left is smaller. That is the cell the total came through.

:mark[**Answer: cost 11**]{hex="#204A2E"}

### Q49. Matrix chain multiplication

> :mark[**Very hard**]{hex="#5C2323"} &nbsp; Four matrices have dimensions $A_1$ 5 by 4, $A_2$ 4 by 6, $A_3$ 6 by 2, $A_4$ 2 by 7. Find the bracketing that minimises the number of scalar multiplications.

Multiplying a $p \times q$ matrix by a $q \times r$ matrix costs $p \times q \times r$ scalar multiplications. The bracketing changes the cost but not the answer, so the question is where to put the outermost multiplication:

$$
m[\textcolor{#5B8CFF}{i},\textcolor{#FF5FA2}{j}] = \min_{i \le k < j}\Big(\textcolor{#A78BFA}{m[i,k] + m[k+1,j]} + \textcolor{#EAB308}{d_{i-1} d_k d_j}\Big)
$$

The table is filled by **chain length**, not left to right: every pair first, then every triple, then the whole chain. A cell always needs shorter chains that are already done.

Dimensions: $d = 5, 4, 6, 2, 7$.

**Working.**

| cell | split at $k$ | best | $k$ taken |
| --- | --- | --- | --- |
| $m[1,2]$ | k=1: 120 | 120 | 1 |
| $m[2,3]$ | k=2: 48 | 48 | 2 |
| $m[3,4]$ | k=3: 84 | 84 | 3 |
| $m[1,3]$ | k=1: 88, k=2: 180 | 88 | 1 |
| $m[2,4]$ | k=2: 252, k=3: 104 | 104 | 3 |
| $m[1,4]$ | k=1: 244, k=2: 414, k=3: 158 | 158 | 3 |

**The filled table.** Only the upper triangle is used; the diagonal is 0.

|   | **1** | **2** | **3** | **4** |
| --- | --- | --- | --- | --- |
| **1** | 0 | 120 | 88 | 158 |
| **2** | - | 0 | 48 | 104 |
| **3** | - | - | 0 | 84 |
| **4** | - | - | - | 0 |

**Traceback.** The split recorded for the whole chain gives the outermost bracket, and each half is read the same way.

:mark[**Answer: 158 multiplications &nbsp; bracketed as ((A1(A2A3))A4)**]{hex="#204A2E"}

### Q50. Longest palindromic subsequence

> :mark[**Very hard**]{hex="#5C2323"} &nbsp; Find the longest palindromic subsequence of `BBABCBCAB`.

A subsequence of `BBABCBCAB` reads the same backwards exactly when it also appears in `BBABCBCAB` written in reverse, which is `BACBCBABB`. So run the ordinary LCS table on those two.

$$
t[\textcolor{#5B8CFF}{i}][\textcolor{#FF5FA2}{j}] = \begin{cases}\textcolor{#22C55E}{t[i-1][j-1] + 1} & \text{if the two letters match} \\\textcolor{#A78BFA}{\max(t[i-1][j],\; t[i][j-1])} & \text{otherwise}\end{cases}
$$

**The filled table.** `BBABCBCAB` down the side, `BACBCBABB` along the top.

|   | **-** | **B** | **A** | **C** | **B** | **C** | **B** | **A** | **B** | **B** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **-** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **B** | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| **B** | 0 | :mark[**1**]{hex="#204A2E"} | 1 | 1 | 2 | 2 | 2 | 2 | 2 | 2 |
| **A** | 0 | 1 | :mark[**2**]{hex="#204A2E"} | 2 | 2 | 2 | 2 | 3 | 3 | 3 |
| **B** | 0 | 1 | 2 | 2 | :mark[**3**]{hex="#204A2E"} | 3 | 3 | 3 | 4 | 4 |
| **C** | 0 | 1 | 2 | 3 | 3 | :mark[**4**]{hex="#204A2E"} | 4 | 4 | 4 | 4 |
| **B** | 0 | 1 | 2 | 3 | 4 | 4 | :mark[**5**]{hex="#204A2E"} | 5 | 5 | 5 |
| **C** | 0 | 1 | 2 | 3 | 4 | 5 | 5 | 5 | 5 | 5 |
| **A** | 0 | 1 | 2 | 3 | 4 | 5 | 5 | :mark[**6**]{hex="#204A2E"} | 6 | 6 |
| **B** | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 6 | 7 | :mark[**7**]{hex="#204A2E"} |

Nothing new happens in the cells. The work is all in noticing that the second word is the first one backwards.

**Traceback.** The same walk from the bottom right corner.

:mark[**Answer: length 7 &nbsp; (BABCBAB)**]{hex="#204A2E"}

> No new recurrence is needed. A palindromic subsequence of $s$ is a subsequence shared by $s$ and $s$ reversed, so this is the LCS table with the second word written backwards.

---

# Self test

Cover the answers and try these from memory.

1. A cell in a longest increasing subsequence table holds what, exactly, in one sentence?
2. Why is the smallest possible entry 1 and not 0?
3. Where in the table is the answer?
4. What is the one line you have to change to turn an increasing question into a non increasing one?
5. In the traceback, what two things must the cell you hop to satisfy?
6. Why is bottom up better than memoisation for a subsequence question?
7. What property must subproblems have before dynamic programming is the right tool?
8. Why does filling the table cost $O(n^2)$ and not $O(n)$?
9. A question gives you prices and ratings. What has to happen before the first cell is filled?
10. In a longest common **substring** table, why does a mismatch write 0 instead of copying a neighbour?

> **Answers.** 1. The length of the longest qualifying run that **ends at that index**.
> 2. Because the element on its own is already a run of length one.
> 3. The largest entry anywhere in it, not the last cell.
> 4. The condition. 5. An entry exactly one smaller, and the condition against the current element.
> 6. Every cell is needed anyway, so memoisation adds overhead and stack depth for nothing.
> 7. They must **overlap**. 8. Because each of the $n$ cells scans up to $n$ cells to its left.
> 9. A sort, by the quantity the recurrence does not look at.
> 10. Because a substring is contiguous, so a mismatch ends the run rather than shortening it.

# Summary

| | |
| --- | --- |
| What a cell holds | the best answer **ending at that index** |
| Fill order | left to right, never looking right |
| The base value | **1**, or the element's own weight |
| The answer | the **largest entry**, wherever it is |
| The traceback | hop left to an entry one smaller that satisfies the condition |
| The condition | the only line that differs between question types |
| Filling the table | **:color[O(n²)]{hex="#F97316"}** |
| Against plain recursion | **:color[O(2ⁿ)]{hex="#EF4444"}**, because subproblems overlap |
| Bottom up against memoisation | bottom up when every cell is needed, which is the usual case |
| Two dimensions | same ritual, one more index, fill row by row |

:mark[**Read the condition. Fill left to right. Take the maximum, not the last cell. Walk back.**]{hex="#3A3A3E"}
