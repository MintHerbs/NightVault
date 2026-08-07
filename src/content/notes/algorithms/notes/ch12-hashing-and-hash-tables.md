# Chapter 12: Hashing and Hash Tables

Chapter 10 got search down to $O(\log n)$ by halving the problem at every step. This chapter does something that ought to be impossible: it finds a key in **constant time**, without searching at all.

The trick is to stop looking for the key and start **computing where it must be**.

![A key passing through a hash function to an index in a table](/notes/img/algorithms/ch12-what-is-hashing.svg)

> The chapter runs on six colours, and each one keeps its meaning to the last page.
>
> | Colour | What it is |
> | --- | --- |
> | **:color[the key being placed]{hex="#FF5FA2"}** | the key this step is about |
> | **:color[a free slot]{hex="#22C55E"}** | somewhere the key can go |
> | **:color[a collision]{hex="#EF4444"}** | a slot already taken |
> | **:color[already settled]{hex="#A78BFA"}** | placed earlier and not moving |
> | **:color[the probe jump]{hex="#2DD4BF"}** | where the search goes next |
> | **:color[a computed index]{hex="#EAB308"}** | the output of the hash function |

## The idea

A **hash table** is an array plus a **hash function**. The function takes a key and returns an index into the array. To store a key you compute its index and put it there. To find it again you compute the index again and look.

:mark[**No comparisons, no traversal. One calculation gives the address.**]{hex="#1B4A46"}

| Operation | Balanced BST (ch 10) | Hash table |
| --- | --- | --- |
| Search | :color[O(log n)]{hex="#A78BFA"} | **:color[O(1)]{hex="#22C55E"}** average |
| Insert | :color[O(log n)]{hex="#A78BFA"} | **:color[O(1)]{hex="#22C55E"}** average |
| Delete | :color[O(log n)]{hex="#A78BFA"} | **:color[O(1)]{hex="#22C55E"}** average |
| Keys in sorted order | :color[O(n)]{hex="#22C55E"}, in-order walk | :color[O(n log n)]{hex="#EF4444"}, you must sort them |
| Minimum or maximum | :color[O(log n)]{hex="#A78BFA"} | :color[O(n)]{hex="#EF4444"}, scan everything |

The last two rows are the price. A hash table destroys all order. If you need sorted output, a range query, or a minimum, a hash table is the wrong structure and a search tree is the right one. If you need exact lookups by key, nothing beats it.

## The modulo, since everything rests on it

Nearly every hash function ends with **mod**, so it is worth being completely certain what that does.

![An animation working out a modulo step by step and landing on a table slot](/notes/img/algorithms/ch12-modulo.svg)

`27 mod 11` asks: how many whole 11s fit inside 27, and what is left over? The answer is the **left over** part.

$$27 = 2 \times 11 + \textcolor{#EAB308}{5}$$

:mark[**A remainder mod 11 is always between 0 and 10, which is exactly the set of slot numbers. That is the whole reason mod is used.**]{hex="#3A3A3E"}

## Hash functions

A good hash function has to do two things: **spread keys evenly**, and be **fast**. It does not need to be unpredictable or secure; that is a different subject.

![The division, mid-square, multiplicative and folding hash functions worked on one key](/notes/img/algorithms/ch12-hash-functions.svg)

### The division method

$$h(k) = k \bmod m$$

The one an exam almost always means. It is a single operation, and the only decision is $m$.

:mark[**Choose m prime, and never a power of 2.**]{hex="#5C2323"}

Taking a key mod $2^p$ keeps only the **lowest p bits** and discards everything else, so any pattern in the low bits of your keys turns straight into a pattern in the indexes. A prime modulus mixes all the bits of the key into the result, so regularities in the data are much less likely to survive.

### The mid-square method

Square the key, take some digits from the **middle**, and reduce those into the table.

The middle digits are used because they depend on **every** digit of the original key: the middle of a square is influenced by both ends, whereas the last digits of $k^2$ depend only on the last digits of $k$.

### The multiplicative method

$$h(k) = \lfloor m \times (k A \bmod 1) \rfloor$$

Multiply by a constant $A$ between 0 and 1, throw away everything before the decimal point, and scale what is left up to the table size. Knuth suggests $A = (\sqrt{5} - 1)/2 \approx 0.6180339887$, the golden ratio conjugate, because it spreads values unusually evenly.

Its advantage over division: **$m$ can be anything**, including a power of 2, which makes the scaling a cheap bit shift.

### The folding method

Cut the key into equal groups of digits, add them, reduce into the table. Useful when keys are long, like account numbers, because every digit contributes.

---

# Collisions

![Nine keys hashing into eleven slots, with three slots receiving more than one](/notes/img/algorithms/ch12-collisions.svg)

Two different keys can hash to the same index. This is not a flaw to be engineered away, it is arithmetic: if there are more possible keys than slots, and there always are, then some keys must share. That is the **pigeonhole principle**.

It happens far sooner than intuition suggests. With only 23 people in a room the odds are better than even that two share a birthday, and a hash table is the same calculation.

:mark[**A hash table is a hash function plus a plan for collisions. There is no third option.**]{hex="#1B4A46"}

There are two families of plan:

| | Idea | The table holds |
| --- | --- | --- |
| **Separate chaining** | let the slot hold more than one key | a list per slot |
| **Open addressing** | find the key another slot | one key per slot |

## The load factor

$$\alpha = \frac{n}{m} = \frac{\text{keys stored}}{\text{slots available}}$$

Everything about hash table performance is a function of $\alpha$, and it is the number an exam wants you to compute and comment on.

![Expected probe count against load factor for chaining, double hashing and linear probing](/notes/img/algorithms/ch12-load-factor.svg)

- With **chaining**, $\alpha$ is the average chain length. It can exceed 1 quite happily.
- With **open addressing**, $\alpha$ can never exceed 1, and the cost climbs steeply as it approaches it. At $\alpha = 0.9$ an unsuccessful linear probing search expects about 50 probes.

Real implementations **resize** when $\alpha$ passes a threshold, typically 0.7, by allocating a bigger table and rehashing everything into it. Rehashing is $O(n)$ and unavoidable, because the index depends on $m$ and $m$ has changed. It happens rarely enough that the average cost per insertion is still $O(1)$.

---

# Separate chaining

Each slot holds a linked list. A collision just means the list has more than one thing in it.

![An animation inserting nine keys into a hash table using separate chaining](/notes/img/algorithms/ch12-chaining.svg)

On the running example, 9 keys into 11 slots gives a longest chain of **3** using **5** of the slots.

| | |
| --- | --- |
| Search, average | :color[O(1 + α)]{hex="#22C55E"} |
| Search, worst case | :color[O(n)]{hex="#EF4444"}, when every key chains to one slot |
| Deletion | easy: unlink from the list |
| Table can be over-full | yes, α may exceed 1 |
| Extra memory | a pointer per entry |

**What it is good at:** deletion is trivial, the table never fills, and performance degrades gently. **What it costs:** pointers, and poor cache behaviour, because a chain is scattered through memory rather than sitting in one block.

---

# Open addressing

Everything lives in the array itself. On a collision, follow a rule to another slot, and keep going until a free one turns up. The sequence of slots tried is the **probe sequence**.

:mark[**A search must follow exactly the same probe sequence the insertion did, and stops at the first empty slot.**]{hex="#3A3A3E"}

That stopping rule is what makes an unsuccessful search terminate, and it is also what makes deletion awkward, as the last section shows.

## Linear probing

$$h(k, i) = (h(k) + i) \bmod m$$

If the slot is taken, try the next one. Then the next.

![An animation inserting keys into a hash table using linear probing](/notes/img/algorithms/ch12-linear-probing.svg)

On the running example: probes of 1, 1, 1, 4, 3, 6, 1, 1, 2, **20 in total**.

### Primary clustering

![A linear probing table with one long cluster beside a double hashing table without one](/notes/img/algorithms/ch12-clustering.svg)

Look at what linear probing produced: one run of **8** consecutive occupied slots.

Runs like this are self-reinforcing. A key that hashes **anywhere** inside a run of length $L$ walks to its far end and extends it to $L+1$, which makes it a bigger target for the next key. This is **primary clustering**, and it is why linear probing degrades so sharply as the table fills.

> Linear probing is not all bad. Walking to the next slot is extremely cache friendly, because the next slot is usually already in cache, and at low load factors it can beat cleverer schemes in real time even while losing on probe counts.

## Quadratic probing

$$h(k, i) = (h(k) + i^2) \bmod m$$

Jump further each time, so runs do not merge. This removes primary clustering, but two keys with the **same** home slot still follow the identical sequence, which is called **secondary clustering**.

It also comes with a catch worth knowing: quadratic probing is only guaranteed to find a free slot while the table is **less than half full** and $m$ is prime. Above that it can cycle without ever finding a free slot that exists.

## Double hashing

$$h(k, i) = (h_1(k) + i \times h_2(k)) \bmod m$$

Use a **second hash function** to decide the step size. Two keys that collide at $h_1$ almost certainly have different steps, so they diverge immediately, and neither primary nor secondary clustering occurs.

![An animation inserting keys into a hash table using double hashing](/notes/img/algorithms/ch12-double-hashing.svg)

On the running example: **16 probes** against linear probing's **20**, for the same keys in the same order.

:mark[**h₂(k) must never be 0, and must be coprime with m.**]{hex="#5C2323"}

If $h_2(k)$ were 0 the probe would never move. If it shares a factor with $m$, the sequence only visits a fraction of the table and can fail to find a free slot that exists. The usual construction, and the one used here, is $h_2(k) = q - (k \bmod q)$ for a prime $q$ slightly smaller than $m$, which here means $q = 7$. It is never 0, and because $m$ is prime, it is always coprime with it.

## Deletion, and why it is not obvious

![Deleting a key from an open addressed table strands a later key unless a tombstone is left](/notes/img/algorithms/ch12-tombstone.svg)

Blanking a slot breaks the table. A search stops at the first empty slot, so emptying a slot that some other key's probe sequence passed **through** cuts that key off. It is still in the table and can no longer be found.

:mark[**Mark deleted slots with a tombstone: a search walks past it, an insertion may reuse it.**]{hex="#1B4A46"}

The cost is that tombstones accumulate. They count as occupied for searching but not for storage, so a table with many deletions slows down without ever appearing full, and eventually has to be rebuilt.

This is the single clearest advantage chaining has: unlinking from a list is exact, immediate, and leaves nothing behind.

## Choosing between them

| | Chaining | Linear probing | Double hashing |
| --- | --- | --- | --- |
| Clustering | none | primary and secondary | neither |
| Deletion | easy | needs tombstones | needs tombstones |
| α may exceed 1 | yes | no | no |
| Cache behaviour | poor | **excellent** | poor |
| Extra memory | a pointer per entry | none | none |
| Probes at high α | grows slowly | grows very fast | grows moderately |

## The marks: what to write down

1. **Show the modulo working**, at least once. `27 = 2 × 11 + 5` earns more than `5`.
2. **State the probe formula** before you use it, and say which $i$ you are on at each step.
3. **One row per key**, giving h(k), the slots tried, and where it ended up.
4. **Count the probes as you go.** The first attempt counts as probe 1, not probe 0. Say which convention you are using and stay with it.
5. **Draw the final table** with the slot numbers on it, even when the question only says state.
6. **For load factor, give the fraction and the number**, and one sentence on what it means for performance.

And the check worth doing: **walk the probe sequence for one key you inserted and make sure you find it again**. If a search cannot reproduce the insertion's path, the table is wrong.

---

# 31 practice questions

Every table here was verified before it was allowed into the chapter: each key inserted must be findable by a search that follows the same probe sequence.

| Part | Shape | Questions |
| --- | --- | --- |
| **A** | apply a hash function | Q1 to Q12 |
| **B** | build a table | Q13 to Q24 |
| **C** | search, delete, load factor | Q25 to Q31 |

## Part A: apply a hash function

Division, mid-square, multiplicative and folding. Two of these use a badly chosen $m$, which part (c) is asking you to notice.

### Q1. The division method

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

Hash the keys `12, 25, 33, 47` into a table of size **m = 11** using the **division** method.

**(a)** Work out h(k) for each key, showing your working. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** State which keys collide. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Comment on the choice of m. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The hash values.**

| Key | Working | h(k) |
| --- | --- | --- |
| 12 | 12 = 1 × 11 + 1 | :color[1]{hex="#EAB308"} |
| 25 | 25 = 2 × 11 + 3 | :color[3]{hex="#EAB308"} |
| 33 | 33 = 3 × 11 + 0 | :color[0]{hex="#EAB308"} |
| 47 | 47 = 4 × 11 + 3 | :color[3]{hex="#EAB308"} |

:mark[**h(12) = 1, h(25) = 3, h(33) = 0, h(47) = 3**]{hex="#204A2E"}

**(b) Collisions.**

- Slot :color[3]{hex="#EF4444"} receives 25, 47.

:mark[**Collisions at slot 3.**]{hex="#5C2323"}

**(c) The choice of m.**

**m = 11 is prime, which is the right choice.** A prime modulus uses every bit of the key rather than just the low ones, so regularities in the keys are less likely to survive into the indexes.

:mark[**m = 11 is prime, which is what you want.**]{hex="#204A2E"}

### Q2. The division method

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

Hash the keys `7, 18, 29, 40, 51` into a table of size **m = 13** using the **division** method.

**(a)** Work out h(k) for each key, showing your working. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** State which keys collide. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Comment on the choice of m. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The hash values.**

| Key | Working | h(k) |
| --- | --- | --- |
| 7 | 7 = 0 × 13 + 7 | :color[7]{hex="#EAB308"} |
| 18 | 18 = 1 × 13 + 5 | :color[5]{hex="#EAB308"} |
| 29 | 29 = 2 × 13 + 3 | :color[3]{hex="#EAB308"} |
| 40 | 40 = 3 × 13 + 1 | :color[1]{hex="#EAB308"} |
| 51 | 51 = 3 × 13 + 12 | :color[12]{hex="#EAB308"} |

:mark[**h(7) = 7, h(18) = 5, h(29) = 3, h(40) = 1, h(51) = 12**]{hex="#204A2E"}

**(b) Collisions.**

Every key lands on a different slot, so there are no collisions with this data.

:mark[**No collisions.**]{hex="#204A2E"}

**(c) The choice of m.**

**m = 13 is prime, which is the right choice.** A prime modulus uses every bit of the key rather than just the low ones, so regularities in the keys are less likely to survive into the indexes.

:mark[**m = 13 is prime, which is what you want.**]{hex="#204A2E"}

### Q3. The division method

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

Hash the keys `101, 202, 303` into a table of size **m = 7** using the **division** method.

**(a)** Work out h(k) for each key, showing your working. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** State which keys collide. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Comment on the choice of m. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The hash values.**

| Key | Working | h(k) |
| --- | --- | --- |
| 101 | 101 = 14 × 7 + 3 | :color[3]{hex="#EAB308"} |
| 202 | 202 = 28 × 7 + 6 | :color[6]{hex="#EAB308"} |
| 303 | 303 = 43 × 7 + 2 | :color[2]{hex="#EAB308"} |

:mark[**h(101) = 3, h(202) = 6, h(303) = 2**]{hex="#204A2E"}

**(b) Collisions.**

Every key lands on a different slot, so there are no collisions with this data.

:mark[**No collisions.**]{hex="#204A2E"}

**(c) The choice of m.**

**m = 7 is prime, which is the right choice.** A prime modulus uses every bit of the key rather than just the low ones, so regularities in the keys are less likely to survive into the indexes.

:mark[**m = 7 is prime, which is what you want.**]{hex="#204A2E"}

### Q4. The division method

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

Hash the keys `12, 23, 34, 45` into a table of size **m = 11** using the **division** method.

**(a)** Work out h(k) for each key, showing your working. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** State which keys collide. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Comment on the choice of m. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The hash values.**

| Key | Working | h(k) |
| --- | --- | --- |
| 12 | 12 = 1 × 11 + 1 | :color[1]{hex="#EAB308"} |
| 23 | 23 = 2 × 11 + 1 | :color[1]{hex="#EAB308"} |
| 34 | 34 = 3 × 11 + 1 | :color[1]{hex="#EAB308"} |
| 45 | 45 = 4 × 11 + 1 | :color[1]{hex="#EAB308"} |

:mark[**h(12) = 1, h(23) = 1, h(34) = 1, h(45) = 1**]{hex="#204A2E"}

**(b) Collisions.**

- Slot :color[1]{hex="#EF4444"} receives 12, 23, 34, 45.

:mark[**Collisions at slot 1.**]{hex="#5C2323"}

**(c) The choice of m.**

**m = 11 is prime, which is the right choice.** A prime modulus uses every bit of the key rather than just the low ones, so regularities in the keys are less likely to survive into the indexes.

:mark[**m = 11 is prime, which is what you want.**]{hex="#204A2E"}

### Q5. The division method

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

Hash the keys `16, 32, 48, 64, 80` into a table of size **m = 16** using the **division** method.

**(a)** Work out h(k) for each key, showing your working. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** State which keys collide. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Comment on the choice of m. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The hash values.**

| Key | Working | h(k) |
| --- | --- | --- |
| 16 | 16 = 1 × 16 + 0 | :color[0]{hex="#EAB308"} |
| 32 | 32 = 2 × 16 + 0 | :color[0]{hex="#EAB308"} |
| 48 | 48 = 3 × 16 + 0 | :color[0]{hex="#EAB308"} |
| 64 | 64 = 4 × 16 + 0 | :color[0]{hex="#EAB308"} |
| 80 | 80 = 5 × 16 + 0 | :color[0]{hex="#EAB308"} |

:mark[**h(16) = 0, h(32) = 0, h(48) = 0, h(64) = 0, h(80) = 0**]{hex="#204A2E"}

**(b) Collisions.**

- Slot :color[0]{hex="#EF4444"} receives 16, 32, 48, 64, 80.

:mark[**Collisions at slot 0.**]{hex="#5C2323"}

**(c) The choice of m.**

**m = 16 is a power of 2, which is the worst choice.** Taking a key mod a power of 2 keeps only the lowest bits and throws the rest away, so any pattern in the low bits of the keys becomes a pattern in the indexes. That is exactly what happens here.

:mark[**m = 16 is a poor choice. Use a prime.**]{hex="#5C2323"}

### Q6. The division method

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

Hash the keys `45, 92, 137, 88` into a table of size **m = 17** using the **division** method.

**(a)** Work out h(k) for each key, showing your working. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** State which keys collide. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Comment on the choice of m. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The hash values.**

| Key | Working | h(k) |
| --- | --- | --- |
| 45 | 45 = 2 × 17 + 11 | :color[11]{hex="#EAB308"} |
| 92 | 92 = 5 × 17 + 7 | :color[7]{hex="#EAB308"} |
| 137 | 137 = 8 × 17 + 1 | :color[1]{hex="#EAB308"} |
| 88 | 88 = 5 × 17 + 3 | :color[3]{hex="#EAB308"} |

:mark[**h(45) = 11, h(92) = 7, h(137) = 1, h(88) = 3**]{hex="#204A2E"}

**(b) Collisions.**

Every key lands on a different slot, so there are no collisions with this data.

:mark[**No collisions.**]{hex="#204A2E"}

**(c) The choice of m.**

**m = 17 is prime, which is the right choice.** A prime modulus uses every bit of the key rather than just the low ones, so regularities in the keys are less likely to survive into the indexes.

:mark[**m = 17 is prime, which is what you want.**]{hex="#204A2E"}

### Q7. The mid-square method

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

Hash the keys `23, 56, 91` into a table of size **m = 11** using the **mid-square** method.

**(a)** Work out h(k) for each key, showing your working. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** State which keys collide. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Comment on the choice of m. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The hash values.**

| Key | Working | h(k) |
| --- | --- | --- |
| 23 | 23² = 529, middle 2 digits = 52, 52 mod 11 = 8 | :color[8]{hex="#EAB308"} |
| 56 | 56² = 3136, middle 2 digits = 13, 13 mod 11 = 2 | :color[2]{hex="#EAB308"} |
| 91 | 91² = 8281, middle 2 digits = 28, 28 mod 11 = 6 | :color[6]{hex="#EAB308"} |

:mark[**h(23) = 8, h(56) = 2, h(91) = 6**]{hex="#204A2E"}

**(b) Collisions.**

Every key lands on a different slot, so there are no collisions with this data.

:mark[**No collisions.**]{hex="#204A2E"}

**(c) The choice of m.**

**m = 11 is prime, which is the right choice.** A prime modulus uses every bit of the key rather than just the low ones, so regularities in the keys are less likely to survive into the indexes.

:mark[**m = 11 is prime, which is what you want.**]{hex="#204A2E"}

### Q8. The folding method

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

Hash the keys `1234, 5678, 9012` into a table of size **m = 13** using the **folding** method.

**(a)** Work out h(k) for each key, showing your working. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** State which keys collide. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Comment on the choice of m. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The hash values.**

| Key | Working | h(k) |
| --- | --- | --- |
| 1234 | 12 + 34 = 46, 46 mod 13 = 7 | :color[7]{hex="#EAB308"} |
| 5678 | 56 + 78 = 134, 134 mod 13 = 4 | :color[4]{hex="#EAB308"} |
| 9012 | 90 + 12 = 102, 102 mod 13 = 11 | :color[11]{hex="#EAB308"} |

:mark[**h(1234) = 7, h(5678) = 4, h(9012) = 11**]{hex="#204A2E"}

**(b) Collisions.**

Every key lands on a different slot, so there are no collisions with this data.

:mark[**No collisions.**]{hex="#204A2E"}

**(c) The choice of m.**

**m = 13 is prime, which is the right choice.** A prime modulus uses every bit of the key rather than just the low ones, so regularities in the keys are less likely to survive into the indexes.

:mark[**m = 13 is prime, which is what you want.**]{hex="#204A2E"}

### Q9. The mid-square method

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

Hash the keys `3121, 4567, 8899` into a table of size **m = 11** using the **mid-square** method.

**(a)** Work out h(k) for each key, showing your working. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** State which keys collide. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Comment on the choice of m. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The hash values.**

| Key | Working | h(k) |
| --- | --- | --- |
| 3121 | 3121² = 9740641, middle 2 digits = 40, 40 mod 11 = 7 | :color[7]{hex="#EAB308"} |
| 4567 | 4567² = 20857489, middle 2 digits = 57, 57 mod 11 = 2 | :color[2]{hex="#EAB308"} |
| 8899 | 8899² = 79192201, middle 2 digits = 92, 92 mod 11 = 4 | :color[4]{hex="#EAB308"} |

:mark[**h(3121) = 7, h(4567) = 2, h(8899) = 4**]{hex="#204A2E"}

**(b) Collisions.**

Every key lands on a different slot, so there are no collisions with this data.

:mark[**No collisions.**]{hex="#204A2E"}

**(c) The choice of m.**

**m = 11 is prime, which is the right choice.** A prime modulus uses every bit of the key rather than just the low ones, so regularities in the keys are less likely to survive into the indexes.

:mark[**m = 11 is prime, which is what you want.**]{hex="#204A2E"}

### Q10. The multiplicative method

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

Hash the keys `61, 72, 83, 94` into a table of size **m = 11** using the **multiplicative** method.

**(a)** Work out h(k) for each key, showing your working. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** State which keys collide. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Comment on the choice of m. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The hash values.**

| Key | Working | h(k) |
| --- | --- | --- |
| 61 | 61 × 0.6180339887 = 37.700073, fractional part 0.700073, × 11 = 7.7008, floor = 7 | :color[7]{hex="#EAB308"} |
| 72 | 72 × 0.6180339887 = 44.498447, fractional part 0.498447, × 11 = 5.4829, floor = 5 | :color[5]{hex="#EAB308"} |
| 83 | 83 × 0.6180339887 = 51.296821, fractional part 0.296821, × 11 = 3.2650, floor = 3 | :color[3]{hex="#EAB308"} |
| 94 | 94 × 0.6180339887 = 58.095195, fractional part 0.095195, × 11 = 1.0471, floor = 1 | :color[1]{hex="#EAB308"} |

:mark[**h(61) = 7, h(72) = 5, h(83) = 3, h(94) = 1**]{hex="#204A2E"}

**(b) Collisions.**

Every key lands on a different slot, so there are no collisions with this data.

:mark[**No collisions.**]{hex="#204A2E"}

**(c) The choice of m.**

**m = 11 is prime, which is the right choice.** A prime modulus uses every bit of the key rather than just the low ones, so regularities in the keys are less likely to survive into the indexes.

:mark[**m = 11 is prime, which is what you want.**]{hex="#204A2E"}

### Q11. The folding method

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

Hash the keys `123456, 654321, 111222` into a table of size **m = 17** using the **folding** method.

**(a)** Work out h(k) for each key, showing your working. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** State which keys collide. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Comment on the choice of m. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The hash values.**

| Key | Working | h(k) |
| --- | --- | --- |
| 123456 | 12 + 34 + 56 = 102, 102 mod 17 = 0 | :color[0]{hex="#EAB308"} |
| 654321 | 65 + 43 + 21 = 129, 129 mod 17 = 10 | :color[10]{hex="#EAB308"} |
| 111222 | 11 + 12 + 22 = 45, 45 mod 17 = 11 | :color[11]{hex="#EAB308"} |

:mark[**h(123456) = 0, h(654321) = 10, h(111222) = 11**]{hex="#204A2E"}

**(b) Collisions.**

Every key lands on a different slot, so there are no collisions with this data.

:mark[**No collisions.**]{hex="#204A2E"}

**(c) The choice of m.**

**m = 17 is prime, which is the right choice.** A prime modulus uses every bit of the key rather than just the low ones, so regularities in the keys are less likely to survive into the indexes.

:mark[**m = 17 is prime, which is what you want.**]{hex="#204A2E"}

### Q12. The mid-square method

> :mark[**Very hard**]{hex="#5C2323"} &nbsp; :mark[**11 marks**]{hex="#3A3A3E"}

Hash the keys `2718, 3141, 1618, 5772` into a table of size **m = 19** using the **mid-square** method.

**(a)** Work out h(k) for each key, showing your working. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(b)** State which keys collide. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Comment on the choice of m. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The hash values.**

| Key | Working | h(k) |
| --- | --- | --- |
| 2718 | 2718² = 7387524, middle 2 digits = 87, 87 mod 19 = 11 | :color[11]{hex="#EAB308"} |
| 3141 | 3141² = 9865881, middle 2 digits = 65, 65 mod 19 = 8 | :color[8]{hex="#EAB308"} |
| 1618 | 1618² = 2617924, middle 2 digits = 17, 17 mod 19 = 17 | :color[17]{hex="#EAB308"} |
| 5772 | 5772² = 33315984, middle 2 digits = 15, 15 mod 19 = 15 | :color[15]{hex="#EAB308"} |

:mark[**h(2718) = 11, h(3141) = 8, h(1618) = 17, h(5772) = 15**]{hex="#204A2E"}

**(b) Collisions.**

Every key lands on a different slot, so there are no collisions with this data.

:mark[**No collisions.**]{hex="#204A2E"}

**(c) The choice of m.**

**m = 19 is prime, which is the right choice.** A prime modulus uses every bit of the key rather than just the low ones, so regularities in the keys are less likely to survive into the indexes.

:mark[**m = 19 is prime, which is what you want.**]{hex="#204A2E"}

## Part B: build a table

All four collision strategies. The last two use the same keys in the same order with linear probing and then double hashing, so the probe counts can be compared directly.

### Q13. Build a table with separate chaining

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

Insert `15, 11, 27, 8` into a table of size **m = 11**, using $h(k) = k \bmod 11$ and **separate chaining** (each slot holds a list).

**(a)** Insert the keys in order, showing each step. &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

**(b)** Draw the final table. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** State the load factor. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The insertions.**

| Key | h(k) | What happens |
| --- | --- | --- |
| :color[15]{hex="#FF5FA2"} | 4 | h(15) = 15 mod 11 = 4. Slot 4 is empty, so 15 goes in. |
| :color[11]{hex="#FF5FA2"} | 0 | h(11) = 11 mod 11 = 0. Slot 0 is empty, so 11 goes in. |
| :color[27]{hex="#FF5FA2"} | 5 | h(27) = 27 mod 11 = 5. Slot 5 is empty, so 27 goes in. |
| :color[8]{hex="#FF5FA2"} | 8 | h(8) = 8 mod 11 = 8. Slot 8 is empty, so 8 goes in. |

**(b) The final table.**

| Slot | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Holds** | 11 | · | · | · | 15 | 27 | · | · | 8 | · | · |

:mark[**4 of 11 slots used, longest chain 1.**]{hex="#204A2E"}

**(c) Load factor.**

$\alpha = n / m = 4 / 11 = 0.364$

With chaining the load factor is the **average chain length**, and it may exceed 1 without anything breaking.

:mark[**α = 0.364**]{hex="#204A2E"}

### Q14. Build a table with linear probing

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

Insert `20, 34, 45, 12` into a table of size **m = 11**, using $h(k) = k \bmod 11$ and **linear probing** ($(h(k) + i) \bmod m$).

**(a)** Insert the keys in order, showing each step. &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

**(b)** Draw the final table. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** State the load factor. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The insertions.**

| Key | h(k) | What happens |
| --- | --- | --- |
| :color[20]{hex="#FF5FA2"} | 9 | h(20) = 20 mod 11 = 9. It was free, so it goes straight in. |
| :color[34]{hex="#FF5FA2"} | 1 | h(34) = 34 mod 11 = 1. It was free, so it goes straight in. |
| :color[45]{hex="#FF5FA2"} | 1 | h(45) = 45 mod 11 = 1. Slots 1 were taken, so probe 1 gives (1 + 1) mod 11 = 2, which is free. |
| :color[12]{hex="#FF5FA2"} | 1 | h(12) = 12 mod 11 = 1. Slots 1, 2 were taken, so probe 2 gives (1 + 2) mod 11 = 3, which is free. |

**(b) The final table.**

| Slot | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Holds** | · | **34** | **45** | **12** | · | · | · | · | · | **20** | · |

:mark[**Probes: 1, 1, 2, 3 &nbsp; total 7**]{hex="#204A2E"}

> The longest run of occupied slots is **:color[3]{hex="#EF4444"}**. With linear probing that run will keep growing, because any key that hashes anywhere inside it ends up on its far end. That is primary clustering.

**(c) Load factor.**

$\alpha = n / m = 4 / 11 = 0.364$

With open addressing the load factor cannot exceed 1, and performance degrades sharply above about 0.7, which is when a real implementation would resize.

:mark[**α = 0.364**]{hex="#204A2E"}

### Q15. Build a table with separate chaining

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

Insert `22, 1, 13, 11, 24` into a table of size **m = 11**, using $h(k) = k \bmod 11$ and **separate chaining** (each slot holds a list).

**(a)** Insert the keys in order, showing each step. &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

**(b)** Draw the final table. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** State the load factor. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The insertions.**

| Key | h(k) | What happens |
| --- | --- | --- |
| :color[22]{hex="#FF5FA2"} | 0 | h(22) = 22 mod 11 = 0. Slot 0 is empty, so 22 goes in. |
| :color[1]{hex="#FF5FA2"} | 1 | h(1) = 1 mod 11 = 1. Slot 1 is empty, so 1 goes in. |
| :color[13]{hex="#FF5FA2"} | 2 | h(13) = 13 mod 11 = 2. Slot 2 is empty, so 13 goes in. |
| :color[11]{hex="#FF5FA2"} | 0 | h(11) = 11 mod 11 = 0. Slot 0 already holds 22, so 11 joins the chain. |
| :color[24]{hex="#FF5FA2"} | 2 | h(24) = 24 mod 11 = 2. Slot 2 already holds 13, so 24 joins the chain. |

**(b) The final table.**

| Slot | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Holds** | 22 → 11 | 1 | 13 → 24 | · | · | · | · | · | · | · | · |

:mark[**3 of 11 slots used, longest chain 2.**]{hex="#204A2E"}

**(c) Load factor.**

$\alpha = n / m = 5 / 11 = 0.455$

With chaining the load factor is the **average chain length**, and it may exceed 1 without anything breaking.

:mark[**α = 0.455**]{hex="#204A2E"}

### Q16. Build a table with linear probing

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

Insert `18, 41, 22, 44, 59` into a table of size **m = 13**, using $h(k) = k \bmod 13$ and **linear probing** ($(h(k) + i) \bmod m$).

**(a)** Insert the keys in order, showing each step. &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

**(b)** Draw the final table. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** State the load factor. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The insertions.**

| Key | h(k) | What happens |
| --- | --- | --- |
| :color[18]{hex="#FF5FA2"} | 5 | h(18) = 18 mod 13 = 5. It was free, so it goes straight in. |
| :color[41]{hex="#FF5FA2"} | 2 | h(41) = 41 mod 13 = 2. It was free, so it goes straight in. |
| :color[22]{hex="#FF5FA2"} | 9 | h(22) = 22 mod 13 = 9. It was free, so it goes straight in. |
| :color[44]{hex="#FF5FA2"} | 5 | h(44) = 44 mod 13 = 5. Slots 5 were taken, so probe 1 gives (5 + 1) mod 13 = 6, which is free. |
| :color[59]{hex="#FF5FA2"} | 7 | h(59) = 59 mod 13 = 7. It was free, so it goes straight in. |

**(b) The final table.**

| Slot | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Holds** | · | · | **41** | · | · | **18** | **44** | **59** | · | **22** | · | · | · |

:mark[**Probes: 1, 1, 1, 2, 1 &nbsp; total 6**]{hex="#204A2E"}

> The longest run of occupied slots is **:color[3]{hex="#EF4444"}**. With linear probing that run will keep growing, because any key that hashes anywhere inside it ends up on its far end. That is primary clustering.

**(c) Load factor.**

$\alpha = n / m = 5 / 13 = 0.385$

With open addressing the load factor cannot exceed 1, and performance degrades sharply above about 0.7, which is when a real implementation would resize.

:mark[**α = 0.385**]{hex="#204A2E"}

### Q17. Build a table with linear probing

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

Insert `79, 69, 98, 72, 14, 50` into a table of size **m = 11**, using $h(k) = k \bmod 11$ and **linear probing** ($(h(k) + i) \bmod m$).

**(a)** Insert the keys in order, showing each step. &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

**(b)** Draw the final table. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** State the load factor. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The insertions.**

| Key | h(k) | What happens |
| --- | --- | --- |
| :color[79]{hex="#FF5FA2"} | 2 | h(79) = 79 mod 11 = 2. It was free, so it goes straight in. |
| :color[69]{hex="#FF5FA2"} | 3 | h(69) = 69 mod 11 = 3. It was free, so it goes straight in. |
| :color[98]{hex="#FF5FA2"} | 10 | h(98) = 98 mod 11 = 10. It was free, so it goes straight in. |
| :color[72]{hex="#FF5FA2"} | 6 | h(72) = 72 mod 11 = 6. It was free, so it goes straight in. |
| :color[14]{hex="#FF5FA2"} | 3 | h(14) = 14 mod 11 = 3. Slots 3 were taken, so probe 1 gives (3 + 1) mod 11 = 4, which is free. |
| :color[50]{hex="#FF5FA2"} | 6 | h(50) = 50 mod 11 = 6. Slots 6 were taken, so probe 1 gives (6 + 1) mod 11 = 7, which is free. |

**(b) The final table.**

| Slot | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Holds** | · | · | **79** | **69** | **14** | · | **72** | **50** | · | · | **98** |

:mark[**Probes: 1, 1, 1, 1, 2, 2 &nbsp; total 8**]{hex="#204A2E"}

> The longest run of occupied slots is **:color[3]{hex="#EF4444"}**. With linear probing that run will keep growing, because any key that hashes anywhere inside it ends up on its far end. That is primary clustering.

**(c) Load factor.**

$\alpha = n / m = 6 / 11 = 0.545$

With open addressing the load factor cannot exceed 1, and performance degrades sharply above about 0.7, which is when a real implementation would resize.

:mark[**α = 0.545**]{hex="#204A2E"}

### Q18. Build a table with double hashing

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

Insert `15, 11, 27, 8, 12, 22` into a table of size **m = 11**, using $h(k) = k \bmod 11$ and **double hashing** ($(h_1(k) + i \times h_2(k)) \bmod m$).

Use $h_2(k) = 7 - (k \bmod 7)$.

**(a)** Insert the keys in order, showing each step. &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

**(b)** Draw the final table. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** State the load factor. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The insertions.**

| Key | h(k) | What happens |
| --- | --- | --- |
| :color[15]{hex="#FF5FA2"} | 4 | h(15) = 15 mod 11 = 4. It was free, so it goes straight in. |
| :color[11]{hex="#FF5FA2"} | 0 | h(11) = 11 mod 11 = 0. It was free, so it goes straight in. |
| :color[27]{hex="#FF5FA2"} | 5 | h(27) = 27 mod 11 = 5. It was free, so it goes straight in. |
| :color[8]{hex="#FF5FA2"} | 8 | h(8) = 8 mod 11 = 8. It was free, so it goes straight in. |
| :color[12]{hex="#FF5FA2"} | 1 | h(12) = 12 mod 11 = 1. It was free, so it goes straight in. |
| :color[22]{hex="#FF5FA2"} | 0 | h(22) = 22 mod 11 = 0. Slots 0 were taken, so probe 1 gives (0 + 1 × 6) mod 11 = 6, which is free. |

**(b) The final table.**

| Slot | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Holds** | **11** | **12** | · | · | **15** | **27** | **22** | · | **8** | · | · |

:mark[**Probes: 1, 1, 1, 1, 1, 2 &nbsp; total 7**]{hex="#204A2E"}

> The longest run of occupied slots is **:color[3]{hex="#EF4444"}**. Runs still form, but a key landing inside one does not necessarily extend it, because the step size depends on the key.

**(c) Load factor.**

$\alpha = n / m = 6 / 11 = 0.545$

With open addressing the load factor cannot exceed 1, and performance degrades sharply above about 0.7, which is when a real implementation would resize.

:mark[**α = 0.545**]{hex="#204A2E"}

### Q19. Build a table with linear probing

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

Insert `22, 1, 13, 11, 24, 33, 18` into a table of size **m = 11**, using $h(k) = k \bmod 11$ and **linear probing** ($(h(k) + i) \bmod m$).

**(a)** Insert the keys in order, showing each step. &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

**(b)** Draw the final table. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** State the load factor. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The insertions.**

| Key | h(k) | What happens |
| --- | --- | --- |
| :color[22]{hex="#FF5FA2"} | 0 | h(22) = 22 mod 11 = 0. It was free, so it goes straight in. |
| :color[1]{hex="#FF5FA2"} | 1 | h(1) = 1 mod 11 = 1. It was free, so it goes straight in. |
| :color[13]{hex="#FF5FA2"} | 2 | h(13) = 13 mod 11 = 2. It was free, so it goes straight in. |
| :color[11]{hex="#FF5FA2"} | 0 | h(11) = 11 mod 11 = 0. Slots 0, 1, 2 were taken, so probe 3 gives (0 + 3) mod 11 = 3, which is free. |
| :color[24]{hex="#FF5FA2"} | 2 | h(24) = 24 mod 11 = 2. Slots 2, 3 were taken, so probe 2 gives (2 + 2) mod 11 = 4, which is free. |
| :color[33]{hex="#FF5FA2"} | 0 | h(33) = 33 mod 11 = 0. Slots 0, 1, 2, 3, 4 were taken, so probe 5 gives (0 + 5) mod 11 = 5, which is free. |
| :color[18]{hex="#FF5FA2"} | 7 | h(18) = 18 mod 11 = 7. It was free, so it goes straight in. |

**(b) The final table.**

| Slot | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Holds** | **22** | **1** | **13** | **11** | **24** | **33** | · | **18** | · | · | · |

:mark[**Probes: 1, 1, 1, 4, 3, 6, 1 &nbsp; total 17**]{hex="#204A2E"}

> The longest run of occupied slots is **:color[6]{hex="#EF4444"}**. With linear probing that run will keep growing, because any key that hashes anywhere inside it ends up on its far end. That is primary clustering.

**(c) Load factor.**

$\alpha = n / m = 7 / 11 = 0.636$

With open addressing the load factor cannot exceed 1, and performance degrades sharply above about 0.7, which is when a real implementation would resize.

:mark[**α = 0.636**]{hex="#204A2E"}

### Q20. Build a table with double hashing

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

Insert `18, 41, 22, 44, 59, 32, 31` into a table of size **m = 13**, using $h(k) = k \bmod 13$ and **double hashing** ($(h_1(k) + i \times h_2(k)) \bmod m$).

Use $h_2(k) = 11 - (k \bmod 11)$.

**(a)** Insert the keys in order, showing each step. &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

**(b)** Draw the final table. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** State the load factor. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The insertions.**

| Key | h(k) | What happens |
| --- | --- | --- |
| :color[18]{hex="#FF5FA2"} | 5 | h(18) = 18 mod 13 = 5. It was free, so it goes straight in. |
| :color[41]{hex="#FF5FA2"} | 2 | h(41) = 41 mod 13 = 2. It was free, so it goes straight in. |
| :color[22]{hex="#FF5FA2"} | 9 | h(22) = 22 mod 13 = 9. It was free, so it goes straight in. |
| :color[44]{hex="#FF5FA2"} | 5 | h(44) = 44 mod 13 = 5. Slots 5 were taken, so probe 1 gives (5 + 1 × 11) mod 13 = 3, which is free. |
| :color[59]{hex="#FF5FA2"} | 7 | h(59) = 59 mod 13 = 7. It was free, so it goes straight in. |
| :color[32]{hex="#FF5FA2"} | 6 | h(32) = 32 mod 13 = 6. It was free, so it goes straight in. |
| :color[31]{hex="#FF5FA2"} | 5 | h(31) = 31 mod 13 = 5. Slots 5, 7, 9 were taken, so probe 3 gives (5 + 3 × 2) mod 13 = 11, which is free. |

**(b) The final table.**

| Slot | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Holds** | · | · | **41** | **44** | · | **18** | **32** | **59** | · | **22** | · | **31** | · |

:mark[**Probes: 1, 1, 1, 2, 1, 1, 4 &nbsp; total 11**]{hex="#204A2E"}

> The longest run of occupied slots is **:color[3]{hex="#EF4444"}**. Runs still form, but a key landing inside one does not necessarily extend it, because the step size depends on the key.

**(c) Load factor.**

$\alpha = n / m = 7 / 13 = 0.538$

With open addressing the load factor cannot exceed 1, and performance degrades sharply above about 0.7, which is when a real implementation would resize.

:mark[**α = 0.538**]{hex="#204A2E"}

### Q21. Build a table with quadratic probing

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

Insert `20, 34, 45, 12, 31, 78` into a table of size **m = 11**, using $h(k) = k \bmod 11$ and **quadratic probing** ($(h(k) + i^2) \bmod m$).

**(a)** Insert the keys in order, showing each step. &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

**(b)** Draw the final table. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** State the load factor. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The insertions.**

| Key | h(k) | What happens |
| --- | --- | --- |
| :color[20]{hex="#FF5FA2"} | 9 | h(20) = 20 mod 11 = 9. It was free, so it goes straight in. |
| :color[34]{hex="#FF5FA2"} | 1 | h(34) = 34 mod 11 = 1. It was free, so it goes straight in. |
| :color[45]{hex="#FF5FA2"} | 1 | h(45) = 45 mod 11 = 1. Slots 1 were taken, so probe 1 gives (1 + 1²) mod 11 = 2, which is free. |
| :color[12]{hex="#FF5FA2"} | 1 | h(12) = 12 mod 11 = 1. Slots 1, 2 were taken, so probe 2 gives (1 + 2²) mod 11 = 5, which is free. |
| :color[31]{hex="#FF5FA2"} | 9 | h(31) = 31 mod 11 = 9. Slots 9 were taken, so probe 1 gives (9 + 1²) mod 11 = 10, which is free. |
| :color[78]{hex="#FF5FA2"} | 1 | h(78) = 78 mod 11 = 1. Slots 1, 2, 5, 10 were taken, so probe 4 gives (1 + 4²) mod 11 = 6, which is free. |

**(b) The final table.**

| Slot | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Holds** | · | **34** | **45** | · | · | **12** | **78** | · | · | **20** | **31** |

:mark[**Probes: 1, 1, 2, 3, 2, 5 &nbsp; total 14**]{hex="#204A2E"}

**(c) Load factor.**

$\alpha = n / m = 6 / 11 = 0.545$

With open addressing the load factor cannot exceed 1, and performance degrades sharply above about 0.7, which is when a real implementation would resize.

:mark[**α = 0.545**]{hex="#204A2E"}

### Q22. Build a table with separate chaining

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

Insert `37, 24, 50, 11, 63, 88, 15` into a table of size **m = 13**, using $h(k) = k \bmod 13$ and **separate chaining** (each slot holds a list).

**(a)** Insert the keys in order, showing each step. &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

**(b)** Draw the final table. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** State the load factor. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The insertions.**

| Key | h(k) | What happens |
| --- | --- | --- |
| :color[37]{hex="#FF5FA2"} | 11 | h(37) = 37 mod 13 = 11. Slot 11 is empty, so 37 goes in. |
| :color[24]{hex="#FF5FA2"} | 11 | h(24) = 24 mod 13 = 11. Slot 11 already holds 37, so 24 joins the chain. |
| :color[50]{hex="#FF5FA2"} | 11 | h(50) = 50 mod 13 = 11. Slot 11 already holds 37, 24, so 50 joins the chain. |
| :color[11]{hex="#FF5FA2"} | 11 | h(11) = 11 mod 13 = 11. Slot 11 already holds 37, 24, 50, so 11 joins the chain. |
| :color[63]{hex="#FF5FA2"} | 11 | h(63) = 63 mod 13 = 11. Slot 11 already holds 37, 24, 50, 11, so 63 joins the chain. |
| :color[88]{hex="#FF5FA2"} | 10 | h(88) = 88 mod 13 = 10. Slot 10 is empty, so 88 goes in. |
| :color[15]{hex="#FF5FA2"} | 2 | h(15) = 15 mod 13 = 2. Slot 2 is empty, so 15 goes in. |

**(b) The final table.**

| Slot | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Holds** | · | · | 15 | · | · | · | · | · | · | · | 88 | 37 → 24 → 50 → 11 → 63 | · |

:mark[**3 of 13 slots used, longest chain 5.**]{hex="#204A2E"}

**(c) Load factor.**

$\alpha = n / m = 7 / 13 = 0.538$

With chaining the load factor is the **average chain length**, and it may exceed 1 without anything breaking.

:mark[**α = 0.538**]{hex="#204A2E"}

### Q23. Build a table with linear probing

> :mark[**Very hard**]{hex="#5C2323"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

Insert `22, 1, 13, 11, 24, 33, 18, 42, 31` into a table of size **m = 11**, using $h(k) = k \bmod 11$ and **linear probing** ($(h(k) + i) \bmod m$).

**(a)** Insert the keys in order, showing each step. &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

**(b)** Draw the final table. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** State the load factor. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The insertions.**

| Key | h(k) | What happens |
| --- | --- | --- |
| :color[22]{hex="#FF5FA2"} | 0 | h(22) = 22 mod 11 = 0. It was free, so it goes straight in. |
| :color[1]{hex="#FF5FA2"} | 1 | h(1) = 1 mod 11 = 1. It was free, so it goes straight in. |
| :color[13]{hex="#FF5FA2"} | 2 | h(13) = 13 mod 11 = 2. It was free, so it goes straight in. |
| :color[11]{hex="#FF5FA2"} | 0 | h(11) = 11 mod 11 = 0. Slots 0, 1, 2 were taken, so probe 3 gives (0 + 3) mod 11 = 3, which is free. |
| :color[24]{hex="#FF5FA2"} | 2 | h(24) = 24 mod 11 = 2. Slots 2, 3 were taken, so probe 2 gives (2 + 2) mod 11 = 4, which is free. |
| :color[33]{hex="#FF5FA2"} | 0 | h(33) = 33 mod 11 = 0. Slots 0, 1, 2, 3, 4 were taken, so probe 5 gives (0 + 5) mod 11 = 5, which is free. |
| :color[18]{hex="#FF5FA2"} | 7 | h(18) = 18 mod 11 = 7. It was free, so it goes straight in. |
| :color[42]{hex="#FF5FA2"} | 9 | h(42) = 42 mod 11 = 9. It was free, so it goes straight in. |
| :color[31]{hex="#FF5FA2"} | 9 | h(31) = 31 mod 11 = 9. Slots 9 were taken, so probe 1 gives (9 + 1) mod 11 = 10, which is free. |

**(b) The final table.**

| Slot | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Holds** | **22** | **1** | **13** | **11** | **24** | **33** | · | **18** | · | **42** | **31** |

:mark[**Probes: 1, 1, 1, 4, 3, 6, 1, 1, 2 &nbsp; total 20**]{hex="#204A2E"}

> The longest run of occupied slots is **:color[8]{hex="#EF4444"}**. With linear probing that run will keep growing, because any key that hashes anywhere inside it ends up on its far end. That is primary clustering.

**(c) Load factor.**

$\alpha = n / m = 9 / 11 = 0.818$

With open addressing the load factor cannot exceed 1, and performance degrades sharply above about 0.7, which is when a real implementation would resize.

:mark[**α = 0.818**]{hex="#204A2E"}

### Q24. Build a table with double hashing

> :mark[**Very hard**]{hex="#5C2323"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

Insert `22, 1, 13, 11, 24, 33, 18, 42, 31` into a table of size **m = 11**, using $h(k) = k \bmod 11$ and **double hashing** ($(h_1(k) + i \times h_2(k)) \bmod m$).

Use $h_2(k) = 7 - (k \bmod 7)$.

**(a)** Insert the keys in order, showing each step. &nbsp; :mark[**7 marks**]{hex="#3A3A3E"}

**(b)** Draw the final table. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** State the load factor. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The insertions.**

| Key | h(k) | What happens |
| --- | --- | --- |
| :color[22]{hex="#FF5FA2"} | 0 | h(22) = 22 mod 11 = 0. It was free, so it goes straight in. |
| :color[1]{hex="#FF5FA2"} | 1 | h(1) = 1 mod 11 = 1. It was free, so it goes straight in. |
| :color[13]{hex="#FF5FA2"} | 2 | h(13) = 13 mod 11 = 2. It was free, so it goes straight in. |
| :color[11]{hex="#FF5FA2"} | 0 | h(11) = 11 mod 11 = 0. Slots 0 were taken, so probe 1 gives (0 + 1 × 3) mod 11 = 3, which is free. |
| :color[24]{hex="#FF5FA2"} | 2 | h(24) = 24 mod 11 = 2. Slots 2 were taken, so probe 1 gives (2 + 1 × 4) mod 11 = 6, which is free. |
| :color[33]{hex="#FF5FA2"} | 0 | h(33) = 33 mod 11 = 0. Slots 0, 2 were taken, so probe 2 gives (0 + 2 × 2) mod 11 = 4, which is free. |
| :color[18]{hex="#FF5FA2"} | 7 | h(18) = 18 mod 11 = 7. It was free, so it goes straight in. |
| :color[42]{hex="#FF5FA2"} | 9 | h(42) = 42 mod 11 = 9. It was free, so it goes straight in. |
| :color[31]{hex="#FF5FA2"} | 9 | h(31) = 31 mod 11 = 9. Slots 9, 2, 6 were taken, so probe 3 gives (9 + 3 × 4) mod 11 = 10, which is free. |

**(b) The final table.**

| Slot | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Holds** | **22** | **1** | **13** | **11** | **33** | · | **24** | **18** | · | **42** | **31** |

:mark[**Probes: 1, 1, 1, 2, 2, 3, 1, 1, 4 &nbsp; total 16**]{hex="#204A2E"}

> The longest run of occupied slots is **:color[7]{hex="#EF4444"}**. Runs still form, but a key landing inside one does not necessarily extend it, because the step size depends on the key.

**(c) Load factor.**

$\alpha = n / m = 9 / 11 = 0.818$

With open addressing the load factor cannot exceed 1, and performance degrades sharply above about 0.7, which is when a real implementation would resize.

:mark[**α = 0.818**]{hex="#204A2E"}

## Part C: search, delete, load factor

Given a finished table. Part (c) is the tombstone problem, and in five of these seven a naive delete really does strand a key.

### Q25. Searching and deleting

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

The keys `15, 11, 27, 8` were inserted into a table of size **m = 11** with $h(k) = k \bmod 11$ and **linear probing**, giving:

| Slot | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Holds** | **11** | · | · | · | **15** | **27** | · | · | **8** | · | · |

**(a)** Search for **27**. List the slots probed. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(b)** Search for **9**. List the slots probed and say how the search knows to stop. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** Delete **11** by blanking its slot. What goes wrong, and what is the fix? &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(d)** State the load factor. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) Searching for 27.**

$h(27) = 27 \bmod 11 = 5$, then walk forward while the slot is occupied by something else.

Slots probed: `5`

:mark[**Found at slot 5 after 1 probe.**]{hex="#204A2E"}

**(b) Searching for 9.**

$h(9) = 9$. Slots probed: `9`

The last slot probed, 9, is **:color[empty]{hex="#22C55E"}**. That is the stopping condition: if 9 were in the table, the insertion would have stopped at the first empty slot on this same walk, so reaching an empty slot proves the key is absent.

:mark[**Not found, after 1 probe.**]{hex="#5C2323"}

**(c) Deleting 11.**

11 sits in slot :color[0]{hex="#EF4444"}. Blanking it looks harmless.

Here nothing is stranded, because no key was placed by a walk that passed through that slot. That is luck, not safety: the same operation on a different key would break the table.

**The fix is a tombstone.** Mark the slot as *deleted* rather than *empty*. A search treats a tombstone as occupied and keeps walking; an insertion treats it as free and may reuse it.

:mark[**Blanking a slot can strand later keys. Leave a tombstone instead.**]{hex="#1B4A46"}

**(d) Load factor.**

$\alpha = 4 / 11 = 0.364$

:mark[**α = 0.364**]{hex="#204A2E"}

### Q26. Searching and deleting

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

The keys `20, 34, 45, 12` were inserted into a table of size **m = 11** with $h(k) = k \bmod 11$ and **linear probing**, giving:

| Slot | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Holds** | · | **34** | **45** | **12** | · | · | · | · | · | **20** | · |

**(a)** Search for **45**. List the slots probed. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(b)** Search for **7**. List the slots probed and say how the search knows to stop. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** Delete **34** by blanking its slot. What goes wrong, and what is the fix? &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(d)** State the load factor. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) Searching for 45.**

$h(45) = 45 \bmod 11 = 1$, then walk forward while the slot is occupied by something else.

Slots probed: `1, 2`

:mark[**Found at slot 2 after 2 probes.**]{hex="#204A2E"}

**(b) Searching for 7.**

$h(7) = 7$. Slots probed: `7`

The last slot probed, 7, is **:color[empty]{hex="#22C55E"}**. That is the stopping condition: if 7 were in the table, the insertion would have stopped at the first empty slot on this same walk, so reaching an empty slot proves the key is absent.

:mark[**Not found, after 1 probe.**]{hex="#5C2323"}

**(c) Deleting 34.**

34 sits in slot :color[1]{hex="#EF4444"}. Blanking it looks harmless.

It is not. **:color[45]{hex="#EF4444"}** was placed by a walk that passed **through** slot 1. A later search for 45 starts at $h(45) = 1$, reaches the now empty slot 1, and stops there, concluding that 45 is absent.

45 is still in the table and has become **unreachable**. Any of `45, 12` can be stranded this way.

**The fix is a tombstone.** Mark the slot as *deleted* rather than *empty*. A search treats a tombstone as occupied and keeps walking; an insertion treats it as free and may reuse it.

:mark[**Blanking a slot can strand later keys. Leave a tombstone instead.**]{hex="#1B4A46"}

**(d) Load factor.**

$\alpha = 4 / 11 = 0.364$

:mark[**α = 0.364**]{hex="#204A2E"}

### Q27. Searching and deleting

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

The keys `22, 1, 13, 11, 24` were inserted into a table of size **m = 11** with $h(k) = k \bmod 11$ and **linear probing**, giving:

| Slot | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Holds** | **22** | **1** | **13** | **11** | **24** | · | · | · | · | · | · |

**(a)** Search for **24**. List the slots probed. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(b)** Search for **5**. List the slots probed and say how the search knows to stop. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** Delete **22** by blanking its slot. What goes wrong, and what is the fix? &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(d)** State the load factor. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) Searching for 24.**

$h(24) = 24 \bmod 11 = 2$, then walk forward while the slot is occupied by something else.

Slots probed: `2, 3, 4`

:mark[**Found at slot 4 after 3 probes.**]{hex="#204A2E"}

**(b) Searching for 5.**

$h(5) = 5$. Slots probed: `5`

The last slot probed, 5, is **:color[empty]{hex="#22C55E"}**. That is the stopping condition: if 5 were in the table, the insertion would have stopped at the first empty slot on this same walk, so reaching an empty slot proves the key is absent.

:mark[**Not found, after 1 probe.**]{hex="#5C2323"}

**(c) Deleting 22.**

22 sits in slot :color[0]{hex="#EF4444"}. Blanking it looks harmless.

It is not. **:color[11]{hex="#EF4444"}** was placed by a walk that passed **through** slot 0. A later search for 11 starts at $h(11) = 0$, reaches the now empty slot 0, and stops there, concluding that 11 is absent.

11 is still in the table and has become **unreachable**. Any of `11` can be stranded this way.

**The fix is a tombstone.** Mark the slot as *deleted* rather than *empty*. A search treats a tombstone as occupied and keeps walking; an insertion treats it as free and may reuse it.

:mark[**Blanking a slot can strand later keys. Leave a tombstone instead.**]{hex="#1B4A46"}

**(d) Load factor.**

$\alpha = 5 / 11 = 0.455$

:mark[**α = 0.455**]{hex="#204A2E"}

### Q28. Searching and deleting

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

The keys `18, 41, 22, 44, 59` were inserted into a table of size **m = 13** with $h(k) = k \bmod 13$ and **linear probing**, giving:

| Slot | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Holds** | · | · | **41** | · | · | **18** | **44** | **59** | · | **22** | · | · | · |

**(a)** Search for **44**. List the slots probed. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(b)** Search for **20**. List the slots probed and say how the search knows to stop. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** Delete **41** by blanking its slot. What goes wrong, and what is the fix? &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(d)** State the load factor. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) Searching for 44.**

$h(44) = 44 \bmod 13 = 5$, then walk forward while the slot is occupied by something else.

Slots probed: `5, 6`

:mark[**Found at slot 6 after 2 probes.**]{hex="#204A2E"}

**(b) Searching for 20.**

$h(20) = 7$. Slots probed: `7, 8`

The last slot probed, 8, is **:color[empty]{hex="#22C55E"}**. That is the stopping condition: if 20 were in the table, the insertion would have stopped at the first empty slot on this same walk, so reaching an empty slot proves the key is absent.

:mark[**Not found, after 2 probes.**]{hex="#5C2323"}

**(c) Deleting 41.**

41 sits in slot :color[2]{hex="#EF4444"}. Blanking it looks harmless.

Here nothing is stranded, because no key was placed by a walk that passed through that slot. That is luck, not safety: the same operation on a different key would break the table.

**The fix is a tombstone.** Mark the slot as *deleted* rather than *empty*. A search treats a tombstone as occupied and keeps walking; an insertion treats it as free and may reuse it.

:mark[**Blanking a slot can strand later keys. Leave a tombstone instead.**]{hex="#1B4A46"}

**(d) Load factor.**

$\alpha = 5 / 13 = 0.385$

:mark[**α = 0.385**]{hex="#204A2E"}

### Q29. Searching and deleting

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

The keys `22, 1, 13, 11, 24, 33, 18` were inserted into a table of size **m = 11** with $h(k) = k \bmod 11$ and **linear probing**, giving:

| Slot | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Holds** | **22** | **1** | **13** | **11** | **24** | **33** | · | **18** | · | · | · |

**(a)** Search for **33**. List the slots probed. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(b)** Search for **6**. List the slots probed and say how the search knows to stop. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** Delete **1** by blanking its slot. What goes wrong, and what is the fix? &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(d)** State the load factor. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) Searching for 33.**

$h(33) = 33 \bmod 11 = 0$, then walk forward while the slot is occupied by something else.

Slots probed: `0, 1, 2, 3, 4, 5`

:mark[**Found at slot 5 after 6 probes.**]{hex="#204A2E"}

**(b) Searching for 6.**

$h(6) = 6$. Slots probed: `6`

The last slot probed, 6, is **:color[empty]{hex="#22C55E"}**. That is the stopping condition: if 6 were in the table, the insertion would have stopped at the first empty slot on this same walk, so reaching an empty slot proves the key is absent.

:mark[**Not found, after 1 probe.**]{hex="#5C2323"}

**(c) Deleting 1.**

1 sits in slot :color[1]{hex="#EF4444"}. Blanking it looks harmless.

It is not. **:color[11]{hex="#EF4444"}** was placed by a walk that passed **through** slot 1. A later search for 11 starts at $h(11) = 0$, reaches the now empty slot 1, and stops there, concluding that 11 is absent.

11 is still in the table and has become **unreachable**. Any of `11, 33` can be stranded this way.

**The fix is a tombstone.** Mark the slot as *deleted* rather than *empty*. A search treats a tombstone as occupied and keeps walking; an insertion treats it as free and may reuse it.

:mark[**Blanking a slot can strand later keys. Leave a tombstone instead.**]{hex="#1B4A46"}

**(d) Load factor.**

$\alpha = 7 / 11 = 0.636$

:mark[**α = 0.636**]{hex="#204A2E"}

### Q30. Searching and deleting

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

The keys `79, 69, 98, 72, 14, 50` were inserted into a table of size **m = 11** with $h(k) = k \bmod 11$ and **linear probing**, giving:

| Slot | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Holds** | · | · | **79** | **69** | **14** | · | **72** | **50** | · | · | **98** |

**(a)** Search for **50**. List the slots probed. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(b)** Search for **8**. List the slots probed and say how the search knows to stop. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** Delete **69** by blanking its slot. What goes wrong, and what is the fix? &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(d)** State the load factor. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) Searching for 50.**

$h(50) = 50 \bmod 11 = 6$, then walk forward while the slot is occupied by something else.

Slots probed: `6, 7`

:mark[**Found at slot 7 after 2 probes.**]{hex="#204A2E"}

**(b) Searching for 8.**

$h(8) = 8$. Slots probed: `8`

The last slot probed, 8, is **:color[empty]{hex="#22C55E"}**. That is the stopping condition: if 8 were in the table, the insertion would have stopped at the first empty slot on this same walk, so reaching an empty slot proves the key is absent.

:mark[**Not found, after 1 probe.**]{hex="#5C2323"}

**(c) Deleting 69.**

69 sits in slot :color[3]{hex="#EF4444"}. Blanking it looks harmless.

It is not. **:color[14]{hex="#EF4444"}** was placed by a walk that passed **through** slot 3. A later search for 14 starts at $h(14) = 3$, reaches the now empty slot 3, and stops there, concluding that 14 is absent.

14 is still in the table and has become **unreachable**. Any of `14` can be stranded this way.

**The fix is a tombstone.** Mark the slot as *deleted* rather than *empty*. A search treats a tombstone as occupied and keeps walking; an insertion treats it as free and may reuse it.

:mark[**Blanking a slot can strand later keys. Leave a tombstone instead.**]{hex="#1B4A46"}

**(d) Load factor.**

$\alpha = 6 / 11 = 0.545$

:mark[**α = 0.545**]{hex="#204A2E"}

### Q31. Searching and deleting

> :mark[**Very hard**]{hex="#5C2323"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

The keys `22, 1, 13, 11, 24, 33, 18, 42, 31` were inserted into a table of size **m = 11** with $h(k) = k \bmod 11$ and **linear probing**, giving:

| Slot | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Holds** | **22** | **1** | **13** | **11** | **24** | **33** | · | **18** | · | **42** | **31** |

**(a)** Search for **31**. List the slots probed. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(b)** Search for **4**. List the slots probed and say how the search knows to stop. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(c)** Delete **13** by blanking its slot. What goes wrong, and what is the fix? &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(d)** State the load factor. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) Searching for 31.**

$h(31) = 31 \bmod 11 = 9$, then walk forward while the slot is occupied by something else.

Slots probed: `9, 10`

:mark[**Found at slot 10 after 2 probes.**]{hex="#204A2E"}

**(b) Searching for 4.**

$h(4) = 4$. Slots probed: `4, 5, 6`

The last slot probed, 6, is **:color[empty]{hex="#22C55E"}**. That is the stopping condition: if 4 were in the table, the insertion would have stopped at the first empty slot on this same walk, so reaching an empty slot proves the key is absent.

:mark[**Not found, after 3 probes.**]{hex="#5C2323"}

**(c) Deleting 13.**

13 sits in slot :color[2]{hex="#EF4444"}. Blanking it looks harmless.

It is not. **:color[11]{hex="#EF4444"}** was placed by a walk that passed **through** slot 2. A later search for 11 starts at $h(11) = 0$, reaches the now empty slot 2, and stops there, concluding that 11 is absent.

11 is still in the table and has become **unreachable**. Any of `11, 24, 33` can be stranded this way.

**The fix is a tombstone.** Mark the slot as *deleted* rather than *empty*. A search treats a tombstone as occupied and keeps walking; an insertion treats it as free and may reuse it.

:mark[**Blanking a slot can strand later keys. Leave a tombstone instead.**]{hex="#1B4A46"}

**(d) Load factor.**

$\alpha = 9 / 11 = 0.818$

:mark[**α = 0.818**]{hex="#204A2E"}

---

# Self test

1. What does a hash table give you that a balanced search tree does not, and what does it take away?
2. Explain `k mod m` in terms of division, without using the word modulo.
3. Why must the result of `k mod m` always be a valid slot number?
4. Why should m be prime, and what specifically goes wrong when m is a power of 2?
5. Why does mid-square take the **middle** digits?
6. What is the load factor, and what does it mean for chaining and for open addressing?
7. Why are collisions unavoidable? Name the principle.
8. In chaining, what is the worst case search cost and when does it happen?
9. Give the probe formula for linear, quadratic and double hashing.
10. What is primary clustering, and why is it self-reinforcing?
11. What is secondary clustering, and which method still suffers from it?
12. What two conditions must h₂(k) satisfy, and what breaks if each is violated?
13. Why is quadratic probing only safe below half full?
14. What does an open addressed search do when it reaches an empty slot, and why?
15. Why does blanking a deleted slot break the table? What is the fix and what does it cost?
16. When would you resize, and why is rehashing unavoidable?
17. Which collision strategy has the best cache behaviour, and why?

# Summary

| Idea | The short version |
| --- | --- |
| Hash table | an array plus a function from key to index |
| Why it is fast | it computes the address instead of searching for it |
| What it gives up | all ordering: no sorted walk, no min, no range |
| `k mod m` | the remainder after dividing, always in 0 … m−1 |
| Division method | $h(k) = k \bmod m$. Pick m **prime**, never a power of 2 |
| Mid-square | square it, take the middle digits, reduce |
| Multiplicative | $\lfloor m(kA \bmod 1) \rfloor$, and m can be anything |
| Folding | split into groups, add, reduce |
| Collisions | unavoidable, by the pigeonhole principle |
| Load factor | $\alpha = n/m$, and everything depends on it |
| Chaining | a list per slot. α may exceed 1, deletion is easy |
| Linear probing | $h(k)+i$. Primary clustering, best cache behaviour |
| Quadratic probing | $h(k)+i^2$. Secondary clustering, needs α < 0.5 |
| Double hashing | $h_1(k)+i\,h_2(k)$. No clustering; h₂ ≠ 0 and coprime with m |
| Open addressed search | stops at the first empty slot |
| Deletion | needs a tombstone, or later keys become unreachable |
| Resizing | at about α = 0.7, and every key must be rehashed |
