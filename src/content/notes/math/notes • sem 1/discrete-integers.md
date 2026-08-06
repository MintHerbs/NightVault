# :color[Discrete Integers]{hex="#00FFA3"}

$$
a = qb\ + r
$$

* **a** is the dividend

* **b** is the divisor

* **r** is the remainder

**note**: r cannot be greater than b

<br />

For integers **a** (divisor) and **b** (dividend):

$$
If\ gcd(a, b) = 1,\ a\ and\ b\ are\ coprime.
$$

<br />

***Example:***

## :color[Solve for integer solutions of x, y, z:]{hex="#B3FFE5"}

$$
6x + 9y + 15z = 107
$$

<br />

***Solution:***

1. Factor out the common divisor on the left-hand side:

   $3(2x + 3y + 5z) = 107$

   <br />
2. Since $3$ is not a divisor of $107$ ($3 \nmid 107$), no integer solutions $(x, y, z)$ exist.

<br />

## :color[Prime Factorization, HCF (GCD), and LCM]{hex="#B3FFE5"}

***Example 1:*** Numbers 24 and 30

* Prime Factors:

  * $24 = 2 \times 2 \times 2 \times 3 = 2^3 \times 3$

  * $30 = 2 \times 3 \times 5$

* HCF / GCD:

  * $\text{HCF} = 2 \times 3 = 6$

* LCM:

  * $\text{LCM} = 2^3 \times 3 \times 5 = 120$

<br />

***Example 2:*** Find HCF and LCM of 294 and 60

* Prime Factors:

* $294 = 2 \times 3 \times 7^2$

* $60 = 2^2 \times 3 \times 5$

* HCF:

  * $\text{HCF} = 2 \times 3 = 6$

* LCM:

  * $\text{LCM} = 2^2 \times 3 \times 7^2 \times 5 = 2940$

<br />

## :color[Euclidean Algorithm for GCD]{hex="#B3FFE5"}

***Example 1:*** Find $\gcd(55, 35)$

$55 = 35(1) + 20$

$35 = 20(1) + 15$

$20 = 15(1) + 5$

$15 = 5(3) + 0$

$\text{gcd}(55, 35) = 5$

<br />

***Example 2:*** Find $\gcd(54321, 9875)$

$54321 = 9875(5) + 4946$

$9875 = 4946(2) + 17$

$4946 = 17(290) + 16$

$17 = 16(1) + 1$

$16 = 1(16) + 0$

$\text{gcd}(54321, 9875) = 1$

<br />

***Example 3:*** Find $\gcd(90, 72)$

$90 = 72(1) + 18$

$72 = 18(4) + 0$

$\text{gcd}(90, 72) = 18$

<br />

## :color[Reverse Euclidean Algorithm]{hex="#B3FFE5"}

Theorem: For any two positive integers $a$ and $b$, there exist integers $s$ and $t$ such that:

$as + bt = \gcd(a, b)$

<br />

To find $s$ and $t$, substitute the Euclidean algorithm steps in **reverse order**.

<br />

***Reverse Substitution Example 1:*** Express $\gcd(54321, 9875) = 1$

From forward steps:

1. $1 = 17 - 16(1)$

   <br />
2.  Substitute $16 = 4929 - 17(289)$:

    $1 = 17 - [4929 - 17(289)] = 290(17) - 4929$ 

   <br />
3. Substitute $17 = 4946 - 4929(1)$: 

   $1 = 290[4946 - 4929(1)] - 4929 = 290(4946) - 291(4929)$ 

   <br />
4. Substitute $4929 = 9875 - 4946(1)$: 

   $1 = 290(4946) - 291[9875 - 4946(1)] = 581(4946) - 291(9875)$ 

   <br />
5. Substitute $4946 = 54321 - 9875(5)$:

    $1 = 581[54321 - 9875(5)] - 291(9875) = 581(54321) - 3196(9875)$ 
6. $\mathbf{1 = 581(54321) - 3196(9875)}$

   <br />

***Reverse Substitution Example 2:*** Express $\gcd(294, 60) = 6$ 

:color[Forward steps:]{hex="#14B8A6"} 

$294 = 60(4) + 54$

 $60 = 54(1) + 6$

 $54 = 6(9) + 0 \implies \gcd = 6$ 

<br />

:color[Reverse steps:]{hex="#14B8A6"}

 $6 = 60 - 54(1)$

 $6 = 60 - [294 - 60(4)]$

 $\mathbf{6 = 60(5) - 294}$

## :color[Problem Solving Keywords Guide:]{hex="#B3FFE5"}

![image](/notes/img/math/cbf8467d-1049-42c9-853b-d579d0cf2161.webp)

***Question 1:*** Exercise Schedules Ben exercises every $12$ days and Isabel every $8$ days. Both exercised today. 

*(i) How many days until they exercise together again?*\
Find $\text{LCM}(12, 8)$: 

$12 = 2^2 \times 3$

 $8 = 2^3$ 

$\text{LCM} = 2^3 \times 3 = 24 \text{ days}$ 

<br />

*(ii) When will they exercise together for the 5th time?* 

1st time = Today (Day 0) 

2nd time = Day 24 

3rd time = Day 48 

4th time = Day 72 

5th time = Day 96

 $\text{They will exercise together for the 5th time in } \mathbf{96 \text{ days}}.$ 

<br />

***Question 2:*** Distributing Supplies Mrs. Evans has $120$ crayons and $30$ pieces of paper. What is the largest number of students she can divide them among equally? 

Find $\text{HCF}(120, 30)$: 

$120 = 2 \times 2 \times 2 \times 3 \times 5$ 

$30 = 2 \times 3 \times 5$ 

$\text{HCF} = 2 \times 3 \times 5 = 30 \text{ students}$

<br />

## :color[Modular Arithmetic & Big Powers]{hex="#B3FFE5"}

***Clock Arithmetic Problem***: The time is now 09:30. What time will it be in 112 hours?

* On a 24-hour clock:

  $$
  112 \pmod{24} = 16
  $$

  $\text{Time} = 09:30 + 16:00 = 25:30 - 24:00 = \mathbf{01:30}$

  <br />
* On a 12-hour clock: 

  $112 \pmod{12} = 4$ 

  $\text{Time} = 09:30 + 04:00 = 13:30 = \mathbf{01:30 \text{ PM}}$

<br />

**:color[Evaluating Modular Exponentiation:]{hex="#14B8A6"}**

1. Reduce base modulo 7: 

   $123 \equiv 4 \pmod{7}$ 

   <br />
2. Check powers pattern: 

   $123^1 \equiv 4 \pmod{7}$ 

   $123^2 \equiv 4^2 = 16 \equiv 2 \pmod{7}$ 

   $123^3 \equiv 2 \times 4 = 8 \equiv 1 \pmod{7}$ 

   $123^4 \equiv 1 \times 4 = 4 \pmod{7}$ 

   <br />
3. Pattern length = 3: 

   $n \equiv 1 \pmod 3 \implies 4$ 

   $n \equiv 2 \pmod 3 \implies 2$ 

   $n \equiv 0 \pmod 3 \implies 1$ 

   <br />
4. Evaluate for exponent 96: 

   $96 \equiv 0 \pmod{3}$ 

   $\mathbf{123^{96} \pmod{7} = 1}$

<br />

***Steps to compute big powers using modulo:***

1. Write exponent in binary (or identify power cycle).
2. Reduce the base modulo \$m\$ first.
3. Perform iterative squaring.
4. Multiply required powers.

<br />

## :color[Recurrence Relations: Implicit to Explicit Conversion]{hex="#B3FFE5"}

***Problem:*** Find the general formula for the recurrence relation $a_n = a_{n-1} + 3$ given $a_1 = 1$. 

:color[Step-by-step Expansion:]{hex="#14B8A6"}

 $a_1 = 1$ 

$a_2 = 1 + 3 = 4$ 

$a_3 = 4 + 3 = 7$ 

$a_4 = 7 + 3 = 10$ 

$a_5 = 10 + 3 = 13$ 

$a_n = a_{n-1} + 3$ 

$a_n = (a_{n-2} + 3) + 3 = a_{n-2} + 2(3)$ 

$a_n = (a_{n-3} + 3) + 6 = a_{n-3} + 3(3)$ 

$a_n = a_{n-4} + 4(3)$

$a_n = a_{n-k} + k(3)$ 

<br />

**:mark[Set $n - k = 1 \implies k = n - 1$:]{hex="#1E3A5C"}**:mark[]{hex="#1E3A5C"} 

$a_n = a_1 + (n - 1)3$ 

$a_n = 1 + 3n - 3$ 

$\mathbf{a_n = 3n - 2}$ 

<br />

:mark[Calculation for $a_{100}$:]{hex="#1E3A5C"} 

$a_{100} = 3(100) - 2 = \mathbf{298}$
