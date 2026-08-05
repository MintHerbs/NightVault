# Chapter 2: Time Complexity and Asymptotic Analysis

Chapter 1 said *what* a growth rate is. This chapter is the skill you are actually examined on: **given a piece of Python, state its time complexity**. The whole job is counting how many times the innermost work runs, as a function of $n$.

## Counting operations, not seconds

Assume every **basic operation** costs one unit of time: an assignment, a comparison, an arithmetic operation, indexing a list, returning.

```python cost per line
def f(a, b):
    c = a + b      # 1
    d = c * 2      # 1
    return d       # 1
```

$T(n) = 3$, a constant, so this is $O(1)$. The exact count does not matter; that it does not depend on $n$ does.

> :mark[**$O(1)$ does not mean "fast".**]{hex="#5C3A1A"} It means "the same, whatever the input size". One line that takes a millisecond is still $O(1)$.

## The three notations

| Notation | Meaning | Says |
| --- | --- | --- |
| $O(f(n))$ | upper bound | grows *at most* as fast as $f(n)$ |
| $\Omega(f(n))$ | lower bound | grows *at least* as fast as $f(n)$ |
| $\Theta(f(n))$ | tight bound | grows *exactly* as fast as $f(n)$ |

Formally, $T(n) = O(f(n))$ if there exist constants $c > 0$ and $n_0$ such that

$$
T(n) \le c \cdot f(n) \quad \text{for all } n \ge n_0
$$

The $n_0$ is the "ignore small inputs" clause, and $c$ is the "ignore constant factors" clause. Together they are the formal version of everything Chapter 1 argued informally.

**Example.** $T(n) = 3n + 5$. Choose $c = 4$ and $n_0 = 5$: for every $n \ge 5$, $3n + 5 \le 4n$. So $T(n) = O(n)$.

### Best, average and worst case

These are a different axis from $O$ / $\Omega$ / $\Theta$, and mixing them up is the most common exam error.

```python linear search
def search(items, target):
    for i in range(len(items)):
        if items[i] == target:
            return i
    return -1
```

| Case | When | Cost |
| --- | --- | --- |
| Best | target is the first item | $O(1)$ |
| Average | target is somewhere in the middle | $O(n)$ |
| Worst | target is last, or absent | $O(n)$ |

Unless a question says otherwise, **:color[give the worst case]{hex="#ffa31a"}**. It is the guarantee, and the average case usually needs assumptions about the data that you were not given.

## Five rules for reading code

> **Rule 1 (simple statements).** Any fixed number of assignments, comparisons and arithmetic is $O(1)$.
>
> **Rule 2 (sequence).** Blocks one after another *add*, then you keep the biggest: $O(n) + O(n^2) = O(n^2)$.
>
> **Rule 3 (nesting).** A loop inside a loop *multiplies*: $O(n) \times O(n) = O(n^2)$.
>
> **Rule 4 (conditionals).** An `if/else` costs the condition plus the **more expensive** branch.
>
> **Rule 5 (simplify).** Drop constant factors and lower order terms at the very end, never in the middle of the count.

### Rule 4, in code

```python if/else takes the worse branch
if x > 0:              # O(1)
    print(x)           # O(1)
else:
    for i in items:    # O(n)
        print(i)
```

Worst case $O(1) + O(n) = O(n)$.

## Loop patterns you must recognise

This table covers most of what an exam can put in front of you.

| Pattern | Iterations | Complexity |
| --- | --- | --- |
| `for i in range(n)` | $n$ | :color[O(n)]{hex="#22C55E"} |
| `for i in range(0, n, 2)` | $n/2$ | :color[O(n)]{hex="#22C55E"} |
| `for i in range(0, n, k)` | $n/k$ | :color[O(n)]{hex="#22C55E"} |
| `for i in range(1000)` | 1000 | :color[O(1)]{hex="#9CA3AF"} |
| `while i < n: i *= 2` | $\log_2 n$ | :color[O(log n)]{hex="#A78BFA"} |
| `while i < n: i *= 3` | $\log_3 n$ | :color[O(log n)]{hex="#A78BFA"} |
| `while i > 1: i //= 2` | $\log_2 n$ | :color[O(log n)]{hex="#A78BFA"} |
| `while i * i < n: i += 1` | $\sqrt{n}$ | :color[O(√n)]{hex="#2DD4BF"} |
| `for i in range(n)` + `for j in range(n)` (nested) | $n \times n$ | :color[O(n²)]{hex="#F97316"} |
| `for i in range(n)` + `for j in range(i)` | $\frac{n(n-1)}{2}$ | :color[O(n²)]{hex="#F97316"} |
| `for i in range(n)` + `for j in range(100)` | $100n$ | :color[O(n)]{hex="#22C55E"} |
| `for i in range(n)` + `while j < n: j *= 2` (j reset inside) | $n \log n$ | :color[O(n log n)]{hex="#EAB308"} |
| three nested `range(n)` loops | $n^3$ | :color[O(n³)]{hex="#EF4444"} |

Two facts explain the whole table:

- A loop that **adds** a fixed amount to the counter is **:color[linear]{hex="#22C55E"}** in the range it covers.
- A loop that **multiplies or divides** the counter is **:color[logarithmic]{hex="#A78BFA"}**, because the counter has to be doubled $\log_2 n$ times to travel from 1 to $n$.

The colours above are not decoration: the same hue means the same complexity everywhere in this chapter. The scale is set out just before the worked examples.

## Python operations are not all $O(1)$

This is where Python analysis differs from pseudocode analysis. A single innocent looking line can hide a loop.

| Operation | Complexity | Note |
| --- | --- | --- |
| `lst[i]` | $O(1)$ | index is direct |
| `len(lst)` | $O(1)$ | the length is stored |
| `lst.append(x)` | $O(1)$ amortised | occasionally has to resize |
| `lst.pop()` | $O(1)$ | from the end |
| `lst.pop(0)` / `lst.insert(0, x)` | :color[O(n)]{hex="#EF4444"} | everything shifts |
| `x in lst` | :color[O(n)]{hex="#EF4444"} | scans the list |
| `x in set` / `x in dict` | $O(1)$ average | hashed |
| `lst[a:b]` | $O(b - a)$ | a slice copies |
| `lst.sort()` / `sorted(lst)` | $O(n \log n)$ | Timsort |
| `min(lst)`, `max(lst)`, `sum(lst)` | $O(n)$ | a hidden loop |
| `lst.copy()`, `list(lst)` | $O(n)$ | copies every element |
| `s1 + s2` on strings | $O(len(s_1) + len(s_2))$ | strings are immutable, a new one is built |
| `"".join(parts)` | $O(\text{total length})$ | the right way to build a string |
| `dict[k] = v`, `dict[k]` | $O(1)$ average | |

> :mark[**Exam trap:**]{hex="#5C2323"} `if x in my_list` inside a `for` loop is **not** $O(n)$. It is $O(n \times m)$, because the membership test is itself a loop. See Example 14.

## Space complexity, briefly

The same counting, applied to memory: how much *extra* memory the algorithm needs as $n$ grows, not counting the input.

```python O(1) space vs O(n) space
def total(items):          # O(1) extra space
    s = 0
    for x in items:
        s += x
    return s

def doubled(items):        # O(n) extra space
    out = []
    for x in items:
        out.append(x * 2)
    return out
```

---

## How to read the worked examples

Every example below is the code with **brackets down the right hand side**, which is exactly how you should annotate a listing in an exam.

> **Read them from the inside out.** The bracket closest to the code is the innermost block, and each bracket further right encloses the ones before it. A label starting with `=` is the conclusion drawn from the brackets inside it.
>
> So three nested brackets reading **:color[O(n)]{hex="#22C55E"}** then **:color[= O(n²)]{hex="#F97316"}** then **:color[= O(n³)]{hex="#EF4444"}** says: the innermost loop is linear, wrapping it in a second loop squares that, wrapping it in a third cubes it.

**The colour is the answer.** Cool means fast, warm means slow, and it is the same scale as the growth rate table in Chapter 1:

| Bracket label | Tier | Where it comes from |
| --- | --- | --- |
| **:color[O(1)]{hex="#9CA3AF"}** | constant | no loop, or a loop with a fixed bound |
| **:color[O(log n)]{hex="#A78BFA"}** | logarithmic | a counter that multiplies or divides |
| **:color[O(√n)]{hex="#2DD4BF"}** | root | a counter tested against $i \times i$ |
| **:color[O(n)]{hex="#22C55E"}** | linear | one pass over the input |
| **:color[O(n log n)]{hex="#EAB308"}** | log linear | a linear loop wrapping a logarithmic one, or a sort |
| **:color[O(n²)]{hex="#F97316"}** | quadratic | two nested passes |
| **:color[O(n³)]{hex="#EF4444"}** | cubic | three nested passes |

The highlighted answer under each example uses the same scale, so a :mark[**quadratic**]{hex="#5C3A1A"} answer is highlighted in the same orange as its bracket. Inside the diagrams the code itself keeps the site's usual syntax colours, so only the bracket labels carry complexity meaning.

---

# Worked examples

## Example 1: no loops

![Annotated code: a constant time function, bracketed as O(1)](/notes/img/algorithms/ch02-e01-code.svg)

Two operations, neither depends on the input size. :mark[**$O(1)$**]{hex="#3A3A3E"}

## Example 2: one loop

![Annotated code: a single loop, bracketed as O(n)](/notes/img/algorithms/ch02-e02-code.svg)

$T(n) = 1 + n + 1 = n + 2$. :mark[**$O(n)$**]{hex="#204A2E"}

## Example 3: two loops one after the other

![Annotated code: two sequential loops, each O(n), together O(n)](/notes/img/algorithms/ch02-e03-code.svg)

$T(n) = n + n = 2n$. Sequence adds, then the constant 2 is dropped. :mark[**$O(n)$**]{hex="#204A2E"}

## Example 4: a loop next to a nested loop

![Annotated code: a loop beside a nested loop, together O(n squared)](/notes/img/algorithms/ch02-e04-code.svg)

$T(n) = n + n^2$. Keep the highest order term. :mark[**$O(n^2)$**]{hex="#5C3A1A"}

## Example 5: nested loops

![Annotated code: two nested loops, O(n) inside O(n), together O(n squared)](/notes/img/algorithms/ch02-e05-code.svg)

The inner loop runs $n$ times for each of the $n$ outer iterations. $T(n) = n \times n$. :mark[**$O(n^2)$**]{hex="#5C3A1A"}

## Example 6: triangular nested loop

![Annotated code: a triangular nested loop, together O(n squared)](/notes/img/algorithms/ch02-e06-code.svg)

The inner loop runs $0, 1, 2, \dots, n-1$ times:

$$
T(n) = 0 + 1 + 2 + \dots + (n-1) = \frac{n(n-1)}{2} = \frac{n^2}{2} - \frac{n}{2}
$$

Half of $n^2$ is still $n^2$ once constants go. :mark[**$O(n^2)$**]{hex="#5C3A1A"}

> A nested loop is not automatically $O(n^2)$, and a triangular one is not automatically better. Count first, simplify last.

## Example 7: inner loop with a fixed bound

![Annotated code: a nested loop with a fixed bound, together O(n)](/notes/img/algorithms/ch02-e07-code.svg)

$T(n) = 100n$. The inner loop does not depend on $n$, so it is a constant factor. :mark[**$O(n)$**]{hex="#204A2E"}

## Example 8: the counter doubles

![Annotated code: a doubling while loop, O(log n)](/notes/img/algorithms/ch02-e08-code.svg)

$i$ takes the values $1, 2, 4, 8, \dots$ Stop when $2^k \ge n$, so $k = \log_2 n$. :mark[**$O(\log n)$**]{hex="#3B2A5E"}

## Example 9: the counter halves

![Annotated code: a halving while loop, O(log n)](/notes/img/algorithms/ch02-e09-code.svg)

$n \to n/2 \to n/4 \to \dots \to 1$ takes $\log_2 n$ steps. :mark[**$O(\log n)$**]{hex="#3B2A5E"}

Halving and doubling are the same count read in opposite directions.

## Example 10: a linear loop wrapping a logarithmic one

![Annotated code: a logarithmic loop inside a linear loop, O(n log n)](/notes/img/algorithms/ch02-e10-code.svg)

$T(n) = n \times \log_2 n$. :mark[**$O(n \log n)$**]{hex="#565426"}

## Example 11: the trap where the counter is not reset

![Annotated code: a nested while whose counter is never reset, O(n)](/notes/img/algorithms/ch02-e11-code.svg)

It *looks* nested, but `j` is never reset. The inner `while` runs $n$ times in total across the whole program, not $n$ times per outer iteration.

$T(n) = n + n = 2n$. :mark[**$O(n)$**]{hex="#204A2E"}

> **:color[Always ask where the inner counter is initialised.]{hex="#EF4444"}** Inside the outer loop means multiply. Outside means add.

## Example 12: the counter squared against $n$

![Annotated code: a loop testing i squared against n, O(square root of n)](/notes/img/algorithms/ch02-e12-code.svg)

The loop stops when $i > \sqrt{n}$. :mark[**$O(\sqrt{n})$**]{hex="#1B4A46"}

## Example 13: two different inputs

![Annotated code: two loops over two different inputs, O(n + m)](/notes/img/algorithms/ch02-e13-code.svg)

:mark[**$O(n + m)$**]{hex="#204A2E"}, and nested it would be $O(n \times m)$.

Writing $O(n^2)$ here is wrong: `list_b` could hold 3 items or 3 million, and nothing in the code ties $m$ to $n$.

## Example 14: the hidden loop

![Annotated code: a list membership test inside a loop, O(n times m)](/notes/img/algorithms/ch02-e14-code.svg)

$T = n \times m$. :mark[**$O(n \times m)$**]{hex="#5C3A1A"}, which is $O(n^2)$ when the two lists have similar size.

The fix is one line:

![Annotated code: the same function using a set, O(n + m)](/notes/img/algorithms/ch02-e14-fixed-code.svg)

:mark[**$O(n + m)$.**]{hex="#204A2E"} Same output, and on two lists of 10 000 items it is about 10 000 times less work.

## Example 15: building a string

![Annotated code: string concatenation in a loop, O(n squared)](/notes/img/algorithms/ch02-e15-code.svg)

Copy costs $1 + 2 + 3 + \dots + n$, giving $\frac{n(n+1)}{2}$. :mark[**$O(n^2)$**]{hex="#5C3A1A"}

![Annotated code: the same thing with join, O(n)](/notes/img/algorithms/ch02-e15-fixed-code.svg)

:mark[**$O(n)$**]{hex="#204A2E"} Strings are immutable, so `+=` in a loop rebuilds the string every time. `join` walks the list once.

## Example 16: a sort inside the function

![Annotated code: a sort inside a function, O(n log n)](/notes/img/algorithms/ch02-e16-code.svg)

$T(n) = n \log n + 1$. :mark[**$O(n \log n)$**]{hex="#565426"}

The sort dominates, and it is the most commonly missed line in an exam. A single pass would have solved this in $O(n)$.

## Example 17: binary search

![Annotated code: binary search, O(log n)](/notes/img/algorithms/ch02-e17-code.svg)

Each iteration halves the search space: $n \to n/2 \to n/4 \to \dots \to 1$. :mark[**$O(\log n)$**]{hex="#3B2A5E"}

Best case $O(1)$ if the middle element is the target on the first try.

## Example 18: nested loop with a moving start

![Annotated code: a nested loop with a moving start, O(n squared)](/notes/img/algorithms/ch02-e18-code.svg)

Inner counts are $n, n-1, n-2, \dots, 1$:

$$
T(n) = \frac{n(n+1)}{2}
$$

:mark[**$O(n^2)$**]{hex="#5C3A1A"}

## Example 19: matrix multiplication

![Annotated code: three nested loops, O(n cubed)](/notes/img/algorithms/ch02-e19-code.svg)

Three nested loops each running $n$ times. :mark[**$O(n^3)$**]{hex="#5C2323"}, with $O(n^2)$ space for the result.

## Example 20: halving inside a linear loop

![Annotated code: a halving loop inside a linear loop, O(n log n)](/notes/img/algorithms/ch02-e20-code.svg)

$T(n) \le n \log_2 n$. :mark[**$O(n \log n)$**]{hex="#565426"}

## Example 21: exam favourite

![Annotated code: a half range loop wrapping a doubling loop, O(n log n)](/notes/img/algorithms/ch02-e21-code.svg)

$T(n) = \dfrac{n}{2} \times \log_2 n$. :mark[**$O(n \log n)$**]{hex="#565426"}

The $n/2$ is a constant factor, so it disappears. Only the *shape* of each loop matters.

## Example 22: recursion, briefly

```python
def factorial(n):
    if n == 0:
        return 1
    return n * factorial(n - 1)
```

One call per value from $n$ down to 0. :mark[**$O(n)$ time, $O(n)$ space**]{hex="#204A2E"} (the call stack).

```python
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)
```

Each call spawns two more. :mark[**$O(2^n)$**]{hex="#5C2323"}

Recursive costs are written as **recurrence relations**, $T(n) = T(n-1) + 1$ for the first and $T(n) = T(n-1) + T(n-2) + 1$ for the second. Solving those is Chapters 3 and 4.

---

## Self test

State the complexity of each, then check against the answer.

```python A
for i in range(n):
    for j in range(n):
        for k in range(100):
            print(i, j, k)
```

```python B
i = n
while i > 0:
    for j in range(n):
        print(j)
    i //= 2
```

```python C
def has_duplicate(items):
    return len(items) != len(set(items))
```

```python D
result = []
for x in range(n):
    result.insert(0, x)
```

```python E
for i in range(n):
    print(sum(range(n)))
```

| | Answer | Why |
| --- | --- | --- |
| **A** | $O(n^2)$ | the innermost loop is a constant 100 |
| **B** | $O(n \log n)$ | outer halves ($\log n$), inner is linear |
| **C** | $O(n)$ | building the set is one pass, `len` is $O(1)$ |
| **D** | $O(n^2)$ | `insert(0, x)` shifts every element, $n$ times |
| **E** | $O(n^2)$ | `sum(range(n))` is a hidden $O(n)$ loop, run $n$ times |

## Chapter summary

- Count basic operations as a function of $n$, then drop constants and lower order terms at the end.
- Sequence adds, nesting multiplies, `if/else` takes the worse branch.
- Counter **adds** a step, the loop is linear. Counter **multiplies or divides**, the loop is logarithmic.
- Check where an inner counter is initialised before assuming a nested loop is quadratic.
- In Python, `in` on a list, slicing, `sum`, `min`, `max`, `sorted`, `insert(0, x)` and `+=` on strings all hide loops. Sets and dicts do not.
- Say worst case unless asked otherwise.
