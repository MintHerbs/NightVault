# Chapter 3: Recurrence Relations, Substitution Method

A recursive function cannot be analysed by counting loops, because its cost is written in terms of itself. That self referring equation is a **recurrence relation**, and this chapter solves them by **back substitution**: expand the relation into itself until the base case appears, then add up what fell out.

> You can check any answer in this chapter against the [Recurrence Relation tool](/algo/recurrence-relation). Do the working by hand first, then confirm.

## The colours

Every part of a recurrence keeps one colour from the first line of working to the answer, so you can follow a single term all the way down a question. Chapter 5 uses the same two colours for the same two roles, so the notation carries across.

| Colour | What it is | Where it is |
| --- | --- | --- |
| **:color[a]{hex="#5B8CFF"}** | how many recursive calls | the multiplier in front of $T$ |
| **:color[the argument of T]{hex="#FF5FA2"}** | how big the problem still is | inside $T(\dots)$ |
| **:color[k]{hex="#A78BFA"}** | how many substitutions you have made | the counter introduced in step 2 |
| **:color[f(n)]{hex="#EAB308"}** | the work outside the recursion | everything that piles up |
| **:color[the base case]{hex="#2DD4BF"}** | where the recursion stops | $T(0)$ or $T(1)$, and the value it holds |

Read a line of working as a race between two of them. The :color[pink]{hex="#FF5FA2"} argument shrinks on every substitution, and the whole method is about driving it down to the :color[teal]{hex="#2DD4BF"} base case. :color[k]{hex="#A78BFA"} counts how many substitutions that took, and the :color[amber]{hex="#EAB308"} terms are the bill you ran up getting there.

> Watch for the places where :color[amber]{hex="#EAB308"} turns :color[violet]{hex="#A78BFA"}. When the work at each level is a constant, the total work **is** the number of substitutions, so the sum and the counter are the same thing. That is the whole of $T(n) = T(\textcolor{#FF5FA2}{n-1}) + \textcolor{#EAB308}{1}$.

The highlighted answer at the end of each question is coloured by its order, on the scale the rest of these notes use: :color[O(1)]{hex="#9CA3AF"}, :color[O(log n)]{hex="#A78BFA"}, :color[O(n)]{hex="#22C55E"}, :color[O(n log n)]{hex="#EAB308"}, :color[O(n²)]{hex="#F97316"}, :color[O(n³) and worse]{hex="#EF4444"}.

## From code to recurrence

```python
def test(n):
    if n > 0:
        print(n)          # O(1)
        test(n - 1)       # T(n-1)
```

The function does constant work, then calls itself on $n - 1$:

$$
T(n) = \begin{cases} \textcolor{#2DD4BF}{1} & n = 0 \\ T(\textcolor{#FF5FA2}{n-1}) + \textcolor{#EAB308}{1} & n > 0 \end{cases}
$$

Change the body and the recurrence changes with it:

| Body of the function | Recurrence |
| --- | --- |
| one `print`, then `test(n-1)` | $T(n) = T(\textcolor{#FF5FA2}{n-1}) + \textcolor{#EAB308}{1}$ |
| a `for` loop over $n$, then `test(n-1)` | $T(n) = T(\textcolor{#FF5FA2}{n-1}) + \textcolor{#EAB308}{n}$ |
| a doubling `while` loop, then `test(n-1)` | $T(n) = T(\textcolor{#FF5FA2}{n-1}) + \textcolor{#EAB308}{\log n}$ |
| two calls to `test(n-1)` | $T(n) = \textcolor{#5B8CFF}{2}T(\textcolor{#FF5FA2}{n-1}) + \textcolor{#EAB308}{1}$ |
| a `for` loop over $n$, then two calls to `test(n/2)` | $T(n) = \textcolor{#5B8CFF}{2}T(\textcolor{#FF5FA2}{n/2}) + \textcolor{#EAB308}{n}$ |

The recursive part gives the $T(\textcolor{#FF5FA2}{\dots})$ terms, and everything else in the body gives $f(n)$.

## The method, in four steps

> **Step 1.** Write the recurrence, then substitute it into itself two or three times. Simplify after each substitution so the pattern is visible.
>
> **Step 2.** Generalise: write the form after $\textcolor{#A78BFA}{k}$ substitutions.
>
> **Step 3.** Choose $\textcolor{#A78BFA}{k}$ so the recursive term becomes the base case. For a *decreasing* recurrence set $n - \textcolor{#A78BFA}{k} = 0$, so $\textcolor{#A78BFA}{k} = n$. For a *dividing* one set $n/2^{\textcolor{#A78BFA}{k}} = 1$, so $\textcolor{#A78BFA}{k} = \log_2 n$.
>
> **Step 4.** Substitute that $\textcolor{#A78BFA}{k}$, sum the series that is left, and read off the highest order term.

## Series you will need

| Series | Sum | Order |
| --- | --- | --- |
| $1 + 1 + \dots + 1$ ($n$ terms) | $n$ | $\textcolor{#22C55E}{O(n)}$ |
| $1 + 2 + 3 + \dots + n$ | $\frac{n(n+1)}{2}$ | $\textcolor{#F97316}{O(n^2)}$ |
| $1^2 + 2^2 + \dots + n^2$ | $\frac{n(n+1)(2n+1)}{6}$ | $\textcolor{#EF4444}{O(n^3)}$ |
| $\log 1 + \log 2 + \dots + \log n$ | $\log(n!)$ | $\textcolor{#EAB308}{O(n \log n)}$ |
| $1 + 2 + 4 + \dots + 2^{\textcolor{#A78BFA}{k}}$ | $2^{\textcolor{#A78BFA}{k}+1} - 1$ | $O(2^{\textcolor{#A78BFA}{k}})$ |
| $1 + 3 + 9 + \dots + 3^{\textcolor{#A78BFA}{k}}$ | $\frac{3^{\textcolor{#A78BFA}{k}+1} - 1}{2}$ | $O(3^{\textcolor{#A78BFA}{k}})$ |
| $1 + \frac{1}{2} + \frac{1}{4} + \dots$ | $< 2$ | $\textcolor{#9CA3AF}{O(1)}$ |
| $1 + \frac{1}{2} + \frac{1}{3} + \dots + \frac{1}{n}$ | $\approx \ln n$ | $\textcolor{#A78BFA}{O(\log n)}$ |
| $\sqrt{1} + \sqrt{2} + \dots + \sqrt{n}$ | $\approx \frac{2}{3}n^{3/2}$ | $\textcolor{#2DD4BF}{O(n^{1.5})}$ |
| $r^0 + r^1 + \dots + r^{\textcolor{#A78BFA}{k}-1}$ | $\frac{r^{\textcolor{#A78BFA}{k}} - 1}{r - 1}$ | last term rules if $r > 1$ |

Two rules cover every geometric series that appears:

- Ratio **:color[bigger than 1]{hex="#EF4444"}** (like $1 + 2 + 4 + \dots$): the **last** term dominates.
- Ratio **:color[smaller than 1]{hex="#22C55E"}** (like $n + \frac{n}{2} + \frac{n}{4} + \dots$): the **first** term dominates, and the sum is a constant multiple of it.

## The two shapes

| Shape | Form | Choose $\textcolor{#A78BFA}{k}$ from | Number of substitutions |
| --- | --- | --- | --- |
| **Decreasing** | $T(n) = \textcolor{#5B8CFF}{a}T(\textcolor{#FF5FA2}{n-b}) + \textcolor{#EAB308}{f(n)}$ | $n - \textcolor{#A78BFA}{k}b = 0$ | $\textcolor{#A78BFA}{k} = n/b$ |
| **Dividing** | $T(n) = \textcolor{#5B8CFF}{a}T(\textcolor{#FF5FA2}{n/b}) + \textcolor{#EAB308}{f(n)}$ | $n/b^{\textcolor{#A78BFA}{k}} = 1$ | $\textcolor{#A78BFA}{k} = \log_b n$ |

Everything below is one of these two.

---

# Part A: decreasing recurrences

Base case $\textcolor{#2DD4BF}{T(0)} = \textcolor{#2DD4BF}{1}$ throughout this part.

## Q1. $T(n) = T(n-1) + 1$

$$
T(n) = \begin{cases} \textcolor{#2DD4BF}{1} & n = 0 \\ T(\textcolor{#FF5FA2}{n-1}) + \textcolor{#EAB308}{1} & n > 0 \end{cases}
$$

**Step 1: expand.**

$$
T(n) = T(\textcolor{#FF5FA2}{n-1}) + \textcolor{#EAB308}{1} \qquad (1)
$$

Since $T(\textcolor{#FF5FA2}{n-1}) = T(\textcolor{#FF5FA2}{n-2}) + \textcolor{#EAB308}{1}$, substitute into $(1)$:

$$
T(n) = [T(\textcolor{#FF5FA2}{n-2}) + \textcolor{#EAB308}{1}] + \textcolor{#EAB308}{1} = T(\textcolor{#FF5FA2}{n-2}) + \textcolor{#EAB308}{2} \qquad (2)
$$

Since $T(\textcolor{#FF5FA2}{n-2}) = T(\textcolor{#FF5FA2}{n-3}) + \textcolor{#EAB308}{1}$, substitute into $(2)$:

$$
T(n) = [T(\textcolor{#FF5FA2}{n-3}) + \textcolor{#EAB308}{1}] + \textcolor{#EAB308}{2} = T(\textcolor{#FF5FA2}{n-3}) + \textcolor{#EAB308}{3} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = T(\textcolor{#FF5FA2}{n-\textcolor{#A78BFA}{k}}) + \textcolor{#A78BFA}{k} \qquad (4)
$$

**Step 3: reach the base case.** $\textcolor{#2DD4BF}{T(0)}$ is known, so assume

$$
n - \textcolor{#A78BFA}{k} = 0 \quad\Rightarrow\quad \textcolor{#A78BFA}{k} = n
$$

Substituting $\textcolor{#A78BFA}{k} = n$ into $(4)$:

$$
T(n) = T(\textcolor{#FF5FA2}{n-n}) + \textcolor{#EAB308}{n} = \textcolor{#2DD4BF}{T(0)} + \textcolor{#EAB308}{n}
$$

**Step 4: sum.**

$$
T(n) = \textcolor{#2DD4BF}{1} + \textcolor{#EAB308}{n}
$$

:mark[**$\textcolor{#22C55E}{O(n)}$**]{hex="#204A2E"}

## Q2. $T(n) = T(n-1) + n$

**Step 1: expand.**

$$
T(n) = T(\textcolor{#FF5FA2}{n-1}) + \textcolor{#EAB308}{n} \qquad (1)
$$

Since $T(\textcolor{#FF5FA2}{n-1}) = T(\textcolor{#FF5FA2}{n-2}) + \textcolor{#EAB308}{(n-1)}$:

$$
T(n) = [T(\textcolor{#FF5FA2}{n-2}) + \textcolor{#EAB308}{(n-1)}] + \textcolor{#EAB308}{n} = T(\textcolor{#FF5FA2}{n-2}) + \textcolor{#EAB308}{(n-1)} + \textcolor{#EAB308}{n} \qquad (2)
$$

Since $T(\textcolor{#FF5FA2}{n-2}) = T(\textcolor{#FF5FA2}{n-3}) + \textcolor{#EAB308}{(n-2)}$:

$$
T(n) = [T(\textcolor{#FF5FA2}{n-3}) + \textcolor{#EAB308}{(n-2)}] + \textcolor{#EAB308}{(n-1)} + \textcolor{#EAB308}{n} = T(\textcolor{#FF5FA2}{n-3}) + \textcolor{#EAB308}{(n-2)} + \textcolor{#EAB308}{(n-1)} + \textcolor{#EAB308}{n} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = T(\textcolor{#FF5FA2}{n-\textcolor{#A78BFA}{k}}) + \textcolor{#EAB308}{(n-\textcolor{#A78BFA}{k}+1)} + \textcolor{#EAB308}{(n-\textcolor{#A78BFA}{k}+2)} + \dots + \textcolor{#EAB308}{(n-1)} + \textcolor{#EAB308}{n} \qquad (4)
$$

**Step 3: reach the base case.** $n - \textcolor{#A78BFA}{k} = 0 \Rightarrow \textcolor{#A78BFA}{k} = n$, so every $n - \textcolor{#A78BFA}{k}$ becomes $0$:

$$
T(n) = \textcolor{#2DD4BF}{T(0)} + \textcolor{#EAB308}{(n-n+1)} + \textcolor{#EAB308}{(n-n+2)} + \dots + \textcolor{#EAB308}{(n-1)} + \textcolor{#EAB308}{n}
$$

$$
T(n) = \textcolor{#2DD4BF}{T(0)} + \textcolor{#EAB308}{1} + \textcolor{#EAB308}{2} + \textcolor{#EAB308}{3} + \dots + \textcolor{#EAB308}{n}
$$

**Step 4: sum.** The tail is an arithmetic series:

$$
T(n) = \textcolor{#2DD4BF}{1} + \textcolor{#EAB308}{\frac{n(n+1)}{2}} = \textcolor{#EAB308}{\frac{n^2 + n + 2}{2}}
$$

:mark[**$\textcolor{#F97316}{O(n^2)}$**]{hex="#5C3A1A"}

## Q3. $T(n) = T(n-1) + \log n$

**Step 1: expand.**

$$
T(n) = T(\textcolor{#FF5FA2}{n-1}) + \textcolor{#EAB308}{\log n} \qquad (1)
$$

$$
T(n) = [T(\textcolor{#FF5FA2}{n-2}) + \textcolor{#EAB308}{\log(n-1)}] + \textcolor{#EAB308}{\log n} = T(\textcolor{#FF5FA2}{n-2}) + \textcolor{#EAB308}{\log(n-1)} + \textcolor{#EAB308}{\log n} \qquad (2)
$$

$$
T(n) = [T(\textcolor{#FF5FA2}{n-3}) + \textcolor{#EAB308}{\log(n-2)}] + \textcolor{#EAB308}{\log(n-1)} + \textcolor{#EAB308}{\log n} = T(\textcolor{#FF5FA2}{n-3}) + \textcolor{#EAB308}{\log(n-2)} + \textcolor{#EAB308}{\log(n-1)} + \textcolor{#EAB308}{\log n} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = T(\textcolor{#FF5FA2}{n-\textcolor{#A78BFA}{k}}) + \textcolor{#EAB308}{\log(n-\textcolor{#A78BFA}{k}+1)} + \dots + \textcolor{#EAB308}{\log(n-1)} + \textcolor{#EAB308}{\log n} \qquad (4)
$$

**Step 3: reach the base case.** $n - \textcolor{#A78BFA}{k} = 0 \Rightarrow \textcolor{#A78BFA}{k} = n$:

$$
T(n) = \textcolor{#2DD4BF}{T(0)} + \textcolor{#EAB308}{\log 1} + \textcolor{#EAB308}{\log 2} + \dots + \textcolor{#EAB308}{\log(n-1)} + \textcolor{#EAB308}{\log n}
$$

**Step 4: sum.** A sum of logs is the log of a product:

$$
T(n) = \textcolor{#2DD4BF}{1} + \textcolor{#EAB308}{\log[1 \times 2 \times \dots \times (n-1) \times n]} = \textcolor{#2DD4BF}{1} + \textcolor{#EAB308}{\log(n!)}
$$

Every one of the $n$ factors is at most $n$, so $\log(n!) \le n\log n$.

:mark[**$\textcolor{#EAB308}{O(n \log n)}$**]{hex="#565426"}

## Q4. $T(n) = T(n-1) + n^2$

**Step 1: expand.**

$$
T(n) = T(\textcolor{#FF5FA2}{n-1}) + \textcolor{#EAB308}{n^2} \qquad (1)
$$

$$
T(n) = [T(\textcolor{#FF5FA2}{n-2}) + \textcolor{#EAB308}{(n-1)^2}] + \textcolor{#EAB308}{n^2} = T(\textcolor{#FF5FA2}{n-2}) + \textcolor{#EAB308}{(n-1)^2} + \textcolor{#EAB308}{n^2} \qquad (2)
$$

$$
T(n) = T(\textcolor{#FF5FA2}{n-3}) + \textcolor{#EAB308}{(n-2)^2} + \textcolor{#EAB308}{(n-1)^2} + \textcolor{#EAB308}{n^2} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = T(\textcolor{#FF5FA2}{n-\textcolor{#A78BFA}{k}}) + \textcolor{#EAB308}{(n-\textcolor{#A78BFA}{k}+1)^2} + \dots + \textcolor{#EAB308}{(n-1)^2} + \textcolor{#EAB308}{n^2} \qquad (4)
$$

**Step 3: reach the base case.** $\textcolor{#A78BFA}{k} = n$:

$$
T(n) = \textcolor{#2DD4BF}{T(0)} + \textcolor{#EAB308}{1^2} + \textcolor{#EAB308}{2^2} + \dots + \textcolor{#EAB308}{n^2}
$$

**Step 4: sum.**

$$
T(n) = \textcolor{#2DD4BF}{1} + \textcolor{#EAB308}{\frac{n(n+1)(2n+1)}{6}}
$$

:mark[**$\textcolor{#EF4444}{O(n^3)}$**]{hex="#5C2323"}

## Q5. $T(n) = T(n-1) + c$, with $c$ a constant

**Step 1: expand.**

$$
T(n) = T(\textcolor{#FF5FA2}{n-1}) + \textcolor{#EAB308}{c} \qquad (1)
$$

$$
T(n) = [T(\textcolor{#FF5FA2}{n-2}) + \textcolor{#EAB308}{c}] + \textcolor{#EAB308}{c} = T(\textcolor{#FF5FA2}{n-2}) + \textcolor{#EAB308}{2c} \qquad (2)
$$

$$
T(n) = [T(\textcolor{#FF5FA2}{n-3}) + \textcolor{#EAB308}{c}] + \textcolor{#EAB308}{2c} = T(\textcolor{#FF5FA2}{n-3}) + \textcolor{#EAB308}{3c} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = T(\textcolor{#FF5FA2}{n-\textcolor{#A78BFA}{k}}) + \textcolor{#EAB308}{\textcolor{#A78BFA}{k}c} \qquad (4)
$$

**Step 3: reach the base case.** $\textcolor{#A78BFA}{k} = n$:

$$
T(n) = \textcolor{#2DD4BF}{T(0)} + \textcolor{#EAB308}{nc} = \textcolor{#2DD4BF}{1} + \textcolor{#EAB308}{cn}
$$

**Step 4: read it off.** A constant multiplier never changes the order.

:mark[**$\textcolor{#22C55E}{O(n)}$**]{hex="#204A2E"}

## Q6. $T(n) = T(n-1) + \sqrt{n}$

**Step 1: expand.**

$$
T(n) = T(\textcolor{#FF5FA2}{n-1}) + \textcolor{#EAB308}{\sqrt{n}} \qquad (1)
$$

$$
T(n) = T(\textcolor{#FF5FA2}{n-2}) + \textcolor{#EAB308}{\sqrt{n-1}} + \textcolor{#EAB308}{\sqrt{n}} \qquad (2)
$$

$$
T(n) = T(\textcolor{#FF5FA2}{n-3}) + \textcolor{#EAB308}{\sqrt{n-2}} + \textcolor{#EAB308}{\sqrt{n-1}} + \textcolor{#EAB308}{\sqrt{n}} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = T(\textcolor{#FF5FA2}{n-\textcolor{#A78BFA}{k}}) + \textcolor{#EAB308}{\sqrt{n-\textcolor{#A78BFA}{k}+1}} + \dots + \textcolor{#EAB308}{\sqrt{n-1}} + \textcolor{#EAB308}{\sqrt{n}} \qquad (4)
$$

**Step 3: reach the base case.** $\textcolor{#A78BFA}{k} = n$:

$$
T(n) = \textcolor{#2DD4BF}{T(0)} + \textcolor{#EAB308}{\sqrt{1}} + \textcolor{#EAB308}{\sqrt{2}} + \dots + \textcolor{#EAB308}{\sqrt{n}}
$$

**Step 4: sum.** There are $n$ terms and none is bigger than $\sqrt{n}$, so the sum is at most $n\sqrt{n}$. The exact value is $\approx \frac{2}{3}n^{3/2}$.

:mark[**$\textcolor{#2DD4BF}{O(n^{1.5})}$**]{hex="#1B4A46"}

## Q7. $T(n) = T(n-1) + \frac{1}{n}$

**Step 1: expand.**

$$
T(n) = T(\textcolor{#FF5FA2}{n-1}) + \textcolor{#EAB308}{\frac{1}{n}} \qquad (1)
$$

$$
T(n) = T(\textcolor{#FF5FA2}{n-2}) + \textcolor{#EAB308}{\frac{1}{n-1}} + \textcolor{#EAB308}{\frac{1}{n}} \qquad (2)
$$

$$
T(n) = T(\textcolor{#FF5FA2}{n-3}) + \textcolor{#EAB308}{\frac{1}{n-2}} + \textcolor{#EAB308}{\frac{1}{n-1}} + \textcolor{#EAB308}{\frac{1}{n}} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = T(\textcolor{#FF5FA2}{n-\textcolor{#A78BFA}{k}}) + \textcolor{#EAB308}{\frac{1}{n-\textcolor{#A78BFA}{k}+1}} + \dots + \textcolor{#EAB308}{\frac{1}{n-1}} + \textcolor{#EAB308}{\frac{1}{n}} \qquad (4)
$$

**Step 3: reach the base case.** $\textcolor{#A78BFA}{k} = n$:

$$
T(n) = \textcolor{#2DD4BF}{T(0)} + \textcolor{#EAB308}{\frac{1}{1}} + \textcolor{#EAB308}{\frac{1}{2}} + \textcolor{#EAB308}{\frac{1}{3}} + \dots + \textcolor{#EAB308}{\frac{1}{n}}
$$

**Step 4: sum.** That tail is the **harmonic series**, which sums to about $\ln n$.

:mark[**$\textcolor{#A78BFA}{O(\log n)}$**]{hex="#3B2A5E"} Worth seeing once: $n$ additions can still total only $\log n$ when each added term shrinks.

## Q8. $T(n) = T(n-1) + 2^n$

**Step 1: expand.**

$$
T(n) = T(\textcolor{#FF5FA2}{n-1}) + \textcolor{#EAB308}{2^n} \qquad (1)
$$

$$
T(n) = T(\textcolor{#FF5FA2}{n-2}) + \textcolor{#EAB308}{2^{n-1}} + \textcolor{#EAB308}{2^n} \qquad (2)
$$

$$
T(n) = T(\textcolor{#FF5FA2}{n-3}) + \textcolor{#EAB308}{2^{n-2}} + \textcolor{#EAB308}{2^{n-1}} + \textcolor{#EAB308}{2^n} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = T(\textcolor{#FF5FA2}{n-\textcolor{#A78BFA}{k}}) + \textcolor{#EAB308}{2^{n-\textcolor{#A78BFA}{k}+1}} + \dots + \textcolor{#EAB308}{2^{n-1}} + \textcolor{#EAB308}{2^n} \qquad (4)
$$

**Step 3: reach the base case.** $\textcolor{#A78BFA}{k} = n$:

$$
T(n) = \textcolor{#2DD4BF}{T(0)} + \textcolor{#EAB308}{2^1} + \textcolor{#EAB308}{2^2} + \dots + \textcolor{#EAB308}{2^n}
$$

**Step 4: sum.** Geometric with ratio 2:

$$
T(n) = \textcolor{#2DD4BF}{1} + \textcolor{#EAB308}{(2^{n+1} - 2)} = \textcolor{#EAB308}{2^{n+1} - 1}
$$

:mark[**$\textcolor{#EF4444}{O(2^n)}$**]{hex="#5C2323"}

## Q9. $T(n) = 2T(n-1) + 1$

**Step 1: expand.** Note the multiplier: the whole substituted expression gets doubled.

$$
T(n) = \textcolor{#5B8CFF}{2}T(\textcolor{#FF5FA2}{n-1}) + \textcolor{#EAB308}{1} \qquad (1)
$$

$$
T(n) = \textcolor{#5B8CFF}{2}[\textcolor{#5B8CFF}{2}T(\textcolor{#FF5FA2}{n-2}) + \textcolor{#EAB308}{1}] + \textcolor{#EAB308}{1} = \textcolor{#5B8CFF}{2^2} T(\textcolor{#FF5FA2}{n-2}) + \textcolor{#EAB308}{2} + \textcolor{#EAB308}{1} \qquad (2)
$$

$$
T(n) = \textcolor{#5B8CFF}{2^2}[\textcolor{#5B8CFF}{2}T(\textcolor{#FF5FA2}{n-3}) + \textcolor{#EAB308}{1}] + \textcolor{#EAB308}{2} + \textcolor{#EAB308}{1} = \textcolor{#5B8CFF}{2^3} T(\textcolor{#FF5FA2}{n-3}) + \textcolor{#EAB308}{2^2} + \textcolor{#EAB308}{2} + \textcolor{#EAB308}{1} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = \textcolor{#5B8CFF}{2^{\textcolor{#A78BFA}{k}}} T(\textcolor{#FF5FA2}{n-\textcolor{#A78BFA}{k}}) + \textcolor{#EAB308}{\left(2^{\textcolor{#A78BFA}{k}-1} + \dots + 2 + 1\right)} = \textcolor{#5B8CFF}{2^{\textcolor{#A78BFA}{k}}} T(\textcolor{#FF5FA2}{n-\textcolor{#A78BFA}{k}}) + \textcolor{#EAB308}{(2^{\textcolor{#A78BFA}{k}} - 1)} \qquad (4)
$$

**Step 3: reach the base case.** $\textcolor{#A78BFA}{k} = n$:

$$
T(n) = \textcolor{#5B8CFF}{2^n} \textcolor{#2DD4BF}{T(0)} + \textcolor{#EAB308}{2^n - 1}
$$

**Step 4: sum.**

$$
T(n) = \textcolor{#EAB308}{2^n} + \textcolor{#EAB308}{2^n - 1} = \textcolor{#EAB308}{2^{n+1} - 1}
$$

:mark[**$\textcolor{#EF4444}{O(2^n)}$**]{hex="#5C2323"} This is the Tower of Hanoi recurrence.

## Q10. $T(n) = 2T(n-1) + n$

**Step 1: expand.**

$$
T(n) = \textcolor{#5B8CFF}{2}T(\textcolor{#FF5FA2}{n-1}) + \textcolor{#EAB308}{n} \qquad (1)
$$

$$
T(n) = \textcolor{#5B8CFF}{2}[\textcolor{#5B8CFF}{2}T(\textcolor{#FF5FA2}{n-2}) + \textcolor{#EAB308}{(n-1)}] + \textcolor{#EAB308}{n} = \textcolor{#5B8CFF}{2^2} T(\textcolor{#FF5FA2}{n-2}) + \textcolor{#EAB308}{2(n-1)} + \textcolor{#EAB308}{n} \qquad (2)
$$

$$
T(n) = \textcolor{#5B8CFF}{2^2}[\textcolor{#5B8CFF}{2}T(\textcolor{#FF5FA2}{n-3}) + \textcolor{#EAB308}{(n-2)}] + \textcolor{#EAB308}{2(n-1)} + \textcolor{#EAB308}{n} = \textcolor{#5B8CFF}{2^3} T(\textcolor{#FF5FA2}{n-3}) + \textcolor{#EAB308}{2^2(n-2)} + \textcolor{#EAB308}{2(n-1)} + \textcolor{#EAB308}{n} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = \textcolor{#5B8CFF}{2^{\textcolor{#A78BFA}{k}}} T(\textcolor{#FF5FA2}{n-\textcolor{#A78BFA}{k}}) + \textcolor{#EAB308}{\sum_{i=0}^{\textcolor{#A78BFA}{k}-1} 2^i (n - i)} \qquad (4)
$$

**Step 3: reach the base case.** $\textcolor{#A78BFA}{k} = n$:

$$
T(n) = \textcolor{#5B8CFF}{2^n} \textcolor{#2DD4BF}{T(0)} + \textcolor{#EAB308}{\sum_{i=0}^{n-1} 2^i (n-i)}
$$

**Step 4: sum.** Split the sum:

$$
\sum_{i=0}^{n-1} 2^i(n-i) = n\sum_{i=0}^{n-1} 2^i - \sum_{i=0}^{n-1} i\,2^i = n(2^n - 1) - \left[(n-2)2^n + 2\right] = 2^{n+1} - n - 2
$$

$$
T(n) = \textcolor{#EAB308}{2^n} + \textcolor{#EAB308}{2^{n+1} - n - 2} = \textcolor{#EAB308}{3 \cdot 2^n - n - 2}
$$

:mark[**$\textcolor{#EF4444}{O(2^n)}$**]{hex="#5C2323"} Check it: $T(1) = 3$, $T(2) = 8$, $T(3) = 19$, which the formula reproduces.

## Q11. $T(n) = 3T(n-1) + 1$

**Step 1: expand.**

$$
T(n) = \textcolor{#5B8CFF}{3}T(\textcolor{#FF5FA2}{n-1}) + \textcolor{#EAB308}{1} \qquad (1)
$$

$$
T(n) = \textcolor{#5B8CFF}{3}[\textcolor{#5B8CFF}{3}T(\textcolor{#FF5FA2}{n-2}) + \textcolor{#EAB308}{1}] + \textcolor{#EAB308}{1} = \textcolor{#5B8CFF}{3^2} T(\textcolor{#FF5FA2}{n-2}) + \textcolor{#EAB308}{3} + \textcolor{#EAB308}{1} \qquad (2)
$$

$$
T(n) = \textcolor{#5B8CFF}{3^2}[\textcolor{#5B8CFF}{3}T(\textcolor{#FF5FA2}{n-3}) + \textcolor{#EAB308}{1}] + \textcolor{#EAB308}{3} + \textcolor{#EAB308}{1} = \textcolor{#5B8CFF}{3^3} T(\textcolor{#FF5FA2}{n-3}) + \textcolor{#EAB308}{3^2} + \textcolor{#EAB308}{3} + \textcolor{#EAB308}{1} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = \textcolor{#5B8CFF}{3^{\textcolor{#A78BFA}{k}}} T(\textcolor{#FF5FA2}{n-\textcolor{#A78BFA}{k}}) + \textcolor{#EAB308}{\left(3^{\textcolor{#A78BFA}{k}-1} + \dots + 3 + 1\right)} = \textcolor{#5B8CFF}{3^{\textcolor{#A78BFA}{k}}} T(\textcolor{#FF5FA2}{n-\textcolor{#A78BFA}{k}}) + \textcolor{#EAB308}{\frac{3^{\textcolor{#A78BFA}{k}} - 1}{2}} \qquad (4)
$$

**Step 3: reach the base case.** $\textcolor{#A78BFA}{k} = n$:

$$
T(n) = \textcolor{#5B8CFF}{3^n} \textcolor{#2DD4BF}{T(0)} + \textcolor{#EAB308}{\frac{3^n - 1}{2}}
$$

**Step 4: sum.**

$$
T(n) = \textcolor{#EAB308}{3^n} + \textcolor{#EAB308}{\frac{3^n - 1}{2}} = \textcolor{#EAB308}{\frac{3^{n+1} - 1}{2}}
$$

:mark[**$\textcolor{#EF4444}{O(3^n)}$**]{hex="#5C2323"} The number of recursive calls per level becomes the base of the exponential.

## Q12. $T(n) = T(n-2) + 1$

**Step 1: expand.** Each substitution now steps down by 2.

$$
T(n) = T(\textcolor{#FF5FA2}{n-2}) + \textcolor{#EAB308}{1} \qquad (1)
$$

$$
T(n) = [T(\textcolor{#FF5FA2}{n-4}) + \textcolor{#EAB308}{1}] + \textcolor{#EAB308}{1} = T(\textcolor{#FF5FA2}{n-4}) + \textcolor{#EAB308}{2} \qquad (2)
$$

$$
T(n) = [T(\textcolor{#FF5FA2}{n-6}) + \textcolor{#EAB308}{1}] + \textcolor{#EAB308}{2} = T(\textcolor{#FF5FA2}{n-6}) + \textcolor{#EAB308}{3} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = T(\textcolor{#FF5FA2}{n-2\textcolor{#A78BFA}{k}}) + \textcolor{#A78BFA}{k} \qquad (4)
$$

**Step 3: reach the base case.**

$$
n - 2\textcolor{#A78BFA}{k} = 0 \quad\Rightarrow\quad \textcolor{#A78BFA}{k} = \frac{n}{2}
$$

$$
T(n) = \textcolor{#2DD4BF}{T(0)} + \textcolor{#EAB308}{\frac{n}{2}}
$$

**Step 4: sum.**

$$
T(n) = \textcolor{#2DD4BF}{1} + \textcolor{#EAB308}{\frac{n}{2}}
$$

:mark[**$\textcolor{#22C55E}{O(n)}$**]{hex="#204A2E"} Stepping down by 2 halves the work, and a half is a constant factor.

## Q13. $T(n) = T(n-2) + n$

**Step 1: expand.**

$$
T(n) = T(\textcolor{#FF5FA2}{n-2}) + \textcolor{#EAB308}{n} \qquad (1)
$$

$$
T(n) = [T(\textcolor{#FF5FA2}{n-4}) + \textcolor{#EAB308}{(n-2)}] + \textcolor{#EAB308}{n} = T(\textcolor{#FF5FA2}{n-4}) + \textcolor{#EAB308}{(n-2)} + \textcolor{#EAB308}{n} \qquad (2)
$$

$$
T(n) = [T(\textcolor{#FF5FA2}{n-6}) + \textcolor{#EAB308}{(n-4)}] + \textcolor{#EAB308}{(n-2)} + \textcolor{#EAB308}{n} = T(\textcolor{#FF5FA2}{n-6}) + \textcolor{#EAB308}{(n-4)} + \textcolor{#EAB308}{(n-2)} + \textcolor{#EAB308}{n} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = T(\textcolor{#FF5FA2}{n-2\textcolor{#A78BFA}{k}}) + \textcolor{#EAB308}{(n-2\textcolor{#A78BFA}{k}+2)} + \dots + \textcolor{#EAB308}{(n-2)} + \textcolor{#EAB308}{n} \qquad (4)
$$

**Step 3: reach the base case.** $n - 2\textcolor{#A78BFA}{k} = 0 \Rightarrow \textcolor{#A78BFA}{k} = \frac{n}{2}$ (take $n$ even):

$$
T(n) = \textcolor{#2DD4BF}{T(0)} + \textcolor{#EAB308}{2} + \textcolor{#EAB308}{4} + \textcolor{#EAB308}{6} + \dots + \textcolor{#EAB308}{n}
$$

**Step 4: sum.** Factor out the 2:

$$
T(n) = \textcolor{#2DD4BF}{1} + \textcolor{#EAB308}{2\left(1 + 2 + \dots + \frac{n}{2}\right)} = \textcolor{#2DD4BF}{1} + \textcolor{#EAB308}{2 \cdot \frac{\frac{n}{2}\left(\frac{n}{2}+1\right)}{2}} = \textcolor{#2DD4BF}{1} + \textcolor{#EAB308}{\frac{n}{2}\left(\frac{n}{2}+1\right) \approx \frac{n^2}{4}}
$$

:mark[**$\textcolor{#F97316}{O(n^2)}$**]{hex="#5C3A1A"}

---

# Part B: dividing recurrences

Base case $\textcolor{#2DD4BF}{T(1)} = \textcolor{#2DD4BF}{1}$ throughout this part.

## Q14. $T(n) = T(n/2) + 1$

$$
T(n) = \begin{cases} \textcolor{#2DD4BF}{1} & n = 1 \\ T(\textcolor{#FF5FA2}{n/2}) + \textcolor{#EAB308}{1} & n > 1 \end{cases}
$$

**Step 1: expand.**

$$
T(n) = T\left(\textcolor{#FF5FA2}{\frac{n}{2}}\right) + \textcolor{#EAB308}{1} \qquad (1)
$$

Since $T(\textcolor{#FF5FA2}{n/2}) = T(\textcolor{#FF5FA2}{n/4}) + \textcolor{#EAB308}{1}$:

$$
T(n) = \left[T\left(\textcolor{#FF5FA2}{\frac{n}{4}}\right) + \textcolor{#EAB308}{1}\right] + \textcolor{#EAB308}{1} = T\left(\textcolor{#FF5FA2}{\frac{n}{2^2}}\right) + \textcolor{#EAB308}{2} \qquad (2)
$$

Since $T(\textcolor{#FF5FA2}{n/4}) = T(\textcolor{#FF5FA2}{n/8}) + \textcolor{#EAB308}{1}$:

$$
T(n) = \left[T\left(\textcolor{#FF5FA2}{\frac{n}{8}}\right) + \textcolor{#EAB308}{1}\right] + \textcolor{#EAB308}{2} = T\left(\textcolor{#FF5FA2}{\frac{n}{2^3}}\right) + \textcolor{#EAB308}{3} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = T\left(\textcolor{#FF5FA2}{\frac{n}{2^{\textcolor{#A78BFA}{k}}}}\right) + \textcolor{#A78BFA}{k} \qquad (4)
$$

**Step 3: reach the base case.** $\textcolor{#2DD4BF}{T(1)}$ is known, so assume

$$
\frac{n}{2^{\textcolor{#A78BFA}{k}}} = 1 \quad\Rightarrow\quad n = 2^{\textcolor{#A78BFA}{k}} \quad\Rightarrow\quad \textcolor{#A78BFA}{k} = \log_2 n
$$

$$
T(n) = \textcolor{#2DD4BF}{T(1)} + \textcolor{#EAB308}{\log_2 n}
$$

**Step 4: sum.**

$$
T(n) = \textcolor{#2DD4BF}{1} + \textcolor{#EAB308}{\log_2 n}
$$

:mark[**$\textcolor{#A78BFA}{O(\log n)}$**]{hex="#3B2A5E"} This is binary search.

## Q15. $T(n) = T(n/2) + n$

**Step 1: expand.**

$$
T(n) = T\left(\textcolor{#FF5FA2}{\frac{n}{2}}\right) + \textcolor{#EAB308}{n} \qquad (1)
$$

$$
T(n) = \left[T\left(\textcolor{#FF5FA2}{\frac{n}{4}}\right) + \textcolor{#EAB308}{\frac{n}{2}}\right] + \textcolor{#EAB308}{n} = T\left(\textcolor{#FF5FA2}{\frac{n}{2^2}}\right) + \textcolor{#EAB308}{\frac{n}{2}} + \textcolor{#EAB308}{n} \qquad (2)
$$

$$
T(n) = \left[T\left(\textcolor{#FF5FA2}{\frac{n}{8}}\right) + \textcolor{#EAB308}{\frac{n}{4}}\right] + \textcolor{#EAB308}{\frac{n}{2}} + \textcolor{#EAB308}{n} = T\left(\textcolor{#FF5FA2}{\frac{n}{2^3}}\right) + \textcolor{#EAB308}{\frac{n}{4}} + \textcolor{#EAB308}{\frac{n}{2}} + \textcolor{#EAB308}{n} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = T\left(\textcolor{#FF5FA2}{\frac{n}{2^{\textcolor{#A78BFA}{k}}}}\right) + \textcolor{#EAB308}{\frac{n}{2^{\textcolor{#A78BFA}{k}-1}}} + \dots + \textcolor{#EAB308}{\frac{n}{2}} + \textcolor{#EAB308}{n} \qquad (4)
$$

**Step 3: reach the base case.** $\frac{n}{2^{\textcolor{#A78BFA}{k}}} = 1 \Rightarrow \textcolor{#A78BFA}{k} = \log_2 n$:

$$
T(n) = \textcolor{#2DD4BF}{T(1)} + \textcolor{#EAB308}{n\left(1 + \frac12 + \frac14 + \dots + \frac{1}{2^{\log_2 n - 1}}\right)}
$$

**Step 4: sum.** Decreasing geometric, ratio $\frac12$, so the sum is under 2:

$$
T(n) < 1 + 2n
$$

:mark[**$\textcolor{#22C55E}{O(n)}$**]{hex="#204A2E"} The very first term, $n$, decides the whole thing.

## Q16. $T(n) = 2T(n/2) + 1$

**Step 1: expand.**

$$
T(n) = \textcolor{#5B8CFF}{2}T\left(\textcolor{#FF5FA2}{\frac{n}{2}}\right) + \textcolor{#EAB308}{1} \qquad (1)
$$

$$
T(n) = \textcolor{#5B8CFF}{2}\left[\textcolor{#5B8CFF}{2}T\left(\textcolor{#FF5FA2}{\frac{n}{4}}\right) + \textcolor{#EAB308}{1}\right] + \textcolor{#EAB308}{1} = \textcolor{#5B8CFF}{2^2} T\left(\textcolor{#FF5FA2}{\frac{n}{2^2}}\right) + \textcolor{#EAB308}{2} + \textcolor{#EAB308}{1} \qquad (2)
$$

$$
T(n) = \textcolor{#5B8CFF}{2^2}\left[\textcolor{#5B8CFF}{2}T\left(\textcolor{#FF5FA2}{\frac{n}{8}}\right) + \textcolor{#EAB308}{1}\right] + \textcolor{#EAB308}{2} + \textcolor{#EAB308}{1} = \textcolor{#5B8CFF}{2^3} T\left(\textcolor{#FF5FA2}{\frac{n}{2^3}}\right) + \textcolor{#EAB308}{2^2} + \textcolor{#EAB308}{2} + \textcolor{#EAB308}{1} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = \textcolor{#5B8CFF}{2^{\textcolor{#A78BFA}{k}}} T\left(\textcolor{#FF5FA2}{\frac{n}{2^{\textcolor{#A78BFA}{k}}}}\right) + \textcolor{#EAB308}{\left(2^{\textcolor{#A78BFA}{k}-1} + \dots + 2 + 1\right)} = \textcolor{#5B8CFF}{2^{\textcolor{#A78BFA}{k}}} T\left(\textcolor{#FF5FA2}{\frac{n}{2^{\textcolor{#A78BFA}{k}}}}\right) + \textcolor{#EAB308}{(2^{\textcolor{#A78BFA}{k}} - 1)} \qquad (4)
$$

**Step 3: reach the base case.** $\frac{n}{2^{\textcolor{#A78BFA}{k}}} = 1 \Rightarrow \textcolor{#A78BFA}{k} = \log_2 n$, and therefore $2^{\textcolor{#A78BFA}{k}} = n$:

$$
T(n) = \textcolor{#5B8CFF}{n}\,\textcolor{#2DD4BF}{T(1)} + \textcolor{#EAB308}{(n - 1)}
$$

**Step 4: sum.**

$$
T(n) = \textcolor{#EAB308}{n} + \textcolor{#EAB308}{n - 1} = \textcolor{#EAB308}{2n - 1}
$$

:mark[**$\textcolor{#22C55E}{O(n)}$**]{hex="#204A2E"} There are $n$ base-case calls and each costs 1, so the leaves decide it.

## Q17. $T(n) = 2T(n/2) + n$

**Step 1: expand.**

$$
T(n) = \textcolor{#5B8CFF}{2}T\left(\textcolor{#FF5FA2}{\frac{n}{2}}\right) + \textcolor{#EAB308}{n} \qquad (1)
$$

$$
T(n) = \textcolor{#5B8CFF}{2}\left[\textcolor{#5B8CFF}{2}T\left(\textcolor{#FF5FA2}{\frac{n}{4}}\right) + \textcolor{#EAB308}{\frac{n}{2}}\right] + \textcolor{#EAB308}{n} = \textcolor{#5B8CFF}{2^2} T\left(\textcolor{#FF5FA2}{\frac{n}{2^2}}\right) + \textcolor{#EAB308}{n} + \textcolor{#EAB308}{n} \qquad (2)
$$

$$
T(n) = \textcolor{#5B8CFF}{2^2}\left[\textcolor{#5B8CFF}{2}T\left(\textcolor{#FF5FA2}{\frac{n}{8}}\right) + \textcolor{#EAB308}{\frac{n}{4}}\right] + \textcolor{#EAB308}{2n} = \textcolor{#5B8CFF}{2^3} T\left(\textcolor{#FF5FA2}{\frac{n}{2^3}}\right) + \textcolor{#EAB308}{n} + \textcolor{#EAB308}{n} + \textcolor{#EAB308}{n} \qquad (3)
$$

Notice each substitution adds exactly $n$: the $2^i$ multiplier cancels the $\frac{n}{2^i}$ term.

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = \textcolor{#5B8CFF}{2^{\textcolor{#A78BFA}{k}}} T\left(\textcolor{#FF5FA2}{\frac{n}{2^{\textcolor{#A78BFA}{k}}}}\right) + \textcolor{#EAB308}{\textcolor{#A78BFA}{k}n} \qquad (4)
$$

**Step 3: reach the base case.** $\frac{n}{2^{\textcolor{#A78BFA}{k}}} = 1 \Rightarrow \textcolor{#A78BFA}{k} = \log_2 n$, $2^{\textcolor{#A78BFA}{k}} = n$:

$$
T(n) = \textcolor{#5B8CFF}{n}\,\textcolor{#2DD4BF}{T(1)} + \textcolor{#EAB308}{n\log_2 n}
$$

**Step 4: sum.**

$$
T(n) = \textcolor{#EAB308}{n} + \textcolor{#EAB308}{n\log_2 n}
$$

:mark[**$\textcolor{#EAB308}{O(n \log n)}$**]{hex="#565426"} This is merge sort.

## Q18. $T(n) = 2T(n/2) + n^2$

**Step 1: expand.**

$$
T(n) = \textcolor{#5B8CFF}{2}T\left(\textcolor{#FF5FA2}{\frac{n}{2}}\right) + \textcolor{#EAB308}{n^2} \qquad (1)
$$

$$
T(n) = \textcolor{#5B8CFF}{2}\left[\textcolor{#5B8CFF}{2}T\left(\textcolor{#FF5FA2}{\frac{n}{4}}\right) + \textcolor{#EAB308}{\frac{n^2}{4}}\right] + \textcolor{#EAB308}{n^2} = \textcolor{#5B8CFF}{2^2} T\left(\textcolor{#FF5FA2}{\frac{n}{2^2}}\right) + \textcolor{#EAB308}{\frac{n^2}{2}} + \textcolor{#EAB308}{n^2} \qquad (2)
$$

$$
T(n) = \textcolor{#5B8CFF}{2^3} T\left(\textcolor{#FF5FA2}{\frac{n}{2^3}}\right) + \textcolor{#EAB308}{\frac{n^2}{4}} + \textcolor{#EAB308}{\frac{n^2}{2}} + \textcolor{#EAB308}{n^2} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = \textcolor{#5B8CFF}{2^{\textcolor{#A78BFA}{k}}} T\left(\textcolor{#FF5FA2}{\frac{n}{2^{\textcolor{#A78BFA}{k}}}}\right) + \textcolor{#EAB308}{n^2\left(1 + \frac12 + \dots + \frac{1}{2^{\textcolor{#A78BFA}{k}-1}}\right)} \qquad (4)
$$

**Step 3: reach the base case.** $\textcolor{#A78BFA}{k} = \log_2 n$, $2^{\textcolor{#A78BFA}{k}} = n$:

$$
T(n) = \textcolor{#5B8CFF}{n}\,\textcolor{#2DD4BF}{T(1)} + \textcolor{#EAB308}{n^2\left(1 + \frac12 + \frac14 + \dots\right)}
$$

**Step 4: sum.** The bracket is under 2:

$$
T(n) < n + 2n^2
$$

:mark[**$\textcolor{#F97316}{O(n^2)}$**]{hex="#5C3A1A"} The top level alone dominates.

## Q19. $T(n) = 4T(n/2) + n$

**Step 1: expand.**

$$
T(n) = \textcolor{#5B8CFF}{4}T\left(\textcolor{#FF5FA2}{\frac{n}{2}}\right) + \textcolor{#EAB308}{n} \qquad (1)
$$

$$
T(n) = \textcolor{#5B8CFF}{4}\left[\textcolor{#5B8CFF}{4}T\left(\textcolor{#FF5FA2}{\frac{n}{4}}\right) + \textcolor{#EAB308}{\frac{n}{2}}\right] + \textcolor{#EAB308}{n} = \textcolor{#5B8CFF}{4^2} T\left(\textcolor{#FF5FA2}{\frac{n}{2^2}}\right) + \textcolor{#EAB308}{2n} + \textcolor{#EAB308}{n} \qquad (2)
$$

$$
T(n) = \textcolor{#5B8CFF}{4^2}\left[\textcolor{#5B8CFF}{4}T\left(\textcolor{#FF5FA2}{\frac{n}{8}}\right) + \textcolor{#EAB308}{\frac{n}{4}}\right] + \textcolor{#EAB308}{2n} + \textcolor{#EAB308}{n} = \textcolor{#5B8CFF}{4^3} T\left(\textcolor{#FF5FA2}{\frac{n}{2^3}}\right) + \textcolor{#EAB308}{4n} + \textcolor{#EAB308}{2n} + \textcolor{#EAB308}{n} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = \textcolor{#5B8CFF}{4^{\textcolor{#A78BFA}{k}}} T\left(\textcolor{#FF5FA2}{\frac{n}{2^{\textcolor{#A78BFA}{k}}}}\right) + \textcolor{#EAB308}{n\left(2^{\textcolor{#A78BFA}{k}-1} + \dots + 2 + 1\right)} = \textcolor{#5B8CFF}{4^{\textcolor{#A78BFA}{k}}} T\left(\textcolor{#FF5FA2}{\frac{n}{2^{\textcolor{#A78BFA}{k}}}}\right) + \textcolor{#EAB308}{n(2^{\textcolor{#A78BFA}{k}} - 1)} \qquad (4)
$$

**Step 3: reach the base case.** $\textcolor{#A78BFA}{k} = \log_2 n$, so $2^{\textcolor{#A78BFA}{k}} = n$ and $4^{\textcolor{#A78BFA}{k}} = 4^{\log_2 n} = n^{\log_2 4} = n^2$:

$$
T(n) = \textcolor{#5B8CFF}{n^2} \textcolor{#2DD4BF}{T(1)} + \textcolor{#EAB308}{n(n-1)}
$$

**Step 4: sum.**

$$
T(n) = \textcolor{#EAB308}{n^2} + \textcolor{#EAB308}{n^2 - n} = \textcolor{#EAB308}{2n^2 - n}
$$

:mark[**$\textcolor{#F97316}{O(n^2)}$**]{hex="#5C3A1A"} The added terms grow towards the base case, so the deepest level dominates.

## Q20. $T(n) = 4T(n/2) + n^2$

**Step 1: expand.**

$$
T(n) = \textcolor{#5B8CFF}{4}T\left(\textcolor{#FF5FA2}{\frac{n}{2}}\right) + \textcolor{#EAB308}{n^2} \qquad (1)
$$

$$
T(n) = \textcolor{#5B8CFF}{4}\left[\textcolor{#5B8CFF}{4}T\left(\textcolor{#FF5FA2}{\frac{n}{4}}\right) + \textcolor{#EAB308}{\frac{n^2}{4}}\right] + \textcolor{#EAB308}{n^2} = \textcolor{#5B8CFF}{4^2} T\left(\textcolor{#FF5FA2}{\frac{n}{2^2}}\right) + \textcolor{#EAB308}{n^2} + \textcolor{#EAB308}{n^2} \qquad (2)
$$

$$
T(n) = \textcolor{#5B8CFF}{4^3} T\left(\textcolor{#FF5FA2}{\frac{n}{2^3}}\right) + \textcolor{#EAB308}{n^2} + \textcolor{#EAB308}{n^2} + \textcolor{#EAB308}{n^2} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = \textcolor{#5B8CFF}{4^{\textcolor{#A78BFA}{k}}} T\left(\textcolor{#FF5FA2}{\frac{n}{2^{\textcolor{#A78BFA}{k}}}}\right) + \textcolor{#EAB308}{\textcolor{#A78BFA}{k} n^2} \qquad (4)
$$

**Step 3: reach the base case.** $\textcolor{#A78BFA}{k} = \log_2 n$, $4^{\textcolor{#A78BFA}{k}} = n^2$:

$$
T(n) = \textcolor{#5B8CFF}{n^2} \textcolor{#2DD4BF}{T(1)} + \textcolor{#EAB308}{n^2 \log_2 n}
$$

**Step 4: sum.**

$$
T(n) = \textcolor{#EAB308}{n^2} + \textcolor{#EAB308}{n^2\log_2 n}
$$

:mark[**$\textcolor{#F97316}{O(n^2 \log n)}$**]{hex="#5C3A1A"} Every substitution contributed the same $n^2$, so multiply by the number of substitutions.

## Q21. $T(n) = 3T(n/2) + n$

**Step 1: expand.**

$$
T(n) = \textcolor{#5B8CFF}{3}T\left(\textcolor{#FF5FA2}{\frac{n}{2}}\right) + \textcolor{#EAB308}{n} \qquad (1)
$$

$$
T(n) = \textcolor{#5B8CFF}{3}\left[\textcolor{#5B8CFF}{3}T\left(\textcolor{#FF5FA2}{\frac{n}{4}}\right) + \textcolor{#EAB308}{\frac{n}{2}}\right] + \textcolor{#EAB308}{n} = \textcolor{#5B8CFF}{3^2} T\left(\textcolor{#FF5FA2}{\frac{n}{2^2}}\right) + \textcolor{#EAB308}{\frac{3}{2}n} + \textcolor{#EAB308}{n} \qquad (2)
$$

$$
T(n) = \textcolor{#5B8CFF}{3^3} T\left(\textcolor{#FF5FA2}{\frac{n}{2^3}}\right) + \textcolor{#EAB308}{\frac{9}{4}n} + \textcolor{#EAB308}{\frac{3}{2}n} + \textcolor{#EAB308}{n} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = \textcolor{#5B8CFF}{3^{\textcolor{#A78BFA}{k}}} T\left(\textcolor{#FF5FA2}{\frac{n}{2^{\textcolor{#A78BFA}{k}}}}\right) + \textcolor{#EAB308}{n\sum_{i=0}^{\textcolor{#A78BFA}{k}-1}\left(\frac{3}{2}\right)^i} \qquad (4)
$$

**Step 3: reach the base case.** $\textcolor{#A78BFA}{k} = \log_2 n$, and

$$
3^{\textcolor{#A78BFA}{k}} = 3^{\log_2 n} = n^{\log_2 3} = n^{1.585}
$$

**Step 4: sum.** The series has ratio $\frac32 > 1$, so its last term rules:

$$
n\sum_{i=0}^{\textcolor{#A78BFA}{k}-1}\left(\frac32\right)^i = 2n\left[\left(\frac32\right)^{\textcolor{#A78BFA}{k}} - 1\right] = 2n\left(n^{0.585} - 1\right) = 2n^{1.585} - 2n
$$

$$
T(n) = \textcolor{#EAB308}{n^{1.585}} + \textcolor{#EAB308}{2n^{1.585} - 2n} = \textcolor{#EAB308}{3n^{1.585} - 2n}
$$

:mark[**$\textcolor{#F97316}{O(n^{\log_2 3}) = O(n^{1.585})}$**]{hex="#5C3A1A"} Karatsuba multiplication, which is why it beats the schoolbook $\textcolor{#F97316}{O(n^2)}$ method.

## Q22. $T(n) = T(n/3) + 1$

**Step 1: expand.**

$$
T(n) = T\left(\textcolor{#FF5FA2}{\frac{n}{3}}\right) + \textcolor{#EAB308}{1} \qquad (1)
$$

$$
T(n) = \left[T\left(\textcolor{#FF5FA2}{\frac{n}{9}}\right) + \textcolor{#EAB308}{1}\right] + \textcolor{#EAB308}{1} = T\left(\textcolor{#FF5FA2}{\frac{n}{3^2}}\right) + \textcolor{#EAB308}{2} \qquad (2)
$$

$$
T(n) = T\left(\textcolor{#FF5FA2}{\frac{n}{3^3}}\right) + \textcolor{#EAB308}{3} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = T\left(\textcolor{#FF5FA2}{\frac{n}{3^{\textcolor{#A78BFA}{k}}}}\right) + \textcolor{#A78BFA}{k} \qquad (4)
$$

**Step 3: reach the base case.**

$$
\frac{n}{3^{\textcolor{#A78BFA}{k}}} = 1 \quad\Rightarrow\quad n = 3^{\textcolor{#A78BFA}{k}} \quad\Rightarrow\quad \textcolor{#A78BFA}{k} = \log_3 n
$$

**Step 4: sum.**

$$
T(n) = \textcolor{#2DD4BF}{T(1)} + \textcolor{#EAB308}{\log_3 n} = \textcolor{#2DD4BF}{1} + \textcolor{#EAB308}{\log_3 n}
$$

:mark[**$\textcolor{#A78BFA}{O(\log n)}$**]{hex="#3B2A5E"} The base of the log is a constant factor, so $\log_3 n$ and $\log_2 n$ are the same order.

## Q23. $T(n) = 2T(n/3) + n$

**Step 1: expand.**

$$
T(n) = \textcolor{#5B8CFF}{2}T\left(\textcolor{#FF5FA2}{\frac{n}{3}}\right) + \textcolor{#EAB308}{n} \qquad (1)
$$

$$
T(n) = \textcolor{#5B8CFF}{2}\left[\textcolor{#5B8CFF}{2}T\left(\textcolor{#FF5FA2}{\frac{n}{9}}\right) + \textcolor{#EAB308}{\frac{n}{3}}\right] + \textcolor{#EAB308}{n} = \textcolor{#5B8CFF}{2^2} T\left(\textcolor{#FF5FA2}{\frac{n}{3^2}}\right) + \textcolor{#EAB308}{\frac{2}{3}n} + \textcolor{#EAB308}{n} \qquad (2)
$$

$$
T(n) = \textcolor{#5B8CFF}{2^3} T\left(\textcolor{#FF5FA2}{\frac{n}{3^3}}\right) + \textcolor{#EAB308}{\frac{4}{9}n} + \textcolor{#EAB308}{\frac{2}{3}n} + \textcolor{#EAB308}{n} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = \textcolor{#5B8CFF}{2^{\textcolor{#A78BFA}{k}}} T\left(\textcolor{#FF5FA2}{\frac{n}{3^{\textcolor{#A78BFA}{k}}}}\right) + \textcolor{#EAB308}{n\sum_{i=0}^{\textcolor{#A78BFA}{k}-1}\left(\frac{2}{3}\right)^i} \qquad (4)
$$

**Step 3: reach the base case.** $\frac{n}{3^{\textcolor{#A78BFA}{k}}} = 1 \Rightarrow \textcolor{#A78BFA}{k} = \log_3 n$, and $2^{\textcolor{#A78BFA}{k}} = 2^{\log_3 n} = n^{\log_3 2} = n^{0.63}$:

$$
T(n) = \textcolor{#5B8CFF}{n^{0.63}}\textcolor{#2DD4BF}{T(1)} + \textcolor{#EAB308}{n\sum_{i=0}^{\textcolor{#A78BFA}{k}-1}\left(\frac23\right)^i}
$$

**Step 4: sum.** Ratio $\frac23 < 1$, so the series is at most $\frac{1}{1 - 2/3} = 3$:

$$
T(n) < n^{0.63} + 3n
$$

:mark[**$\textcolor{#22C55E}{O(n)}$**]{hex="#204A2E"}

## Q24. $T(n) = T(n/2) + \log n$

**Step 1: expand.**

$$
T(n) = T\left(\textcolor{#FF5FA2}{\frac{n}{2}}\right) + \textcolor{#EAB308}{\log n} \qquad (1)
$$

$$
T(n) = \left[T\left(\textcolor{#FF5FA2}{\frac{n}{4}}\right) + \textcolor{#EAB308}{\log\frac{n}{2}}\right] + \textcolor{#EAB308}{\log n} = T\left(\textcolor{#FF5FA2}{\frac{n}{2^2}}\right) + \textcolor{#EAB308}{\log\frac{n}{2}} + \textcolor{#EAB308}{\log n} \qquad (2)
$$

$$
T(n) = T\left(\textcolor{#FF5FA2}{\frac{n}{2^3}}\right) + \textcolor{#EAB308}{\log\frac{n}{4}} + \textcolor{#EAB308}{\log\frac{n}{2}} + \textcolor{#EAB308}{\log n} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = T\left(\textcolor{#FF5FA2}{\frac{n}{2^{\textcolor{#A78BFA}{k}}}}\right) + \textcolor{#EAB308}{\log\frac{n}{2^{\textcolor{#A78BFA}{k}-1}}} + \dots + \textcolor{#EAB308}{\log\frac{n}{2}} + \textcolor{#EAB308}{\log n} \qquad (4)
$$

**Step 3: reach the base case.** $\textcolor{#A78BFA}{k} = \log_2 n$. Using $\log\frac{n}{2^i} = \log n - i$:

$$
T(n) = \textcolor{#2DD4BF}{T(1)} + \textcolor{#EAB308}{\left[\log n + (\log n - 1) + (\log n - 2) + \dots + 1\right]}
$$

**Step 4: sum.** That is an arithmetic series with $\log n$ terms:

$$
T(n) = \textcolor{#2DD4BF}{1} + \textcolor{#EAB308}{\frac{\log n(\log n + 1)}{2}}
$$

:mark[**$\textcolor{#A78BFA}{O(\log^2 n)}$**]{hex="#3B2A5E"}

## Q25. $T(n) = 8T(n/2) + n^3$

**Step 1: expand.**

$$
T(n) = \textcolor{#5B8CFF}{8}T\left(\textcolor{#FF5FA2}{\frac{n}{2}}\right) + \textcolor{#EAB308}{n^3} \qquad (1)
$$

$$
T(n) = \textcolor{#5B8CFF}{8}\left[\textcolor{#5B8CFF}{8}T\left(\textcolor{#FF5FA2}{\frac{n}{4}}\right) + \textcolor{#EAB308}{\frac{n^3}{8}}\right] + \textcolor{#EAB308}{n^3} = \textcolor{#5B8CFF}{8^2} T\left(\textcolor{#FF5FA2}{\frac{n}{2^2}}\right) + \textcolor{#EAB308}{n^3} + \textcolor{#EAB308}{n^3} \qquad (2)
$$

$$
T(n) = \textcolor{#5B8CFF}{8^3} T\left(\textcolor{#FF5FA2}{\frac{n}{2^3}}\right) + \textcolor{#EAB308}{n^3} + \textcolor{#EAB308}{n^3} + \textcolor{#EAB308}{n^3} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = \textcolor{#5B8CFF}{8^{\textcolor{#A78BFA}{k}}} T\left(\textcolor{#FF5FA2}{\frac{n}{2^{\textcolor{#A78BFA}{k}}}}\right) + \textcolor{#EAB308}{\textcolor{#A78BFA}{k} n^3} \qquad (4)
$$

**Step 3: reach the base case.** $\textcolor{#A78BFA}{k} = \log_2 n$, and $8^{\textcolor{#A78BFA}{k}} = 8^{\log_2 n} = n^{\log_2 8} = n^3$:

$$
T(n) = \textcolor{#5B8CFF}{n^3} \textcolor{#2DD4BF}{T(1)} + \textcolor{#EAB308}{n^3 \log_2 n}
$$

**Step 4: sum.**

$$
T(n) = \textcolor{#EAB308}{n^3} + \textcolor{#EAB308}{n^3\log_2 n}
$$

:mark[**$\textcolor{#EF4444}{O(n^3 \log n)}$**]{hex="#5C2323"} Naive recursive matrix multiplication.

## Q26. $T(n) = 7T(n/2) + n^2$

**Step 1: expand.**

$$
T(n) = \textcolor{#5B8CFF}{7}T\left(\textcolor{#FF5FA2}{\frac{n}{2}}\right) + \textcolor{#EAB308}{n^2} \qquad (1)
$$

$$
T(n) = \textcolor{#5B8CFF}{7}\left[\textcolor{#5B8CFF}{7}T\left(\textcolor{#FF5FA2}{\frac{n}{4}}\right) + \textcolor{#EAB308}{\frac{n^2}{4}}\right] + \textcolor{#EAB308}{n^2} = \textcolor{#5B8CFF}{7^2} T\left(\textcolor{#FF5FA2}{\frac{n}{2^2}}\right) + \textcolor{#EAB308}{\frac{7}{4}n^2} + \textcolor{#EAB308}{n^2} \qquad (2)
$$

$$
T(n) = \textcolor{#5B8CFF}{7^3} T\left(\textcolor{#FF5FA2}{\frac{n}{2^3}}\right) + \textcolor{#EAB308}{\frac{49}{16}n^2} + \textcolor{#EAB308}{\frac{7}{4}n^2} + \textcolor{#EAB308}{n^2} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = \textcolor{#5B8CFF}{7^{\textcolor{#A78BFA}{k}}} T\left(\textcolor{#FF5FA2}{\frac{n}{2^{\textcolor{#A78BFA}{k}}}}\right) + \textcolor{#EAB308}{n^2\sum_{i=0}^{\textcolor{#A78BFA}{k}-1}\left(\frac{7}{4}\right)^i} \qquad (4)
$$

**Step 3: reach the base case.** $\textcolor{#A78BFA}{k} = \log_2 n$, and

$$
7^{\textcolor{#A78BFA}{k}} = 7^{\log_2 n} = n^{\log_2 7} = n^{2.807}
$$

**Step 4: sum.** Ratio $\frac74 > 1$, so the last term rules, and $\left(\frac74\right)^{\log_2 n} = n^{\log_2 (7/4)} = n^{0.807}$:

$$
n^2 \sum_{i=0}^{\textcolor{#A78BFA}{k}-1}\left(\frac74\right)^i = \frac{4}{3}n^2\left(n^{0.807} - 1\right) = \frac43 n^{2.807} - \frac43 n^2
$$

$$
T(n) = \textcolor{#EAB308}{n^{2.807}} + \textcolor{#EAB308}{\frac43 n^{2.807} - \frac43 n^2}
$$

:mark[**$\textcolor{#EF4444}{O(n^{\log_2 7}) = O(n^{2.807})}$**]{hex="#5C2323"} Strassen's matrix multiplication, faster than the $\textcolor{#EF4444}{O(n^3)}$ of Q25.

## Q27. $T(n) = 16T(n/4) + n$

**Step 1: expand.**

$$
T(n) = \textcolor{#5B8CFF}{16}T\left(\textcolor{#FF5FA2}{\frac{n}{4}}\right) + \textcolor{#EAB308}{n} \qquad (1)
$$

$$
T(n) = \textcolor{#5B8CFF}{16}\left[\textcolor{#5B8CFF}{16}T\left(\textcolor{#FF5FA2}{\frac{n}{16}}\right) + \textcolor{#EAB308}{\frac{n}{4}}\right] + \textcolor{#EAB308}{n} = \textcolor{#5B8CFF}{16^2} T\left(\textcolor{#FF5FA2}{\frac{n}{4^2}}\right) + \textcolor{#EAB308}{4n} + \textcolor{#EAB308}{n} \qquad (2)
$$

$$
T(n) = \textcolor{#5B8CFF}{16^3} T\left(\textcolor{#FF5FA2}{\frac{n}{4^3}}\right) + \textcolor{#EAB308}{16n} + \textcolor{#EAB308}{4n} + \textcolor{#EAB308}{n} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = \textcolor{#5B8CFF}{16^{\textcolor{#A78BFA}{k}}} T\left(\textcolor{#FF5FA2}{\frac{n}{4^{\textcolor{#A78BFA}{k}}}}\right) + \textcolor{#EAB308}{n\left(4^{\textcolor{#A78BFA}{k}-1} + \dots + 4 + 1\right)} = \textcolor{#5B8CFF}{16^{\textcolor{#A78BFA}{k}}} T\left(\textcolor{#FF5FA2}{\frac{n}{4^{\textcolor{#A78BFA}{k}}}}\right) + \textcolor{#EAB308}{n \cdot \frac{4^{\textcolor{#A78BFA}{k}} - 1}{3}} \qquad (4)
$$

**Step 3: reach the base case.** $\frac{n}{4^{\textcolor{#A78BFA}{k}}} = 1 \Rightarrow \textcolor{#A78BFA}{k} = \log_4 n$, so $4^{\textcolor{#A78BFA}{k}} = n$ and $16^{\textcolor{#A78BFA}{k}} = 16^{\log_4 n} = n^{\log_4 16} = n^2$:

$$
T(n) = \textcolor{#5B8CFF}{n^2} \textcolor{#2DD4BF}{T(1)} + \textcolor{#EAB308}{n \cdot \frac{n-1}{3}}
$$

**Step 4: sum.**

$$
T(n) = \textcolor{#EAB308}{n^2} + \textcolor{#EAB308}{\frac{n^2 - n}{3}}
$$

:mark[**$\textcolor{#F97316}{O(n^2)}$**]{hex="#5C3A1A"}

## Q28. $T(n) = 2T(n/2) + n\log n$

**Step 1: expand.**

$$
T(n) = \textcolor{#5B8CFF}{2}T\left(\textcolor{#FF5FA2}{\frac{n}{2}}\right) + \textcolor{#EAB308}{n\log n} \qquad (1)
$$

$$
T(n) = \textcolor{#5B8CFF}{2}\left[\textcolor{#5B8CFF}{2}T\left(\textcolor{#FF5FA2}{\frac{n}{4}}\right) + \textcolor{#EAB308}{\frac{n}{2}\log\frac{n}{2}}\right] + \textcolor{#EAB308}{n\log n} = \textcolor{#5B8CFF}{2^2} T\left(\textcolor{#FF5FA2}{\frac{n}{2^2}}\right) + \textcolor{#EAB308}{n\log\frac{n}{2}} + \textcolor{#EAB308}{n\log n} \qquad (2)
$$

$$
T(n) = \textcolor{#5B8CFF}{2^3} T\left(\textcolor{#FF5FA2}{\frac{n}{2^3}}\right) + \textcolor{#EAB308}{n\log\frac{n}{4}} + \textcolor{#EAB308}{n\log\frac{n}{2}} + \textcolor{#EAB308}{n\log n} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = \textcolor{#5B8CFF}{2^{\textcolor{#A78BFA}{k}}} T\left(\textcolor{#FF5FA2}{\frac{n}{2^{\textcolor{#A78BFA}{k}}}}\right) + \textcolor{#EAB308}{n\left[\log\frac{n}{2^{\textcolor{#A78BFA}{k}-1}} + \dots + \log\frac{n}{2} + \log n\right]} \qquad (4)
$$

**Step 3: reach the base case.** $\textcolor{#A78BFA}{k} = \log_2 n$, $2^{\textcolor{#A78BFA}{k}} = n$, and $\log\frac{n}{2^i} = \log n - i$:

$$
T(n) = \textcolor{#5B8CFF}{n}\,\textcolor{#2DD4BF}{T(1)} + \textcolor{#EAB308}{n\left[\log n + (\log n - 1) + \dots + 1\right]}
$$

**Step 4: sum.**

$$
T(n) = \textcolor{#EAB308}{n} + \textcolor{#EAB308}{n \cdot \frac{\log n(\log n + 1)}{2}}
$$

:mark[**$\textcolor{#EAB308}{O(n \log^2 n)}$**]{hex="#565426"}

## Q29. $T(n) = T(9n/10) + n$

**Step 1: expand.**

$$
T(n) = T\left(\textcolor{#FF5FA2}{\frac{9n}{10}}\right) + \textcolor{#EAB308}{n} \qquad (1)
$$

$$
T(n) = \left[T\left(\textcolor{#FF5FA2}{\frac{81n}{100}}\right) + \textcolor{#EAB308}{\frac{9n}{10}}\right] + \textcolor{#EAB308}{n} = T\left(\textcolor{#FF5FA2}{\left(\frac{9}{10}\right)^2 n}\right) + \textcolor{#EAB308}{\frac{9n}{10}} + \textcolor{#EAB308}{n} \qquad (2)
$$

$$
T(n) = T\left(\textcolor{#FF5FA2}{\left(\frac{9}{10}\right)^3 n}\right) + \textcolor{#EAB308}{\left(\frac{9}{10}\right)^2 n} + \textcolor{#EAB308}{\frac{9n}{10}} + \textcolor{#EAB308}{n} \qquad (3)
$$

**Step 2: after $\textcolor{#A78BFA}{k}$ substitutions.**

$$
T(n) = T\left(\textcolor{#FF5FA2}{\left(\frac{9}{10}\right)^{\textcolor{#A78BFA}{k}} n}\right) + \textcolor{#EAB308}{n\sum_{i=0}^{\textcolor{#A78BFA}{k}-1}\left(\frac{9}{10}\right)^i} \qquad (4)
$$

**Step 3: reach the base case.**

$$
\left(\frac{9}{10}\right)^{\textcolor{#A78BFA}{k}} n = 1 \quad\Rightarrow\quad \textcolor{#A78BFA}{k} = \log_{10/9} n
$$

**Step 4: sum.** Ratio $\frac{9}{10} < 1$, so the series is at most $\frac{1}{1 - 9/10} = 10$:

$$
T(n) < \textcolor{#2DD4BF}{T(1)} + 10n
$$

:mark[**$\textcolor{#22C55E}{O(n)}$**]{hex="#204A2E"} Even a lopsided split is linear, as long as a constant *fraction* is removed each time.

## Q30. $T(n) = T(\sqrt{n}) + 1$

The size drops by a square root, so the usual $n - \textcolor{#A78BFA}{k}$ or $n/2^{\textcolor{#A78BFA}{k}}$ patterns do not apply. Two ways to finish it.

**Method 1: expand directly.**

$$
T(n) = T\left(\textcolor{#FF5FA2}{n^{1/2}}\right) + \textcolor{#EAB308}{1} \qquad (1)
$$

$$
T(n) = \left[T\left(\textcolor{#FF5FA2}{n^{1/4}}\right) + \textcolor{#EAB308}{1}\right] + \textcolor{#EAB308}{1} = T\left(\textcolor{#FF5FA2}{n^{1/2^2}}\right) + \textcolor{#EAB308}{2} \qquad (2)
$$

$$
T(n) = T\left(\textcolor{#FF5FA2}{n^{1/2^3}}\right) + \textcolor{#EAB308}{3} \qquad (3)
$$

After $\textcolor{#A78BFA}{k}$ substitutions:

$$
T(n) = T\left(\textcolor{#FF5FA2}{n^{1/2^{\textcolor{#A78BFA}{k}}}}\right) + \textcolor{#A78BFA}{k} \qquad (4)
$$

The recursion stops when the size reaches 2, so assume $n^{1/2^{\textcolor{#A78BFA}{k}}} = 2$. Taking $\log_2$ of both sides:

$$
\frac{\log_2 n}{2^{\textcolor{#A78BFA}{k}}} = 1 \quad\Rightarrow\quad 2^{\textcolor{#A78BFA}{k}} = \log_2 n \quad\Rightarrow\quad \textcolor{#A78BFA}{k} = \log_2 \log_2 n
$$

$$
T(n) = T(\textcolor{#FF5FA2}{2}) + \textcolor{#EAB308}{\log_2\log_2 n}
$$

**Method 2: change the variable.** Put $n = 2^m$, so $m = \log_2 n$ and $\sqrt{n} = 2^{m/2}$. Writing $S(m) = T(\textcolor{#FF5FA2}{2^m})$:

$$
S(m) = S\left(\frac{m}{2}\right) + 1
$$

That is exactly Q14, so $S(m) = 1 + \log_2 m$. Substituting $m = \log_2 n$ back:

$$
T(n) = \textcolor{#2DD4BF}{1} + \textcolor{#EAB308}{\log_2\log_2 n}
$$

:mark[**$\textcolor{#A78BFA}{O(\log \log n)}$**]{hex="#3B2A5E"}

## Bonus. $T(n) = 2T(\sqrt{n}) + \log n$

**Change the variable.** Put $n = 2^m$, so $m = \log_2 n$, $\sqrt n = 2^{m/2}$ and $\log n = m$. With $S(m) = T(\textcolor{#FF5FA2}{2^m})$:

$$
S(m) = 2S\left(\frac{m}{2}\right) + m
$$

That is exactly Q17, so $S(m) = m + m\log_2 m$. Substituting $m = \log_2 n$:

$$
T(n) = \textcolor{#EAB308}{\log_2 n} + \textcolor{#EAB308}{\log_2 n \cdot \log_2\log_2 n}
$$

:mark[**$\textcolor{#A78BFA}{O(\log n \cdot \log \log n)}$**]{hex="#3B2A5E"}

---

## Quick reference

| Recurrence | $\textcolor{#A78BFA}{k}$ from | Series left behind | Answer |
| --- | --- | --- | --- |
| $T(\textcolor{#FF5FA2}{n-1}) + 1$ | $n - \textcolor{#A78BFA}{k} = 0$ | $1 + 1 + \dots$ | $\textcolor{#22C55E}{O(n)}$ |
| $T(\textcolor{#FF5FA2}{n-1}) + n$ | $n - \textcolor{#A78BFA}{k} = 0$ | $1 + 2 + \dots + n$ | $\textcolor{#F97316}{O(n^2)}$ |
| $T(\textcolor{#FF5FA2}{n-1}) + \log n$ | $n - \textcolor{#A78BFA}{k} = 0$ | $\log(n!)$ | $\textcolor{#EAB308}{O(n \log n)}$ |
| $T(\textcolor{#FF5FA2}{n-1}) + n^2$ | $n - \textcolor{#A78BFA}{k} = 0$ | $1^2 + \dots + n^2$ | $\textcolor{#EF4444}{O(n^3)}$ |
| $T(\textcolor{#FF5FA2}{n-1}) + \sqrt n$ | $n - \textcolor{#A78BFA}{k} = 0$ | $\sqrt1 + \dots + \sqrt n$ | $\textcolor{#2DD4BF}{O(n^{1.5})}$ |
| $T(\textcolor{#FF5FA2}{n-1}) + \frac1n$ | $n - \textcolor{#A78BFA}{k} = 0$ | harmonic | $\textcolor{#A78BFA}{O(\log n)}$ |
| $\textcolor{#5B8CFF}{2}T(\textcolor{#FF5FA2}{n-1}) + 1$ | $n - \textcolor{#A78BFA}{k} = 0$ | $1 + 2 + \dots + 2^n$ | $\textcolor{#EF4444}{O(2^n)}$ |
| $\textcolor{#5B8CFF}{3}T(\textcolor{#FF5FA2}{n-1}) + 1$ | $n - \textcolor{#A78BFA}{k} = 0$ | $1 + 3 + \dots + 3^n$ | $\textcolor{#EF4444}{O(3^n)}$ |
| $T(\textcolor{#FF5FA2}{n-2}) + n$ | $n - 2\textcolor{#A78BFA}{k} = 0$ | $2 + 4 + \dots + n$ | $\textcolor{#F97316}{O(n^2)}$ |
| $T(\textcolor{#FF5FA2}{n/2}) + 1$ | $n/2^{\textcolor{#A78BFA}{k}} = 1$ | $1 + 1 + \dots$ ($\log n$) | $\textcolor{#A78BFA}{O(\log n)}$ |
| $T(\textcolor{#FF5FA2}{n/2}) + n$ | $n/2^{\textcolor{#A78BFA}{k}} = 1$ | $n + \frac n2 + \frac n4 \dots$ | $\textcolor{#22C55E}{O(n)}$ |
| $\textcolor{#5B8CFF}{2}T(\textcolor{#FF5FA2}{n/2}) + 1$ | $n/2^{\textcolor{#A78BFA}{k}} = 1$ | $1 + 2 + \dots + n$ | $\textcolor{#22C55E}{O(n)}$ |
| $\textcolor{#5B8CFF}{2}T(\textcolor{#FF5FA2}{n/2}) + n$ | $n/2^{\textcolor{#A78BFA}{k}} = 1$ | $n$ added $\log n$ times | $\textcolor{#EAB308}{O(n \log n)}$ |
| $\textcolor{#5B8CFF}{2}T(\textcolor{#FF5FA2}{n/2}) + n^2$ | $n/2^{\textcolor{#A78BFA}{k}} = 1$ | $n^2 + \frac{n^2}2 + \dots$ | $\textcolor{#F97316}{O(n^2)}$ |
| $\textcolor{#5B8CFF}{4}T(\textcolor{#FF5FA2}{n/2}) + n$ | $n/2^{\textcolor{#A78BFA}{k}} = 1$ | $n(1 + 2 + \dots + n)$ | $\textcolor{#F97316}{O(n^2)}$ |
| $\textcolor{#5B8CFF}{4}T(\textcolor{#FF5FA2}{n/2}) + n^2$ | $n/2^{\textcolor{#A78BFA}{k}} = 1$ | $n^2$ added $\log n$ times | $\textcolor{#F97316}{O(n^2 \log n)}$ |
| $\textcolor{#5B8CFF}{3}T(\textcolor{#FF5FA2}{n/2}) + n$ | $n/2^{\textcolor{#A78BFA}{k}} = 1$ | ratio $\frac32$, last term rules | $\textcolor{#F97316}{O(n^{1.585})}$ |
| $T(\textcolor{#FF5FA2}{\sqrt n}) + 1$ | $n^{1/2^{\textcolor{#A78BFA}{k}}} = 2$ | $1$ added $\log\log n$ times | $\textcolor{#A78BFA}{O(\log \log n)}$ |

## Chapter summary

- Expand the recurrence into itself two or three times, simplifying each time, until the pattern in $\textcolor{#A78BFA}{k}$ is obvious.
- Write the general form after $\textcolor{#A78BFA}{k}$ substitutions, then pick $\textcolor{#A78BFA}{k}$ so the recursive term hits the base case: $n - \textcolor{#A78BFA}{k} = 0$ for decreasing, $n/b^{\textcolor{#A78BFA}{k}} = 1$ for dividing.
- What is left is always a series. Identify it, sum it, keep the highest order term.
- Watch the multiplier: in $\textcolor{#5B8CFF}{a}T(\textcolor{#FF5FA2}{\dots})$ the $a$ compounds, so after $\textcolor{#A78BFA}{k}$ substitutions the front carries $a^{\textcolor{#A78BFA}{k}}$ and the added terms carry $a^{\textcolor{#A78BFA}{k}-1}, a^{\textcolor{#A78BFA}{k}-2}, \dots$
- Increasing geometric series are decided by the **last** term, decreasing ones by the **first**, and a series of equal terms is one term times the number of substitutions.
- A square root recurrence needs either $n^{1/2^{\textcolor{#A78BFA}{k}}} = 2$ or the substitution $n = 2^m$.
