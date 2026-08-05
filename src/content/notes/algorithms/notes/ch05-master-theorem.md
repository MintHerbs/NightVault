# Chapter 5: Master Theorem

Chapter 3 solved recurrences by expanding them, Chapter 4 by drawing them. Both take a page of working. The **master theorem** does the same job in three lines: read four numbers off the recurrence, compare two of them, and quote the matching case.

It only works on **dividing** recurrences, the shape

$$
T(n) = a\,T\!\left(\frac{n}{b}\right) + f(n)
$$

and only when $f(n)$ can be written as $n^N \log^P n$. That covers almost every recurrence an exam will give you.

## The four numbers

Everything in this chapter comes from reading four values off the recurrence. Each one keeps the same colour from here to the end of the chapter, so you can follow a number from the recurrence into the comparison and into the answer.

| Symbol | Reads as | Where it is |
| --- | --- | --- |
| **:color[a]{hex="#5B8CFF"}** | how many recursive calls | the multiplier in front of $T$ |
| **:color[b]{hex="#FF5FA2"}** | how much smaller each call is | what $n$ is divided by |
| **:color[N]{hex="#22C55E"}** | the power of $n$ outside the recursion | from $f(n)$ |
| **:color[P]{hex="#EAB308"}** | the power of $\log n$ outside the recursion | from $f(n)$ |

The trick that makes the reading mechanical is to **always rewrite $f(n)$ as $n^N \log^P n$**, even when one of the powers is zero:

| $f(n)$ as written | $f(n)$ rewritten | :color[N]{hex="#22C55E"} | :color[P]{hex="#EAB308"} |
| --- | --- | --- | --- |
| $1$ | $n^{\textcolor{#22C55E}{0}} \log^{\textcolor{#EAB308}{0}} n$ | $\textcolor{#22C55E}{0}$ | $\textcolor{#EAB308}{0}$ |
| $n$ | $n^{\textcolor{#22C55E}{1}} \log^{\textcolor{#EAB308}{0}} n$ | $\textcolor{#22C55E}{1}$ | $\textcolor{#EAB308}{0}$ |
| $\log n$ | $n^{\textcolor{#22C55E}{0}} \log^{\textcolor{#EAB308}{1}} n$ | $\textcolor{#22C55E}{0}$ | $\textcolor{#EAB308}{1}$ |
| $n \log n$ | $n^{\textcolor{#22C55E}{1}} \log^{\textcolor{#EAB308}{1}} n$ | $\textcolor{#22C55E}{1}$ | $\textcolor{#EAB308}{1}$ |
| $n^2 \log^2 n$ | $n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{2}} n$ | $\textcolor{#22C55E}{2}$ | $\textcolor{#EAB308}{2}$ |
| $\dfrac{n}{\log n}$ | $n^{\textcolor{#22C55E}{1}} \log^{\textcolor{#EAB308}{-1}} n$ | $\textcolor{#22C55E}{1}$ | $\textcolor{#EAB308}{-1}$ |
| $\dfrac{n}{\log^2 n}$ | $n^{\textcolor{#22C55E}{1}} \log^{\textcolor{#EAB308}{-2}} n$ | $\textcolor{#22C55E}{1}$ | $\textcolor{#EAB308}{-2}$ |
| $n\sqrt n$ | $n^{\textcolor{#22C55E}{1.5}} \log^{\textcolor{#EAB308}{0}} n$ | $\textcolor{#22C55E}{1.5}$ | $\textcolor{#EAB308}{0}$ |

> A denominator is a **negative** power. That single line is what the whole of Case 2 turns on, so read $\frac{n}{\log n}$ as $n^1 \log^{-1} n$ every time.

## The rules

Compare $\log_{\textcolor{#FF5FA2}{b}} \textcolor{#5B8CFF}{a}$ against $\textcolor{#22C55E}{N}$. That comparison alone picks the case, and only then does $\textcolor{#EAB308}{P}$ matter.

> Written $\log_b^a$ in the lecture, which means $\log$ **to the base :color[b]{hex="#FF5FA2"}** of **:color[a]{hex="#5B8CFF"}**. It is not a power.

### Case 1

$$
\log_{\textcolor{#FF5FA2}{b}} \textcolor{#5B8CFF}{a} > \textcolor{#22C55E}{N} \qquad \Longrightarrow \qquad O\!\left(n^{\log_{\textcolor{#FF5FA2}{b}} \textcolor{#5B8CFF}{a}}\right)
$$

The leaves of the recursion tree dominate. $\textcolor{#EAB308}{P}$ is ignored.

### Case 2

$$
\log_{\textcolor{#FF5FA2}{b}} \textcolor{#5B8CFF}{a} = \textcolor{#22C55E}{N}
$$

| Condition | Answer |
| --- | --- |
| $\textcolor{#EAB308}{P} > -1$ | $O\!\left(n^{\textcolor{#22C55E}{N}} \log^{\textcolor{#EAB308}{P}+1} n\right)$ |
| $\textcolor{#EAB308}{P} = -1$ | $O\!\left(n^{\textcolor{#22C55E}{N}} \log \log n\right)$ |
| $\textcolor{#EAB308}{P} < -1$ | $O\!\left(n^{\textcolor{#22C55E}{N}}\right)$ |

Every level costs the same, so the answer is one level's cost times the number of levels. That is where the extra $+1$ on the log comes from.

### Case 3

$$
\log_{\textcolor{#FF5FA2}{b}} \textcolor{#5B8CFF}{a} < \textcolor{#22C55E}{N}
$$

| Condition | Answer |
| --- | --- |
| $\textcolor{#EAB308}{P} \geq 0$ | $O\!\left(n^{\textcolor{#22C55E}{N}} \log^{\textcolor{#EAB308}{P}} n\right)$ |
| $\textcolor{#EAB308}{P} \leq 0$ | $O\!\left(n^{\textcolor{#22C55E}{N}}\right)$ |

The root dominates, so the answer is just $f(n)$ back again. The two rows overlap at $\textcolor{#EAB308}{P} = 0$, and harmlessly so: $\log^0 n = 1$, so both rows give $O(n^{\textcolor{#22C55E}{N}})$.

## The method, in three steps

> **Step 1.** Read off :color[a]{hex="#5B8CFF"} and :color[b]{hex="#FF5FA2"}, then rewrite $f(n)$ as $n^{\textcolor{#22C55E}{N}} \log^{\textcolor{#EAB308}{P}} n$ to read off :color[N]{hex="#22C55E"} and :color[P]{hex="#EAB308"}.
>
> **Step 2.** Work out $\log_{\textcolor{#FF5FA2}{b}} \textcolor{#5B8CFF}{a}$ and compare it with :color[N]{hex="#22C55E"}. Greater is Case 1, equal is Case 2, smaller is Case 3.
>
> **Step 3.** Quote the case. For Case 2 and Case 3, use :color[P]{hex="#EAB308"} to pick the row.

### Logs you should not have to work out

| $\log_b a$ | Value |
| --- | --- |
| $\log_2 1$ | $0$ |
| $\log_2 2$ | $1$ |
| $\log_2 4$, $\log_3 9$, $\log_4 16$ | $2$ |
| $\log_2 8$, $\log_3 27$ | $3$ |
| $\log_2 16$ | $4$ |
| $\log_4 2$, $\log_9 3$ | $0.5$ |
| $\log_2 3$ | $\approx 1.585$ |
| $\log_2 7$ | $\approx 2.807$ |

When it is not a whole number, leave the answer as $n^{\log_b a}$. That **is** the answer, and writing $n^{\log_2 3}$ is worth more marks than a rounded decimal.

---

# Problems for Case 1

Case 1 is the one where the recursion outgrows the work outside it. The answer never mentions $f(n)$.

## Q1. $T(n) = 2T(n/2) + 1$

**Step 1: read the four numbers.**

$$
T(n) = \textcolor{#5B8CFF}{2}\,T\!\left(\frac{n}{\textcolor{#FF5FA2}{2}}\right) + 1
$$

The work outside the recursion is the constant $1$, so write it in standard form:

$$
f(n) = 1 = n^{\textcolor{#22C55E}{0}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{2}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad \textcolor{#22C55E}{N} = \textcolor{#22C55E}{0}, \quad \textcolor{#EAB308}{P} = \textcolor{#EAB308}{0}
$$

**Step 2: compare.**

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{2} = 1 \; > \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{0}
$$

**Step 3: Case 1.**

$$
T(n) = O\!\left(n^{\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{2}}\right) = O(n^1)
$$

:mark[**Answer: $O(n)$**]{hex="#204A2E"}

## Q2. $T(n) = 4T(n/2) + n$

**Step 1: read the four numbers.**

$$
T(n) = \textcolor{#5B8CFF}{4}\,T\!\left(\frac{n}{\textcolor{#FF5FA2}{2}}\right) + n
$$

$$
f(n) = n = n^{\textcolor{#22C55E}{1}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{4}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad \textcolor{#22C55E}{N} = \textcolor{#22C55E}{1}, \quad \textcolor{#EAB308}{P} = \textcolor{#EAB308}{0}
$$

**Step 2: compare.**

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{4} = 2 \; > \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{1}
$$

**Step 3: Case 1.**

$$
T(n) = O\!\left(n^{\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{4}}\right) = O(n^2)
$$

:mark[**Answer: $O(n^2)$**]{hex="#5C3A1A"}

## Q3. $T(n) = 8T(n/2) + n \log n$

**Step 1: read the four numbers.**

$$
T(n) = \textcolor{#5B8CFF}{8}\,T\!\left(\frac{n}{\textcolor{#FF5FA2}{2}}\right) + n \log n
$$

$$
f(n) = n \log n = n^{\textcolor{#22C55E}{1}} \log^{\textcolor{#EAB308}{1}} n
$$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{8}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad \textcolor{#22C55E}{N} = \textcolor{#22C55E}{1}, \quad \textcolor{#EAB308}{P} = \textcolor{#EAB308}{1}
$$

**Step 2: compare.**

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{8} = 3 \; > \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{1}
$$

**Step 3: Case 1.** The $\log n$ in $f(n)$ never appears in the answer, because Case 1 ignores :color[P]{hex="#EAB308"}.

$$
T(n) = O\!\left(n^{\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{8}}\right) = O(n^3)
$$

:mark[**Answer: $O(n^3)$**]{hex="#5C2323"}

## Q4. $T(n) = 3T(n/2) + n$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{3}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = n^{\textcolor{#22C55E}{1}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{3} \approx 1.585 \; > \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{1}
$$

Case 1. The exponent is not a whole number, so leave it as it is:

$$
T(n) = O\!\left(n^{\log_2 3}\right) \approx O(n^{1.585})
$$

:mark[**Answer: $O(n^{\log_2 3})$**]{hex="#5C3A1A"}

## Q5. $T(n) = 9T(n/3) + n$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{9}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{3}, \quad f(n) = n^{\textcolor{#22C55E}{1}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{3}} \textcolor{#5B8CFF}{9} = 2 \; > \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{1}
$$

Case 1.

$$
T(n) = O(n^2)
$$

:mark[**Answer: $O(n^2)$**]{hex="#5C3A1A"}

## Q6. $T(n) = 2T(n/2) + \log n$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{2}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = \log n = n^{\textcolor{#22C55E}{0}} \log^{\textcolor{#EAB308}{1}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{2} = 1 \; > \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{0}
$$

Case 1, and again :color[P]{hex="#EAB308"} plays no part.

$$
T(n) = O(n^1)
$$

:mark[**Answer: $O(n)$**]{hex="#204A2E"}

## Q7. $T(n) = 16T(n/4) + n$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{16}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{4}, \quad f(n) = n^{\textcolor{#22C55E}{1}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{4}} \textcolor{#5B8CFF}{16} = 2 \; > \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{1}
$$

Case 1.

$$
T(n) = O(n^2)
$$

:mark[**Answer: $O(n^2)$**]{hex="#5C3A1A"}

## Q8. $T(n) = 7T(n/2) + n^2$

This is Strassen's matrix multiplication, and it is the reason the algorithm is famous.

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{7}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{7} \approx 2.807 \; > \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{2}
$$

Case 1.

$$
T(n) = O\!\left(n^{\log_2 7}\right) \approx O(n^{2.807})
$$

:mark[**Answer: $O(n^{\log_2 7})$**]{hex="#5C2323"} Beating the schoolbook $O(n^3)$ is exactly this: dropping :color[a]{hex="#5B8CFF"} from 8 to 7.

## Q9. $T(n) = 4T(n/2) + \log n$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{4}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = \log n = n^{\textcolor{#22C55E}{0}} \log^{\textcolor{#EAB308}{1}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{4} = 2 \; > \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{0}
$$

Case 1.

$$
T(n) = O(n^2)
$$

:mark[**Answer: $O(n^2)$**]{hex="#5C3A1A"}

## Q10. $T(n) = 8T(n/2) + n^2$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{8}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{8} = 3 \; > \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{2}
$$

Case 1.

$$
T(n) = O(n^3)
$$

:mark[**Answer: $O(n^3)$**]{hex="#5C2323"}

## Q11. $T(n) = 27T(n/3) + n^2$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{27}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{3}, \quad f(n) = n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{3}} \textcolor{#5B8CFF}{27} = 3 \; > \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{2}
$$

Case 1.

$$
T(n) = O(n^3)
$$

:mark[**Answer: $O(n^3)$**]{hex="#5C2323"}

## Q12. $T(n) = 5T(n/4) + n$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{5}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{4}, \quad f(n) = n^{\textcolor{#22C55E}{1}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{4}} \textcolor{#5B8CFF}{5} \approx 1.161 \; > \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{1}
$$

Case 1.

$$
T(n) = O\!\left(n^{\log_4 5}\right)
$$

:mark[**Answer: $O\!\left(n^{\log_4 5}\right)$**]{hex="#5C3A1A"} Leave the exponent as it is. A decimal is an approximation, and $n^{\log_4 5}$ is the answer.

## Q13. $T(n) = 3T(n/3) + \sqrt{n}$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{3}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{3}, \quad f(n) = \sqrt n = n^{\textcolor{#22C55E}{0.5}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{3}} \textcolor{#5B8CFF}{3} = 1 \; > \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{0.5}
$$

Case 1.

$$
T(n) = O(n)
$$

:mark[**Answer: $O(n)$**]{hex="#204A2E"}

## Q14. $T(n) = 4T(n/3) + n$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{4}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{3}, \quad f(n) = n^{\textcolor{#22C55E}{1}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{3}} \textcolor{#5B8CFF}{4} \approx 1.262 \; > \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{1}
$$

Case 1.

$$
T(n) = O\!\left(n^{\log_3 4}\right)
$$

:mark[**Answer: $O\!\left(n^{\log_3 4}\right)$**]{hex="#5C3A1A"}

## Q15. $T(n) = 6T(n/2) + n^2$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{6}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{6} \approx 2.585 \; > \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{2}
$$

Case 1.

$$
T(n) = O\!\left(n^{\log_2 6}\right)
$$

:mark[**Answer: $O\!\left(n^{\log_2 6}\right)$**]{hex="#5C2323"}

## Q16. $T(n) = 64T(n/4) + n^2 \log n$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{64}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{4}, \quad f(n) = n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{1}} n
$$

$$
\log_{\textcolor{#FF5FA2}{4}} \textcolor{#5B8CFF}{64} = 3 \; > \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{2}
$$

Case 1.

$$
T(n) = O(n^3)
$$

:mark[**Answer: $O(n^3)$**]{hex="#5C2323"}

## Q17. $T(n) = 10T(n/3) + n^2$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{10}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{3}, \quad f(n) = n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{3}} \textcolor{#5B8CFF}{10} \approx 2.096 \; > \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{2}
$$

Case 1.

$$
T(n) = O\!\left(n^{\log_3 10}\right)
$$

:mark[**Answer: $O\!\left(n^{\log_3 10}\right)$**]{hex="#5C3A1A"} Only just Case 1, but only just is enough.

## Q18. $T(n) = 4T(n/9) + \sqrt{n}$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{4}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{9}, \quad f(n) = \sqrt n = n^{\textcolor{#22C55E}{0.5}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{9}} \textcolor{#5B8CFF}{4} \approx 0.631 \; > \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{0.5}
$$

Case 1.

$$
T(n) = O\!\left(n^{\log_9 4}\right)
$$

:mark[**Answer: $O\!\left(n^{\log_9 4}\right)$**]{hex="#1B4A46"} The answer is sublinear, which Case 1 allows whenever $f(n)$ is lighter still.

---

# Problems for Case 2

Case 2 is the balanced one: the recursion and the work outside it cost the same at every level. This is where :color[P]{hex="#EAB308"} finally earns its colour, so read the sign of it carefully.

## Q19. $T(n) = 2T(n/2) + n$

**Step 1: read the four numbers.**

$$
T(n) = \textcolor{#5B8CFF}{2}\,T\!\left(\frac{n}{\textcolor{#FF5FA2}{2}}\right) + n
$$

$$
f(n) = n = n^{\textcolor{#22C55E}{1}} \log^{\textcolor{#EAB308}{0}} n
$$

**Step 2: compare.**

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{2} = 1 \; = \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{1}
$$

**Step 3: Case 2, and $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{0} > -1$**, so the log gains one power.

$$
T(n) = O\!\left(n^{\textcolor{#22C55E}{1}} \log^{\textcolor{#EAB308}{0}+1} n\right) = O(n \log n)
$$

:mark[**Answer: $O(n \log n)$**]{hex="#565426"} This is merge sort, and it is the same answer the tree method gave in Chapter 4.

## Q20. $T(n) = 4T(n/2) + n^2 \log^2 n$

**Step 1: read the four numbers.**

$$
T(n) = \textcolor{#5B8CFF}{4}\,T\!\left(\frac{n}{\textcolor{#FF5FA2}{2}}\right) + n^2 \log^2 n
$$

$$
f(n) = n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{2}} n
$$

**Step 2: compare.**

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{4} = 2 \; = \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{2}
$$

**Step 3: Case 2, and $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{2} > -1$.**

$$
T(n) = O\!\left(n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{2}+1} n\right) = O(n^2 \log^3 n)
$$

:mark[**Answer: $O(n^2 \log^3 n)$**]{hex="#5C3A1A"}

## Q21. $T(n) = 2T(n/2) + \dfrac{n}{\log n}$

**Step 1: read the four numbers.** The log is on the bottom, so its power is negative.

$$
f(n) = \frac{n}{\log n} = n^{\textcolor{#22C55E}{1}} \log^{\textcolor{#EAB308}{-1}} n
$$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{2}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad \textcolor{#22C55E}{N} = \textcolor{#22C55E}{1}, \quad \textcolor{#EAB308}{P} = \textcolor{#EAB308}{-1}
$$

**Step 2: compare.**

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{2} = 1 \; = \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{1}
$$

**Step 3: Case 2, and $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{-1}$ exactly**, which is the middle row.

$$
T(n) = O\!\left(n^{\textcolor{#22C55E}{1}} \log \log n\right)
$$

:mark[**Answer: $O(n \log \log n)$**]{hex="#565426"}

## Q22. $T(n) = 2T(n/2) + \dfrac{n}{\log^2 n}$

**Step 1: read the four numbers.**

$$
f(n) = \frac{n}{\log^2 n} = n^{\textcolor{#22C55E}{1}} \log^{\textcolor{#EAB308}{-2}} n
$$

**Step 2: compare.**

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{2} = 1 \; = \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{1}
$$

**Step 3: Case 2, and $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{-2} < -1$**, which is the bottom row: the log disappears completely.

$$
T(n) = O\!\left(n^{\textcolor{#22C55E}{1}}\right)
$$

:mark[**Answer: $O(n)$**]{hex="#204A2E"} Compare with Q21: the same recurrence with a slightly heavier divisor drops a whole $\log \log n$ factor.

## Q23. $T(n) = T(n/2) + 1$

Binary search.

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{1}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = 1 = n^{\textcolor{#22C55E}{0}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{1} = 0 \; = \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{0}
$$

Case 2 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{0} > -1$:

$$
T(n) = O\!\left(n^{\textcolor{#22C55E}{0}} \log^{\textcolor{#EAB308}{0}+1} n\right) = O(\log n)
$$

:mark[**Answer: $O(\log n)$**]{hex="#3B2A5E"}

## Q24. $T(n) = 4T(n/2) + n^2$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{4}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{4} = 2 \; = \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{2}
$$

Case 2 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{0} > -1$:

$$
T(n) = O(n^2 \log n)
$$

:mark[**Answer: $O(n^2 \log n)$**]{hex="#5C3A1A"} Note Q2 had the same :color[a]{hex="#5B8CFF"} and :color[b]{hex="#FF5FA2"} but a lighter $f(n)$, and landed in Case 1 instead.

## Q25. $T(n) = 3T(n/3) + n \log n$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{3}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{3}, \quad f(n) = n^{\textcolor{#22C55E}{1}} \log^{\textcolor{#EAB308}{1}} n
$$

$$
\log_{\textcolor{#FF5FA2}{3}} \textcolor{#5B8CFF}{3} = 1 \; = \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{1}
$$

Case 2 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{1} > -1$:

$$
T(n) = O\!\left(n \log^{\textcolor{#EAB308}{1}+1} n\right) = O(n \log^2 n)
$$

:mark[**Answer: $O(n \log^2 n)$**]{hex="#565426"}

## Q26. $T(n) = T(n/2) + \log n$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{1}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = n^{\textcolor{#22C55E}{0}} \log^{\textcolor{#EAB308}{1}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{1} = 0 \; = \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{0}
$$

Case 2 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{1} > -1$:

$$
T(n) = O\!\left(n^{\textcolor{#22C55E}{0}} \log^{\textcolor{#EAB308}{1}+1} n\right) = O(\log^2 n)
$$

:mark[**Answer: $O(\log^2 n)$**]{hex="#3B2A5E"}

## Q27. $T(n) = 8T(n/2) + n^3$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{8}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = n^{\textcolor{#22C55E}{3}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{8} = 3 \; = \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{3}
$$

Case 2 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{0} > -1$:

$$
T(n) = O(n^3 \log n)
$$

:mark[**Answer: $O(n^3 \log n)$**]{hex="#5C2323"}

## Q28. $T(n) = 9T(n/3) + n^2 \log n$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{9}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{3}, \quad f(n) = n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{1}} n
$$

$$
\log_{\textcolor{#FF5FA2}{3}} \textcolor{#5B8CFF}{9} = 2 \; = \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{2}
$$

Case 2 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{1} > -1$:

$$
T(n) = O(n^2 \log^2 n)
$$

:mark[**Answer: $O(n^2 \log^2 n)$**]{hex="#5C3A1A"}

## Q29. $T(n) = 2T(n/2) + n \log^2 n$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{2}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = n^{\textcolor{#22C55E}{1}} \log^{\textcolor{#EAB308}{2}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{2} = 1 \; = \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{1}
$$

Case 2 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{2} > -1$:

$$
T(n) = O(n \log^3 n)
$$

:mark[**Answer: $O(n \log^3 n)$**]{hex="#565426"}

## Q30. $T(n) = 4T(n/2) + \dfrac{n^2}{\log n}$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{4}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = \frac{n^2}{\log n} = n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{-1}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{4} = 2 \; = \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{2}
$$

Case 2 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{-1}$ exactly, which is the middle row:

$$
T(n) = O(n^2 \log \log n)
$$

:mark[**Answer: $O(n^2 \log \log n)$**]{hex="#5C3A1A"}

## Q31. $T(n) = 4T(n/2) + \dfrac{n^2}{\log^2 n}$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{4}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = \frac{n^2}{\log^2 n} = n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{-2}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{4} = 2 \; = \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{2}
$$

Case 2 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{-2} < -1$, which is the bottom row, so the log disappears:

$$
T(n) = O(n^2)
$$

:mark[**Answer: $O(n^2)$**]{hex="#5C3A1A"}

## Q32. $T(n) = T(n/3) + 1$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{1}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{3}, \quad f(n) = 1 = n^{\textcolor{#22C55E}{0}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{3}} \textcolor{#5B8CFF}{1} = 0 \; = \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{0}
$$

Case 2 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{0} > -1$:

$$
T(n) = O(\log n)
$$

:mark[**Answer: $O(\log n)$**]{hex="#3B2A5E"} Ternary search. Cutting the input into three instead of two changes the constant, not the order.

## Q33. $T(n) = 16T(n/4) + n^2$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{16}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{4}, \quad f(n) = n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{4}} \textcolor{#5B8CFF}{16} = 2 \; = \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{2}
$$

Case 2 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{0} > -1$:

$$
T(n) = O(n^2 \log n)
$$

:mark[**Answer: $O(n^2 \log n)$**]{hex="#5C3A1A"}

## Q34. $T(n) = 3T(n/3) + \dfrac{n}{\log n}$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{3}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{3}, \quad f(n) = \frac{n}{\log n} = n^{\textcolor{#22C55E}{1}} \log^{\textcolor{#EAB308}{-1}} n
$$

$$
\log_{\textcolor{#FF5FA2}{3}} \textcolor{#5B8CFF}{3} = 1 \; = \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{1}
$$

Case 2 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{-1}$ exactly, which is the middle row:

$$
T(n) = O(n \log \log n)
$$

:mark[**Answer: $O(n \log \log n)$**]{hex="#565426"}

## Q35. $T(n) = 2T(n/2) + \dfrac{n}{\log^3 n}$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{2}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = \frac{n}{\log^3 n} = n^{\textcolor{#22C55E}{1}} \log^{\textcolor{#EAB308}{-3}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{2} = 1 \; = \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{1}
$$

Case 2 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{-3} < -1$, which is the bottom row, so the log disappears:

$$
T(n) = O(n)
$$

:mark[**Answer: $O(n)$**]{hex="#204A2E"}

## Q36. $T(n) = 27T(n/3) + n^3 \log n$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{27}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{3}, \quad f(n) = n^{\textcolor{#22C55E}{3}} \log^{\textcolor{#EAB308}{1}} n
$$

$$
\log_{\textcolor{#FF5FA2}{3}} \textcolor{#5B8CFF}{27} = 3 \; = \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{3}
$$

Case 2 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{1} > -1$:

$$
T(n) = O(n^3 \log^2 n)
$$

:mark[**Answer: $O(n^3 \log^2 n)$**]{hex="#5C2323"}

---

# Problems for Case 3

Case 3 is the top heavy one: the work at the root already outweighs everything below it, so the answer is $f(n)$ itself.

## Q37. $T(n) = T(n/2) + n^2$

**Step 1: read the four numbers.**

$$
T(n) = \textcolor{#5B8CFF}{1}\,T\!\left(\frac{n}{\textcolor{#FF5FA2}{2}}\right) + n^2
$$

A missing multiplier means $\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{1}$.

$$
f(n) = n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{0}} n
$$

**Step 2: compare.**

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{1} = 0 \; < \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{2}
$$

**Step 3: Case 3, and $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{0} \geq 0$**, so the top row applies:

$$
T(n) = O\!\left(n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{0}} n\right) = O(n^2)
$$

:mark[**Answer: $O(n^2)$**]{hex="#5C3A1A"}

## Q38. $T(n) = 2T(n/2) + n^2 \log^2 n$

**Step 1: read the four numbers.**

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{2}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{2}} n
$$

**Step 2: compare.**

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{2} = 1 \; < \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{2}
$$

**Step 3: Case 3, and $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{2} \geq 0$.** The answer is $f(n)$ unchanged, log and all:

$$
T(n) = O\!\left(n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{2}} n\right)
$$

:mark[**Answer: $O(n^2 \log^2 n)$**]{hex="#5C3A1A"} Compare with Q20, where the same $f(n)$ sat in Case 2 and gained a power of log. In Case 3 it never does.

## Q39. $T(n) = 4T(n/2) + n^3$

**Step 1: read the four numbers.**

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{4}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = n^{\textcolor{#22C55E}{3}} \log^{\textcolor{#EAB308}{0}} n
$$

**Step 2: compare.**

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{4} = 2 \; < \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{3}
$$

**Step 3: Case 3, $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{0}$.**

$$
T(n) = O(n^3)
$$

:mark[**Answer: $O(n^3)$**]{hex="#5C2323"}

## Q40. $T(n) = 2T(n/2) + n^2$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{2}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{2} = 1 \; < \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{2}
$$

Case 3 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{0}$:

$$
T(n) = O(n^2)
$$

:mark[**Answer: $O(n^2)$**]{hex="#5C3A1A"}

## Q41. $T(n) = 3T(n/2) + n^2$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{3}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{3} \approx 1.585 \; < \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{2}
$$

Case 3, so the awkward exponent never reaches the answer:

$$
T(n) = O(n^2)
$$

:mark[**Answer: $O(n^2)$**]{hex="#5C3A1A"}

## Q42. $T(n) = T(n/2) + n$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{1}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = n^{\textcolor{#22C55E}{1}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{1} = 0 \; < \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{1}
$$

Case 3:

$$
T(n) = O(n)
$$

:mark[**Answer: $O(n)$**]{hex="#204A2E"}

## Q43. $T(n) = 4T(n/2) + n^2 \sqrt{n}$

$$
f(n) = n^2 \sqrt n = n^{\textcolor{#22C55E}{2.5}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{4} = 2 \; < \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{2.5}
$$

Case 3:

$$
T(n) = O\!\left(n^{2.5}\right)
$$

:mark[**Answer: $O(n^{2.5})$**]{hex="#5C2323"}

## Q44. $T(n) = 2T(n/2) + \dfrac{n^2}{\log n}$

The first of two questions here with a negative :color[P]{hex="#EAB308"}, which is what the second row of Case 3 is for.

$$
f(n) = \frac{n^2}{\log n} = n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{-1}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{2} = 1 \; < \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{2}
$$

Case 3 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{-1} < 0$, which is the bottom row, so the log is dropped:

$$
T(n) = O\!\left(n^{\textcolor{#22C55E}{2}}\right)
$$

:mark[**Answer: $O(n^2)$**]{hex="#5C3A1A"}

## Q45. $T(n) = 2T(n/4) + n^{0.51}$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{2}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{4}, \quad f(n) = n^{\textcolor{#22C55E}{0.51}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{4}} \textcolor{#5B8CFF}{2} = 0.5 \; < \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{0.51}
$$

Case 3, by a margin of $0.01$. The comparison is all that matters, not how close it is.

$$
T(n) = O\!\left(n^{0.51}\right)
$$

:mark[**Answer: $O(n^{0.51})$**]{hex="#1B4A46"}

## Q46. $T(n) = 2T(n/2) + n^3$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{2}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = n^{\textcolor{#22C55E}{3}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{2} = 1 \; < \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{3}
$$

Case 3 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{0} \geq 0$:

$$
T(n) = O(n^3)
$$

:mark[**Answer: $O(n^3)$**]{hex="#5C2323"}

## Q47. $T(n) = 3T(n/4) + n \log n$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{3}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{4}, \quad f(n) = n^{\textcolor{#22C55E}{1}} \log^{\textcolor{#EAB308}{1}} n
$$

$$
\log_{\textcolor{#FF5FA2}{4}} \textcolor{#5B8CFF}{3} \approx 0.792 \; < \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{1}
$$

Case 3 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{1} \geq 0$:

$$
T(n) = O(n \log n)
$$

:mark[**Answer: $O(n \log n)$**]{hex="#565426"} Case 3 hands $f(n)$ back untouched, log and all.

## Q48. $T(n) = 2T(n/3) + n^2$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{2}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{3}, \quad f(n) = n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{3}} \textcolor{#5B8CFF}{2} \approx 0.631 \; < \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{2}
$$

Case 3 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{0} \geq 0$:

$$
T(n) = O(n^2)
$$

:mark[**Answer: $O(n^2)$**]{hex="#5C3A1A"}

## Q49. $T(n) = 4T(n/3) + n^2$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{4}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{3}, \quad f(n) = n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{3}} \textcolor{#5B8CFF}{4} \approx 1.262 \; < \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{2}
$$

Case 3 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{0} \geq 0$:

$$
T(n) = O(n^2)
$$

:mark[**Answer: $O(n^2)$**]{hex="#5C3A1A"}

## Q50. $T(n) = T(n/2) + n \log n$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{1}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = n^{\textcolor{#22C55E}{1}} \log^{\textcolor{#EAB308}{1}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{1} = 0 \; < \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{1}
$$

Case 3 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{1} \geq 0$:

$$
T(n) = O(n \log n)
$$

:mark[**Answer: $O(n \log n)$**]{hex="#565426"}

## Q51. $T(n) = 8T(n/4) + n^2$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{8}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{4}, \quad f(n) = n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{4}} \textcolor{#5B8CFF}{8} = 1.5 \; < \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{2}
$$

Case 3 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{0} \geq 0$:

$$
T(n) = O(n^2)
$$

:mark[**Answer: $O(n^2)$**]{hex="#5C3A1A"}

## Q52. $T(n) = 9T(n/4) + n^2 \log n$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{9}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{4}, \quad f(n) = n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{1}} n
$$

$$
\log_{\textcolor{#FF5FA2}{4}} \textcolor{#5B8CFF}{9} \approx 1.585 \; < \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{2}
$$

Case 3 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{1} \geq 0$:

$$
T(n) = O(n^2 \log n)
$$

:mark[**Answer: $O(n^2 \log n)$**]{hex="#5C3A1A"}

## Q53. $T(n) = 3T(n/2) + n^2 \log^2 n$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{3}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = n^{\textcolor{#22C55E}{2}} \log^{\textcolor{#EAB308}{2}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{3} \approx 1.585 \; < \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{2}
$$

Case 3 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{2} \geq 0$:

$$
T(n) = O(n^2 \log^2 n)
$$

:mark[**Answer: $O(n^2 \log^2 n)$**]{hex="#5C3A1A"}

## Q54. $T(n) = 4T(n/2) + \dfrac{n^3}{\log n}$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{4}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = \frac{n^3}{\log n} = n^{\textcolor{#22C55E}{3}} \log^{\textcolor{#EAB308}{-1}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{4} = 2 \; < \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{3}
$$

Case 3 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{-1} < 0$, which is the bottom row, so the log is dropped:

$$
T(n) = O(n^3)
$$

:mark[**Answer: $O(n^3)$**]{hex="#5C2323"} The second of the two negative $P$ questions in this case, and it drops the log for the same reason Q44 did.

## Q55. $T(n) = 16T(n/2) + n^5$

$$
\textcolor{#5B8CFF}{a} = \textcolor{#5B8CFF}{16}, \quad \textcolor{#FF5FA2}{b} = \textcolor{#FF5FA2}{2}, \quad f(n) = n^{\textcolor{#22C55E}{5}} \log^{\textcolor{#EAB308}{0}} n
$$

$$
\log_{\textcolor{#FF5FA2}{2}} \textcolor{#5B8CFF}{16} = 4 \; < \; \textcolor{#22C55E}{N} = \textcolor{#22C55E}{5}
$$

Case 3 with $\textcolor{#EAB308}{P} = \textcolor{#EAB308}{0} \geq 0$:

$$
T(n) = O(n^5)
$$

:mark[**Answer: $O(n^5)$**]{hex="#5C2323"}

---

## Where the theorem does not apply

Quoting a case on a recurrence outside the standard form is the easiest way to lose the marks. Check for these first:

| Recurrence | Why it fails | Use instead |
| --- | --- | --- |
| $T(n) = T(n-1) + n$ | decreasing, not dividing | substitution, Chapter 3 |
| $T(n) = 2T(n-1) + 1$ | decreasing | substitution, Chapter 3 |
| $T(n) = 2^n T(n/2) + n$ | :color[a]{hex="#5B8CFF"} is not a constant | tree, Chapter 4 |
| $T(n) = 0.5\,T(n/2) + n$ | $\textcolor{#5B8CFF}{a} < 1$, half a subproblem is meaningless | nothing, it is not valid |
| $T(n) = T(n/2) + 2^n$ | $f(n)$ is not $n^N \log^P n$ | tree, Chapter 4 |
| $T(n) = T(\sqrt n) + 1$ | the size is not divided by a constant | substitution with a change of variable |
| $T(n) = T(n/3) + T(2n/3) + n$ | two different sized subproblems | tree, Chapter 4 |

## Everything on one line

> Read :color[a]{hex="#5B8CFF"}, :color[b]{hex="#FF5FA2"}, :color[N]{hex="#22C55E"}, :color[P]{hex="#EAB308"}. Compare $\log_b a$ with $N$. **Bigger** gives $n^{\log_b a}$, **equal** gives $n^N \log^{P+1} n$ (or $\log \log n$ at $P = -1$, or nothing below it), **smaller** gives $f(n)$ back.

| $\log_{\textcolor{#FF5FA2}{b}} \textcolor{#5B8CFF}{a}$ vs $\textcolor{#22C55E}{N}$ | Condition on :color[P]{hex="#EAB308"} | $T(n)$ |
| --- | --- | --- |
| $>$ | any | $O\!\left(n^{\log_{\textcolor{#FF5FA2}{b}} \textcolor{#5B8CFF}{a}}\right)$ |
| $=$ | $\textcolor{#EAB308}{P} > -1$ | $O\!\left(n^{\textcolor{#22C55E}{N}} \log^{\textcolor{#EAB308}{P}+1} n\right)$ |
| $=$ | $\textcolor{#EAB308}{P} = -1$ | $O\!\left(n^{\textcolor{#22C55E}{N}} \log \log n\right)$ |
| $=$ | $\textcolor{#EAB308}{P} < -1$ | $O\!\left(n^{\textcolor{#22C55E}{N}}\right)$ |
| $<$ | $\textcolor{#EAB308}{P} \geq 0$ | $O\!\left(n^{\textcolor{#22C55E}{N}} \log^{\textcolor{#EAB308}{P}} n\right)$ |
| $<$ | $\textcolor{#EAB308}{P} \leq 0$ | $O\!\left(n^{\textcolor{#22C55E}{N}}\right)$ |

## Self test

Solve each with the three steps, then check.

1. $T(n) = 2T(n/2) + n^3$
2. $T(n) = 16T(n/4) + n^2$
3. $T(n) = T(n/2) + \dfrac{1}{\log n}$ ... careful, is this even in standard form?
4. $T(n) = 8T(n/4) + n \log n$
5. $T(n) = 5T(n/2) + n^2 \log n$

> **Answers.**
> 1. $\log_2 2 = 1 < 3$, Case 3, $P = 0$: $O(n^3)$.
> 2. $\log_4 16 = 2 = 2$, Case 2, $P = 0$: $O(n^2 \log n)$.
> 3. $f(n) = n^0 \log^{-1} n$, so $N = 0$, $P = -1$, and $\log_2 1 = 0 = N$: Case 2 middle row, $O(\log \log n)$. It is in standard form after all.
> 4. $\log_4 8 = 1.5 > 1$, Case 1: $O(n^{1.5})$.
> 5. $\log_2 5 \approx 2.32 > 2$, Case 1: $O(n^{\log_2 5})$.

## Chapter summary

- The master theorem applies to $T(n) = a\,T(n/b) + f(n)$ with $f(n) = n^N \log^P n$, and to nothing else.
- One comparison, $\log_b a$ against $N$, picks the case. :color[P]{hex="#EAB308"} only picks the row inside the case.
- Case 1 is leaf heavy and forgets $f(n)$. Case 3 is root heavy and returns $f(n)$. Case 2 is balanced, and pays one extra power of $\log$.
- Always rewrite $f(n)$ as $n^N \log^P n$ first. A log in a denominator is a negative :color[P]{hex="#EAB308"}, and that is where the marks are lost.
