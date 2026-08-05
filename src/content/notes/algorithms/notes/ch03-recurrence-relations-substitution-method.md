# Chapter 3: Recurrence Relations, Substitution Method

A recursive function cannot be analysed by counting loops, because its cost is written in terms of itself. That self referring equation is a **recurrence relation**, and this chapter solves them by **back substitution**: expand the relation into itself until the base case appears, then add up what fell out.

> You can check any answer in this chapter against the [Recurrence Relation tool](/algo/recurrence-relation). Do the working by hand first, then confirm.

## From code to recurrence

```python
def test(n):
    if n > 0:
        print(n)          # O(1)
        test(n - 1)       # T(n-1)
```

The function does constant work, then calls itself on $n - 1$:

$$
T(n) = \begin{cases} 1 & n = 0 \\ T(n-1) + 1 & n > 0 \end{cases}
$$

Change the body and the recurrence changes with it:

| Body of the function | Recurrence |
| --- | --- |
| one `print`, then `test(n-1)` | $T(n) = T(n-1) + 1$ |
| a `for` loop over $n$, then `test(n-1)` | $T(n) = T(n-1) + n$ |
| a doubling `while` loop, then `test(n-1)` | $T(n) = T(n-1) + \log n$ |
| two calls to `test(n-1)` | $T(n) = 2T(n-1) + 1$ |
| a `for` loop over $n$, then two calls to `test(n/2)` | $T(n) = 2T(n/2) + n$ |

The recursive part gives the $T(\dots)$ terms, and everything else in the body gives $f(n)$.

## The method, in four steps

> **Step 1.** Write the recurrence, then substitute it into itself two or three times. Simplify after each substitution so the pattern is visible.
>
> **Step 2.** Generalise: write the form after $k$ substitutions.
>
> **Step 3.** Choose $k$ so the recursive term becomes the base case. For a *decreasing* recurrence set $n - k = 0$, so $k = n$. For a *dividing* one set $n/2^k = 1$, so $k = \log_2 n$.
>
> **Step 4.** Substitute that $k$, sum the series that is left, and read off the highest order term.

## Series you will need

| Series | Sum | Order |
| --- | --- | --- |
| $1 + 1 + \dots + 1$ ($n$ terms) | $n$ | $O(n)$ |
| $1 + 2 + 3 + \dots + n$ | $\frac{n(n+1)}{2}$ | $O(n^2)$ |
| $1^2 + 2^2 + \dots + n^2$ | $\frac{n(n+1)(2n+1)}{6}$ | $O(n^3)$ |
| $\log 1 + \log 2 + \dots + \log n$ | $\log(n!)$ | $O(n \log n)$ |
| $1 + 2 + 4 + \dots + 2^k$ | $2^{k+1} - 1$ | $O(2^k)$ |
| $1 + 3 + 9 + \dots + 3^k$ | $\frac{3^{k+1} - 1}{2}$ | $O(3^k)$ |
| $1 + \frac{1}{2} + \frac{1}{4} + \dots$ | $< 2$ | $O(1)$ |
| $1 + \frac{1}{2} + \frac{1}{3} + \dots + \frac{1}{n}$ | $\approx \ln n$ | $O(\log n)$ |
| $\sqrt{1} + \sqrt{2} + \dots + \sqrt{n}$ | $\approx \frac{2}{3}n^{3/2}$ | $O(n^{1.5})$ |
| $r^0 + r^1 + \dots + r^{k-1}$ | $\frac{r^k - 1}{r - 1}$ | last term rules if $r > 1$ |

Two rules cover every geometric series that appears:

- Ratio **:color[bigger than 1]{hex="#EF4444"}** (like $1 + 2 + 4 + \dots$): the **last** term dominates.
- Ratio **:color[smaller than 1]{hex="#22C55E"}** (like $n + \frac{n}{2} + \frac{n}{4} + \dots$): the **first** term dominates, and the sum is a constant multiple of it.

## The two shapes

| Shape | Form | Choose $k$ from | Number of substitutions |
| --- | --- | --- | --- |
| **Decreasing** | $T(n) = aT(n-b) + f(n)$ | $n - kb = 0$ | $k = n/b$ |
| **Dividing** | $T(n) = aT(n/b) + f(n)$ | $n/b^k = 1$ | $k = \log_b n$ |

Everything below is one of these two.

---

# Part A: decreasing recurrences

Base case $T(0) = 1$ throughout this part.

## Q1. $T(n) = T(n-1) + 1$

$$
T(n) = \begin{cases} 1 & n = 0 \\ T(n-1) + 1 & n > 0 \end{cases}
$$

**Step 1: expand.**

$$
T(n) = T(n-1) + 1 \qquad (1)
$$

Since $T(n-1) = T(n-2) + 1$, substitute into $(1)$:

$$
T(n) = [T(n-2) + 1] + 1 = T(n-2) + 2 \qquad (2)
$$

Since $T(n-2) = T(n-3) + 1$, substitute into $(2)$:

$$
T(n) = [T(n-3) + 1] + 2 = T(n-3) + 3 \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = T(n-k) + k \qquad (4)
$$

**Step 3: reach the base case.** $T(0)$ is known, so assume

$$
n - k = 0 \quad\Rightarrow\quad k = n
$$

Substituting $k = n$ into $(4)$:

$$
T(n) = T(n-n) + n = T(0) + n
$$

**Step 4: sum.**

$$
T(n) = 1 + n
$$

:mark[**$O(n)$**]{hex="#204A2E"}

## Q2. $T(n) = T(n-1) + n$

**Step 1: expand.**

$$
T(n) = T(n-1) + n \qquad (1)
$$

Since $T(n-1) = T(n-2) + (n-1)$:

$$
T(n) = [T(n-2) + (n-1)] + n = T(n-2) + (n-1) + n \qquad (2)
$$

Since $T(n-2) = T(n-3) + (n-2)$:

$$
T(n) = [T(n-3) + (n-2)] + (n-1) + n = T(n-3) + (n-2) + (n-1) + n \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = T(n-k) + (n-k+1) + (n-k+2) + \dots + (n-1) + n \qquad (4)
$$

**Step 3: reach the base case.** $n - k = 0 \Rightarrow k = n$, so every $n - k$ becomes $0$:

$$
T(n) = T(0) + (n-n+1) + (n-n+2) + \dots + (n-1) + n
$$

$$
T(n) = T(0) + 1 + 2 + 3 + \dots + n
$$

**Step 4: sum.** The tail is an arithmetic series:

$$
T(n) = 1 + \frac{n(n+1)}{2} = \frac{n^2 + n + 2}{2}
$$

:mark[**$O(n^2)$**]{hex="#204A2E"}

## Q3. $T(n) = T(n-1) + \log n$

**Step 1: expand.**

$$
T(n) = T(n-1) + \log n \qquad (1)
$$

$$
T(n) = [T(n-2) + \log(n-1)] + \log n = T(n-2) + \log(n-1) + \log n \qquad (2)
$$

$$
T(n) = [T(n-3) + \log(n-2)] + \log(n-1) + \log n = T(n-3) + \log(n-2) + \log(n-1) + \log n \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = T(n-k) + \log(n-k+1) + \dots + \log(n-1) + \log n \qquad (4)
$$

**Step 3: reach the base case.** $n - k = 0 \Rightarrow k = n$:

$$
T(n) = T(0) + \log 1 + \log 2 + \dots + \log(n-1) + \log n
$$

**Step 4: sum.** A sum of logs is the log of a product:

$$
T(n) = 1 + \log[1 \times 2 \times \dots \times (n-1) \times n] = 1 + \log(n!)
$$

Every one of the $n$ factors is at most $n$, so $\log(n!) \le n\log n$.

:mark[**$O(n \log n)$**]{hex="#204A2E"}

## Q4. $T(n) = T(n-1) + n^2$

**Step 1: expand.**

$$
T(n) = T(n-1) + n^2 \qquad (1)
$$

$$
T(n) = [T(n-2) + (n-1)^2] + n^2 = T(n-2) + (n-1)^2 + n^2 \qquad (2)
$$

$$
T(n) = T(n-3) + (n-2)^2 + (n-1)^2 + n^2 \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = T(n-k) + (n-k+1)^2 + \dots + (n-1)^2 + n^2 \qquad (4)
$$

**Step 3: reach the base case.** $k = n$:

$$
T(n) = T(0) + 1^2 + 2^2 + \dots + n^2
$$

**Step 4: sum.**

$$
T(n) = 1 + \frac{n(n+1)(2n+1)}{6}
$$

:mark[**$O(n^3)$**]{hex="#204A2E"}

## Q5. $T(n) = T(n-1) + c$, with $c$ a constant

**Step 1: expand.**

$$
T(n) = T(n-1) + c \qquad (1)
$$

$$
T(n) = [T(n-2) + c] + c = T(n-2) + 2c \qquad (2)
$$

$$
T(n) = [T(n-3) + c] + 2c = T(n-3) + 3c \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = T(n-k) + kc \qquad (4)
$$

**Step 3: reach the base case.** $k = n$:

$$
T(n) = T(0) + nc = 1 + cn
$$

**Step 4: read it off.** A constant multiplier never changes the order.

:mark[**$O(n)$**]{hex="#204A2E"}

## Q6. $T(n) = T(n-1) + \sqrt{n}$

**Step 1: expand.**

$$
T(n) = T(n-1) + \sqrt{n} \qquad (1)
$$

$$
T(n) = T(n-2) + \sqrt{n-1} + \sqrt{n} \qquad (2)
$$

$$
T(n) = T(n-3) + \sqrt{n-2} + \sqrt{n-1} + \sqrt{n} \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = T(n-k) + \sqrt{n-k+1} + \dots + \sqrt{n-1} + \sqrt{n} \qquad (4)
$$

**Step 3: reach the base case.** $k = n$:

$$
T(n) = T(0) + \sqrt{1} + \sqrt{2} + \dots + \sqrt{n}
$$

**Step 4: sum.** There are $n$ terms and none is bigger than $\sqrt{n}$, so the sum is at most $n\sqrt{n}$. The exact value is $\approx \frac{2}{3}n^{3/2}$.

:mark[**$O(n^{1.5})$**]{hex="#204A2E"}

## Q7. $T(n) = T(n-1) + \frac{1}{n}$

**Step 1: expand.**

$$
T(n) = T(n-1) + \frac{1}{n} \qquad (1)
$$

$$
T(n) = T(n-2) + \frac{1}{n-1} + \frac{1}{n} \qquad (2)
$$

$$
T(n) = T(n-3) + \frac{1}{n-2} + \frac{1}{n-1} + \frac{1}{n} \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = T(n-k) + \frac{1}{n-k+1} + \dots + \frac{1}{n-1} + \frac{1}{n} \qquad (4)
$$

**Step 3: reach the base case.** $k = n$:

$$
T(n) = T(0) + \frac{1}{1} + \frac{1}{2} + \frac{1}{3} + \dots + \frac{1}{n}
$$

**Step 4: sum.** That tail is the **harmonic series**, which sums to about $\ln n$.

:mark[**$O(\log n)$**]{hex="#204A2E"} Worth seeing once: $n$ additions can still total only $\log n$ when each added term shrinks.

## Q8. $T(n) = T(n-1) + 2^n$

**Step 1: expand.**

$$
T(n) = T(n-1) + 2^n \qquad (1)
$$

$$
T(n) = T(n-2) + 2^{n-1} + 2^n \qquad (2)
$$

$$
T(n) = T(n-3) + 2^{n-2} + 2^{n-1} + 2^n \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = T(n-k) + 2^{n-k+1} + \dots + 2^{n-1} + 2^n \qquad (4)
$$

**Step 3: reach the base case.** $k = n$:

$$
T(n) = T(0) + 2^1 + 2^2 + \dots + 2^n
$$

**Step 4: sum.** Geometric with ratio 2:

$$
T(n) = 1 + (2^{n+1} - 2) = 2^{n+1} - 1
$$

:mark[**$O(2^n)$**]{hex="#204A2E"}

## Q9. $T(n) = 2T(n-1) + 1$

**Step 1: expand.** Note the multiplier: the whole substituted expression gets doubled.

$$
T(n) = 2T(n-1) + 1 \qquad (1)
$$

$$
T(n) = 2[2T(n-2) + 1] + 1 = 2^2 T(n-2) + 2 + 1 \qquad (2)
$$

$$
T(n) = 2^2[2T(n-3) + 1] + 2 + 1 = 2^3 T(n-3) + 2^2 + 2 + 1 \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = 2^k T(n-k) + \left(2^{k-1} + \dots + 2 + 1\right) = 2^k T(n-k) + (2^k - 1) \qquad (4)
$$

**Step 3: reach the base case.** $k = n$:

$$
T(n) = 2^n T(0) + 2^n - 1
$$

**Step 4: sum.**

$$
T(n) = 2^n + 2^n - 1 = 2^{n+1} - 1
$$

:mark[**$O(2^n)$**]{hex="#204A2E"} This is the Tower of Hanoi recurrence.

## Q10. $T(n) = 2T(n-1) + n$

**Step 1: expand.**

$$
T(n) = 2T(n-1) + n \qquad (1)
$$

$$
T(n) = 2[2T(n-2) + (n-1)] + n = 2^2 T(n-2) + 2(n-1) + n \qquad (2)
$$

$$
T(n) = 2^2[2T(n-3) + (n-2)] + 2(n-1) + n = 2^3 T(n-3) + 2^2(n-2) + 2(n-1) + n \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = 2^k T(n-k) + \sum_{i=0}^{k-1} 2^i (n - i) \qquad (4)
$$

**Step 3: reach the base case.** $k = n$:

$$
T(n) = 2^n T(0) + \sum_{i=0}^{n-1} 2^i (n-i)
$$

**Step 4: sum.** Split the sum:

$$
\sum_{i=0}^{n-1} 2^i(n-i) = n\sum_{i=0}^{n-1} 2^i - \sum_{i=0}^{n-1} i\,2^i = n(2^n - 1) - \left[(n-2)2^n + 2\right] = 2^{n+1} - n - 2
$$

$$
T(n) = 2^n + 2^{n+1} - n - 2 = 3 \cdot 2^n - n - 2
$$

:mark[**$O(2^n)$**]{hex="#204A2E"} Check it: $T(1) = 3$, $T(2) = 8$, $T(3) = 19$, which the formula reproduces.

## Q11. $T(n) = 3T(n-1) + 1$

**Step 1: expand.**

$$
T(n) = 3T(n-1) + 1 \qquad (1)
$$

$$
T(n) = 3[3T(n-2) + 1] + 1 = 3^2 T(n-2) + 3 + 1 \qquad (2)
$$

$$
T(n) = 3^2[3T(n-3) + 1] + 3 + 1 = 3^3 T(n-3) + 3^2 + 3 + 1 \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = 3^k T(n-k) + \left(3^{k-1} + \dots + 3 + 1\right) = 3^k T(n-k) + \frac{3^k - 1}{2} \qquad (4)
$$

**Step 3: reach the base case.** $k = n$:

$$
T(n) = 3^n T(0) + \frac{3^n - 1}{2}
$$

**Step 4: sum.**

$$
T(n) = 3^n + \frac{3^n - 1}{2} = \frac{3^{n+1} - 1}{2}
$$

:mark[**$O(3^n)$**]{hex="#204A2E"} The number of recursive calls per level becomes the base of the exponential.

## Q12. $T(n) = T(n-2) + 1$

**Step 1: expand.** Each substitution now steps down by 2.

$$
T(n) = T(n-2) + 1 \qquad (1)
$$

$$
T(n) = [T(n-4) + 1] + 1 = T(n-4) + 2 \qquad (2)
$$

$$
T(n) = [T(n-6) + 1] + 2 = T(n-6) + 3 \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = T(n-2k) + k \qquad (4)
$$

**Step 3: reach the base case.**

$$
n - 2k = 0 \quad\Rightarrow\quad k = \frac{n}{2}
$$

$$
T(n) = T(0) + \frac{n}{2}
$$

**Step 4: sum.**

$$
T(n) = 1 + \frac{n}{2}
$$

:mark[**$O(n)$**]{hex="#204A2E"} Stepping down by 2 halves the work, and a half is a constant factor.

## Q13. $T(n) = T(n-2) + n$

**Step 1: expand.**

$$
T(n) = T(n-2) + n \qquad (1)
$$

$$
T(n) = [T(n-4) + (n-2)] + n = T(n-4) + (n-2) + n \qquad (2)
$$

$$
T(n) = [T(n-6) + (n-4)] + (n-2) + n = T(n-6) + (n-4) + (n-2) + n \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = T(n-2k) + (n-2k+2) + \dots + (n-2) + n \qquad (4)
$$

**Step 3: reach the base case.** $n - 2k = 0 \Rightarrow k = \frac{n}{2}$ (take $n$ even):

$$
T(n) = T(0) + 2 + 4 + 6 + \dots + n
$$

**Step 4: sum.** Factor out the 2:

$$
T(n) = 1 + 2\left(1 + 2 + \dots + \frac{n}{2}\right) = 1 + 2 \cdot \frac{\frac{n}{2}\left(\frac{n}{2}+1\right)}{2} = 1 + \frac{n}{2}\left(\frac{n}{2}+1\right) \approx \frac{n^2}{4}
$$

:mark[**$O(n^2)$**]{hex="#204A2E"}

---

# Part B: dividing recurrences

Base case $T(1) = 1$ throughout this part.

## Q14. $T(n) = T(n/2) + 1$

$$
T(n) = \begin{cases} 1 & n = 1 \\ T(n/2) + 1 & n > 1 \end{cases}
$$

**Step 1: expand.**

$$
T(n) = T\left(\frac{n}{2}\right) + 1 \qquad (1)
$$

Since $T(n/2) = T(n/4) + 1$:

$$
T(n) = \left[T\left(\frac{n}{4}\right) + 1\right] + 1 = T\left(\frac{n}{2^2}\right) + 2 \qquad (2)
$$

Since $T(n/4) = T(n/8) + 1$:

$$
T(n) = \left[T\left(\frac{n}{8}\right) + 1\right] + 2 = T\left(\frac{n}{2^3}\right) + 3 \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = T\left(\frac{n}{2^k}\right) + k \qquad (4)
$$

**Step 3: reach the base case.** $T(1)$ is known, so assume

$$
\frac{n}{2^k} = 1 \quad\Rightarrow\quad n = 2^k \quad\Rightarrow\quad k = \log_2 n
$$

$$
T(n) = T(1) + \log_2 n
$$

**Step 4: sum.**

$$
T(n) = 1 + \log_2 n
$$

:mark[**$O(\log n)$**]{hex="#204A2E"} This is binary search.

## Q15. $T(n) = T(n/2) + n$

**Step 1: expand.**

$$
T(n) = T\left(\frac{n}{2}\right) + n \qquad (1)
$$

$$
T(n) = \left[T\left(\frac{n}{4}\right) + \frac{n}{2}\right] + n = T\left(\frac{n}{2^2}\right) + \frac{n}{2} + n \qquad (2)
$$

$$
T(n) = \left[T\left(\frac{n}{8}\right) + \frac{n}{4}\right] + \frac{n}{2} + n = T\left(\frac{n}{2^3}\right) + \frac{n}{4} + \frac{n}{2} + n \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = T\left(\frac{n}{2^k}\right) + \frac{n}{2^{k-1}} + \dots + \frac{n}{2} + n \qquad (4)
$$

**Step 3: reach the base case.** $\frac{n}{2^k} = 1 \Rightarrow k = \log_2 n$:

$$
T(n) = T(1) + n\left(1 + \frac12 + \frac14 + \dots + \frac{1}{2^{\log_2 n - 1}}\right)
$$

**Step 4: sum.** Decreasing geometric, ratio $\frac12$, so the sum is under 2:

$$
T(n) < 1 + 2n
$$

:mark[**$O(n)$**]{hex="#204A2E"} The very first term, $n$, decides the whole thing.

## Q16. $T(n) = 2T(n/2) + 1$

**Step 1: expand.**

$$
T(n) = 2T\left(\frac{n}{2}\right) + 1 \qquad (1)
$$

$$
T(n) = 2\left[2T\left(\frac{n}{4}\right) + 1\right] + 1 = 2^2 T\left(\frac{n}{2^2}\right) + 2 + 1 \qquad (2)
$$

$$
T(n) = 2^2\left[2T\left(\frac{n}{8}\right) + 1\right] + 2 + 1 = 2^3 T\left(\frac{n}{2^3}\right) + 2^2 + 2 + 1 \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = 2^k T\left(\frac{n}{2^k}\right) + \left(2^{k-1} + \dots + 2 + 1\right) = 2^k T\left(\frac{n}{2^k}\right) + (2^k - 1) \qquad (4)
$$

**Step 3: reach the base case.** $\frac{n}{2^k} = 1 \Rightarrow k = \log_2 n$, and therefore $2^k = n$:

$$
T(n) = n\,T(1) + (n - 1)
$$

**Step 4: sum.**

$$
T(n) = n + n - 1 = 2n - 1
$$

:mark[**$O(n)$**]{hex="#204A2E"} There are $n$ base-case calls and each costs 1, so the leaves decide it.

## Q17. $T(n) = 2T(n/2) + n$

**Step 1: expand.**

$$
T(n) = 2T\left(\frac{n}{2}\right) + n \qquad (1)
$$

$$
T(n) = 2\left[2T\left(\frac{n}{4}\right) + \frac{n}{2}\right] + n = 2^2 T\left(\frac{n}{2^2}\right) + n + n \qquad (2)
$$

$$
T(n) = 2^2\left[2T\left(\frac{n}{8}\right) + \frac{n}{4}\right] + 2n = 2^3 T\left(\frac{n}{2^3}\right) + n + n + n \qquad (3)
$$

Notice each substitution adds exactly $n$: the $2^i$ multiplier cancels the $\frac{n}{2^i}$ term.

**Step 2: after $k$ substitutions.**

$$
T(n) = 2^k T\left(\frac{n}{2^k}\right) + kn \qquad (4)
$$

**Step 3: reach the base case.** $\frac{n}{2^k} = 1 \Rightarrow k = \log_2 n$, $2^k = n$:

$$
T(n) = n\,T(1) + n\log_2 n
$$

**Step 4: sum.**

$$
T(n) = n + n\log_2 n
$$

:mark[**$O(n \log n)$**]{hex="#204A2E"} This is merge sort.

## Q18. $T(n) = 2T(n/2) + n^2$

**Step 1: expand.**

$$
T(n) = 2T\left(\frac{n}{2}\right) + n^2 \qquad (1)
$$

$$
T(n) = 2\left[2T\left(\frac{n}{4}\right) + \frac{n^2}{4}\right] + n^2 = 2^2 T\left(\frac{n}{2^2}\right) + \frac{n^2}{2} + n^2 \qquad (2)
$$

$$
T(n) = 2^3 T\left(\frac{n}{2^3}\right) + \frac{n^2}{4} + \frac{n^2}{2} + n^2 \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = 2^k T\left(\frac{n}{2^k}\right) + n^2\left(1 + \frac12 + \dots + \frac{1}{2^{k-1}}\right) \qquad (4)
$$

**Step 3: reach the base case.** $k = \log_2 n$, $2^k = n$:

$$
T(n) = n\,T(1) + n^2\left(1 + \frac12 + \frac14 + \dots\right)
$$

**Step 4: sum.** The bracket is under 2:

$$
T(n) < n + 2n^2
$$

:mark[**$O(n^2)$**]{hex="#204A2E"} The top level alone dominates.

## Q19. $T(n) = 4T(n/2) + n$

**Step 1: expand.**

$$
T(n) = 4T\left(\frac{n}{2}\right) + n \qquad (1)
$$

$$
T(n) = 4\left[4T\left(\frac{n}{4}\right) + \frac{n}{2}\right] + n = 4^2 T\left(\frac{n}{2^2}\right) + 2n + n \qquad (2)
$$

$$
T(n) = 4^2\left[4T\left(\frac{n}{8}\right) + \frac{n}{4}\right] + 2n + n = 4^3 T\left(\frac{n}{2^3}\right) + 4n + 2n + n \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = 4^k T\left(\frac{n}{2^k}\right) + n\left(2^{k-1} + \dots + 2 + 1\right) = 4^k T\left(\frac{n}{2^k}\right) + n(2^k - 1) \qquad (4)
$$

**Step 3: reach the base case.** $k = \log_2 n$, so $2^k = n$ and $4^k = 4^{\log_2 n} = n^{\log_2 4} = n^2$:

$$
T(n) = n^2 T(1) + n(n-1)
$$

**Step 4: sum.**

$$
T(n) = n^2 + n^2 - n = 2n^2 - n
$$

:mark[**$O(n^2)$**]{hex="#204A2E"} The added terms grow towards the base case, so the deepest level dominates.

## Q20. $T(n) = 4T(n/2) + n^2$

**Step 1: expand.**

$$
T(n) = 4T\left(\frac{n}{2}\right) + n^2 \qquad (1)
$$

$$
T(n) = 4\left[4T\left(\frac{n}{4}\right) + \frac{n^2}{4}\right] + n^2 = 4^2 T\left(\frac{n}{2^2}\right) + n^2 + n^2 \qquad (2)
$$

$$
T(n) = 4^3 T\left(\frac{n}{2^3}\right) + n^2 + n^2 + n^2 \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = 4^k T\left(\frac{n}{2^k}\right) + k n^2 \qquad (4)
$$

**Step 3: reach the base case.** $k = \log_2 n$, $4^k = n^2$:

$$
T(n) = n^2 T(1) + n^2 \log_2 n
$$

**Step 4: sum.**

$$
T(n) = n^2 + n^2\log_2 n
$$

:mark[**$O(n^2 \log n)$**]{hex="#204A2E"} Every substitution contributed the same $n^2$, so multiply by the number of substitutions.

## Q21. $T(n) = 3T(n/2) + n$

**Step 1: expand.**

$$
T(n) = 3T\left(\frac{n}{2}\right) + n \qquad (1)
$$

$$
T(n) = 3\left[3T\left(\frac{n}{4}\right) + \frac{n}{2}\right] + n = 3^2 T\left(\frac{n}{2^2}\right) + \frac{3}{2}n + n \qquad (2)
$$

$$
T(n) = 3^3 T\left(\frac{n}{2^3}\right) + \frac{9}{4}n + \frac{3}{2}n + n \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = 3^k T\left(\frac{n}{2^k}\right) + n\sum_{i=0}^{k-1}\left(\frac{3}{2}\right)^i \qquad (4)
$$

**Step 3: reach the base case.** $k = \log_2 n$, and

$$
3^k = 3^{\log_2 n} = n^{\log_2 3} = n^{1.585}
$$

**Step 4: sum.** The series has ratio $\frac32 > 1$, so its last term rules:

$$
n\sum_{i=0}^{k-1}\left(\frac32\right)^i = 2n\left[\left(\frac32\right)^{k} - 1\right] = 2n\left(n^{0.585} - 1\right) = 2n^{1.585} - 2n
$$

$$
T(n) = n^{1.585} + 2n^{1.585} - 2n = 3n^{1.585} - 2n
$$

:mark[**$O(n^{\log_2 3}) = O(n^{1.585})$**]{hex="#204A2E"} Karatsuba multiplication, which is why it beats the schoolbook $O(n^2)$ method.

## Q22. $T(n) = T(n/3) + 1$

**Step 1: expand.**

$$
T(n) = T\left(\frac{n}{3}\right) + 1 \qquad (1)
$$

$$
T(n) = \left[T\left(\frac{n}{9}\right) + 1\right] + 1 = T\left(\frac{n}{3^2}\right) + 2 \qquad (2)
$$

$$
T(n) = T\left(\frac{n}{3^3}\right) + 3 \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = T\left(\frac{n}{3^k}\right) + k \qquad (4)
$$

**Step 3: reach the base case.**

$$
\frac{n}{3^k} = 1 \quad\Rightarrow\quad n = 3^k \quad\Rightarrow\quad k = \log_3 n
$$

**Step 4: sum.**

$$
T(n) = T(1) + \log_3 n = 1 + \log_3 n
$$

:mark[**$O(\log n)$**]{hex="#204A2E"} The base of the log is a constant factor, so $\log_3 n$ and $\log_2 n$ are the same order.

## Q23. $T(n) = 2T(n/3) + n$

**Step 1: expand.**

$$
T(n) = 2T\left(\frac{n}{3}\right) + n \qquad (1)
$$

$$
T(n) = 2\left[2T\left(\frac{n}{9}\right) + \frac{n}{3}\right] + n = 2^2 T\left(\frac{n}{3^2}\right) + \frac{2}{3}n + n \qquad (2)
$$

$$
T(n) = 2^3 T\left(\frac{n}{3^3}\right) + \frac{4}{9}n + \frac{2}{3}n + n \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = 2^k T\left(\frac{n}{3^k}\right) + n\sum_{i=0}^{k-1}\left(\frac{2}{3}\right)^i \qquad (4)
$$

**Step 3: reach the base case.** $\frac{n}{3^k} = 1 \Rightarrow k = \log_3 n$, and $2^k = 2^{\log_3 n} = n^{\log_3 2} = n^{0.63}$:

$$
T(n) = n^{0.63}T(1) + n\sum_{i=0}^{k-1}\left(\frac23\right)^i
$$

**Step 4: sum.** Ratio $\frac23 < 1$, so the series is at most $\frac{1}{1 - 2/3} = 3$:

$$
T(n) < n^{0.63} + 3n
$$

:mark[**$O(n)$**]{hex="#204A2E"}

## Q24. $T(n) = T(n/2) + \log n$

**Step 1: expand.**

$$
T(n) = T\left(\frac{n}{2}\right) + \log n \qquad (1)
$$

$$
T(n) = \left[T\left(\frac{n}{4}\right) + \log\frac{n}{2}\right] + \log n = T\left(\frac{n}{2^2}\right) + \log\frac{n}{2} + \log n \qquad (2)
$$

$$
T(n) = T\left(\frac{n}{2^3}\right) + \log\frac{n}{4} + \log\frac{n}{2} + \log n \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = T\left(\frac{n}{2^k}\right) + \log\frac{n}{2^{k-1}} + \dots + \log\frac{n}{2} + \log n \qquad (4)
$$

**Step 3: reach the base case.** $k = \log_2 n$. Using $\log\frac{n}{2^i} = \log n - i$:

$$
T(n) = T(1) + \left[\log n + (\log n - 1) + (\log n - 2) + \dots + 1\right]
$$

**Step 4: sum.** That is an arithmetic series with $\log n$ terms:

$$
T(n) = 1 + \frac{\log n(\log n + 1)}{2}
$$

:mark[**$O(\log^2 n)$**]{hex="#204A2E"}

## Q25. $T(n) = 8T(n/2) + n^3$

**Step 1: expand.**

$$
T(n) = 8T\left(\frac{n}{2}\right) + n^3 \qquad (1)
$$

$$
T(n) = 8\left[8T\left(\frac{n}{4}\right) + \frac{n^3}{8}\right] + n^3 = 8^2 T\left(\frac{n}{2^2}\right) + n^3 + n^3 \qquad (2)
$$

$$
T(n) = 8^3 T\left(\frac{n}{2^3}\right) + n^3 + n^3 + n^3 \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = 8^k T\left(\frac{n}{2^k}\right) + k n^3 \qquad (4)
$$

**Step 3: reach the base case.** $k = \log_2 n$, and $8^k = 8^{\log_2 n} = n^{\log_2 8} = n^3$:

$$
T(n) = n^3 T(1) + n^3 \log_2 n
$$

**Step 4: sum.**

$$
T(n) = n^3 + n^3\log_2 n
$$

:mark[**$O(n^3 \log n)$**]{hex="#204A2E"} Naive recursive matrix multiplication.

## Q26. $T(n) = 7T(n/2) + n^2$

**Step 1: expand.**

$$
T(n) = 7T\left(\frac{n}{2}\right) + n^2 \qquad (1)
$$

$$
T(n) = 7\left[7T\left(\frac{n}{4}\right) + \frac{n^2}{4}\right] + n^2 = 7^2 T\left(\frac{n}{2^2}\right) + \frac{7}{4}n^2 + n^2 \qquad (2)
$$

$$
T(n) = 7^3 T\left(\frac{n}{2^3}\right) + \frac{49}{16}n^2 + \frac{7}{4}n^2 + n^2 \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = 7^k T\left(\frac{n}{2^k}\right) + n^2\sum_{i=0}^{k-1}\left(\frac{7}{4}\right)^i \qquad (4)
$$

**Step 3: reach the base case.** $k = \log_2 n$, and

$$
7^k = 7^{\log_2 n} = n^{\log_2 7} = n^{2.807}
$$

**Step 4: sum.** Ratio $\frac74 > 1$, so the last term rules, and $\left(\frac74\right)^{\log_2 n} = n^{\log_2 (7/4)} = n^{0.807}$:

$$
n^2 \sum_{i=0}^{k-1}\left(\frac74\right)^i = \frac{4}{3}n^2\left(n^{0.807} - 1\right) = \frac43 n^{2.807} - \frac43 n^2
$$

$$
T(n) = n^{2.807} + \frac43 n^{2.807} - \frac43 n^2
$$

:mark[**$O(n^{\log_2 7}) = O(n^{2.807})$**]{hex="#204A2E"} Strassen's matrix multiplication, faster than the $O(n^3)$ of Q25.

## Q27. $T(n) = 16T(n/4) + n$

**Step 1: expand.**

$$
T(n) = 16T\left(\frac{n}{4}\right) + n \qquad (1)
$$

$$
T(n) = 16\left[16T\left(\frac{n}{16}\right) + \frac{n}{4}\right] + n = 16^2 T\left(\frac{n}{4^2}\right) + 4n + n \qquad (2)
$$

$$
T(n) = 16^3 T\left(\frac{n}{4^3}\right) + 16n + 4n + n \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = 16^k T\left(\frac{n}{4^k}\right) + n\left(4^{k-1} + \dots + 4 + 1\right) = 16^k T\left(\frac{n}{4^k}\right) + n \cdot \frac{4^k - 1}{3} \qquad (4)
$$

**Step 3: reach the base case.** $\frac{n}{4^k} = 1 \Rightarrow k = \log_4 n$, so $4^k = n$ and $16^k = 16^{\log_4 n} = n^{\log_4 16} = n^2$:

$$
T(n) = n^2 T(1) + n \cdot \frac{n-1}{3}
$$

**Step 4: sum.**

$$
T(n) = n^2 + \frac{n^2 - n}{3}
$$

:mark[**$O(n^2)$**]{hex="#204A2E"}

## Q28. $T(n) = 2T(n/2) + n\log n$

**Step 1: expand.**

$$
T(n) = 2T\left(\frac{n}{2}\right) + n\log n \qquad (1)
$$

$$
T(n) = 2\left[2T\left(\frac{n}{4}\right) + \frac{n}{2}\log\frac{n}{2}\right] + n\log n = 2^2 T\left(\frac{n}{2^2}\right) + n\log\frac{n}{2} + n\log n \qquad (2)
$$

$$
T(n) = 2^3 T\left(\frac{n}{2^3}\right) + n\log\frac{n}{4} + n\log\frac{n}{2} + n\log n \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = 2^k T\left(\frac{n}{2^k}\right) + n\left[\log\frac{n}{2^{k-1}} + \dots + \log\frac{n}{2} + \log n\right] \qquad (4)
$$

**Step 3: reach the base case.** $k = \log_2 n$, $2^k = n$, and $\log\frac{n}{2^i} = \log n - i$:

$$
T(n) = n\,T(1) + n\left[\log n + (\log n - 1) + \dots + 1\right]
$$

**Step 4: sum.**

$$
T(n) = n + n \cdot \frac{\log n(\log n + 1)}{2}
$$

:mark[**$O(n \log^2 n)$**]{hex="#204A2E"}

## Q29. $T(n) = T(9n/10) + n$

**Step 1: expand.**

$$
T(n) = T\left(\frac{9n}{10}\right) + n \qquad (1)
$$

$$
T(n) = \left[T\left(\frac{81n}{100}\right) + \frac{9n}{10}\right] + n = T\left(\left(\frac{9}{10}\right)^2 n\right) + \frac{9n}{10} + n \qquad (2)
$$

$$
T(n) = T\left(\left(\frac{9}{10}\right)^3 n\right) + \left(\frac{9}{10}\right)^2 n + \frac{9n}{10} + n \qquad (3)
$$

**Step 2: after $k$ substitutions.**

$$
T(n) = T\left(\left(\frac{9}{10}\right)^k n\right) + n\sum_{i=0}^{k-1}\left(\frac{9}{10}\right)^i \qquad (4)
$$

**Step 3: reach the base case.**

$$
\left(\frac{9}{10}\right)^k n = 1 \quad\Rightarrow\quad k = \log_{10/9} n
$$

**Step 4: sum.** Ratio $\frac{9}{10} < 1$, so the series is at most $\frac{1}{1 - 9/10} = 10$:

$$
T(n) < T(1) + 10n
$$

:mark[**$O(n)$**]{hex="#204A2E"} Even a lopsided split is linear, as long as a constant *fraction* is removed each time.

## Q30. $T(n) = T(\sqrt{n}) + 1$

The size drops by a square root, so the usual $n - k$ or $n/2^k$ patterns do not apply. Two ways to finish it.

**Method 1: expand directly.**

$$
T(n) = T\left(n^{1/2}\right) + 1 \qquad (1)
$$

$$
T(n) = \left[T\left(n^{1/4}\right) + 1\right] + 1 = T\left(n^{1/2^2}\right) + 2 \qquad (2)
$$

$$
T(n) = T\left(n^{1/2^3}\right) + 3 \qquad (3)
$$

After $k$ substitutions:

$$
T(n) = T\left(n^{1/2^k}\right) + k \qquad (4)
$$

The recursion stops when the size reaches 2, so assume $n^{1/2^k} = 2$. Taking $\log_2$ of both sides:

$$
\frac{\log_2 n}{2^k} = 1 \quad\Rightarrow\quad 2^k = \log_2 n \quad\Rightarrow\quad k = \log_2 \log_2 n
$$

$$
T(n) = T(2) + \log_2\log_2 n
$$

**Method 2: change the variable.** Put $n = 2^m$, so $m = \log_2 n$ and $\sqrt{n} = 2^{m/2}$. Writing $S(m) = T(2^m)$:

$$
S(m) = S\left(\frac{m}{2}\right) + 1
$$

That is exactly Q14, so $S(m) = 1 + \log_2 m$. Substituting $m = \log_2 n$ back:

$$
T(n) = 1 + \log_2\log_2 n
$$

:mark[**$O(\log \log n)$**]{hex="#204A2E"}

## Bonus. $T(n) = 2T(\sqrt{n}) + \log n$

**Change the variable.** Put $n = 2^m$, so $m = \log_2 n$, $\sqrt n = 2^{m/2}$ and $\log n = m$. With $S(m) = T(2^m)$:

$$
S(m) = 2S\left(\frac{m}{2}\right) + m
$$

That is exactly Q17, so $S(m) = m + m\log_2 m$. Substituting $m = \log_2 n$:

$$
T(n) = \log_2 n + \log_2 n \cdot \log_2\log_2 n
$$

:mark[**$O(\log n \cdot \log \log n)$**]{hex="#204A2E"}

---

## Quick reference

| Recurrence | $k$ from | Series left behind | Answer |
| --- | --- | --- | --- |
| $T(n-1) + 1$ | $n - k = 0$ | $1 + 1 + \dots$ | $O(n)$ |
| $T(n-1) + n$ | $n - k = 0$ | $1 + 2 + \dots + n$ | $O(n^2)$ |
| $T(n-1) + \log n$ | $n - k = 0$ | $\log(n!)$ | $O(n \log n)$ |
| $T(n-1) + n^2$ | $n - k = 0$ | $1^2 + \dots + n^2$ | $O(n^3)$ |
| $T(n-1) + \sqrt n$ | $n - k = 0$ | $\sqrt1 + \dots + \sqrt n$ | $O(n^{1.5})$ |
| $T(n-1) + \frac1n$ | $n - k = 0$ | harmonic | $O(\log n)$ |
| $2T(n-1) + 1$ | $n - k = 0$ | $1 + 2 + \dots + 2^n$ | $O(2^n)$ |
| $3T(n-1) + 1$ | $n - k = 0$ | $1 + 3 + \dots + 3^n$ | $O(3^n)$ |
| $T(n-2) + n$ | $n - 2k = 0$ | $2 + 4 + \dots + n$ | $O(n^2)$ |
| $T(n/2) + 1$ | $n/2^k = 1$ | $1 + 1 + \dots$ ($\log n$) | $O(\log n)$ |
| $T(n/2) + n$ | $n/2^k = 1$ | $n + \frac n2 + \frac n4 \dots$ | $O(n)$ |
| $2T(n/2) + 1$ | $n/2^k = 1$ | $1 + 2 + \dots + n$ | $O(n)$ |
| $2T(n/2) + n$ | $n/2^k = 1$ | $n$ added $\log n$ times | $O(n \log n)$ |
| $2T(n/2) + n^2$ | $n/2^k = 1$ | $n^2 + \frac{n^2}2 + \dots$ | $O(n^2)$ |
| $4T(n/2) + n$ | $n/2^k = 1$ | $n(1 + 2 + \dots + n)$ | $O(n^2)$ |
| $4T(n/2) + n^2$ | $n/2^k = 1$ | $n^2$ added $\log n$ times | $O(n^2 \log n)$ |
| $3T(n/2) + n$ | $n/2^k = 1$ | ratio $\frac32$, last term rules | $O(n^{1.585})$ |
| $T(\sqrt n) + 1$ | $n^{1/2^k} = 2$ | $1$ added $\log\log n$ times | $O(\log \log n)$ |

## Chapter summary

- Expand the recurrence into itself two or three times, simplifying each time, until the pattern in $k$ is obvious.
- Write the general form after $k$ substitutions, then pick $k$ so the recursive term hits the base case: $n - k = 0$ for decreasing, $n/b^k = 1$ for dividing.
- What is left is always a series. Identify it, sum it, keep the highest order term.
- Watch the multiplier: in $aT(\dots)$ the $a$ compounds, so after $k$ substitutions the front carries $a^k$ and the added terms carry $a^{k-1}, a^{k-2}, \dots$
- Increasing geometric series are decided by the **last** term, decreasing ones by the **first**, and a series of equal terms is one term times the number of substitutions.
- A square root recurrence needs either $n^{1/2^k} = 2$ or the substitution $n = 2^m$.
