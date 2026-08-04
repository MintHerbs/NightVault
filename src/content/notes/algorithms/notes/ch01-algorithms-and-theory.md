# Chapter 1: Algorithms and Theory

Everything in this module comes back to one question: **given two ways of solving the same problem, which one do you pick?** This chapter builds the vocabulary for answering that, and ends with the exam pattern you will meet every year: *a faster computer or a faster algorithm?*

## What is an algorithm

An **algorithm** is a finite, ordered set of unambiguous steps that takes some input and produces the correct output for every valid input.

Three words in that sentence do the work:

- **finite** it has to stop
- **unambiguous** every step means exactly one thing
- **every valid input** it is not allowed to work only on the examples you tried

> An algorithm is the *method*. A program is one *implementation* of that method in one language. The same algorithm can be written in Python, C or on paper, and it is still the same algorithm.

**Example.** Find the largest number in a list.

```text algorithm: find maximum
1. If the list is empty, report "no maximum" and stop.
2. Set max to the first item.
3. For each remaining item x in the list:
       if x > max, set max to x.
4. Report max.
```

That is an algorithm: finite (the list ends), unambiguous (no step is open to interpretation), and correct for every list, not just the one you tested.

A recipe that says *"add salt to taste"* is :color[not]{hex="#EF4444"} an algorithm. A step that says *"pick any number and check if it works"* is not one either.

## Properties of an algorithm

Five classic properties, usually attributed to Knuth. Exam questions ask you to name them and to say which one a bad example violates.

| Property | Meaning | Violated when |
| --- | --- | --- |
| **Input** | Zero or more well defined inputs are supplied | The steps refer to data that was never given |
| **Output** | At least one well defined output is produced | It runs and reports nothing useful |
| **Definiteness** | Every step is clear and unambiguous | "Sort it somehow", "add salt to taste" |
| **Finiteness** | It terminates after a finite number of steps | `while True:` with no exit, or a recursion with no base case |
| **Effectiveness** | Every step is basic enough to be carried out exactly, in finite time, with pen and paper | "Let x be the exact value of $\pi$", "guess the right answer" |

Two more that most textbooks add:

| Property | Meaning |
| --- | --- |
| **Correctness** | For every valid input it produces the right output |
| **Generality** | It solves the whole class of problems, not one instance |

**Spot the violation.**

```text which property fails?
Step 1: read n
Step 2: set i = 1
Step 3: if i is not equal to n, go to Step 3
Step 4: print i
```

Step 3 loops forever whenever $n \neq 1$, so it breaks :color[**finiteness**]{hex="#EF4444"}.

## Comparing two algorithms

You have two algorithms that solve the same problem. There are only two ways to decide which is better.

| Approach | What you do | What you get |
| --- | --- | --- |
| **Empirical (experimental)** | Implement both, run them, time them with a clock | Real seconds, on one machine, for the inputs you tried |
| **Theoretical (asymptotic)** | Count the work as a function of input size, on paper | A growth rate that holds on every machine, for every input size |

Both are used in practice. The rest of this module is about the second one, but you need to know why the first one is not enough.

## Empirical analysis

**Empirical analysis** means measuring an algorithm by actually running it and recording the time (or memory, or number of comparisons) it takes.

```python empirical analysis of two sorts
import time, random

data = [random.randint(0, 10_000) for _ in range(10_000)]

start = time.perf_counter()
bubble_sort(data.copy())
print("bubble:", time.perf_counter() - start, "s")

start = time.perf_counter()
sorted(data.copy())
print("built-in:", time.perf_counter() - start, "s")
```

A typical run produces a table like this:

| Input size $n$ | Bubble sort | Built in sort |
| --- | --- | --- |
| 1 000 | 0.09 s | 0.0002 s |
| 5 000 | 2.20 s | 0.0011 s |
| 10 000 | 8.80 s | 0.0024 s |
| 20 000 | 35.30 s | 0.0051 s |

Read the *pattern*, not the numbers: doubling $n$ multiplies bubble sort's time by about 4, and the built-in sort's by about 2. That is the useful part of the experiment.

## Limitations of empirical analysis

| Limitation | Why it hurts |
| --- | --- |
| **You must implement first** | You cannot compare 5 candidate designs without writing all 5 |
| **Machine dependent** | The same code on a faster CPU, more RAM or a different cache gives different numbers |
| **Environment dependent** | Language, compiler, interpreter version, OS scheduling and background processes all move the result |
| **Data dependent** | The times you measured belong to the inputs you happened to pick. An already sorted list can make one sort look brilliant |
| **Limited input sizes** | You cannot run $n = 10^9$ just to find out. The interesting sizes are exactly the ones you cannot test |
| **No proof** | Measurements on some inputs never prove behaviour on all inputs |

> :mark[**The core problem:**]{hex="#5C3A1A"} empirical results measure *this program, on this machine, with this data, today*. Change any of the three and the numbers change. Theoretical analysis measures the algorithm itself.

## Growth rate (time complexity)

The **growth rate** of an algorithm is the rate at which its cost increases as the input size increases.

Two decisions make this machine independent:

1. **Count basic operations, not seconds.** Comparisons, assignments, arithmetic. Each takes some constant time $c$ on any machine, so seconds are just $c \times (\text{operations})$.
2. **Care about large $n$ only.** Every algorithm is fast on 10 items. The difference shows up when the input grows.

So instead of "8.8 seconds", we say the cost is $T(n) = c n^2$, and then we drop the constant $c$ and call it :color[**quadratic growth**]{hex="#EA6C0A"}.

### Why constants and lower order terms are dropped

Take $T(n) = 2n^2 + 100n + 5000$.

| $n$ | $2n^2$ | $100n$ | $5000$ | Share of the total from $2n^2$ |
| --- | --- | --- | --- | --- |
| 10 | 200 | 1 000 | 5 000 | 3 % |
| 100 | 20 000 | 10 000 | 5 000 | 57 % |
| 1 000 | 2 000 000 | 100 000 | 5 000 | 95 % |
| 10 000 | 200 000 000 | 1 000 000 | 5 000 | 99.5 % |

For small $n$ the constant 5000 dominates, which is exactly why small inputs tell you nothing. As $n$ grows, the **highest order term** takes over completely. So $T(n) = 2n^2 + 100n + 5000$ is $O(n^2)$.

### The picture

![Growth rates of 2^n, 2n squared, 5n log n, 20n, 10n and the constant 40](/notes/img/algorithms/ch01-growth-rates.svg)

The same curves, zoomed in on small $n$, where the ordering is still a mess:

![The same equations plotted for n up to 16, where the curves cross each other](/notes/img/algorithms/ch01-growth-rates-zoom.svg)

Read three things off these two plots:

- At $n = 4$, $2^n$ is the *cheapest* of the curved lines. By $n = 10$ it has left the chart. **Small inputs lie.**
- $5n \log n$ is *cheaper* than $20n$ until about $n = 16$, and loses from there on. A crossover point is normal, and it does not change which one is better *asymptotically*.
- The constant 40 is a flat line. It never cares how big the input is.

### Growth rates, ordered

| Highest order term | Growth rate | Fast or slow |
| --- | --- | --- |
| some constant | Constant | :color[Fast]{hex="#22C55E"} |
| $\log n$ | Logarithmic | |
| $n$ | Linear | |
| $n \log n$ | Log linear | |
| $n^2$ | Quadratic | |
| $n^3$ | Cubic | |
| $2^n$ | Exponential | :color[Slow]{hex="#EF4444"} |

Order to memorise:

$$
1 \;<\; \log n \;<\; \sqrt{n} \;<\; n \;<\; n \log n \;<\; n^2 \;<\; n^3 \;<\; 2^n \;<\; n!
$$

## A faster computer or a faster algorithm?

The tempting answer to a slow program is "buy a better machine". Here is what that actually buys you.

Let $c$ be the time one input costs, and $x$ the speed of the machine. A machine 10 times faster does the same unit of work in $c/10$.

**Linear algorithm, $T = cn$**

| Speed of computer | No. of inputs | Time for 1 input | Total time |
| --- | --- | --- | --- |
| $x$ | $n$ | $c$ | $T = cn$ |
| $10x$ | $10n$ | $c/10$ | $T = (10n)(c/10) = cn$ |

Ten times the machine, ten times the input, :color[**same total time**]{hex="#22C55E"}. Hardware pays off perfectly.

**Quadratic algorithm, $T = cn^2$**

| Speed of computer | No. of inputs | Time for 1 input | Total time |
| --- | --- | --- | --- |
| $x$ | $n$ | $c$ | $T = cn^2$ |
| $10x$ | $10n$ | $c/10$ | $T = (10n)^2(c/10) = 10cn^2$ |

Ten times the machine, ten times the input, and it now takes :color[**ten times longer**]{hex="#EF4444"}. To keep the same running time on a 10 times faster machine, you can only grow the input by $\sqrt{10} \approx 3.16$.

**What a 10 times faster machine buys, per growth rate**

If $n$ is the largest input you can finish in one hour today, $n'$ is the largest you could finish in one hour on a machine 10 times faster:

| Cost | Largest input $n'$ | In words |
| --- | --- | --- |
| $10n$ | $10n$ | 10 times the work |
| $10 n \log n$ | slightly under $10n$ | almost 10 times |
| $2n^2$ | $3.16n$ | about 3 times |
| $2n^3$ | $2.15n$ | about twice |
| $2^n$ | $n + 3.3$ | :color[three more items]{hex="#EF4444"} |

> :mark[**The lesson:**]{hex="#3B2A5E"} hardware multiplies the input size you can handle by a constant factor, and that factor shrinks as the growth rate worsens. For an exponential algorithm, hardware is useless: a machine a **thousand** times faster adds about **10** items to what you can solve. Only a better algorithm changes the shape of the curve.

## The exam pattern

Every question of this type is the same three steps.

> **Step 1.** Write the proportionality from the given complexity, and turn it into an equation with a constant $k$.
> $T \propto n^2 \;\Rightarrow\; T = k n^2$
>
> **Step 2.** Substitute the one data point you were given, and solve for $k$.
>
> **Step 3.** Put $k$ back in and solve for whatever is asked.

Two extra rules cover the variations:

- **A machine $s$ times faster** does every operation in $1/s$ of the time, so $\;T_{\text{new}} = \dfrac{k f(n)}{s}$.
- **If you only need a ratio**, $k$ cancels and you never have to find it:
  $$\frac{T_2}{T_1} = \frac{f(n_2)}{f(n_1)}$$

---

# Solved questions

## Q1. The classic

*A sorting algorithm is $O(n^2)$ in the worst case. It takes 2 seconds to sort 10 000 records.*
*(a) What is the predicted time to sort 20 000 records?*
*(b) On a machine 100 times as fast, how many records can be processed in 4 seconds?*

**(a)**

$$
T = k n^2 \quad\Rightarrow\quad 2 = k(10\,000)^2 \quad\Rightarrow\quad k = \frac{2}{10^8} = 2 \times 10^{-8}
$$

$$
T = 2 \times 10^{-8} \times (20\,000)^2 = 2 \times 10^{-8} \times 4 \times 10^{8} = 8
$$

:mark[**8 seconds.**]{hex="#204A2E"} Doubling the input on a quadratic algorithm quadruples the time.

**(b)** The machine is 100 times faster, so the cost is divided by 100:

$$
T = \frac{k n^2}{100} \quad\Rightarrow\quad 4 = \frac{2 \times 10^{-8} \, n^2}{100}
$$

$$
n^2 = \frac{4 \times 100}{2 \times 10^{-8}} = 2 \times 10^{10} \quad\Rightarrow\quad n = \sqrt{2 \times 10^{10}} \approx 141\,421
$$

:mark[**About 141 421 records.**]{hex="#204A2E"} A 100 times faster machine bought only 10 times the input, because $\sqrt{100} = 10$.

## Q2. Linear search

*A search algorithm is $O(n)$. It takes 0.5 seconds on 1 000 000 records.*
*(a) Predicted time for 2 500 000 records?*
*(b) On a machine 5 times as fast, how many records in 0.5 seconds?*

**(a)** $T = kn$, so $0.5 = k(10^6)$ and $k = 5 \times 10^{-7}$.

$$
T = 5 \times 10^{-7} \times 2.5 \times 10^{6} = 1.25
$$

:mark[**1.25 seconds.**]{hex="#204A2E"}

**(b)** $\;0.5 = \dfrac{5 \times 10^{-7} n}{5} \Rightarrow n = 5 \times 10^{6}$.

:mark[**5 000 000 records.**]{hex="#204A2E"} For a linear algorithm the speedup passes straight through: 5 times the machine, 5 times the records.

## Q3. Ratios without $k$

*An $O(n^2)$ algorithm takes $t$ seconds on an input of size $n$. How long on an input of size $3n$?*

$$
\frac{T_2}{T_1} = \frac{(3n)^2}{n^2} = 9
$$

:mark[**$9t$ seconds.**]{hex="#204A2E"} When both sizes are given, $k$ always cancels, so skip Step 2.

Worth memorising, for input multiplied by $m$:

| Complexity | Time multiplied by |
| --- | --- |
| $O(\log n)$ | adds $\log m$ |
| $O(n)$ | $m$ |
| $O(n^2)$ | $m^2$ |
| $O(n^3)$ | $m^3$ |
| $O(2^n)$ | astronomically, see Q10 |

## Q4. Identify the complexity from measurements

*An algorithm takes 1 second on 1 000 records and 4 seconds on 2 000 records. State the likely complexity and predict the time for 8 000 records.*

Input doubled, time went up 4 times. Time $\propto n^2$, so the algorithm is :color[$O(n^2)$]{hex="#EA6C0A"}.

$$
\frac{T_2}{T_1} = \left(\frac{8000}{1000}\right)^2 = 64 \quad\Rightarrow\quad T_2 = 64 \times 1
$$

:mark[**64 seconds.**]{hex="#204A2E"}

> Doubling the input and watching the factor is the fastest way to name a complexity: factor $\approx 2$ is linear, $\approx 4$ is quadratic, $\approx 8$ is cubic, just over 2 is $n \log n$, unchanged is logarithmic.

## Q5. Cubic

*An $O(n^3)$ algorithm takes 5 seconds when $n = 100$.*
*(a) Time when $n = 300$?*
*(b) On a machine 64 times as fast, what is the largest $n$ solvable in 5 seconds?*

**(a)** $\left(\frac{300}{100}\right)^3 = 27$, so $T = 27 \times 5 = 135$.

:mark[**135 seconds.**]{hex="#204A2E"}

**(b)** $k = \dfrac{5}{100^3} = 5 \times 10^{-6}$.

$$
5 = \frac{5 \times 10^{-6} n^3}{64} \quad\Rightarrow\quad n^3 = 64 \times 10^{6} \quad\Rightarrow\quad n = \sqrt[3]{64 \times 10^6} = 400
$$

:mark[**$n = 400$.**]{hex="#204A2E"} 64 times the machine, only $\sqrt[3]{64} = 4$ times the input.

## Q6. Log linear, with clean powers of 2

*A merge sort is $O(n \log_2 n)$ and takes 5 seconds on 1024 records.*
*(a) Time for 2048 records? (b) Time for 4096 records?*

$$
T = k n \log_2 n \quad\Rightarrow\quad 5 = k \times 1024 \times 10 \quad\Rightarrow\quad k = \frac{5}{10\,240}
$$

**(a)** $T = \dfrac{5}{10\,240} \times 2048 \times 11 = 11$ :mark[**11 seconds**]{hex="#204A2E"}

**(b)** $T = \dfrac{5}{10\,240} \times 4096 \times 12 = 24$ :mark[**24 seconds**]{hex="#204A2E"}

Doubling the input multiplies the time by a bit more than 2 (here 2.2, then 2.18), never by 4. That "bit more" is the $\log$ term.

## Q7. Log linear, with real world numbers

*An $O(n \log_2 n)$ sort takes 6 seconds on 1 000 000 records. How long on 2 000 000?*

$$
\log_2 10^6 = 19.93, \qquad \log_2 (2 \times 10^6) = 20.93
$$

$$
\frac{T_2}{T_1} = \frac{2 \times 10^6 \times 20.93}{10^6 \times 19.93} = 2 \times 1.050 = 2.10
$$

$$
T_2 = 6 \times 2.10 = 12.6
$$

:mark[**About 12.6 seconds.**]{hex="#204A2E"} This is why $n \log n$ sorts are treated as "practically linear": the log term adds 5 %, not a whole factor.

## Q8. Logarithmic

*A binary search is $O(\log_2 n)$ and takes 4 ms on a sorted list of $2^{20} = 1\,048\,576$ items.*
*(a) Time on $2^{30}$ items? (b) The largest list searchable in 5 ms?*

$$
T = k \log_2 n \quad\Rightarrow\quad 4 = k \times 20 \quad\Rightarrow\quad k = 0.2 \text{ ms per step}
$$

**(a)** $T = 0.2 \times 30 = 6$ :mark[**6 ms**]{hex="#204A2E"} for a list a **thousand times** longer.

**(b)** $5 = 0.2 \log_2 n \Rightarrow \log_2 n = 25 \Rightarrow n = 2^{25}$

:mark[**33 554 432 items.**]{hex="#204A2E"}

## Q9. Square root

*An algorithm is $O(\sqrt{n})$ and takes 2 seconds when $n = 10\,000$. Time when $n = 1\,000\,000$?*

$$
\frac{T_2}{T_1} = \frac{\sqrt{10^6}}{\sqrt{10^4}} = \frac{1000}{100} = 10
$$

:mark[**20 seconds**]{hex="#204A2E"} for 100 times the input.

## Q10. Exponential, and why hardware cannot save it

*An exact algorithm is $O(2^n)$ and takes 1 second when $n = 30$.*
*(a) Time when $n = 35$?*
*(b) On a machine 1000 times as fast, what is the largest $n$ solvable in 1 second?*

**(a)** $\dfrac{2^{35}}{2^{30}} = 2^5 = 32$ :mark[**32 seconds**]{hex="#204A2E"} for five extra items.

**(b)**

$$
1 = \frac{k 2^n}{1000}, \qquad k = \frac{1}{2^{30}} \quad\Rightarrow\quad 2^n = 1000 \times 2^{30}
$$

$$
n = 30 + \log_2 1000 = 30 + 9.97 = 39.97
$$

:mark[**$n = 39$.**]{hex="#204A2E"} A machine a thousand times faster bought :color[**nine extra items**]{hex="#EF4444"}. Buying hardware to fix an exponential algorithm is throwing money away.

## Q11. Watch the units

*An $O(n^2)$ algorithm takes 4 minutes on 60 000 records. How long on 15 000 records?*

Convert first: 4 minutes = 240 seconds.

$$
\frac{T_2}{T_1} = \left(\frac{15\,000}{60\,000}\right)^2 = \frac{1}{16} \quad\Rightarrow\quad T_2 = \frac{240}{16} = 15
$$

:mark[**15 seconds.**]{hex="#204A2E"}

## Q12. Working backwards from a deadline

*An $O(n^2)$ algorithm processes 5 000 records in 1 second. Your batch job must finish within 60 seconds. What is the largest number of records you can accept?*

$$
\frac{T_2}{T_1} = \left(\frac{n}{5000}\right)^2 = 60 \quad\Rightarrow\quad n = 5000\sqrt{60} = 5000 \times 7.746
$$

:mark[**About 38 730 records.**]{hex="#204A2E"} 60 times the time budget buys only 7.7 times the records.

## Q13. How much faster must the machine be?

*An $O(n^3)$ job takes 100 seconds when $n = 1000$. Management wants it run at $n = 4000$, still within 100 seconds. How much faster must the new machine be?*

$$
\text{cost factor} = \left(\frac{4000}{1000}\right)^3 = 64
$$

The work is 64 times bigger and the deadline is unchanged, so:

:mark[**A machine 64 times as fast.**]{hex="#204A2E"} If the vendor can only sell you 8 times faster, the honest answer is to change the algorithm.

## Q14. Two changes at once

*An $O(n^2)$ algorithm takes 3 seconds on 6 000 records. The input doubles to 12 000 and the machine is replaced by one 4 times as fast. What is the new running time?*

$$
T_{\text{new}} = \frac{k(2n)^2}{4} = \frac{4kn^2}{4} = kn^2 = T_{\text{old}}
$$

:mark[**Still 3 seconds.**]{hex="#204A2E"} The two changes cancel exactly, because $\sqrt{4} = 2$.

## Q15. What a 10 times faster machine buys

*You can currently finish an input of size $n$ in one hour. Fill in the largest input $n'$ you could finish in one hour on a machine 10 times as fast.*

| Cost function | Equation to solve | $n'$ |
| --- | --- | --- |
| $kn$ | $kn' = 10kn$ | $10n$ |
| $kn^2$ | $k n'^2 = 10 k n^2$ | $\sqrt{10}\,n = 3.16n$ |
| $kn^3$ | $k n'^3 = 10 k n^3$ | $\sqrt[3]{10}\,n = 2.15n$ |
| $k 2^n$ | $k2^{n'} = 10 \cdot k2^{n}$ | $n + \log_2 10 = n + 3.32$ |

:mark[**The worse the growth rate, the less hardware helps.**]{hex="#5C3A1A"} This single table is the answer to "a faster computer or a faster algorithm".

## Q16. Crossover point between two algorithms

*Algorithm A costs $100n^2$ operations. Algorithm B costs $5n^3$. Which is better, and from which $n$?*

$$
100n^2 = 5n^3 \quad\Rightarrow\quad n = \frac{100}{5} = 20
$$

- For $n < 20$: B is faster. At $n = 10$, A does 10 000 and B does 5 000.
- For $n > 20$: A is faster. At $n = 100$, A does $10^6$ and B does $5 \times 10^6$.

:mark[**A is better for every $n > 20$.**]{hex="#204A2E"} A big constant only ever delays the crossover, it never prevents it.

## Q17. Faster computer or faster algorithm, decided numerically

*Algorithm A is $n^2$ operations. Algorithm B is $100 n \log_2 n$ operations, so it has a much worse constant. (a) From what input size is B the better choice? (b) You could instead run A on a machine 10 times as fast. Does that change the answer for large $n$?*

**(a)** B is better when

$$
100 n \log_2 n < n^2 \quad\Rightarrow\quad 100 \log_2 n < n
$$

At $n = 500$: $100 \log_2 500 = 897 > 500$, so A still wins.
At $n = 1000$: $100 \log_2 1000 = 997 < 1000$, so B wins.

:mark[**B takes over just under $n = 1000$.**]{hex="#204A2E"}

**(b)** A on the fast machine costs the time of $n^2/10$ operations. That beats B while $n^2/10 < 100n\log_2 n$, i.e. $n < 1000 \log_2 n$, which holds up to about $n = 13\,750$.

So the faster machine pushes the crossover from 1 000 to 13 750, and then :color[**loses anyway**]{hex="#EF4444"}. The hardware bought a constant factor; the algorithm changed the curve.

## Q18. Which term matters

*An algorithm costs $T(n) = 2n^2 + 100n + 5000$ operations. State its complexity, and say at which input size the $n^2$ term starts to dominate.*

Complexity: :color[$O(n^2)$]{hex="#EA6C0A"}, the highest order term with its constant dropped.

$2n^2$ overtakes $100n + 5000$ when $2n^2 > 100n + 5000$, and solving the quadratic gives $n > 80.9$.

:mark[**Below $n \approx 81$ the constants run the show; above it the $n^2$ does.**]{hex="#204A2E"} Which is exactly why timing an algorithm on 50 records tells you nothing about its behaviour on 50 000.

## Q19. The exponential wall

*An algorithm performs $2^n$ operations and the machine does one operation per microsecond. How long does $n = 50$ take?*

$$
2^{50} = 1.126 \times 10^{15}\ \mu s = 1.126 \times 10^{9}\ \text{s}
$$

$$
\frac{1.126 \times 10^{9}}{60 \times 60 \times 24 \times 365} \approx 35.7
$$

:mark[**About 35.7 years.**]{hex="#204A2E"} On a machine 1000 times faster it is still 13 days, and $n = 60$ puts you back to 36 years.

## Q20. Full exam style question

*A sorting algorithm is $O(n^2)$ in the worst case and takes 3 seconds to sort 2 000 records.*
*(a) Predicted time for 10 000 records.*
*(b) On a machine 25 times as fast, how many records can be sorted in 3 seconds?*
*(c) Comment on your answers.*

**(a)** $\left(\frac{10\,000}{2\,000}\right)^2 = 25$, so $T = 25 \times 3 = 75$ :mark[**75 seconds**]{hex="#204A2E"}

**(b)** $k = \dfrac{3}{2000^2}$, and

$$
3 = \frac{k n^2}{25} \quad\Rightarrow\quad n^2 = 25 \times 2000^2 \quad\Rightarrow\quad n = 5 \times 2000 = 10\,000
$$

:mark[**10 000 records.**]{hex="#204A2E"}

**(c)** Buying a machine **25 times** faster increased the workload the program can handle by only **5 times**, because the cost grows as $n^2$ and $\sqrt{25} = 5$. Replacing the sort with an $O(n \log n)$ one would handle far more records on the original hardware.

---

## Chapter summary

- An algorithm is a finite, unambiguous, effective method with input and output, correct for every valid input.
- Empirical analysis measures a program on a machine with some data. It cannot generalise: implementation, hardware, environment and data all leak into the result.
- Asymptotic analysis measures the algorithm by its growth rate, so it survives all four.
- Only the highest order term matters; constants and lower order terms vanish as $n$ grows.
- $1 < \log n < \sqrt{n} < n < n \log n < n^2 < n^3 < 2^n < n!$
- Faster hardware multiplies the workable input by a constant factor, and that factor collapses as the growth rate worsens: $\times 10$ for linear, $\times 3.16$ for quadratic, $+3$ items for exponential. A better algorithm changes the curve itself.
- Every numerical question: write $T = k f(n)$, find $k$ from the given point, substitute. Divide by $s$ for a machine $s$ times faster, and use ratios when $k$ would cancel.
