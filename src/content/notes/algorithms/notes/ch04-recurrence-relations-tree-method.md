# Chapter 4: Recurrence Relations, Tree Method

The substitution method of Chapter 3 is algebra. The **recursion tree method** is the same calculation drawn as a picture: every recursive call becomes a node, the work done *outside* the recursion becomes that node's cost, and the answer is the sum of every node in the tree.

It is faster than substitution once the recurrence has more than one recursive call, and it makes the answer obvious rather than derived.

> :mark[**Every tree in this chapter was drawn by the site's own tool.**]{hex="#1E3A5C"} Open the [Recurrence Relation tool](/algo/recurrence-relation), type the formula, choose **Tree**, and you get exactly the picture printed below the question, including the per level cost boxes on the right. Use it to check your own drawing, and to try recurrences that are not in this chapter.

## How to build the tree

For $T(n) = a\,T(n/b) + f(n)$:

> **Step 1.** The root is one call on size $n$. It costs $f(n)$, the work done outside the recursion.
>
> **Step 2.** Give it $a$ children, each a subproblem of size $n/b$. Repeat for every child until the size reaches the base case.
>
> **Step 3.** For each level work out three things: how many **nodes**, the **size** of each, and therefore the **cost of the level** = nodes $\times$ cost per node.
>
> **Step 4.** Find the **height**. The sizes are $n, \frac nb, \frac{n}{b^2}, \dots, \frac{n}{b^k}$, and the recursion stops at size 1, so assume $\frac{n}{b^k} = 1$, giving $k = \log_b n$.
>
> **Step 5.** Count the **leaves**: level $k$ holds $a^k = a^{\log_b n} = n^{\log_b a}$ nodes, each costing $T(1)$.
>
> **Step 6.** Add every level, then keep the highest order term.

### The one identity you need

Step 5 uses this over and over, so learn it:

$$
a^{\log_b n} = n^{\log_b a}
$$

**Why.** Take $\log_b$ of both sides. The left gives $\log_b n \times \log_b a$, and the right gives $\log_b a \times \log_b n$. Same thing.

**Use it like this.** For $4T(n/2)$: the height is $\log_2 n$ and the leaf count is $4^{\log_2 n} = n^{\log_2 4} = n^2$.

## Worked example: $T(n) = 2T(n/2) + n$

![Recursion tree for T(n) = 2T(n/2) + n](/notes/img/algorithms/ch04-q12-tree.svg)

**Step 1: what one node costs.** A call on size $m$ does $f(m) = m$ units of work, then hands two subproblems of size $\frac m2$ to its children.

**Step 2: cost of each level.**

$$
\text{level } 0: \; 1 \times n = n
$$

$$
\text{level } 1: \; 2 \times \frac n2 = n
$$

$$
\text{level } 2: \; 4 \times \frac n4 = n
$$

$$
\text{level } i: \; 2^i \times \frac{n}{2^i} = n
$$

| Level | Nodes | Size of each | Cost per node | Cost of level |
| --- | --- | --- | --- | --- |
| 0 | $1$ | $n$ | $n$ | $n$ |
| 1 | $2$ | $n/2$ | $n/2$ | $n$ |
| 2 | $4$ | $n/4$ | $n/4$ | $n$ |
| $i$ | $2^i$ | $n/2^i$ | $n/2^i$ | $n$ |
| $k$ | $2^k$ | $1$ | $1$ | $n$ |

**Step 3: height.** The sizes are $n, \frac n2, \frac n4, \dots, \frac{n}{2^k}$, and the last level has size 1:

$$
\frac{n}{2^k} = 1 \;\Rightarrow\; n = 2^k \;\Rightarrow\; k = \log_2 n
$$

Levels $0$ to $k$, so $\log_2 n + 1$ levels in total.

**Step 4: leaves.** Level $k$ holds $2^k = 2^{\log_2 n} = n$ leaves, each costing $T(1) = 1$, so the bottom level costs $n$.

**Step 5: add the levels.** Every level costs the same $n$:

$$
T(n) = \underbrace{n + n + n + \dots + n}_{\log_2 n + 1 \text{ levels}} = n(\log_2 n + 1) = n\log_2 n + n
$$

**Step 6: order.** $n\log n$ beats $n$, so

$$
\boxed{T(n) = O(n \log n)}
$$

## The three shapes of a tree

Once you have the level costs, only their *trend* matters.

| Level costs go | Series | Who dominates | Total |
| --- | --- | --- | --- |
| :color[**down**]{hex="#22C55E"} ($n, \frac n2, \frac n4 \dots$) | decreasing geometric | the **root** | $O(f(n))$ |
| :color[**flat**]{hex="#3B82F6"} ($n, n, n \dots$) | constant | every level | $O(f(n) \times \text{height})$ |
| :color[**up**]{hex="#EF4444"} ($n, 2n, 4n \dots$) | increasing geometric | the **leaves** | $O(n^{\log_b a})$ |

The two geometric sums you will keep writing:

$$
1 + r + r^2 + \dots + r^k = \frac{r^{k+1} - 1}{r - 1} \qquad\text{and}\qquad 1 + r + r^2 + \dots < \frac{1}{1 - r} \;\;(r < 1)
$$

---

# Part A: chain trees

One recursive call means one node per level, so the level costs are simply the terms of a series.

## Q1. $T(n) = T(n-1) + 1$

![Recursion tree for T(n) = T(n-1) + 1](/notes/img/algorithms/ch04-q01-tree.svg)

**Step 1: what one node costs.** A call on size $m$ does $f(m) = 1$ unit of work and makes one call on size $m - 1$.

**Step 2: cost of each level.**

$$
\text{level } 0: \; 1 \times 1 = 1 \qquad \text{level } 1: \; 1 \times 1 = 1 \qquad \text{level } i: \; 1 \times 1 = 1
$$

| Level | Nodes | Size | Cost per node | Cost of level |
| --- | --- | --- | --- | --- |
| 0 | 1 | $n$ | 1 | 1 |
| 1 | 1 | $n-1$ | 1 | 1 |
| $i$ | 1 | $n-i$ | 1 | 1 |
| $k$ | 1 | $0$ | 1 | 1 |

**Step 3: height.** The sizes are $n, n-1, n-2, \dots, n-k$, and the base case is $T(0)$:

$$
n - k = 0 \;\Rightarrow\; k = n
$$

So there are $n + 1$ levels.

**Step 4: leaves.** One call per level, so there is a single leaf, $T(0) = 1$.

**Step 5: add the levels.** :color[Flat]{hex="#3B82F6"}, cost 1 each:

$$
T(n) = \underbrace{1 + 1 + 1 + \dots + 1}_{n + 1} = n + 1
$$

**Step 6: order.**

:mark[**$O(n)$**]{hex="#204A2E"}

## Q2. $T(n) = T(n-1) + n$

![Recursion tree for T(n) = T(n-1) + n](/notes/img/algorithms/ch04-q02-tree.svg)

**Step 1: what one node costs.** A call on size $m$ does $f(m) = m$ work, then one call on size $m-1$. In the picture, that work is the green box hanging off each node.

**Step 2: cost of each level.**

$$
\text{level } 0: \; 1 \times n = n
$$

$$
\text{level } 1: \; 1 \times (n-1) = n-1
$$

$$
\text{level } 2: \; 1 \times (n-2) = n-2
$$

$$
\text{level } i: \; 1 \times (n-i) = n-i
$$

| Level | Nodes | Size | Cost per node | Cost of level |
| --- | --- | --- | --- | --- |
| 0 | 1 | $n$ | $n$ | $n$ |
| 1 | 1 | $n-1$ | $n-1$ | $n-1$ |
| 2 | 1 | $n-2$ | $n-2$ | $n-2$ |
| $i$ | 1 | $n-i$ | $n-i$ | $n-i$ |
| last | 1 | $1$ | $1$ | $1$ |

**Step 3: height.** $n - k = 0 \Rightarrow k = n$ levels.

**Step 4: leaves.** One leaf, $T(0)$, costing a constant.

**Step 5: add the levels.** The costs are $n, n-1, n-2, \dots, 1$, an arithmetic series. Write it forwards and backwards and pair the terms:

$$
S = n + (n-1) + \dots + 2 + 1
$$

$$
S = 1 + 2 + \dots + (n-1) + n
$$

$$
2S = \underbrace{(n+1) + (n+1) + \dots + (n+1)}_{n \text{ pairs}} = n(n+1) \;\Rightarrow\; S = \frac{n(n+1)}{2}
$$

$$
T(n) = \frac{n^2 + n}{2}
$$

**Step 6: order.** Keep the highest order term and drop the $\frac12$:

:mark[**$O(n^2)$**]{hex="#204A2E"}

## Q3. $T(n) = T(n-1) + \log n$

![Recursion tree for T(n) = T(n-1) + log n](/notes/img/algorithms/ch04-q03-tree.svg)

**Step 1: what one node costs.** $f(m) = \log m$, one call on $m - 1$. A doubling loop inside a recursive function produces exactly this.

**Step 2: cost of each level.**

$$
\text{level } 0: \; \log n \qquad \text{level } 1: \; \log(n-1) \qquad \text{level } i: \; \log(n-i)
$$

**Step 3: height.** $n - k = 0 \Rightarrow k = n$ levels.

**Step 4: leaves.** One leaf, constant cost.

**Step 5: add the levels.**

$$
T(n) = \log n + \log(n-1) + \log(n-2) + \dots + \log 2 + \log 1
$$

A sum of logs is the log of a product:

$$
T(n) = \log\left[n \times (n-1) \times (n-2) \times \dots \times 2 \times 1\right] = \log(n!)
$$

**Step 6: order.** Bound $n!$ from above: every one of the $n$ factors is at most $n$, so $n! \le n^n$ and

$$
\log(n!) \le \log(n^n) = n\log n
$$

:mark[**$O(n \log n)$**]{hex="#204A2E"}

## Q4. $T(n) = T(n-1) + n^2$

![Recursion tree for T(n) = T(n-1) + n squared](/notes/img/algorithms/ch04-q04-tree.svg)

**Step 1: what one node costs.** $f(m) = m^2$, one call on $m-1$. A nested loop inside a recursive function.

**Step 2: cost of each level.**

$$
\text{level } 0: \; n^2 \qquad \text{level } 1: \; (n-1)^2 \qquad \text{level } i: \; (n-i)^2
$$

**Step 3: height.** $n - k = 0 \Rightarrow k = n$ levels.

**Step 4: leaves.** One leaf, constant cost.

**Step 5: add the levels.**

$$
T(n) = n^2 + (n-1)^2 + (n-2)^2 + \dots + 2^2 + 1^2 = \sum_{i=1}^{n} i^2 = \frac{n(n+1)(2n+1)}{6}
$$

Expanding the numerator:

$$
T(n) = \frac{2n^3 + 3n^2 + n}{6} \approx \frac{n^3}{3}
$$

**Step 6: order.**

:mark[**$O(n^3)$**]{hex="#204A2E"}

## Q5. $T(n) = T(n-1) + n\log n$

![Recursion tree for T(n) = T(n-1) + n log n](/notes/img/algorithms/ch04-q05-tree.svg)

**Step 1: what one node costs.** $f(m) = m\log m$, one call on $m-1$. A merge sort called once per level of an outer recursion looks like this.

**Step 2: cost of each level.**

$$
\text{level } 0: \; n\log n \qquad \text{level } 1: \; (n-1)\log(n-1) \qquad \text{level } i: \; (n-i)\log(n-i)
$$

**Step 3: height.** $n - k = 0 \Rightarrow k = n$ levels.

**Step 4: leaves.** One leaf, constant cost.

**Step 5: add the levels.**

$$
T(n) = \sum_{i=1}^{n} i \log i
$$

Bound it from above by replacing every $\log i$ with the largest one, $\log n$:

$$
T(n) \le \log n \sum_{i=1}^{n} i = \log n \cdot \frac{n(n+1)}{2} \approx \frac{n^2\log n}{2}
$$

The bound is tight: the top half of the terms ($i > n/2$) each have $\log i > \log n - 1$, so the sum is also at least about $\frac{n^2 \log n}{8}$.

**Step 6: order.**

:mark[**$O(n^2 \log n)$**]{hex="#204A2E"}

## Q6. $T(n) = T(n-2) + n$

![Recursion tree for T(n) = T(n-2) + n](/notes/img/algorithms/ch04-q06-tree.svg)

**Step 1: what one node costs.** $f(m) = m$, one call on $m - 2$. The size now drops by 2 per level.

**Step 2: cost of each level.**

$$
\text{level } 0: \; n \qquad \text{level } 1: \; n - 2 \qquad \text{level } 2: \; n - 4 \qquad \text{level } i: \; n - 2i
$$

**Step 3: height.** The sizes are $n, n-2, n-4, \dots, n-2k$, and the base case is $T(0)$:

$$
n - 2k = 0 \;\Rightarrow\; k = \frac n2
$$

Half the height of Q2.

**Step 4: leaves.** One leaf, constant cost.

**Step 5: add the levels.** Take $n$ even, so the costs are $n, n-2, \dots, 4, 2$:

$$
T(n) = n + (n-2) + (n-4) + \dots + 2 = 2\left(\frac n2 + \frac n2 - 1 + \dots + 1\right) = 2\sum_{i=1}^{n/2} i
$$

$$
T(n) = 2 \cdot \frac{\frac n2\left(\frac n2 + 1\right)}{2} = \frac n2\left(\frac n2 + 1\right) = \frac{n^2}{4} + \frac n2
$$

**Step 6: order.** Half the levels gave a quarter of the total, which is a constant factor, so:

:mark[**$O(n^2)$**]{hex="#204A2E"}

## Q7. $T(n) = T(n/2) + 1$

![Recursion tree for T(n) = T(n/2) + 1](/notes/img/algorithms/ch04-q07-tree.svg)

**Step 1: what one node costs.** $f(m) = 1$, one call on $\frac m2$. Binary search: one comparison, then recurse into half the array.

**Step 2: cost of each level.**

$$
\text{level } 0: \; 1 \times 1 = 1 \qquad \text{level } i: \; 1 \times 1 = 1
$$

| Level | Nodes | Size | Cost of level |
| --- | --- | --- | --- |
| 0 | 1 | $n$ | 1 |
| 1 | 1 | $n/2$ | 1 |
| $i$ | 1 | $n/2^i$ | 1 |
| $k$ | 1 | $1$ | 1 |

**Step 3: height.**

$$
\frac{n}{2^k} = 1 \;\Rightarrow\; n = 2^k \;\Rightarrow\; k = \log_2 n
$$

So $\log_2 n + 1$ levels.

**Step 4: leaves.** One leaf, $T(1) = 1$.

**Step 5: add the levels.** :color[Flat]{hex="#3B82F6"}:

$$
T(n) = \underbrace{1 + 1 + \dots + 1}_{\log_2 n + 1} = \log_2 n + 1
$$

**Step 6: order.**

:mark[**$O(\log n)$**]{hex="#204A2E"}

## Q8. $T(n) = T(n/2) + n$

![Recursion tree for T(n) = T(n/2) + n](/notes/img/algorithms/ch04-q08-tree.svg)

**Step 1: what one node costs.** $f(m) = m$, one call on $\frac m2$. A linear scan, then recurse into half.

**Step 2: cost of each level.**

$$
\text{level } 0: \; n \qquad \text{level } 1: \; \frac n2 \qquad \text{level } 2: \; \frac n4 \qquad \text{level } i: \; \frac{n}{2^i}
$$

**Step 3: height.** $\frac{n}{2^k} = 1 \Rightarrow k = \log_2 n$.

**Step 4: leaves.** One leaf, $T(1) = 1$.

**Step 5: add the levels.** Factor out $n$:

$$
T(n) = n + \frac n2 + \frac n4 + \dots + 1 = n\left(1 + \frac12 + \frac14 + \dots + \frac{1}{2^{\log_2 n}}\right)
$$

Decreasing geometric with $r = \frac12$, so the bracket is less than $\frac{1}{1 - \frac12} = 2$:

$$
T(n) < 2n
$$

**Step 6: order.** Costs :color[decrease]{hex="#22C55E"} down the tree, so the root alone decides it:

:mark[**$O(n)$**]{hex="#204A2E"}

## Q9. $T(n) = T(n/2) + n^2$

![Recursion tree for T(n) = T(n/2) + n squared](/notes/img/algorithms/ch04-q09-tree.svg)

**Step 1: what one node costs.** $f(m) = m^2$, one call on $\frac m2$.

**Step 2: cost of each level.** Squaring the size squares the shrink factor:

$$
\text{level } 0: \; n^2 \qquad \text{level } 1: \; \left(\frac n2\right)^2 = \frac{n^2}{4} \qquad \text{level } i: \; \left(\frac{n}{2^i}\right)^2 = \frac{n^2}{4^i}
$$

**Step 3: height.** $\frac{n}{2^k} = 1 \Rightarrow k = \log_2 n$.

**Step 4: leaves.** One leaf, $T(1) = 1$.

**Step 5: add the levels.**

$$
T(n) = n^2\left(1 + \frac14 + \frac{1}{16} + \dots\right) < n^2 \cdot \frac{1}{1 - \frac14} = \frac{4n^2}{3}
$$

**Step 6: order.**

:mark[**$O(n^2)$**]{hex="#204A2E"}

## Q10. $T(n) = T(n/3) + n$

![Recursion tree for T(n) = T(n/3) + n](/notes/img/algorithms/ch04-q10-tree.svg)

**Step 1: what one node costs.** $f(m) = m$, one call on $\frac m3$.

**Step 2: cost of each level.**

$$
\text{level } 0: \; n \qquad \text{level } 1: \; \frac n3 \qquad \text{level } 2: \; \frac n9 \qquad \text{level } i: \; \frac{n}{3^i}
$$

**Step 3: height.**

$$
\frac{n}{3^k} = 1 \;\Rightarrow\; n = 3^k \;\Rightarrow\; k = \log_3 n
$$

**Step 4: leaves.** One leaf, $T(1) = 1$.

**Step 5: add the levels.** Decreasing geometric with $r = \frac13$:

$$
T(n) = n\left(1 + \frac13 + \frac19 + \dots\right) < n \cdot \frac{1}{1 - \frac13} = \frac{3n}{2}
$$

**Step 6: order.**

:mark[**$O(n)$**]{hex="#204A2E"} Throwing away two thirds instead of one half changes only the constant.

---

# Part B: binary division trees

Now every node has more than one child, so the node count grows down the tree and the leaves start to matter.

## Q11. $T(n) = 2T(n/2) + 1$

![Recursion tree for T(n) = 2T(n/2) + 1](/notes/img/algorithms/ch04-q11-tree.svg)

**Step 1: what one node costs.** $f(m) = 1$, and each call splits into 2 subproblems of size $\frac m2$.

**Step 2: cost of each level.** The size no longer appears in the cost, so the level cost is just the node count:

$$
\text{level } 0: \; 1 \times 1 = 1
$$

$$
\text{level } 1: \; 2 \times 1 = 2
$$

$$
\text{level } 2: \; 4 \times 1 = 4
$$

$$
\text{level } i: \; 2^i \times 1 = 2^i
$$

| Level | Nodes | Size | Cost per node | Cost of level |
| --- | --- | --- | --- | --- |
| 0 | $1$ | $n$ | $1$ | $1$ |
| 1 | $2$ | $n/2$ | $1$ | $2$ |
| 2 | $4$ | $n/4$ | $1$ | $4$ |
| $i$ | $2^i$ | $n/2^i$ | $1$ | $2^i$ |
| $k$ | $2^k$ | $1$ | $1$ | $2^k$ |

**Step 3: height.** $\dfrac{n}{2^k} = 1 \Rightarrow k = \log_2 n$.

**Step 4: leaves.**

$$
2^k = 2^{\log_2 n} = n \text{ leaves}, \quad \text{each costing } T(1) = 1
$$

**Step 5: add the levels.** Increasing geometric with $r = 2$:

$$
T(n) = 1 + 2 + 4 + \dots + 2^k = \frac{2^{k+1} - 1}{2 - 1} = 2 \cdot 2^k - 1 = 2n - 1
$$

**Step 6: order.** Costs :color[increase]{hex="#EF4444"} down the tree, so the leaves decide it, and there are $n$ of them:

:mark[**$O(n)$**]{hex="#204A2E"}

## Q12. $T(n) = 2T(n/2) + n$

Solved in full as the worked example above.

![Recursion tree for T(n) = 2T(n/2) + n](/notes/img/algorithms/ch04-q12-tree.svg)

Every level costs $n$, there are $\log_2 n + 1$ of them, so $T(n) = n\log_2 n + n$.

:mark[**$O(n \log n)$**]{hex="#204A2E"} Merge sort.

## Q13. $T(n) = 2T(n/2) + n^2$

![Recursion tree for T(n) = 2T(n/2) + n squared](/notes/img/algorithms/ch04-q13-tree.svg)

**Step 1: what one node costs.** $f(m) = m^2$, two children of size $\frac m2$.

**Step 2: cost of each level.** Two things fight here: the node count doubles, but each node's cost falls by 4.

$$
\text{level } 0: \; 1 \times n^2 = n^2
$$

$$
\text{level } 1: \; 2 \times \left(\frac n2\right)^2 = 2 \times \frac{n^2}{4} = \frac{n^2}{2}
$$

$$
\text{level } 2: \; 4 \times \left(\frac n4\right)^2 = 4 \times \frac{n^2}{16} = \frac{n^2}{4}
$$

$$
\text{level } i: \; 2^i \times \frac{n^2}{4^i} = \frac{n^2}{2^i}
$$

**Step 3: height.** $k = \log_2 n$.

**Step 4: leaves.** $2^k = n$ leaves, each costing $T(1) = 1$, so the bottom contributes $n$.

**Step 5: add the levels.** Decreasing geometric with $r = \frac12$:

$$
T(n) = n^2\left(1 + \frac12 + \frac14 + \dots\right) + n < 2n^2 + n
$$

**Step 6: order.** The root alone is $n^2$ and the whole tree is under $2n^2$:

:mark[**$O(n^2)$**]{hex="#204A2E"}

## Q14. $T(n) = 2T(n/2) + \log n$

![Recursion tree for T(n) = 2T(n/2) + log n](/notes/img/algorithms/ch04-q14-tree.svg)

**Step 1: what one node costs.** $f(m) = \log m$, two children of size $\frac m2$.

**Step 2: cost of each level.** A node at level $i$ has size $\frac{n}{2^i}$, so it costs $\log\frac{n}{2^i} = \log n - i$:

$$
\text{level } 0: \; 1 \times \log n
$$

$$
\text{level } 1: \; 2 \times (\log n - 1)
$$

$$
\text{level } 2: \; 4 \times (\log n - 2)
$$

$$
\text{level } i: \; 2^i(\log n - i)
$$

**Step 3: height.** $k = \log_2 n$.

**Step 4: leaves.** $2^k = n$ leaves, each costing $T(1) = 1$, so the bottom contributes $n$.

**Step 5: add the levels.** The doubling beats the shrinking log, so count from the bottom instead. Put $j = k - i$, so $2^i = \dfrac{n}{2^j}$ and $\log n - i = j$:

$$
\sum_{i=0}^{k-1} 2^i(\log n - i) = \sum_{j=1}^{k} \frac{n}{2^j} \cdot j = n\sum_{j=1}^{k} \frac{j}{2^j} < n \times 2 = 2n
$$

using the standard sum $\sum_{j \ge 1} \frac{j}{2^j} = 2$. Adding the leaves:

$$
T(n) < 2n + n = 3n
$$

**Step 6: order.**

:mark[**$O(n)$**]{hex="#204A2E"} A $\log n$ split cost cannot keep up with $n$ leaves.

## Q15. $T(n) = 2T(n/2) + n\log n$

![Recursion tree for T(n) = 2T(n/2) + n log n](/notes/img/algorithms/ch04-q15-tree.svg)

**Step 1: what one node costs.** $f(m) = m\log m$, two children of size $\frac m2$.

**Step 2: cost of each level.**

$$
\text{level } 0: \; 1 \times n\log n = n\log n
$$

$$
\text{level } 1: \; 2 \times \frac n2 \log\frac n2 = n(\log n - 1)
$$

$$
\text{level } 2: \; 4 \times \frac n4 \log\frac n4 = n(\log n - 2)
$$

$$
\text{level } i: \; 2^i \times \frac{n}{2^i}\log\frac{n}{2^i} = n(\log n - i)
$$

**Step 3: height.** $k = \log_2 n$.

**Step 4: leaves.** $n$ leaves, contributing $n$.

**Step 5: add the levels.** The $n$ factors out, leaving an arithmetic series:

$$
T(n) = n\left[\log n + (\log n - 1) + (\log n - 2) + \dots + 1\right] + n
$$

That bracket is $1 + 2 + \dots + \log n$, so:

$$
T(n) = n \cdot \frac{\log n(\log n + 1)}{2} + n = \frac{n\log^2 n + n\log n}{2} + n
$$

**Step 6: order.**

:mark[**$O(n \log^2 n)$**]{hex="#204A2E"}

## Q16. $T(n) = 2T(n/2) + \sqrt{n}$

![Recursion tree for T(n) = 2T(n/2) + sqrt n](/notes/img/algorithms/ch04-q16-tree.svg)

**Step 1: what one node costs.** $f(m) = \sqrt m$, two children of size $\frac m2$.

**Step 2: cost of each level.** A node at level $i$ has size $\frac{n}{2^i}$, so it costs $\sqrt{\frac{n}{2^i}} = \frac{\sqrt n}{(\sqrt2)^i}$:

$$
\text{level } 0: \; 1 \times \sqrt n = \sqrt n
$$

$$
\text{level } 1: \; 2 \times \frac{\sqrt n}{\sqrt2} = \sqrt2 \sqrt n
$$

$$
\text{level } i: \; 2^i \times \frac{\sqrt n}{(\sqrt2)^i} = (\sqrt2)^i \sqrt n
$$

**Step 3: height.** $k = \log_2 n$.

**Step 4: leaves.** $2^k = n$ leaves, contributing $n$.

**Step 5: add the levels.** Increasing geometric with $r = \sqrt2$, so evaluate the last term using the identity:

$$
(\sqrt2)^k = (\sqrt2)^{\log_2 n} = n^{\log_2 \sqrt2} = n^{1/2} = \sqrt n
$$

$$
T(n) = \sqrt n \cdot \frac{(\sqrt2)^{k+1} - 1}{\sqrt2 - 1} \approx \sqrt n \cdot \frac{\sqrt2 \cdot \sqrt n}{0.414} \approx 3.4n
$$

**Step 6: order.**

:mark[**$O(n)$**]{hex="#204A2E"} The leaves win again: $\sqrt n$ per node is not enough work to matter against $n$ of them.

## Q17. $T(n) = 4T(n/2) + n$

![Recursion tree for T(n) = 4T(n/2) + n](/notes/img/algorithms/ch04-q17-tree.svg)

**Step 1: what one node costs.** $f(m) = m$, and each call splits into **4** subproblems of size $\frac m2$.

**Step 2: cost of each level.** The node count quadruples while the size only halves:

$$
\text{level } 0: \; 1 \times n = n
$$

$$
\text{level } 1: \; 4 \times \frac n2 = 2n
$$

$$
\text{level } 2: \; 16 \times \frac n4 = 4n
$$

$$
\text{level } i: \; 4^i \times \frac{n}{2^i} = 2^i n
$$

**Step 3: height.** $\dfrac{n}{2^k} = 1 \Rightarrow k = \log_2 n$.

**Step 4: leaves.**

$$
4^k = 4^{\log_2 n} = n^{\log_2 4} = n^2 \text{ leaves}
$$

**Step 5: add the levels.** Increasing geometric with $r = 2$, and $2^k = n$:

$$
T(n) = n\left(1 + 2 + 4 + \dots + 2^k\right) = n\left(2 \cdot 2^k - 1\right) = n(2n - 1) = 2n^2 - n
$$

**Step 6: order.** The $n^2$ leaves dominate:

:mark[**$O(n^2)$**]{hex="#204A2E"}

## Q18. $T(n) = 4T(n/2) + n^2$

![Recursion tree for T(n) = 4T(n/2) + n squared](/notes/img/algorithms/ch04-q18-tree.svg)

**Step 1: what one node costs.** $f(m) = m^2$, four children of size $\frac m2$.

**Step 2: cost of each level.** Quadrupling the node count exactly cancels quartering the cost:

$$
\text{level } 0: \; 1 \times n^2 = n^2
$$

$$
\text{level } 1: \; 4 \times \left(\frac n2\right)^2 = 4 \times \frac{n^2}{4} = n^2
$$

$$
\text{level } 2: \; 16 \times \left(\frac n4\right)^2 = 16 \times \frac{n^2}{16} = n^2
$$

$$
\text{level } i: \; 4^i \times \frac{n^2}{4^i} = n^2
$$

**Step 3: height.** $k = \log_2 n$.

**Step 4: leaves.** $4^{\log_2 n} = n^2$ leaves, each costing $T(1) = 1$, so the bottom level costs $n^2$ as well.

**Step 5: add the levels.** :color[Flat]{hex="#3B82F6"}, so multiply by the number of levels:

$$
T(n) = n^2(\log_2 n + 1) = n^2\log_2 n + n^2
$$

**Step 6: order.**

:mark[**$O(n^2 \log n)$**]{hex="#204A2E"}

## Q19. $T(n) = 4T(n/2) + n^3$

![Recursion tree for T(n) = 4T(n/2) + n cubed](/notes/img/algorithms/ch04-q19-tree.svg)

**Step 1: what one node costs.** $f(m) = m^3$, four children of size $\frac m2$.

**Step 2: cost of each level.** Now the cost falls by 8 per level while the count rises by 4:

$$
\text{level } 0: \; 1 \times n^3 = n^3
$$

$$
\text{level } 1: \; 4 \times \frac{n^3}{8} = \frac{n^3}{2}
$$

$$
\text{level } 2: \; 16 \times \frac{n^3}{64} = \frac{n^3}{4}
$$

$$
\text{level } i: \; 4^i \times \frac{n^3}{8^i} = \frac{n^3}{2^i}
$$

**Step 3: height.** $k = \log_2 n$.

**Step 4: leaves.** $n^2$ leaves, contributing $n^2$.

**Step 5: add the levels.** Decreasing geometric with $r = \frac12$:

$$
T(n) = n^3\left(1 + \frac12 + \frac14 + \dots\right) + n^2 < 2n^3 + n^2
$$

**Step 6: order.** The root's $n^3$ beats the $n^2$ leaves:

:mark[**$O(n^3)$**]{hex="#204A2E"}

## Q20. $T(n) = 3T(n/2) + n$

![Recursion tree for T(n) = 3T(n/2) + n](/notes/img/algorithms/ch04-q20-tree.svg)

**Step 1: what one node costs.** $f(m) = m$, three children of size $\frac m2$. This is Karatsuba's multiplication: three half sized multiplications plus linear additions.

**Step 2: cost of each level.**

$$
\text{level } 0: \; 1 \times n = n
$$

$$
\text{level } 1: \; 3 \times \frac n2 = \frac32 n
$$

$$
\text{level } 2: \; 9 \times \frac n4 = \frac94 n
$$

$$
\text{level } i: \; 3^i \times \frac{n}{2^i} = \left(\frac32\right)^i n
$$

**Step 3: height.** $k = \log_2 n$.

**Step 4: leaves.**

$$
3^k = 3^{\log_2 n} = n^{\log_2 3} = n^{1.585} \text{ leaves}
$$

**Step 5: add the levels.** Increasing geometric with $r = \frac32$:

$$
T(n) = n \cdot \frac{\left(\frac32\right)^{k+1} - 1}{\frac32 - 1} = 2n\left[\frac32\left(\frac32\right)^{k} - 1\right]
$$

Evaluate the last term with the identity:

$$
\left(\frac32\right)^{k} = \left(\frac32\right)^{\log_2 n} = n^{\log_2 1.5} = n^{0.585}
$$

$$
T(n) \approx 3n \cdot n^{0.585} = 3n^{1.585}
$$

**Step 6: order.**

:mark[**$O(n^{\log_2 3}) = O(n^{1.585})$**]{hex="#204A2E"} Better than the $O(n^2)$ of long multiplication, which is the whole point of the algorithm.

## Q21. $T(n) = 3T(n/2) + n^2$

![Recursion tree for T(n) = 3T(n/2) + n squared](/notes/img/algorithms/ch04-q21-tree.svg)

**Step 1: what one node costs.** $f(m) = m^2$, three children of size $\frac m2$.

**Step 2: cost of each level.** Tripling the count against quartering the cost:

$$
\text{level } 0: \; 1 \times n^2 = n^2
$$

$$
\text{level } 1: \; 3 \times \frac{n^2}{4} = \frac34 n^2
$$

$$
\text{level } 2: \; 9 \times \frac{n^2}{16} = \frac{9}{16} n^2
$$

$$
\text{level } i: \; 3^i \times \frac{n^2}{4^i} = \left(\frac34\right)^i n^2
$$

**Step 3: height.** $k = \log_2 n$.

**Step 4: leaves.** $3^{\log_2 n} = n^{1.585}$ leaves, contributing $n^{1.585}$.

**Step 5: add the levels.** Decreasing geometric with $r = \frac34$:

$$
T(n) = n^2\left(1 + \frac34 + \frac{9}{16} + \dots\right) < n^2 \cdot \frac{1}{1 - \frac34} = 4n^2
$$

**Step 6: order.** Compare the two candidates: the root does $n^2$ work, the leaves only $n^{1.585}$, so the root wins:

:mark[**$O(n^2)$**]{hex="#204A2E"}

## Q22. $T(n) = 8T(n/2) + n^2$

![Recursion tree for T(n) = 8T(n/2) + n squared](/notes/img/algorithms/ch04-q22-tree.svg)

**Step 1: what one node costs.** $f(m) = m^2$, eight children of size $\frac m2$. This is naive recursive matrix multiplication with an $n^2$ add step.

**Step 2: cost of each level.**

$$
\text{level } 0: \; 1 \times n^2 = n^2
$$

$$
\text{level } 1: \; 8 \times \frac{n^2}{4} = 2n^2
$$

$$
\text{level } 2: \; 64 \times \frac{n^2}{16} = 4n^2
$$

$$
\text{level } i: \; 8^i \times \frac{n^2}{4^i} = 2^i n^2
$$

**Step 3: height.** $k = \log_2 n$.

**Step 4: leaves.**

$$
8^k = 8^{\log_2 n} = n^{\log_2 8} = n^3 \text{ leaves}
$$

**Step 5: add the levels.** Increasing geometric with $r = 2$, and $2^k = n$:

$$
T(n) = n^2\left(1 + 2 + 4 + \dots + 2^k\right) = n^2(2n - 1) = 2n^3 - n^2
$$

**Step 6: order.**

:mark[**$O(n^3)$**]{hex="#204A2E"}

## Q23. $T(n) = 8T(n/2) + n^3$

![Recursion tree for T(n) = 8T(n/2) + n cubed](/notes/img/algorithms/ch04-q23-tree.svg)

**Step 1: what one node costs.** $f(m) = m^3$, eight children of size $\frac m2$.

**Step 2: cost of each level.** Eight times the nodes, an eighth of the cost each, so they cancel:

$$
\text{level } 0: \; 1 \times n^3 = n^3
$$

$$
\text{level } 1: \; 8 \times \frac{n^3}{8} = n^3
$$

$$
\text{level } 2: \; 64 \times \frac{n^3}{64} = n^3
$$

$$
\text{level } i: \; 8^i \times \frac{n^3}{8^i} = n^3
$$

**Step 3: height.** $k = \log_2 n$.

**Step 4: leaves.** $n^3$ leaves, contributing $n^3$.

**Step 5: add the levels.** :color[Flat]{hex="#3B82F6"}:

$$
T(n) = n^3(\log_2 n + 1)
$$

**Step 6: order.**

:mark[**$O(n^3 \log n)$**]{hex="#204A2E"} Compare with Q22: the same tree, but $n^3$ of work per node instead of $n^2$ turns an increasing series into a flat one.

---

# Part C: other branching factors

Same method, different $b$. Only two numbers change: the height becomes $\log_b n$ and the leaf count becomes $n^{\log_b a}$.

## Q24. $T(n) = 3T(n/3) + n$

![Recursion tree for T(n) = 3T(n/3) + n](/notes/img/algorithms/ch04-q24-tree.svg)

**Step 1: what one node costs.** $f(m) = m$, three children of size $\frac m3$. A three way merge sort.

**Step 2: cost of each level.**

$$
\text{level } 0: \; 1 \times n = n \qquad \text{level } 1: \; 3 \times \frac n3 = n \qquad \text{level } 2: \; 9 \times \frac n9 = n
$$

$$
\text{level } i: \; 3^i \times \frac{n}{3^i} = n
$$

**Step 3: height.**

$$
\frac{n}{3^k} = 1 \;\Rightarrow\; n = 3^k \;\Rightarrow\; k = \log_3 n
$$

**Step 4: leaves.** $3^{\log_3 n} = n$ leaves, contributing $n$.

**Step 5: add the levels.** :color[Flat]{hex="#3B82F6"}:

$$
T(n) = n(\log_3 n + 1)
$$

**Step 6: order.** $\log_3 n = \frac{\log_2 n}{\log_2 3}$, a constant multiple of $\log_2 n$:

:mark[**$O(n \log n)$**]{hex="#204A2E"} Splitting three ways instead of two does not change the order, only the constant.

## Q25. $T(n) = 2T(n/3) + n$

![Recursion tree for T(n) = 2T(n/3) + n](/notes/img/algorithms/ch04-q25-tree.svg)

**Step 1: what one node costs.** $f(m) = m$, two children of size $\frac m3$. The pieces do not cover the whole problem, so work is thrown away at every level.

**Step 2: cost of each level.**

$$
\text{level } 0: \; 1 \times n = n \qquad \text{level } 1: \; 2 \times \frac n3 = \frac23 n \qquad \text{level } 2: \; 4 \times \frac n9 = \frac49 n
$$

$$
\text{level } i: \; 2^i \times \frac{n}{3^i} = \left(\frac23\right)^i n
$$

**Step 3: height.** $k = \log_3 n$.

**Step 4: leaves.**

$$
2^{\log_3 n} = n^{\log_3 2} = n^{0.63} \text{ leaves}
$$

**Step 5: add the levels.** Decreasing geometric with $r = \frac23$:

$$
T(n) = n\left(1 + \frac23 + \frac49 + \dots\right) < n \cdot \frac{1}{1 - \frac23} = 3n
$$

**Step 6: order.** Root $n$ against leaves $n^{0.63}$, so the root wins:

:mark[**$O(n)$**]{hex="#204A2E"}

## Q26. $T(n) = 4T(n/3) + n$

![Recursion tree for T(n) = 4T(n/3) + n](/notes/img/algorithms/ch04-q26-tree.svg)

**Step 1: what one node costs.** $f(m) = m$, four children of size $\frac m3$.

**Step 2: cost of each level.**

$$
\text{level } 0: \; 1 \times n = n \qquad \text{level } 1: \; 4 \times \frac n3 = \frac43 n \qquad \text{level } 2: \; 16 \times \frac n9 = \frac{16}{9} n
$$

$$
\text{level } i: \; 4^i \times \frac{n}{3^i} = \left(\frac43\right)^i n
$$

**Step 3: height.** $k = \log_3 n$.

**Step 4: leaves.**

$$
4^{\log_3 n} = n^{\log_3 4} = n^{1.262} \text{ leaves}
$$

**Step 5: add the levels.** Increasing geometric with $r = \frac43$:

$$
T(n) = n \cdot \frac{\left(\frac43\right)^{k+1} - 1}{\frac43 - 1} = 3n\left[\frac43\left(\frac43\right)^{k} - 1\right]
$$

$$
\left(\frac43\right)^{k} = \left(\frac43\right)^{\log_3 n} = n^{\log_3 (4/3)} = n^{0.262}
$$

$$
T(n) \approx 4n \cdot n^{0.262} = 4n^{1.262}
$$

**Step 6: order.**

:mark[**$O(n^{\log_3 4}) = O(n^{1.262})$**]{hex="#204A2E"}

## Q27. $T(n) = 9T(n/3) + n^2$

![Recursion tree for T(n) = 9T(n/3) + n squared](/notes/img/algorithms/ch04-q27-tree.svg)

**Step 1: what one node costs.** $f(m) = m^2$, nine children of size $\frac m3$.

**Step 2: cost of each level.** Nine times the nodes, a ninth of the cost:

$$
\text{level } 0: \; 1 \times n^2 = n^2 \qquad \text{level } 1: \; 9 \times \frac{n^2}{9} = n^2 \qquad \text{level } i: \; 9^i \times \frac{n^2}{9^i} = n^2
$$

**Step 3: height.** $k = \log_3 n$.

**Step 4: leaves.** $9^{\log_3 n} = n^{\log_3 9} = n^2$ leaves, contributing $n^2$.

**Step 5: add the levels.** :color[Flat]{hex="#3B82F6"}:

$$
T(n) = n^2(\log_3 n + 1)
$$

**Step 6: order.**

:mark[**$O(n^2 \log n)$**]{hex="#204A2E"}

## Q28. $T(n) = 9T(n/3) + n$

![Recursion tree for T(n) = 9T(n/3) + n](/notes/img/algorithms/ch04-q28-tree.svg)

**Step 1: what one node costs.** $f(m) = m$, nine children of size $\frac m3$.

**Step 2: cost of each level.**

$$
\text{level } 0: \; 1 \times n = n \qquad \text{level } 1: \; 9 \times \frac n3 = 3n \qquad \text{level } 2: \; 81 \times \frac n9 = 9n
$$

$$
\text{level } i: \; 9^i \times \frac{n}{3^i} = 3^i n
$$

**Step 3: height.** $k = \log_3 n$.

**Step 4: leaves.** $9^{\log_3 n} = n^2$ leaves, contributing $n^2$.

**Step 5: add the levels.** Increasing geometric with $r = 3$, and $3^k = n$:

$$
T(n) = n\left(1 + 3 + 9 + \dots + 3^k\right) = n \cdot \frac{3 \cdot 3^k - 1}{3 - 1} = n \cdot \frac{3n - 1}{2} \approx \frac{3n^2}{2}
$$

**Step 6: order.**

:mark[**$O(n^2)$**]{hex="#204A2E"}

## Q29. $T(n) = 5T(n/5) + n$

![Recursion tree for T(n) = 5T(n/5) + n](/notes/img/algorithms/ch04-q29-tree.svg)

**Step 1: what one node costs.** $f(m) = m$, five children of size $\frac m5$.

**Step 2: cost of each level.**

$$
\text{level } 0: \; 1 \times n = n \qquad \text{level } 1: \; 5 \times \frac n5 = n \qquad \text{level } i: \; 5^i \times \frac{n}{5^i} = n
$$

**Step 3: height.** $\dfrac{n}{5^k} = 1 \Rightarrow k = \log_5 n$.

**Step 4: leaves.** $5^{\log_5 n} = n$ leaves, contributing $n$.

**Step 5: add the levels.** :color[Flat]{hex="#3B82F6"}:

$$
T(n) = n(\log_5 n + 1)
$$

**Step 6: order.**

:mark[**$O(n \log n)$**]{hex="#204A2E"} Any $aT(n/a) + n$ gives $n\log n$: the branching factor cancels against the shrink factor.

## Q30. $T(n) = 16T(n/4) + n^2$

![Recursion tree for T(n) = 16T(n/4) + n squared](/notes/img/algorithms/ch04-q30-tree.svg)

**Step 1: what one node costs.** $f(m) = m^2$, sixteen children of size $\frac m4$.

**Step 2: cost of each level.**

$$
\text{level } 0: \; 1 \times n^2 = n^2 \qquad \text{level } 1: \; 16 \times \left(\frac n4\right)^2 = 16 \times \frac{n^2}{16} = n^2
$$

$$
\text{level } i: \; 16^i \times \frac{n^2}{16^i} = n^2
$$

**Step 3: height.** $\dfrac{n}{4^k} = 1 \Rightarrow k = \log_4 n$.

**Step 4: leaves.** $16^{\log_4 n} = n^{\log_4 16} = n^2$ leaves, contributing $n^2$.

**Step 5: add the levels.** :color[Flat]{hex="#3B82F6"}:

$$
T(n) = n^2(\log_4 n + 1)
$$

**Step 6: order.**

:mark[**$O(n^2 \log n)$**]{hex="#204A2E"}

## Q31. $T(n) = 2T(n/4) + \sqrt{n}$

![Recursion tree for T(n) = 2T(n/4) + sqrt n](/notes/img/algorithms/ch04-q31-tree.svg)

**Step 1: what one node costs.** $f(m) = \sqrt m$, two children of size $\frac m4$.

**Step 2: cost of each level.** A node at level $i$ has size $\frac{n}{4^i}$, so it costs $\sqrt{\frac{n}{4^i}} = \frac{\sqrt n}{2^i}$, and there are $2^i$ of them. They cancel exactly:

$$
\text{level } 0: \; 1 \times \sqrt n = \sqrt n \qquad \text{level } 1: \; 2 \times \frac{\sqrt n}{2} = \sqrt n
$$

$$
\text{level } i: \; 2^i \times \frac{\sqrt n}{2^i} = \sqrt n
$$

**Step 3: height.** $k = \log_4 n$.

**Step 4: leaves.** $2^{\log_4 n} = n^{\log_4 2} = n^{0.5} = \sqrt n$ leaves, contributing $\sqrt n$.

**Step 5: add the levels.** :color[Flat]{hex="#3B82F6"}:

$$
T(n) = \sqrt n(\log_4 n + 1)
$$

**Step 6: order.**

:mark[**$O(\sqrt{n} \log n)$**]{hex="#204A2E"} The flat case is not only about $n$ per level: here it is $\sqrt n$ per level.

## Q32. $T(n) = 3T(n/4) + n\log n$

![Recursion tree for T(n) = 3T(n/4) + n log n](/notes/img/algorithms/ch04-q32-tree.svg)

**Step 1: what one node costs.** $f(m) = m\log m$, three children of size $\frac m4$.

**Step 2: cost of each level.**

$$
\text{level } 0: \; 1 \times n\log n = n\log n
$$

$$
\text{level } 1: \; 3 \times \frac n4\log\frac n4 = \frac34 n\log\frac n4
$$

$$
\text{level } i: \; 3^i \times \frac{n}{4^i}\log\frac{n}{4^i} = \left(\frac34\right)^i n \log\frac{n}{4^i} \;\le\; \left(\frac34\right)^i n\log n
$$

**Step 3: height.** $k = \log_4 n$.

**Step 4: leaves.** $3^{\log_4 n} = n^{\log_4 3} = n^{0.792}$ leaves, contributing $n^{0.792}$.

**Step 5: add the levels.** Decreasing geometric with ratio at most $\frac34$:

$$
T(n) \le n\log n\left(1 + \frac34 + \frac{9}{16} + \dots\right) < n\log n \cdot \frac{1}{1 - \frac34} = 4n\log n
$$

**Step 6: order.** Root $n\log n$ against leaves $n^{0.792}$, so the root wins:

:mark[**$O(n \log n)$**]{hex="#204A2E"}

---

# Part D: uneven splits and non standard trees

## Q33. $T(n) = T(n/4) + T(n/2) + n$

![Recursion tree for T(n) = T(n/4) + T(n/2) + n](/notes/img/algorithms/ch04-q33-tree.svg)

**Step 1: what one node costs.** $f(m) = m$, and the two children have *different* sizes, $\frac m4$ and $\frac m2$. The tree is lopsided, so the level tables of Parts B and C do not apply directly. Add the node costs across each level instead.

**Step 2: cost of each level.**

$$
\text{level } 0: \; n
$$

$$
\text{level } 1: \; \frac n4 + \frac n2 = \frac{3n}{4}
$$

$$
\text{level } 2: \; \frac{n}{16} + \frac n8 + \frac n8 + \frac n4 = \frac{n + 2n + 2n + 4n}{16} = \frac{9n}{16} = \left(\frac34\right)^2 n
$$

The pattern: the children's sizes total $\frac14 + \frac12 = \frac34$ of the parent, so :color[**each level costs $\frac34$ of the level above**]{hex="#22C55E"}:

$$
\text{level } i: \; \left(\frac34\right)^i n
$$

**Step 3: height.** Two different depths: the shortest path divides by 4 each time ($\log_4 n$ levels), the longest divides by 2 ($\log_2 n$ levels). Use the longest as the upper bound.

**Step 4: leaves.** Fewer than $2^{\log_2 n} = n$, since the tree is not full.

**Step 5: add the levels.** Decreasing geometric with $r = \frac34$:

$$
T(n) \le n\left(1 + \frac34 + \frac{9}{16} + \dots\right) < n \cdot \frac{1}{1 - \frac34} = 4n
$$

**Step 6: order.**

:mark[**$O(n)$**]{hex="#204A2E"} An uneven split is still linear when the pieces total **less** than the whole.

## Q34. $T(n) = T(n/3) + T(2n/3) + n$

![Recursion tree for T(n) = T(n/3) + T(2n/3) + n](/notes/img/algorithms/ch04-q34-tree.svg)

**Step 1: what one node costs.** $f(m) = m$, children of size $\frac m3$ and $\frac{2m}{3}$. This is quicksort when the pivot always lands one third of the way in.

**Step 2: cost of each level.**

$$
\text{level } 0: \; n
$$

$$
\text{level } 1: \; \frac n3 + \frac{2n}{3} = n
$$

$$
\text{level } 2: \; \frac n9 + \frac{2n}{9} + \frac{2n}{9} + \frac{4n}{9} = \frac{9n}{9} = n
$$

The pieces total exactly $n$, so :color[**every level costs $n$**]{hex="#3B82F6"}, until branches start reaching the base case.

**Step 3: height.** Two depths again:

$$
\text{shortest path: } \frac{n}{3^k} = 1 \Rightarrow k = \log_3 n
$$

$$
\text{longest path: } n\left(\frac23\right)^k = 1 \Rightarrow k = \log_{3/2} n
$$

Both are $\Theta(\log n)$, and $\log_{3/2} n \approx 1.71\log_2 n$.

**Step 4: leaves.** Between $3^{\log_3 n}$ and $2^{\log_{3/2} n}$ of them, all $\Theta(n)$ order, each costing $T(1)$.

**Step 5: add the levels.** Below the shortest path's depth some branches have finished, so $n$ per level is an upper bound:

$$
T(n) \le n \times \log_{3/2} n
$$

**Step 6: order.**

:mark[**$O(n \log n)$**]{hex="#204A2E"} This is why quicksort stays $n\log n$ even when the pivot is never the median: any *constant* ratio split keeps the height logarithmic.

## Q35. $T(n) = T(n/5) + T(4n/5) + n$

![Recursion tree for T(n) = T(n/5) + T(4n/5) + n](/notes/img/algorithms/ch04-q35-tree.svg)

**Step 1: what one node costs.** $f(m) = m$, children of size $\frac m5$ and $\frac{4m}{5}$, an even more lopsided split than Q34.

**Step 2: cost of each level.**

$$
\text{level } 0: \; n \qquad \text{level } 1: \; \frac n5 + \frac{4n}{5} = n
$$

$$
\text{level } 2: \; \frac{n}{25} + \frac{4n}{25} + \frac{4n}{25} + \frac{16n}{25} = \frac{25n}{25} = n
$$

Again the pieces total exactly $n$, so every level costs $n$.

**Step 3: height.**

$$
\text{shortest path: } \log_5 n \qquad \text{longest path: } \log_{5/4} n \approx 3.1\log_2 n
$$

**Step 4: leaves.** $\Theta(n)$ of them, each costing $T(1)$.

**Step 5: add the levels.**

$$
T(n) \le n \times \log_{5/4} n
$$

**Step 6: order.**

:mark[**$O(n \log n)$**]{hex="#204A2E"} A 1 to 4 split is still log linear, just with a constant about 3 times worse than a perfect split. Only splitting off a *constant* sized piece breaks it, as in Q36.

## Q36. $T(n) = T(n-1) + T(1) + n$

The quicksort **worst case**: the pivot is always the smallest element, so one side is empty and the other holds $n - 1$ items. $T(1)$ is a constant, so the recurrence collapses to $T(n) = T(n-1) + n$, which is the tree below.

![Recursion tree for T(n) = T(n-1) + n](/notes/img/algorithms/ch04-q36-tree.svg)

**Step 1: what one node costs.** $f(m) = m$ for the partition step, and only **one** real subproblem, of size $m - 1$.

**Step 2: cost of each level.**

$$
\text{level } 0: \; n \qquad \text{level } 1: \; n-1 \qquad \text{level } i: \; n-i
$$

**Step 3: height.** The size drops by 1, not by a factor:

$$
n - k = 0 \;\Rightarrow\; k = n \text{ levels}
$$

That is the whole disaster: $n$ levels instead of $\log n$.

**Step 4: leaves.** One real leaf.

**Step 5: add the levels.**

$$
T(n) = n + (n-1) + (n-2) + \dots + 1 = \frac{n(n+1)}{2}
$$

**Step 6: order.**

:mark[**$O(n^2)$**]{hex="#204A2E"} Compare with Q34: same algorithm, same $n$ of work per level, but the height went from $\log n$ to $n$.

## Q37. $T(n) = T(9n/10) + n$

![Recursion tree for T(n) = T(9n/10) + n](/notes/img/algorithms/ch04-q37-tree.svg)

**Step 1: what one node costs.** $f(m) = m$, one child of size $\frac{9m}{10}$. A 90 % to 10 % split where the small side is discarded.

**Step 2: cost of each level.**

$$
\text{level } 0: \; n \qquad \text{level } 1: \; \frac{9n}{10} \qquad \text{level } 2: \; \left(\frac{9}{10}\right)^2 n \qquad \text{level } i: \; \left(\frac{9}{10}\right)^i n
$$

**Step 3: height.**

$$
\left(\frac{9}{10}\right)^k n = 1 \;\Rightarrow\; k = \log_{10/9} n \approx 6.6\log_2 n
$$

Still $\Theta(\log n)$, just with a big constant.

**Step 4: leaves.** One leaf, $T(1)$.

**Step 5: add the levels.** Decreasing geometric with $r = \frac{9}{10}$:

$$
T(n) = n\left(1 + \frac{9}{10} + \frac{81}{100} + \dots\right) < n \cdot \frac{1}{1 - \frac{9}{10}} = 10n
$$

**Step 6: order.**

:mark[**$O(n)$**]{hex="#204A2E"} Even a terrible looking split is linear, because the size still shrinks by a constant **factor** each time.

## Q38. $T(n) = 2T(n-1) + 1$

![Recursion tree for T(n) = 2T(n-1) + 1](/notes/img/algorithms/ch04-q38-tree.svg)

**Step 1: what one node costs.** $f(m) = 1$, and **two** children of size $m - 1$. Tower of Hanoi: move the stack above, move one disc, move the stack back.

**Step 2: cost of each level.**

$$
\text{level } 0: \; 1 \times 1 = 1 \qquad \text{level } 1: \; 2 \times 1 = 2 \qquad \text{level } 2: \; 4 \times 1 = 4
$$

$$
\text{level } i: \; 2^i \times 1 = 2^i
$$

**Step 3: height.** The size drops by 1, so:

$$
n - k = 0 \;\Rightarrow\; k = n \text{ levels}
$$

**Step 4: leaves.** $2^k = 2^n$ leaves. That is the difference from Q11: the same doubling, but over $n$ levels instead of $\log_2 n$.

**Step 5: add the levels.** Increasing geometric with $r = 2$:

$$
T(n) = 1 + 2 + 4 + \dots + 2^n = \frac{2^{n+1} - 1}{2 - 1} = 2^{n+1} - 1
$$

**Step 6: order.**

:mark[**$O(2^n)$**]{hex="#204A2E"} Dividing by 2 gives $\log n$ levels and a linear total (Q11); subtracting 1 gives $n$ levels and an exponential one.

## Q39. $T(n) = 2T(n-1) + n$

![Recursion tree for T(n) = 2T(n-1) + n](/notes/img/algorithms/ch04-q39-tree.svg)

**Step 1: what one node costs.** $f(m) = m$, two children of size $m-1$.

**Step 2: cost of each level.** Level $i$ has $2^i$ nodes, each of size $n - i$:

$$
\text{level } 0: \; 1 \times n = n \qquad \text{level } 1: \; 2 \times (n-1) \qquad \text{level } 2: \; 4 \times (n-2)
$$

$$
\text{level } i: \; 2^i(n-i)
$$

**Step 3: height.** $n - k = 0 \Rightarrow k = n$ levels.

**Step 4: leaves.** $2^n$ leaves, each costing $T(0) = 1$, so the bottom contributes $2^n$.

**Step 5: add the levels.** Count from the bottom: put $j = n - i$, so $2^i = \dfrac{2^n}{2^j}$ and $n - i = j$:

$$
\sum_{i=0}^{n-1} 2^i(n-i) = \sum_{j=1}^{n} \frac{2^n}{2^j}\, j = 2^n \sum_{j=1}^{n} \frac{j}{2^j} < 2^n \times 2 = 2^{n+1}
$$

Adding the leaves gives the exact value $T(n) = 3 \cdot 2^n - n - 2$.

**Step 6: order.**

:mark[**$O(2^n)$**]{hex="#204A2E"} The extra $n$ per node changed the constant from 2 to 3, nothing more.

## Q40. $T(n) = T(n-1) + T(n-2) + 1$

![Recursion tree for T(n) = T(n-1) + T(n-2) + 1](/notes/img/algorithms/ch04-q40-tree.svg)

**Step 1: what one node costs.** $f(m) = 1$, and two children of *different* sizes, $m - 1$ and $m - 2$. Naive recursive Fibonacci.

**Step 2: cost of each level.** Each node costs 1, so the level cost is the node count, but the tree is not full: the $m-2$ branches run out sooner, so the count is somewhere between $2^i$ (full) and much less.

**Step 3: height.** Two depths:

$$
\text{longest path (always } -1): \; n \text{ levels} \qquad \text{shortest path (always } -2): \; \frac n2 \text{ levels}
$$

**Step 4: leaves.** Between $2^{n/2}$ and $2^n$.

**Step 5: bound it from both sides.** Instead of an exact sum, trap the tree between two full binary trees:

$$
\text{upper: every path at most } n \text{ deep} \;\Rightarrow\; T(n) \le 2^n
$$

$$
\text{lower: every path at least } \tfrac n2 \text{ deep} \;\Rightarrow\; T(n) \ge 2^{n/2} = (\sqrt2)^n
$$

So $T(n)$ is exponential, with a base between $\sqrt2 = 1.41$ and $2$.

**Step 6: order.** The exact node count follows the Fibonacci numbers, which grow as $\phi^n$ with $\phi = \frac{1 + \sqrt5}{2} = 1.618$:

:mark[**$O(2^n)$, exactly $\Theta(1.618^n)$**]{hex="#204A2E"} Memoisation collapses the repeated subtrees, leaving $n$ distinct calls and $O(n)$ time.

---

## Quick reference

For $T(n) = aT(n/b) + f(n)$, compare $f(n)$ against the leaf count $n^{\log_b a}$:

| If | Who wins | Total |
| --- | --- | --- |
| $f(n)$ grows slower than $n^{\log_b a}$ | leaves | $O(n^{\log_b a})$ |
| $f(n)$ is the same order as $n^{\log_b a}$ | all levels | $O(f(n) \log n)$ |
| $f(n)$ grows faster than $n^{\log_b a}$ | root | $O(f(n))$ |

| Recurrence | Height | Leaves $n^{\log_b a}$ | Level costs | Answer |
| --- | --- | --- | --- | --- |
| $2T(n/2) + 1$ | $\log_2 n$ | $n$ | up | $O(n)$ |
| $2T(n/2) + n$ | $\log_2 n$ | $n$ | flat | $O(n \log n)$ |
| $2T(n/2) + n^2$ | $\log_2 n$ | $n$ | down | $O(n^2)$ |
| $2T(n/2) + \log n$ | $\log_2 n$ | $n$ | up | $O(n)$ |
| $2T(n/2) + n\log n$ | $\log_2 n$ | $n$ | almost flat | $O(n \log^2 n)$ |
| $3T(n/2) + n$ | $\log_2 n$ | $n^{1.585}$ | up | $O(n^{1.585})$ |
| $3T(n/2) + n^2$ | $\log_2 n$ | $n^{1.585}$ | down | $O(n^2)$ |
| $4T(n/2) + n$ | $\log_2 n$ | $n^2$ | up | $O(n^2)$ |
| $4T(n/2) + n^2$ | $\log_2 n$ | $n^2$ | flat | $O(n^2 \log n)$ |
| $4T(n/2) + n^3$ | $\log_2 n$ | $n^2$ | down | $O(n^3)$ |
| $8T(n/2) + n^2$ | $\log_2 n$ | $n^3$ | up | $O(n^3)$ |
| $8T(n/2) + n^3$ | $\log_2 n$ | $n^3$ | flat | $O(n^3 \log n)$ |
| $3T(n/3) + n$ | $\log_3 n$ | $n$ | flat | $O(n \log n)$ |
| $2T(n/3) + n$ | $\log_3 n$ | $n^{0.63}$ | down | $O(n)$ |
| $9T(n/3) + n$ | $\log_3 n$ | $n^2$ | up | $O(n^2)$ |
| $2T(n/4) + \sqrt n$ | $\log_4 n$ | $\sqrt n$ | flat | $O(\sqrt n \log n)$ |

That comparison is the **Master Theorem**, which Chapter 5 states properly. The tree method is where it comes from, so keep drawing trees until the three cases feel obvious.

## Chapter summary

- A recursion tree turns a recurrence into levels: nodes $\times$ cost per node = cost of the level. Add the levels.
- Height comes from the size sequence, by assuming the last level is the base case: $\frac{n}{b^k} = 1$ gives $k = \log_b n$, and $n - kb = 0$ gives $k = n/b$.
- Leaves for $aT(n/b)$ are $a^{\log_b n} = n^{\log_b a}$, each costing $T(1)$.
- Level costs going **down** mean the root decides, **flat** means cost $\times$ height, going **up** means the leaves decide.
- For an increasing series, evaluate the last term with $r^{\log_b n} = n^{\log_b r}$. That single identity turns every awkward looking sum into a power of $n$.
- Uneven splits: if the pieces total less than $n$, the level costs shrink geometrically and the answer is linear. If they total exactly $n$, every level costs $n$ and the answer is $n\log n$.
- Subtracting from $n$ instead of dividing it turns $\log n$ levels into $n$ levels, which is what makes $2T(n-1)$ exponential while $2T(n/2)$ is linear.
- Draw the tree yourself, then check it in the [Recurrence Relation tool](/algo/recurrence-relation).
