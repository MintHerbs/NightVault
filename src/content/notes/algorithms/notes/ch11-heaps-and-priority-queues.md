# Chapter 11: Heaps and Priority Queues

Chapter 10 built a tree that keeps its keys **completely** ordered, and paid for it: a search tree can degenerate into a line, and keeping it balanced needs rotations.

A **heap** gives up most of that ordering on purpose. It only promises one thing, about each node and its own children, and in exchange it is always perfectly shaped, needs no pointers at all, and answers one question instantly: **what is the largest value here?**

That single question is worth a whole data structure, because it is what a **priority queue** asks, and priority queues run schedulers, Dijkstra, A\*, Huffman coding and every job queue that has ever had an urgent job in it.

> The chapter runs on seven colours, and each one keeps its meaning to the last page.
>
> | Colour | What it is |
> | --- | --- |
> | **:color[the root]{hex="#EAB308"}** | index 0, the largest value in a max-heap |
> | **:color[an internal node]{hex="#5B8CFF"}** | a value with at least one child |
> | **:color[a leaf]{hex="#22C55E"}** | a value with no children, the bottom half of the array |
> | **:color[being looked at]{hex="#FF5FA2"}** | the value moving this step |
> | **:color[settled or sorted]{hex="#A78BFA"}** | finished, not touched again |
> | **:color[leaving]{hex="#EF4444"}** | coming off the heap |
> | **:color[just arrived]{hex="#2DD4BF"}** | a value added this step |

## The heap property

A **max-heap** is a binary tree where **every parent is greater than or equal to both of its children**. A **min-heap** is the same with the comparison reversed.

![A max-heap, a min-heap and a tree that breaks the heap property, side by side](/notes/img/algorithms/ch11-what-is-a-heap.svg)

Read that definition carefully, because what it does **not** say is the important part.

- It says nothing about **left against right**. A parent's two children are in no order relative to each other. In the max-heap above, 12 sits left of 19 and that is fine.
- It says nothing about **cousins**, or about anything more than one level apart, except by the chain of parents between them.
- So an in-order walk of a heap is **not** sorted, and searching a heap for an arbitrary value costs **:color[O(n)]{hex="#EF4444"}**. A heap is not a search structure.

:mark[**The only value a heap can find quickly is the one at the top.**]{hex="#1B4A46"}

That is the trade. A search tree orders everything and is fragile. A heap orders almost nothing and is indestructible.

### The shape rule

Alongside the ordering rule there is a shape rule, and it is doing more work than it looks:

:mark[**A heap is always a complete tree: every level full except the last, which fills from the left.**]{hex="#1B4A46"}

Nothing you can do to a heap is allowed to break that. It is why a heap can never degenerate the way a search tree can, so the height is always **:color[⌊log₂ n⌋]{hex="#22C55E"}**, and it is what makes the next section possible.

## A heap is an array

Because the tree is always complete, there are never any gaps, so the nodes can be written into an array left to right, top to bottom, with nothing wasted and no links to store.

![An animation filling a heap array level by level from the tree](/notes/img/algorithms/ch11-array-mapping.svg)

:mark[**The tree is a way of talking about the array. Only the array exists.**]{hex="#3A3A3E"}

This is the part worth getting comfortable with, because every exam question is set on the array and every answer is written as an array. The tree is a drawing you make to think with.

### Parent and child are arithmetic

![The parent, left child and right child index formulas worked on one node](/notes/img/algorithms/ch11-index-arithmetic.svg)

| From index $i$ | Formula |
| --- | --- |
| Parent | $(i - 1) \div 2$, rounded down |
| Left child | $2i + 1$ |
| Right child | $2i + 2$ |

Three things follow, and questions are built out of all three:

1. **A child index is only a real node while it is less than $n$.** Every sink has to check that before it looks. This is the single most common lost mark in the topic.
2. **The last parent is at index $n \div 2 - 1$.** Everything after it is a leaf.
3. **Half the array is leaves.** That fact is the whole reason the bottom up build in a later section is **:color[O(n)]{hex="#22C55E"}** rather than $O(n \log n)$.

> **If your course numbers from 1** the formulas become $parent(i) = i \div 2$, $left(i) = 2i$ and $right(i) = 2i + 1$, which is tidier, and the last parent is at $n \div 2$. This chapter numbers from **0**, to match the array chapters and to match real code. Check your own slides once, then be consistent.

---

# The two repairs

Only two things can ever be wrong with a heap, and there is one repair for each.

| What is wrong | The fix | Direction | Cost |
| --- | --- | --- | --- |
| one value is too **strong** for where it sits | **:color[upheap]{hex="#FF5FA2"}** | climbs toward the root | $O(\log n)$ |
| one value is too **weak** for where it sits | **:color[downheap]{hex="#FF5FA2"}** | sinks toward the leaves | $O(\log n)$ |

Every operation in the rest of this chapter is one of these two, or a loop over one of them. Learn these and the rest is bookkeeping.

## Upheap

Compare the value with its **parent**. If it beats the parent, swap, and repeat from the new position. Stop when it does not beat its parent, or when it reaches the root.

![An animation of a value climbing to its place in a max-heap](/notes/img/algorithms/ch11-upheap.svg)

> Only the parent is ever consulted. There is no need to look at a sibling, because the sibling is already below the parent, so beating the parent beats the sibling too.

## Downheap

Compare the value with **both** children. If the stronger of them beats it, swap with that one, and repeat. Stop when neither child beats it, or when it reaches a leaf.

![An animation of a value sinking to its place in a max-heap](/notes/img/algorithms/ch11-downheap.svg)

:mark[**Swap with the stronger child, not the first one that beats you.**]{hex="#5C2323"}

That is the trap. In a max-heap, if you swap with the smaller of two children that both beat the parent, the value you promote is now sitting above a larger sibling, and you have broken the heap while trying to fix it. Compare the two children with **each other** first.

---

# Building a heap

Given a loose array, there are two ways to turn it into a heap, and an exam will name which one it wants.

## Top down: insert one at a time

Start from an empty heap. Put each value in the next free slot, then **upheap** it.

![An animation building a heap by inserting each value in turn](/notes/img/algorithms/ch11-build-top-down.svg)

Each insertion is $O(\log n)$ and there are $n$ of them, so the build is **:color[O(n log n)]{hex="#F97316"}**.

## Bottom up: heapify

Take the array exactly as it is. Every leaf is already a heap on its own, so there is nothing to do to the back half. Start at the **last parent** and **downheap** each node, working backwards to index 0.

![An animation building a heap by sinking each parent in turn](/notes/img/algorithms/ch11-build-bottom-up.svg)

When you sink index $i$, both of its subtrees are already heaps, because you did them first. That is the invariant the whole method rests on, and it is why the loop has to run **backwards**.

### Why bottom up is linear

This is the counter-intuitive result of the chapter, and it gets asked.

![A tree of fifteen nodes shaded by level, showing that most nodes can barely move](/notes/img/algorithms/ch11-why-linear.svg)

The cost of sinking a node is its **height above the leaves**, not the height of the tree. So count how many nodes there are at each height:

| Nodes | Height above the leaves | Work |
| --- | --- | --- |
| $n/2$ | 0 | none at all |
| $n/4$ | 1 | one level |
| $n/8$ | 2 | two levels |
| 1 | $\log n$ | the full height |

The sum $\sum \frac{n}{2^{h+1}} \cdot h$ converges to less than $2n$, so the whole build is **:color[O(n)]{hex="#22C55E"}**.

:mark[**Top down puts every value where the climb is longest. Bottom up leaves most values where they cannot move at all.**]{hex="#3A3A3E"}

## The two builds do not agree

![The heap from a top down build beside the heap from a bottom up build](/notes/img/algorithms/ch11-build-compare.svg)

Same eight values, two correct max-heaps, two different arrays. This surprises people and it should not: **a heap is not unique**. The heap property constrains each parent against its own children and nothing else, so many arrangements satisfy it.

What this means for you in an exam: if your array differs from the mark scheme, check whether you used the other method before assuming you made a mistake. And if the question names a method, use that one, because the marks are for the working.

---

# Using a heap

## Insert

Put the value in the **next free slot**, which is index $n$, then upheap. The slot is forced: it is the only place that keeps the tree complete.

## Remove the root

This is the operation the whole structure exists for.

![An animation removing the root of a max-heap and sinking the replacement](/notes/img/algorithms/ch11-remove-root.svg)

1. Take the root. That is the answer.
2. Move the **last** value into index 0. Not a child, the last value, because removing the last slot is the only removal that keeps the tree complete.
3. **Downheap** it.

> Step 2 is the one people get wrong, by promoting the larger child instead. That leaves a hole in the middle of the array and the tree is no longer complete.

## What everything costs

| Operation | Cost | Why |
| --- | --- | --- |
| Find the maximum | :color[O(1)]{hex="#9CA3AF"} | it is index 0, just read it |
| Insert | :color[O(log n)]{hex="#A78BFA"} | one upheap, at most the height |
| Remove the root | :color[O(log n)]{hex="#A78BFA"} | one downheap, at most the height |
| Build, bottom up | :color[O(n)]{hex="#22C55E"} | most nodes cannot move |
| Build, top down | :color[O(n log n)]{hex="#F97316"} | every value may climb the full height |
| Search for any other value | :color[O(n)]{hex="#EF4444"} | no ordering to guide you |
| Space | :color[O(n)]{hex="#22C55E"} | one array, no pointers |

The last two rows are the ones that define what a heap is **for**. It is not a search structure, and it costs less memory than any tree with links.

## Priority queues

A **priority queue** is the interface; a heap is the usual implementation.

![An ordinary queue beside a priority queue, showing which element leaves next](/notes/img/algorithms/ch11-priority-queue.svg)

| Implementation | Insert | Find highest | Remove highest |
| --- | --- | --- | --- |
| Unsorted array | :color[O(1)]{hex="#9CA3AF"} | :color[O(n)]{hex="#EF4444"} | :color[O(n)]{hex="#EF4444"} |
| Sorted array | :color[O(n)]{hex="#EF4444"} | :color[O(1)]{hex="#9CA3AF"} | :color[O(1)]{hex="#9CA3AF"} |
| **Heap** | :color[O(log n)]{hex="#A78BFA"} | :color[O(1)]{hex="#9CA3AF"} | :color[O(log n)]{hex="#A78BFA"} |

Neither array is bad at everything, and that is the point: each is excellent at one end and hopeless at the other. The heap refuses to be brilliant at anything and is therefore the only one you can use when both operations happen often.

Where you will meet it again: **Dijkstra** and **A\*** pull the nearest unvisited node from a priority queue, **Huffman coding** repeatedly pulls the two least frequent symbols, and **Prim's** algorithm pulls the cheapest edge. All three are chapters 13 and 18.

---

# Heapsort

If removing the largest value is cheap, doing it repeatedly sorts the array.

![An animation of heapsort shrinking the heap and growing a sorted region](/notes/img/algorithms/ch11-heapsort.svg)

The trick that makes it free of extra memory: the value you remove needs somewhere to live, and the slot that just fell out of the heap is exactly the right place for it.

1. **Build** a max-heap from the array, bottom up. $O(n)$.
2. **Swap** index 0 with the last slot of the heap. The largest value is now in its final position.
3. **Shrink** the heap by one, so that slot is no longer part of it.
4. **Downheap** the new root, over the smaller heap.
5. Repeat until one value is left.

:mark[**A max-heap sorts into ascending order.**]{hex="#3A3A3E"} That catches people out. The largest value comes off first and goes to the **back**, so the array fills from the right and finishes ascending. If you want descending, use a min-heap.

## What it costs

| | Cost |
| --- | --- |
| Build | :color[O(n)]{hex="#22C55E"} |
| $n - 1$ extractions, each $O(\log n)$ | :color[O(n log n)]{hex="#EAB308"} |
| **Total, best, average and worst** | **:color[O(n log n)]{hex="#EAB308"}** |
| Extra space | **:color[O(1)]{hex="#9CA3AF"}** |

Two properties are worth naming because they are what an exam compares:

- **The bound is not an average.** Unlike quicksort, which is $O(n \log n)$ on average and $O(n^2)$ if it is unlucky, heapsort is $O(n \log n)$ **always**. There is no bad input.
- **It is not stable.** Equal values can be reordered by the swaps, so if you are sorting records by one field and need ties to keep their original order, heapsort will not do it.

In practice quicksort is usually faster despite the worse worst case, because it moves through memory in order and heapsort jumps around the array. Heapsort is what you reach for when the worst case is the thing you cannot afford. Chapter 15 covers quicksort, and the [sorting visualiser](/algo/sorting) lets you watch them side by side.

## The marks: what to write down

1. **State which method you are using** before you build. Top down and bottom up give different arrays and the marks are for the working.
2. **Show the array after every sink**, not just the final one. Most of the marks live here.
3. **Say which index you are sinking** at each step. One number per line is enough.
4. **For heapsort, show the boundary.** Make it clear which part is still a heap and which part is finished.
5. **Check the child index against $n$** whenever a node is near the bottom, and say that you did.
6. **The free check:** every parent must beat its children. Run your eye over the final array once, indices 0 to $n \div 2 - 1$. It takes seconds and it catches nearly everything.

---

# 32 practice questions

Three shapes, matching the three ways this topic is asked. Every array here was solved by the same code that drew its picture, so the two cannot disagree.

| Part | Shape | Questions |
| --- | --- | --- |
| **A** | build a heap from a loose array | Q1 to Q12 |
| **B** | heapsort, end to end | Q13 to Q22 |
| **C** | operate on a heap you are given | Q23 to Q32 |

## Part A: build a heap

Is it already a heap, how tall is it, build it bottom up, state the result. Two of these twelve are already heaps before you start, so part (a) is worth actually checking.

### Q1. Build a max-heap

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

You are given the array `4, 10, 3, 5, 1`.

![Q1, the array drawn as a complete tree](/notes/img/algorithms/ch11-q1.svg)

**(a)** Is this array already a **max-heap**? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree, and which indices are leaves. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Build a **max-heap** using the **bottom up** method. Show the array after each node is sunk. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(d)** State the final array. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) Is it already a max-heap?**

The rule is that every parent is greater than or equal to its children. Check every parent, which is indices 0 to 1.

Index :color[0]{hex="#EF4444"} holds 4, and its child at index :color[1]{hex="#EF4444"} holds 10, which is larger. That breaks the rule.

:mark[**Answer: no.** 4 at index 0 is beaten by 10 at index 1.]{hex="#5C2323"}

**(b) Height and leaves.**

With $n = 5$ the last parent is at index $n \div 2 - 1 = 1$, so everything after it is a leaf.

:mark[**Height 2. Leaves are indices 2, 3, 4, which is 3 of the 5 values.**]{hex="#204A2E"}

**(c) The bottom up build.**

Start at index :color[1]{hex="#FF5FA2"}, the last parent, and work back to index 0. Sink each value past the larger of its children until it settles.

| Sink index | Array before | What happens | Array after |
| --- | --- | --- | --- |
| :color[1]{hex="#FF5FA2"} (10) | `4, 10, 3, 5, 1` | 10 already beats 5 and 1, so it stays | `4, 10, 3, 5, 1` |
| :color[0]{hex="#FF5FA2"} (4) | `4, 10, 3, 5, 1` | 10 is the stronger child and beats 4, so they swap; 5 is the stronger child and beats 4, so they swap | `10, 5, 3, 4, 1` |

![Q1 answer, the finished max-heap](/notes/img/algorithms/ch11-q1h.svg)

**(d) The final array.**

:mark[**10, 5, 3, 4, 1**]{hex="#204A2E"}

That took **2 swaps** and **6 comparisons**.

> Top down happens to give the same array here, `10, 5, 3, 4, 1`. That is a coincidence of this data, not a rule.

### Q2. Build a max-heap

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

You are given the array `14, 9, 11, 7, 6`.

![Q2, the array drawn as a complete tree](/notes/img/algorithms/ch11-q2.svg)

**(a)** Is this array already a **max-heap**? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree, and which indices are leaves. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Build a **max-heap** using the **bottom up** method. Show the array after each node is sunk. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(d)** State the final array. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) Is it already a max-heap?**

The rule is that every parent is greater than or equal to its children. Check every parent, which is indices 0 to 1.

:mark[**Answer: yes.** No parent is beaten by a child, so the array is already a max-heap.]{hex="#204A2E"}

> Worth noticing: part **(c)** then costs nothing. Bottom up visits every parent, finds each one already in order, and no swap happens at all.

**(b) Height and leaves.**

With $n = 5$ the last parent is at index $n \div 2 - 1 = 1$, so everything after it is a leaf.

:mark[**Height 2. Leaves are indices 2, 3, 4, which is 3 of the 5 values.**]{hex="#204A2E"}

**(c) The bottom up build.**

Start at index :color[1]{hex="#FF5FA2"}, the last parent, and work back to index 0. Sink each value past the larger of its children until it settles.

| Sink index | Array before | What happens | Array after |
| --- | --- | --- | --- |
| :color[1]{hex="#FF5FA2"} (9) | `14, 9, 11, 7, 6` | 9 already beats 7 and 6, so it stays | `14, 9, 11, 7, 6` |
| :color[0]{hex="#FF5FA2"} (14) | `14, 9, 11, 7, 6` | 14 already beats 9 and 11, so it stays | `14, 9, 11, 7, 6` |

![Q2 answer, the finished max-heap](/notes/img/algorithms/ch11-q2h.svg)

**(d) The final array.**

:mark[**14, 9, 11, 7, 6**]{hex="#204A2E"}

That took **0 swaps** and **4 comparisons**.

> Top down happens to give the same array here, `14, 9, 11, 7, 6`. That is a coincidence of this data, not a rule.

### Q3. Build a min-heap

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

You are given the array `20, 35, 11, 8, 42`.

![Q3, the array drawn as a complete tree](/notes/img/algorithms/ch11-q3.svg)

**(a)** Is this array already a **min-heap**? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree, and which indices are leaves. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Build a **min-heap** using the **bottom up** method. Show the array after each node is sunk. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(d)** State the final array. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) Is it already a min-heap?**

The rule is that every parent is less than or equal to its children. Check every parent, which is indices 0 to 1.

Index :color[0]{hex="#EF4444"} holds 20, and its child at index :color[2]{hex="#EF4444"} holds 11, which is smaller. That breaks the rule.

:mark[**Answer: no.** 20 at index 0 is beaten by 11 at index 2.]{hex="#5C2323"}

**(b) Height and leaves.**

With $n = 5$ the last parent is at index $n \div 2 - 1 = 1$, so everything after it is a leaf.

:mark[**Height 2. Leaves are indices 2, 3, 4, which is 3 of the 5 values.**]{hex="#204A2E"}

**(c) The bottom up build.**

Start at index :color[1]{hex="#FF5FA2"}, the last parent, and work back to index 0. Sink each value past the smaller of its children until it settles.

| Sink index | Array before | What happens | Array after |
| --- | --- | --- | --- |
| :color[1]{hex="#FF5FA2"} (35) | `20, 35, 11, 8, 42` | 8 is the stronger child and beats 35, so they swap | `20, 8, 11, 35, 42` |
| :color[0]{hex="#FF5FA2"} (20) | `20, 8, 11, 35, 42` | 8 is the stronger child and beats 20, so they swap | `8, 20, 11, 35, 42` |

![Q3 answer, the finished min-heap](/notes/img/algorithms/ch11-q3h.svg)

**(d) The final array.**

:mark[**8, 20, 11, 35, 42**]{hex="#204A2E"}

That took **2 swaps** and **6 comparisons**.

> Building the same values **top down** instead gives `8, 11, 20, 35, 42`, a different array. Both are correct min-heaps. A heap is not unique, so a different answer from a different method is not a wrong answer, but it is a different method, so read the question.

### Q4. Build a max-heap

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

You are given the array `15, 4, 20, 9, 1, 12, 7`.

![Q4, the array drawn as a complete tree](/notes/img/algorithms/ch11-q4.svg)

**(a)** Is this array already a **max-heap**? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree, and which indices are leaves. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Build a **max-heap** using the **bottom up** method. Show the array after each node is sunk. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(d)** State the final array. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) Is it already a max-heap?**

The rule is that every parent is greater than or equal to its children. Check every parent, which is indices 0 to 2.

Index :color[0]{hex="#EF4444"} holds 15, and its child at index :color[2]{hex="#EF4444"} holds 20, which is larger. That breaks the rule.

:mark[**Answer: no.** 15 at index 0 is beaten by 20 at index 2.]{hex="#5C2323"}

**(b) Height and leaves.**

With $n = 7$ the last parent is at index $n \div 2 - 1 = 2$, so everything after it is a leaf.

:mark[**Height 2. Leaves are indices 3, 4, 5, 6, which is 4 of the 7 values.**]{hex="#204A2E"}

**(c) The bottom up build.**

Start at index :color[2]{hex="#FF5FA2"}, the last parent, and work back to index 0. Sink each value past the larger of its children until it settles.

| Sink index | Array before | What happens | Array after |
| --- | --- | --- | --- |
| :color[2]{hex="#FF5FA2"} (20) | `15, 4, 20, 9, 1, 12, 7` | 20 already beats 12 and 7, so it stays | `15, 4, 20, 9, 1, 12, 7` |
| :color[1]{hex="#FF5FA2"} (4) | `15, 4, 20, 9, 1, 12, 7` | 9 is the stronger child and beats 4, so they swap | `15, 9, 20, 4, 1, 12, 7` |
| :color[0]{hex="#FF5FA2"} (15) | `15, 9, 20, 4, 1, 12, 7` | 20 is the stronger child and beats 15, so they swap | `20, 9, 15, 4, 1, 12, 7` |

![Q4 answer, the finished max-heap](/notes/img/algorithms/ch11-q4h.svg)

**(d) The final array.**

:mark[**20, 9, 15, 4, 1, 12, 7**]{hex="#204A2E"}

That took **2 swaps** and **8 comparisons**.

> Top down happens to give the same array here, `20, 9, 15, 4, 1, 12, 7`. That is a coincidence of this data, not a rule.

### Q5. Build a max-heap

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

You are given the array `6, 18, 2, 11, 25, 7, 30`.

![Q5, the array drawn as a complete tree](/notes/img/algorithms/ch11-q5.svg)

**(a)** Is this array already a **max-heap**? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree, and which indices are leaves. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Build a **max-heap** using the **bottom up** method. Show the array after each node is sunk. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(d)** State the final array. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) Is it already a max-heap?**

The rule is that every parent is greater than or equal to its children. Check every parent, which is indices 0 to 2.

Index :color[0]{hex="#EF4444"} holds 6, and its child at index :color[1]{hex="#EF4444"} holds 18, which is larger. That breaks the rule.

:mark[**Answer: no.** 6 at index 0 is beaten by 18 at index 1.]{hex="#5C2323"}

**(b) Height and leaves.**

With $n = 7$ the last parent is at index $n \div 2 - 1 = 2$, so everything after it is a leaf.

:mark[**Height 2. Leaves are indices 3, 4, 5, 6, which is 4 of the 7 values.**]{hex="#204A2E"}

**(c) The bottom up build.**

Start at index :color[2]{hex="#FF5FA2"}, the last parent, and work back to index 0. Sink each value past the larger of its children until it settles.

| Sink index | Array before | What happens | Array after |
| --- | --- | --- | --- |
| :color[2]{hex="#FF5FA2"} (2) | `6, 18, 2, 11, 25, 7, 30` | 30 is the stronger child and beats 2, so they swap | `6, 18, 30, 11, 25, 7, 2` |
| :color[1]{hex="#FF5FA2"} (18) | `6, 18, 30, 11, 25, 7, 2` | 25 is the stronger child and beats 18, so they swap | `6, 25, 30, 11, 18, 7, 2` |
| :color[0]{hex="#FF5FA2"} (6) | `6, 25, 30, 11, 18, 7, 2` | 30 is the stronger child and beats 6, so they swap; 7 is the stronger child and beats 6, so they swap | `30, 25, 7, 11, 18, 6, 2` |

![Q5 answer, the finished max-heap](/notes/img/algorithms/ch11-q5h.svg)

**(d) The final array.**

:mark[**30, 25, 7, 11, 18, 6, 2**]{hex="#204A2E"}

That took **4 swaps** and **8 comparisons**.

> Building the same values **top down** instead gives `30, 18, 25, 6, 11, 2, 7`, a different array. Both are correct max-heaps. A heap is not unique, so a different answer from a different method is not a wrong answer, but it is a different method, so read the question.

### Q6. Build a min-heap

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

You are given the array `9, 17, 12, 21, 33, 38, 45`.

![Q6, the array drawn as a complete tree](/notes/img/algorithms/ch11-q6.svg)

**(a)** Is this array already a **min-heap**? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree, and which indices are leaves. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Build a **min-heap** using the **bottom up** method. Show the array after each node is sunk. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(d)** State the final array. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) Is it already a min-heap?**

The rule is that every parent is less than or equal to its children. Check every parent, which is indices 0 to 2.

:mark[**Answer: yes.** No parent is beaten by a child, so the array is already a min-heap.]{hex="#204A2E"}

> Worth noticing: part **(c)** then costs nothing. Bottom up visits every parent, finds each one already in order, and no swap happens at all.

**(b) Height and leaves.**

With $n = 7$ the last parent is at index $n \div 2 - 1 = 2$, so everything after it is a leaf.

:mark[**Height 2. Leaves are indices 3, 4, 5, 6, which is 4 of the 7 values.**]{hex="#204A2E"}

**(c) The bottom up build.**

Start at index :color[2]{hex="#FF5FA2"}, the last parent, and work back to index 0. Sink each value past the smaller of its children until it settles.

| Sink index | Array before | What happens | Array after |
| --- | --- | --- | --- |
| :color[2]{hex="#FF5FA2"} (12) | `9, 17, 12, 21, 33, 38, 45` | 12 already beats 38 and 45, so it stays | `9, 17, 12, 21, 33, 38, 45` |
| :color[1]{hex="#FF5FA2"} (17) | `9, 17, 12, 21, 33, 38, 45` | 17 already beats 21 and 33, so it stays | `9, 17, 12, 21, 33, 38, 45` |
| :color[0]{hex="#FF5FA2"} (9) | `9, 17, 12, 21, 33, 38, 45` | 9 already beats 17 and 12, so it stays | `9, 17, 12, 21, 33, 38, 45` |

![Q6 answer, the finished min-heap](/notes/img/algorithms/ch11-q6h.svg)

**(d) The final array.**

:mark[**9, 17, 12, 21, 33, 38, 45**]{hex="#204A2E"}

That took **0 swaps** and **6 comparisons**.

> Top down happens to give the same array here, `9, 17, 12, 21, 33, 38, 45`. That is a coincidence of this data, not a rule.

### Q7. Build a max-heap

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

You are given the array `8, 20, 6, 17, 3, 25, 11, 14`.

![Q7, the array drawn as a complete tree](/notes/img/algorithms/ch11-q7.svg)

**(a)** Is this array already a **max-heap**? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree, and which indices are leaves. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Build a **max-heap** using the **bottom up** method. Show the array after each node is sunk. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(d)** State the final array. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) Is it already a max-heap?**

The rule is that every parent is greater than or equal to its children. Check every parent, which is indices 0 to 3.

Index :color[0]{hex="#EF4444"} holds 8, and its child at index :color[1]{hex="#EF4444"} holds 20, which is larger. That breaks the rule.

:mark[**Answer: no.** 8 at index 0 is beaten by 20 at index 1.]{hex="#5C2323"}

**(b) Height and leaves.**

With $n = 8$ the last parent is at index $n \div 2 - 1 = 3$, so everything after it is a leaf.

:mark[**Height 3. Leaves are indices 4, 5, 6, 7, which is 4 of the 8 values.**]{hex="#204A2E"}

**(c) The bottom up build.**

Start at index :color[3]{hex="#FF5FA2"}, the last parent, and work back to index 0. Sink each value past the larger of its children until it settles.

| Sink index | Array before | What happens | Array after |
| --- | --- | --- | --- |
| :color[3]{hex="#FF5FA2"} (17) | `8, 20, 6, 17, 3, 25, 11, 14` | 17 already beats 14, so it stays | `8, 20, 6, 17, 3, 25, 11, 14` |
| :color[2]{hex="#FF5FA2"} (6) | `8, 20, 6, 17, 3, 25, 11, 14` | 25 is the stronger child and beats 6, so they swap | `8, 20, 25, 17, 3, 6, 11, 14` |
| :color[1]{hex="#FF5FA2"} (20) | `8, 20, 25, 17, 3, 6, 11, 14` | 20 already beats 17 and 3, so it stays | `8, 20, 25, 17, 3, 6, 11, 14` |
| :color[0]{hex="#FF5FA2"} (8) | `8, 20, 25, 17, 3, 6, 11, 14` | 25 is the stronger child and beats 8, so they swap; 11 is the stronger child and beats 8, so they swap | `25, 20, 11, 17, 3, 6, 8, 14` |

![Q7 answer, the finished max-heap](/notes/img/algorithms/ch11-q7h.svg)

**(d) The final array.**

:mark[**25, 20, 11, 17, 3, 6, 8, 14**]{hex="#204A2E"}

That took **3 swaps** and **9 comparisons**.

> Building the same values **top down** instead gives `25, 17, 20, 14, 3, 6, 11, 8`, a different array. Both are correct max-heaps. A heap is not unique, so a different answer from a different method is not a wrong answer, but it is a different method, so read the question.

### Q8. Build a max-heap

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**14 marks**]{hex="#3A3A3E"}

You are given the array `23, 17, 14, 6, 13, 10, 1, 5, 7, 12`.

![Q8, the array drawn as a complete tree](/notes/img/algorithms/ch11-q8.svg)

**(a)** Is this array already a **max-heap**? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree, and which indices are leaves. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Build a **max-heap** using the **bottom up** method. Show the array after each node is sunk. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(d)** State the final array. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) Is it already a max-heap?**

The rule is that every parent is greater than or equal to its children. Check every parent, which is indices 0 to 4.

Index :color[3]{hex="#EF4444"} holds 6, and its child at index :color[8]{hex="#EF4444"} holds 7, which is larger. That breaks the rule.

:mark[**Answer: no.** 6 at index 3 is beaten by 7 at index 8.]{hex="#5C2323"}

**(b) Height and leaves.**

With $n = 10$ the last parent is at index $n \div 2 - 1 = 4$, so everything after it is a leaf.

:mark[**Height 3. Leaves are indices 5, 6, 7, 8, 9, which is 5 of the 10 values.**]{hex="#204A2E"}

**(c) The bottom up build.**

Start at index :color[4]{hex="#FF5FA2"}, the last parent, and work back to index 0. Sink each value past the larger of its children until it settles.

| Sink index | Array before | What happens | Array after |
| --- | --- | --- | --- |
| :color[4]{hex="#FF5FA2"} (13) | `23, 17, 14, 6, 13, 10, 1, 5, 7, 12` | 13 already beats 12, so it stays | `23, 17, 14, 6, 13, 10, 1, 5, 7, 12` |
| :color[3]{hex="#FF5FA2"} (6) | `23, 17, 14, 6, 13, 10, 1, 5, 7, 12` | 7 is the stronger child and beats 6, so they swap | `23, 17, 14, 7, 13, 10, 1, 5, 6, 12` |
| :color[2]{hex="#FF5FA2"} (14) | `23, 17, 14, 7, 13, 10, 1, 5, 6, 12` | 14 already beats 10 and 1, so it stays | `23, 17, 14, 7, 13, 10, 1, 5, 6, 12` |
| :color[1]{hex="#FF5FA2"} (17) | `23, 17, 14, 7, 13, 10, 1, 5, 6, 12` | 17 already beats 7 and 13, so it stays | `23, 17, 14, 7, 13, 10, 1, 5, 6, 12` |
| :color[0]{hex="#FF5FA2"} (23) | `23, 17, 14, 7, 13, 10, 1, 5, 6, 12` | 23 already beats 17 and 14, so it stays | `23, 17, 14, 7, 13, 10, 1, 5, 6, 12` |

![Q8 answer, the finished max-heap](/notes/img/algorithms/ch11-q8h.svg)

**(d) The final array.**

:mark[**23, 17, 14, 7, 13, 10, 1, 5, 6, 12**]{hex="#204A2E"}

That took **1 swap** and **9 comparisons**.

> Top down happens to give the same array here, `23, 17, 14, 7, 13, 10, 1, 5, 6, 12`. That is a coincidence of this data, not a rule.

### Q9. Build a max-heap

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**14 marks**]{hex="#3A3A3E"}

You are given the array `5, 13, 2, 25, 7, 17, 20, 8, 4`.

![Q9, the array drawn as a complete tree](/notes/img/algorithms/ch11-q9.svg)

**(a)** Is this array already a **max-heap**? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree, and which indices are leaves. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Build a **max-heap** using the **bottom up** method. Show the array after each node is sunk. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(d)** State the final array. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) Is it already a max-heap?**

The rule is that every parent is greater than or equal to its children. Check every parent, which is indices 0 to 3.

Index :color[0]{hex="#EF4444"} holds 5, and its child at index :color[1]{hex="#EF4444"} holds 13, which is larger. That breaks the rule.

:mark[**Answer: no.** 5 at index 0 is beaten by 13 at index 1.]{hex="#5C2323"}

**(b) Height and leaves.**

With $n = 9$ the last parent is at index $n \div 2 - 1 = 3$, so everything after it is a leaf.

:mark[**Height 3. Leaves are indices 4, 5, 6, 7, 8, which is 5 of the 9 values.**]{hex="#204A2E"}

**(c) The bottom up build.**

Start at index :color[3]{hex="#FF5FA2"}, the last parent, and work back to index 0. Sink each value past the larger of its children until it settles.

| Sink index | Array before | What happens | Array after |
| --- | --- | --- | --- |
| :color[3]{hex="#FF5FA2"} (25) | `5, 13, 2, 25, 7, 17, 20, 8, 4` | 25 already beats 8 and 4, so it stays | `5, 13, 2, 25, 7, 17, 20, 8, 4` |
| :color[2]{hex="#FF5FA2"} (2) | `5, 13, 2, 25, 7, 17, 20, 8, 4` | 20 is the stronger child and beats 2, so they swap | `5, 13, 20, 25, 7, 17, 2, 8, 4` |
| :color[1]{hex="#FF5FA2"} (13) | `5, 13, 20, 25, 7, 17, 2, 8, 4` | 25 is the stronger child and beats 13, so they swap | `5, 25, 20, 13, 7, 17, 2, 8, 4` |
| :color[0]{hex="#FF5FA2"} (5) | `5, 25, 20, 13, 7, 17, 2, 8, 4` | 25 is the stronger child and beats 5, so they swap; 13 is the stronger child and beats 5, so they swap; 8 is the stronger child and beats 5, so they swap | `25, 13, 20, 8, 7, 17, 2, 5, 4` |

![Q9 answer, the finished max-heap](/notes/img/algorithms/ch11-q9h.svg)

**(d) The final array.**

:mark[**25, 13, 20, 8, 7, 17, 2, 5, 4**]{hex="#204A2E"}

That took **5 swaps** and **14 comparisons**.

> Building the same values **top down** instead gives `25, 13, 20, 8, 7, 2, 17, 5, 4`, a different array. Both are correct max-heaps. A heap is not unique, so a different answer from a different method is not a wrong answer, but it is a different method, so read the question.

### Q10. Build a min-heap

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**14 marks**]{hex="#3A3A3E"}

You are given the array `40, 12, 31, 7, 22, 3, 18, 27, 9`.

![Q10, the array drawn as a complete tree](/notes/img/algorithms/ch11-q10.svg)

**(a)** Is this array already a **min-heap**? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree, and which indices are leaves. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Build a **min-heap** using the **bottom up** method. Show the array after each node is sunk. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(d)** State the final array. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) Is it already a min-heap?**

The rule is that every parent is less than or equal to its children. Check every parent, which is indices 0 to 3.

Index :color[0]{hex="#EF4444"} holds 40, and its child at index :color[1]{hex="#EF4444"} holds 12, which is smaller. That breaks the rule.

:mark[**Answer: no.** 40 at index 0 is beaten by 12 at index 1.]{hex="#5C2323"}

**(b) Height and leaves.**

With $n = 9$ the last parent is at index $n \div 2 - 1 = 3$, so everything after it is a leaf.

:mark[**Height 3. Leaves are indices 4, 5, 6, 7, 8, which is 5 of the 9 values.**]{hex="#204A2E"}

**(c) The bottom up build.**

Start at index :color[3]{hex="#FF5FA2"}, the last parent, and work back to index 0. Sink each value past the smaller of its children until it settles.

| Sink index | Array before | What happens | Array after |
| --- | --- | --- | --- |
| :color[3]{hex="#FF5FA2"} (7) | `40, 12, 31, 7, 22, 3, 18, 27, 9` | 7 already beats 27 and 9, so it stays | `40, 12, 31, 7, 22, 3, 18, 27, 9` |
| :color[2]{hex="#FF5FA2"} (31) | `40, 12, 31, 7, 22, 3, 18, 27, 9` | 3 is the stronger child and beats 31, so they swap | `40, 12, 3, 7, 22, 31, 18, 27, 9` |
| :color[1]{hex="#FF5FA2"} (12) | `40, 12, 3, 7, 22, 31, 18, 27, 9` | 7 is the stronger child and beats 12, so they swap; 9 is the stronger child and beats 12, so they swap | `40, 7, 3, 9, 22, 31, 18, 27, 12` |
| :color[0]{hex="#FF5FA2"} (40) | `40, 7, 3, 9, 22, 31, 18, 27, 12` | 3 is the stronger child and beats 40, so they swap; 18 is the stronger child and beats 40, so they swap | `3, 7, 18, 9, 22, 31, 40, 27, 12` |

![Q10 answer, the finished min-heap](/notes/img/algorithms/ch11-q10h.svg)

**(d) The final array.**

:mark[**3, 7, 18, 9, 22, 31, 40, 27, 12**]{hex="#204A2E"}

That took **5 swaps** and **12 comparisons**.

> Building the same values **top down** instead gives `3, 9, 7, 12, 22, 31, 18, 40, 27`, a different array. Both are correct min-heaps. A heap is not unique, so a different answer from a different method is not a wrong answer, but it is a different method, so read the question.

### Q11. Build a max-heap

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**14 marks**]{hex="#3A3A3E"}

You are given the array `2, 9, 7, 6, 5, 8, 1, 10, 3, 4, 11`.

![Q11, the array drawn as a complete tree](/notes/img/algorithms/ch11-q11.svg)

**(a)** Is this array already a **max-heap**? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree, and which indices are leaves. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Build a **max-heap** using the **bottom up** method. Show the array after each node is sunk. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(d)** State the final array. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) Is it already a max-heap?**

The rule is that every parent is greater than or equal to its children. Check every parent, which is indices 0 to 4.

Index :color[0]{hex="#EF4444"} holds 2, and its child at index :color[1]{hex="#EF4444"} holds 9, which is larger. That breaks the rule.

:mark[**Answer: no.** 2 at index 0 is beaten by 9 at index 1.]{hex="#5C2323"}

**(b) Height and leaves.**

With $n = 11$ the last parent is at index $n \div 2 - 1 = 4$, so everything after it is a leaf.

:mark[**Height 3. Leaves are indices 5, 6, 7, 8, 9, 10, which is 6 of the 11 values.**]{hex="#204A2E"}

**(c) The bottom up build.**

Start at index :color[4]{hex="#FF5FA2"}, the last parent, and work back to index 0. Sink each value past the larger of its children until it settles.

| Sink index | Array before | What happens | Array after |
| --- | --- | --- | --- |
| :color[4]{hex="#FF5FA2"} (5) | `2, 9, 7, 6, 5, 8, 1, 10, 3, 4, 11` | 11 is the stronger child and beats 5, so they swap | `2, 9, 7, 6, 11, 8, 1, 10, 3, 4, 5` |
| :color[3]{hex="#FF5FA2"} (6) | `2, 9, 7, 6, 11, 8, 1, 10, 3, 4, 5` | 10 is the stronger child and beats 6, so they swap | `2, 9, 7, 10, 11, 8, 1, 6, 3, 4, 5` |
| :color[2]{hex="#FF5FA2"} (7) | `2, 9, 7, 10, 11, 8, 1, 6, 3, 4, 5` | 8 is the stronger child and beats 7, so they swap | `2, 9, 8, 10, 11, 7, 1, 6, 3, 4, 5` |
| :color[1]{hex="#FF5FA2"} (9) | `2, 9, 8, 10, 11, 7, 1, 6, 3, 4, 5` | 11 is the stronger child and beats 9, so they swap | `2, 11, 8, 10, 9, 7, 1, 6, 3, 4, 5` |
| :color[0]{hex="#FF5FA2"} (2) | `2, 11, 8, 10, 9, 7, 1, 6, 3, 4, 5` | 11 is the stronger child and beats 2, so they swap; 10 is the stronger child and beats 2, so they swap; 6 is the stronger child and beats 2, so they swap | `11, 10, 8, 6, 9, 7, 1, 2, 3, 4, 5` |

![Q11 answer, the finished max-heap](/notes/img/algorithms/ch11-q11h.svg)

**(d) The final array.**

:mark[**11, 10, 8, 6, 9, 7, 1, 2, 3, 4, 5**]{hex="#204A2E"}

That took **7 swaps** and **16 comparisons**.

> Top down happens to give the same array here, `11, 10, 8, 6, 9, 7, 1, 2, 3, 4, 5`. That is a coincidence of this data, not a rule.

### Q12. Build a max-heap

> :mark[**Very hard**]{hex="#5C2323"} &nbsp; :mark[**14 marks**]{hex="#3A3A3E"}

You are given the array `16, 4, 22, 9, 31, 7, 13, 28, 2, 19, 6, 25`.

![Q12, the array drawn as a complete tree](/notes/img/algorithms/ch11-q12.svg)

**(a)** Is this array already a **max-heap**? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree, and which indices are leaves. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(c)** Build a **max-heap** using the **bottom up** method. Show the array after each node is sunk. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(d)** State the final array. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) Is it already a max-heap?**

The rule is that every parent is greater than or equal to its children. Check every parent, which is indices 0 to 5.

Index :color[0]{hex="#EF4444"} holds 16, and its child at index :color[2]{hex="#EF4444"} holds 22, which is larger. That breaks the rule.

:mark[**Answer: no.** 16 at index 0 is beaten by 22 at index 2.]{hex="#5C2323"}

**(b) Height and leaves.**

With $n = 12$ the last parent is at index $n \div 2 - 1 = 5$, so everything after it is a leaf.

:mark[**Height 3. Leaves are indices 6, 7, 8, 9, 10, 11, which is 6 of the 12 values.**]{hex="#204A2E"}

**(c) The bottom up build.**

Start at index :color[5]{hex="#FF5FA2"}, the last parent, and work back to index 0. Sink each value past the larger of its children until it settles.

| Sink index | Array before | What happens | Array after |
| --- | --- | --- | --- |
| :color[5]{hex="#FF5FA2"} (7) | `16, 4, 22, 9, 31, 7, 13, 28, 2, 19, 6, 25` | 25 is the stronger child and beats 7, so they swap | `16, 4, 22, 9, 31, 25, 13, 28, 2, 19, 6, 7` |
| :color[4]{hex="#FF5FA2"} (31) | `16, 4, 22, 9, 31, 25, 13, 28, 2, 19, 6, 7` | 31 already beats 19 and 6, so it stays | `16, 4, 22, 9, 31, 25, 13, 28, 2, 19, 6, 7` |
| :color[3]{hex="#FF5FA2"} (9) | `16, 4, 22, 9, 31, 25, 13, 28, 2, 19, 6, 7` | 28 is the stronger child and beats 9, so they swap | `16, 4, 22, 28, 31, 25, 13, 9, 2, 19, 6, 7` |
| :color[2]{hex="#FF5FA2"} (22) | `16, 4, 22, 28, 31, 25, 13, 9, 2, 19, 6, 7` | 25 is the stronger child and beats 22, so they swap | `16, 4, 25, 28, 31, 22, 13, 9, 2, 19, 6, 7` |
| :color[1]{hex="#FF5FA2"} (4) | `16, 4, 25, 28, 31, 22, 13, 9, 2, 19, 6, 7` | 31 is the stronger child and beats 4, so they swap; 19 is the stronger child and beats 4, so they swap | `16, 31, 25, 28, 19, 22, 13, 9, 2, 4, 6, 7` |
| :color[0]{hex="#FF5FA2"} (16) | `16, 31, 25, 28, 19, 22, 13, 9, 2, 4, 6, 7` | 31 is the stronger child and beats 16, so they swap; 28 is the stronger child and beats 16, so they swap | `31, 28, 25, 16, 19, 22, 13, 9, 2, 4, 6, 7` |

![Q12 answer, the finished max-heap](/notes/img/algorithms/ch11-q12h.svg)

**(d) The final array.**

:mark[**31, 28, 25, 16, 19, 22, 13, 9, 2, 4, 6, 7**]{hex="#204A2E"}

That took **7 swaps** and **18 comparisons**.

> Building the same values **top down** instead gives `31, 28, 25, 22, 19, 16, 13, 4, 2, 9, 6, 7`, a different array. Both are correct max-heaps. A heap is not unique, so a different answer from a different method is not a wrong answer, but it is a different method, so read the question.

## Part B: heapsort

Heapify, then extract. Show the boundary between the shrinking heap and the growing sorted tail, because that is where the marks are.

### Q13. Heapsort

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**14 marks**]{hex="#3A3A3E"}

Sort the array `3, 9, 2, 7, 5` into **ascending** order using **heapsort**.

![Q13, the array drawn as a complete tree](/notes/img/algorithms/ch11-q13.svg)

**(i)** Build a max-heap from the array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Carry out the sort. Show the array after each value is placed. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(iii)** State the sorted array and the time complexity. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) Heapify.**

Bottom up, starting at the last parent.

:mark[**9, 7, 2, 3, 5**]{hex="#204A2E"}

![Q13, the array after heapifying](/notes/img/algorithms/ch11-q13h.svg)

**(ii) The sort.**

The root is always the largest value left, so swap it with the last slot of the heap, shrink the heap by one, and sink the new root. The :color[sorted tail]{hex="#A78BFA"} grows from the right and is never touched again.

| Pass | Root placed | Goes to index | The heap now | The sorted tail |
| --- | --- | --- | --- | --- |
| 1 | :color[9]{hex="#EAB308"} | 4 | `7, 5, 2, 3` | :color[9]{hex="#A78BFA"} |
| 2 | :color[7]{hex="#EAB308"} | 3 | `5, 3, 2` | :color[7, 9]{hex="#A78BFA"} |
| 3 | :color[5]{hex="#EAB308"} | 2 | `3, 2` | :color[5, 7, 9]{hex="#A78BFA"} |
| 4 | :color[3]{hex="#EAB308"} | 1 | `2` | :color[3, 5, 7, 9]{hex="#A78BFA"} |

> The two right hand columns are one array, split at the boundary. The :color[sorted tail]{hex="#A78BFA"} is finished and never touched again; the heap is everything before it, and it shrinks by one every pass.

**(iii) Result and cost.**

:mark[**2, 3, 5, 7, 9**]{hex="#204A2E"}

The build is $O(n)$ and each of the $n - 1$ extractions sinks a value through at most $\log n$ levels, so heapsort is **:color[O(n log n)]{hex="#EAB308"}** in the best, average and worst case. It sorted in place, using **11 swaps** and **18 comparisons**, with no second array.

### Q14. Heapsort

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**14 marks**]{hex="#3A3A3E"}

Sort the array `12, 4, 18, 6, 15` into **ascending** order using **heapsort**.

![Q14, the array drawn as a complete tree](/notes/img/algorithms/ch11-q14.svg)

**(i)** Build a max-heap from the array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Carry out the sort. Show the array after each value is placed. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(iii)** State the sorted array and the time complexity. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) Heapify.**

Bottom up, starting at the last parent.

:mark[**18, 15, 12, 6, 4**]{hex="#204A2E"}

![Q14, the array after heapifying](/notes/img/algorithms/ch11-q14h.svg)

**(ii) The sort.**

The root is always the largest value left, so swap it with the last slot of the heap, shrink the heap by one, and sink the new root. The :color[sorted tail]{hex="#A78BFA"} grows from the right and is never touched again.

| Pass | Root placed | Goes to index | The heap now | The sorted tail |
| --- | --- | --- | --- | --- |
| 1 | :color[18]{hex="#EAB308"} | 4 | `15, 6, 12, 4` | :color[18]{hex="#A78BFA"} |
| 2 | :color[15]{hex="#EAB308"} | 3 | `12, 6, 4` | :color[15, 18]{hex="#A78BFA"} |
| 3 | :color[12]{hex="#EAB308"} | 2 | `6, 4` | :color[12, 15, 18]{hex="#A78BFA"} |
| 4 | :color[6]{hex="#EAB308"} | 1 | `4` | :color[6, 12, 15, 18]{hex="#A78BFA"} |

> The two right hand columns are one array, split at the boundary. The :color[sorted tail]{hex="#A78BFA"} is finished and never touched again; the heap is everything before it, and it shrinks by one every pass.

**(iii) Result and cost.**

:mark[**4, 6, 12, 15, 18**]{hex="#204A2E"}

The build is $O(n)$ and each of the $n - 1$ extractions sinks a value through at most $\log n$ levels, so heapsort is **:color[O(n log n)]{hex="#EAB308"}** in the best, average and worst case. It sorted in place, using **12 swaps** and **14 comparisons**, with no second array.

### Q15. Heapsort

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**14 marks**]{hex="#3A3A3E"}

Sort the array `21, 8, 34, 5, 17, 29` into **ascending** order using **heapsort**.

![Q15, the array drawn as a complete tree](/notes/img/algorithms/ch11-q15.svg)

**(i)** Build a max-heap from the array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Carry out the sort. Show the array after each value is placed. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(iii)** State the sorted array and the time complexity. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) Heapify.**

Bottom up, starting at the last parent.

:mark[**34, 17, 29, 5, 8, 21**]{hex="#204A2E"}

![Q15, the array after heapifying](/notes/img/algorithms/ch11-q15h.svg)

**(ii) The sort.**

The root is always the largest value left, so swap it with the last slot of the heap, shrink the heap by one, and sink the new root. The :color[sorted tail]{hex="#A78BFA"} grows from the right and is never touched again.

| Pass | Root placed | Goes to index | The heap now | The sorted tail |
| --- | --- | --- | --- | --- |
| 1 | :color[34]{hex="#EAB308"} | 5 | `29, 17, 21, 5, 8` | :color[34]{hex="#A78BFA"} |
| 2 | :color[29]{hex="#EAB308"} | 4 | `21, 17, 8, 5` | :color[29, 34]{hex="#A78BFA"} |
| 3 | :color[21]{hex="#EAB308"} | 3 | `17, 5, 8` | :color[21, 29, 34]{hex="#A78BFA"} |
| 4 | :color[17]{hex="#EAB308"} | 2 | `8, 5` | :color[17, 21, 29, 34]{hex="#A78BFA"} |
| 5 | :color[8]{hex="#EAB308"} | 1 | `5` | :color[8, 17, 21, 29, 34]{hex="#A78BFA"} |

> The two right hand columns are one array, split at the boundary. The :color[sorted tail]{hex="#A78BFA"} is finished and never touched again; the heap is everything before it, and it shrinks by one every pass.

**(iii) Result and cost.**

:mark[**5, 8, 17, 21, 29, 34**]{hex="#204A2E"}

The build is $O(n)$ and each of the $n - 1$ extractions sinks a value through at most $\log n$ levels, so heapsort is **:color[O(n log n)]{hex="#EAB308"}** in the best, average and worst case. It sorted in place, using **14 swaps** and **19 comparisons**, with no second array.

### Q16. Heapsort

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**14 marks**]{hex="#3A3A3E"}

Sort the array `7, 26, 13, 2, 19, 11` into **ascending** order using **heapsort**.

![Q16, the array drawn as a complete tree](/notes/img/algorithms/ch11-q16.svg)

**(i)** Build a max-heap from the array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Carry out the sort. Show the array after each value is placed. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(iii)** State the sorted array and the time complexity. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) Heapify.**

Bottom up, starting at the last parent.

:mark[**26, 19, 13, 2, 7, 11**]{hex="#204A2E"}

![Q16, the array after heapifying](/notes/img/algorithms/ch11-q16h.svg)

**(ii) The sort.**

The root is always the largest value left, so swap it with the last slot of the heap, shrink the heap by one, and sink the new root. The :color[sorted tail]{hex="#A78BFA"} grows from the right and is never touched again.

| Pass | Root placed | Goes to index | The heap now | The sorted tail |
| --- | --- | --- | --- | --- |
| 1 | :color[26]{hex="#EAB308"} | 5 | `19, 11, 13, 2, 7` | :color[26]{hex="#A78BFA"} |
| 2 | :color[19]{hex="#EAB308"} | 4 | `13, 11, 7, 2` | :color[19, 26]{hex="#A78BFA"} |
| 3 | :color[13]{hex="#EAB308"} | 3 | `11, 2, 7` | :color[13, 19, 26]{hex="#A78BFA"} |
| 4 | :color[11]{hex="#EAB308"} | 2 | `7, 2` | :color[11, 13, 19, 26]{hex="#A78BFA"} |
| 5 | :color[7]{hex="#EAB308"} | 1 | `2` | :color[7, 11, 13, 19, 26]{hex="#A78BFA"} |

> The two right hand columns are one array, split at the boundary. The :color[sorted tail]{hex="#A78BFA"} is finished and never touched again; the heap is everything before it, and it shrinks by one every pass.

**(iii) Result and cost.**

:mark[**2, 7, 11, 13, 19, 26**]{hex="#204A2E"}

The build is $O(n)$ and each of the $n - 1$ extractions sinks a value through at most $\log n$ levels, so heapsort is **:color[O(n log n)]{hex="#EAB308"}** in the best, average and worst case. It sorted in place, using **12 swaps** and **23 comparisons**, with no second array.

### Q17. Heapsort

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**14 marks**]{hex="#3A3A3E"}

Sort the array `45, 10, 32, 27, 6, 19, 38` into **ascending** order using **heapsort**.

![Q17, the array drawn as a complete tree](/notes/img/algorithms/ch11-q17.svg)

**(i)** Build a max-heap from the array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Carry out the sort. Show the array after each value is placed. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(iii)** State the sorted array and the time complexity. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) Heapify.**

Bottom up, starting at the last parent.

:mark[**45, 27, 38, 10, 6, 19, 32**]{hex="#204A2E"}

![Q17, the array after heapifying](/notes/img/algorithms/ch11-q17h.svg)

**(ii) The sort.**

The root is always the largest value left, so swap it with the last slot of the heap, shrink the heap by one, and sink the new root. The :color[sorted tail]{hex="#A78BFA"} grows from the right and is never touched again.

| Pass | Root placed | Goes to index | The heap now | The sorted tail |
| --- | --- | --- | --- | --- |
| 1 | :color[45]{hex="#EAB308"} | 6 | `38, 27, 32, 10, 6, 19` | :color[45]{hex="#A78BFA"} |
| 2 | :color[38]{hex="#EAB308"} | 5 | `32, 27, 19, 10, 6` | :color[38, 45]{hex="#A78BFA"} |
| 3 | :color[32]{hex="#EAB308"} | 4 | `27, 10, 19, 6` | :color[32, 38, 45]{hex="#A78BFA"} |
| 4 | :color[27]{hex="#EAB308"} | 3 | `19, 10, 6` | :color[27, 32, 38, 45]{hex="#A78BFA"} |
| 5 | :color[19]{hex="#EAB308"} | 2 | `10, 6` | :color[19, 27, 32, 38, 45]{hex="#A78BFA"} |
| 6 | :color[10]{hex="#EAB308"} | 1 | `6` | :color[10, 19, 27, 32, 38, 45]{hex="#A78BFA"} |

> The two right hand columns are one array, split at the boundary. The :color[sorted tail]{hex="#A78BFA"} is finished and never touched again; the heap is everything before it, and it shrinks by one every pass.

**(iii) Result and cost.**

:mark[**6, 10, 19, 27, 32, 38, 45**]{hex="#204A2E"}

The build is $O(n)$ and each of the $n - 1$ extractions sinks a value through at most $\log n$ levels, so heapsort is **:color[O(n log n)]{hex="#EAB308"}** in the best, average and worst case. It sorted in place, using **16 swaps** and **23 comparisons**, with no second array.

### Q18. Heapsort

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**14 marks**]{hex="#3A3A3E"}

Sort the array `14, 3, 27, 9, 21, 6, 33, 18` into **ascending** order using **heapsort**.

![Q18, the array drawn as a complete tree](/notes/img/algorithms/ch11-q18.svg)

**(i)** Build a max-heap from the array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Carry out the sort. Show the array after each value is placed. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(iii)** State the sorted array and the time complexity. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) Heapify.**

Bottom up, starting at the last parent.

:mark[**33, 21, 27, 18, 3, 6, 14, 9**]{hex="#204A2E"}

![Q18, the array after heapifying](/notes/img/algorithms/ch11-q18h.svg)

**(ii) The sort.**

The root is always the largest value left, so swap it with the last slot of the heap, shrink the heap by one, and sink the new root. The :color[sorted tail]{hex="#A78BFA"} grows from the right and is never touched again.

| Pass | Root placed | Goes to index | The heap now | The sorted tail |
| --- | --- | --- | --- | --- |
| 1 | :color[33]{hex="#EAB308"} | 7 | `27, 21, 14, 18, 3, 6, 9` | :color[33]{hex="#A78BFA"} |
| 2 | :color[27]{hex="#EAB308"} | 6 | `21, 18, 14, 9, 3, 6` | :color[27, 33]{hex="#A78BFA"} |
| 3 | :color[21]{hex="#EAB308"} | 5 | `18, 9, 14, 6, 3` | :color[21, 27, 33]{hex="#A78BFA"} |
| 4 | :color[18]{hex="#EAB308"} | 4 | `14, 9, 3, 6` | :color[18, 21, 27, 33]{hex="#A78BFA"} |
| 5 | :color[14]{hex="#EAB308"} | 3 | `9, 6, 3` | :color[14, 18, 21, 27, 33]{hex="#A78BFA"} |
| 6 | :color[9]{hex="#EAB308"} | 2 | `6, 3` | :color[9, 14, 18, 21, 27, 33]{hex="#A78BFA"} |
| 7 | :color[6]{hex="#EAB308"} | 1 | `3` | :color[6, 9, 14, 18, 21, 27, 33]{hex="#A78BFA"} |

> The two right hand columns are one array, split at the boundary. The :color[sorted tail]{hex="#A78BFA"} is finished and never touched again; the heap is everything before it, and it shrinks by one every pass.

**(iii) Result and cost.**

:mark[**3, 6, 9, 14, 18, 21, 27, 33**]{hex="#204A2E"}

The build is $O(n)$ and each of the $n - 1$ extractions sinks a value through at most $\log n$ levels, so heapsort is **:color[O(n log n)]{hex="#EAB308"}** in the best, average and worst case. It sorted in place, using **26 swaps** and **35 comparisons**, with no second array.

### Q19. Heapsort

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**14 marks**]{hex="#3A3A3E"}

Sort the array `30, 11, 24, 5, 17, 39, 8, 22` into **ascending** order using **heapsort**.

![Q19, the array drawn as a complete tree](/notes/img/algorithms/ch11-q19.svg)

**(i)** Build a max-heap from the array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Carry out the sort. Show the array after each value is placed. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(iii)** State the sorted array and the time complexity. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) Heapify.**

Bottom up, starting at the last parent.

:mark[**39, 22, 30, 11, 17, 24, 8, 5**]{hex="#204A2E"}

![Q19, the array after heapifying](/notes/img/algorithms/ch11-q19h.svg)

**(ii) The sort.**

The root is always the largest value left, so swap it with the last slot of the heap, shrink the heap by one, and sink the new root. The :color[sorted tail]{hex="#A78BFA"} grows from the right and is never touched again.

| Pass | Root placed | Goes to index | The heap now | The sorted tail |
| --- | --- | --- | --- | --- |
| 1 | :color[39]{hex="#EAB308"} | 7 | `30, 22, 24, 11, 17, 5, 8` | :color[39]{hex="#A78BFA"} |
| 2 | :color[30]{hex="#EAB308"} | 6 | `24, 22, 8, 11, 17, 5` | :color[30, 39]{hex="#A78BFA"} |
| 3 | :color[24]{hex="#EAB308"} | 5 | `22, 17, 8, 11, 5` | :color[24, 30, 39]{hex="#A78BFA"} |
| 4 | :color[22]{hex="#EAB308"} | 4 | `17, 11, 8, 5` | :color[22, 24, 30, 39]{hex="#A78BFA"} |
| 5 | :color[17]{hex="#EAB308"} | 3 | `11, 5, 8` | :color[17, 22, 24, 30, 39]{hex="#A78BFA"} |
| 6 | :color[11]{hex="#EAB308"} | 2 | `8, 5` | :color[11, 17, 22, 24, 30, 39]{hex="#A78BFA"} |
| 7 | :color[8]{hex="#EAB308"} | 1 | `5` | :color[8, 11, 17, 22, 24, 30, 39]{hex="#A78BFA"} |

> The two right hand columns are one array, split at the boundary. The :color[sorted tail]{hex="#A78BFA"} is finished and never touched again; the heap is everything before it, and it shrinks by one every pass.

**(iii) Result and cost.**

:mark[**5, 8, 11, 17, 22, 24, 30, 39**]{hex="#204A2E"}

The build is $O(n)$ and each of the $n - 1$ extractions sinks a value through at most $\log n$ levels, so heapsort is **:color[O(n log n)]{hex="#EAB308"}** in the best, average and worst case. It sorted in place, using **23 swaps** and **37 comparisons**, with no second array.

### Q20. Heapsort

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**14 marks**]{hex="#3A3A3E"}

Sort the array `9, 41, 16, 28, 3, 35, 12, 7, 20` into **ascending** order using **heapsort**.

![Q20, the array drawn as a complete tree](/notes/img/algorithms/ch11-q20.svg)

**(i)** Build a max-heap from the array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Carry out the sort. Show the array after each value is placed. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(iii)** State the sorted array and the time complexity. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) Heapify.**

Bottom up, starting at the last parent.

:mark[**41, 28, 35, 20, 3, 16, 12, 7, 9**]{hex="#204A2E"}

![Q20, the array after heapifying](/notes/img/algorithms/ch11-q20h.svg)

**(ii) The sort.**

The root is always the largest value left, so swap it with the last slot of the heap, shrink the heap by one, and sink the new root. The :color[sorted tail]{hex="#A78BFA"} grows from the right and is never touched again.

| Pass | Root placed | Goes to index | The heap now | The sorted tail |
| --- | --- | --- | --- | --- |
| 1 | :color[41]{hex="#EAB308"} | 8 | `35, 28, 16, 20, 3, 9, 12, 7` | :color[41]{hex="#A78BFA"} |
| 2 | :color[35]{hex="#EAB308"} | 7 | `28, 20, 16, 7, 3, 9, 12` | :color[35, 41]{hex="#A78BFA"} |
| 3 | :color[28]{hex="#EAB308"} | 6 | `20, 12, 16, 7, 3, 9` | :color[28, 35, 41]{hex="#A78BFA"} |
| 4 | :color[20]{hex="#EAB308"} | 5 | `16, 12, 9, 7, 3` | :color[20, 28, 35, 41]{hex="#A78BFA"} |
| 5 | :color[16]{hex="#EAB308"} | 4 | `12, 7, 9, 3` | :color[16, 20, 28, 35, 41]{hex="#A78BFA"} |
| 6 | :color[12]{hex="#EAB308"} | 3 | `9, 7, 3` | :color[12, 16, 20, 28, 35, 41]{hex="#A78BFA"} |
| 7 | :color[9]{hex="#EAB308"} | 2 | `7, 3` | :color[9, 12, 16, 20, 28, 35, 41]{hex="#A78BFA"} |
| 8 | :color[7]{hex="#EAB308"} | 1 | `3` | :color[7, 9, 12, 16, 20, 28, 35, 41]{hex="#A78BFA"} |

> The two right hand columns are one array, split at the boundary. The :color[sorted tail]{hex="#A78BFA"} is finished and never touched again; the heap is everything before it, and it shrinks by one every pass.

**(iii) Result and cost.**

:mark[**3, 7, 9, 12, 16, 20, 28, 35, 41**]{hex="#204A2E"}

The build is $O(n)$ and each of the $n - 1$ extractions sinks a value through at most $\log n$ levels, so heapsort is **:color[O(n log n)]{hex="#EAB308"}** in the best, average and worst case. It sorted in place, using **26 swaps** and **44 comparisons**, with no second array.

### Q21. Heapsort

> :mark[**Very hard**]{hex="#5C2323"} &nbsp; :mark[**14 marks**]{hex="#3A3A3E"}

Sort the array `25, 6, 37, 14, 2, 29, 18, 43, 11` into **ascending** order using **heapsort**.

![Q21, the array drawn as a complete tree](/notes/img/algorithms/ch11-q21.svg)

**(i)** Build a max-heap from the array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Carry out the sort. Show the array after each value is placed. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(iii)** State the sorted array and the time complexity. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) Heapify.**

Bottom up, starting at the last parent.

:mark[**43, 25, 37, 14, 2, 29, 18, 6, 11**]{hex="#204A2E"}

![Q21, the array after heapifying](/notes/img/algorithms/ch11-q21h.svg)

**(ii) The sort.**

The root is always the largest value left, so swap it with the last slot of the heap, shrink the heap by one, and sink the new root. The :color[sorted tail]{hex="#A78BFA"} grows from the right and is never touched again.

| Pass | Root placed | Goes to index | The heap now | The sorted tail |
| --- | --- | --- | --- | --- |
| 1 | :color[43]{hex="#EAB308"} | 8 | `37, 25, 29, 14, 2, 11, 18, 6` | :color[43]{hex="#A78BFA"} |
| 2 | :color[37]{hex="#EAB308"} | 7 | `29, 25, 18, 14, 2, 11, 6` | :color[37, 43]{hex="#A78BFA"} |
| 3 | :color[29]{hex="#EAB308"} | 6 | `25, 14, 18, 6, 2, 11` | :color[29, 37, 43]{hex="#A78BFA"} |
| 4 | :color[25]{hex="#EAB308"} | 5 | `18, 14, 11, 6, 2` | :color[25, 29, 37, 43]{hex="#A78BFA"} |
| 5 | :color[18]{hex="#EAB308"} | 4 | `14, 6, 11, 2` | :color[18, 25, 29, 37, 43]{hex="#A78BFA"} |
| 6 | :color[14]{hex="#EAB308"} | 3 | `11, 6, 2` | :color[14, 18, 25, 29, 37, 43]{hex="#A78BFA"} |
| 7 | :color[11]{hex="#EAB308"} | 2 | `6, 2` | :color[11, 14, 18, 25, 29, 37, 43]{hex="#A78BFA"} |
| 8 | :color[6]{hex="#EAB308"} | 1 | `2` | :color[6, 11, 14, 18, 25, 29, 37, 43]{hex="#A78BFA"} |

> The two right hand columns are one array, split at the boundary. The :color[sorted tail]{hex="#A78BFA"} is finished and never touched again; the heap is everything before it, and it shrinks by one every pass.

**(iii) Result and cost.**

:mark[**2, 6, 11, 14, 18, 25, 29, 37, 43**]{hex="#204A2E"}

The build is $O(n)$ and each of the $n - 1$ extractions sinks a value through at most $\log n$ levels, so heapsort is **:color[O(n log n)]{hex="#EAB308"}** in the best, average and worst case. It sorted in place, using **27 swaps** and **44 comparisons**, with no second array.

### Q22. Heapsort

> :mark[**Very hard**]{hex="#5C2323"} &nbsp; :mark[**14 marks**]{hex="#3A3A3E"}

Sort the array `13, 48, 22, 5, 31, 9, 40, 17, 26, 2` into **ascending** order using **heapsort**.

![Q22, the array drawn as a complete tree](/notes/img/algorithms/ch11-q22.svg)

**(i)** Build a max-heap from the array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Carry out the sort. Show the array after each value is placed. &nbsp; :mark[**8 marks**]{hex="#3A3A3E"}

**(iii)** State the sorted array and the time complexity. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) Heapify.**

Bottom up, starting at the last parent.

:mark[**48, 31, 40, 26, 13, 9, 22, 17, 5, 2**]{hex="#204A2E"}

![Q22, the array after heapifying](/notes/img/algorithms/ch11-q22h.svg)

**(ii) The sort.**

The root is always the largest value left, so swap it with the last slot of the heap, shrink the heap by one, and sink the new root. The :color[sorted tail]{hex="#A78BFA"} grows from the right and is never touched again.

| Pass | Root placed | Goes to index | The heap now | The sorted tail |
| --- | --- | --- | --- | --- |
| 1 | :color[48]{hex="#EAB308"} | 9 | `40, 31, 22, 26, 13, 9, 2, 17, 5` | :color[48]{hex="#A78BFA"} |
| 2 | :color[40]{hex="#EAB308"} | 8 | `31, 26, 22, 17, 13, 9, 2, 5` | :color[40, 48]{hex="#A78BFA"} |
| 3 | :color[31]{hex="#EAB308"} | 7 | `26, 17, 22, 5, 13, 9, 2` | :color[31, 40, 48]{hex="#A78BFA"} |
| 4 | :color[26]{hex="#EAB308"} | 6 | `22, 17, 9, 5, 13, 2` | :color[26, 31, 40, 48]{hex="#A78BFA"} |
| 5 | :color[22]{hex="#EAB308"} | 5 | `17, 13, 9, 5, 2` | :color[22, 26, 31, 40, 48]{hex="#A78BFA"} |
| 6 | :color[17]{hex="#EAB308"} | 4 | `13, 5, 9, 2` | :color[17, 22, 26, 31, 40, 48]{hex="#A78BFA"} |
| 7 | :color[13]{hex="#EAB308"} | 3 | `9, 5, 2` | :color[13, 17, 22, 26, 31, 40, 48]{hex="#A78BFA"} |
| 8 | :color[9]{hex="#EAB308"} | 2 | `5, 2` | :color[9, 13, 17, 22, 26, 31, 40, 48]{hex="#A78BFA"} |
| 9 | :color[5]{hex="#EAB308"} | 1 | `2` | :color[5, 9, 13, 17, 22, 26, 31, 40, 48]{hex="#A78BFA"} |

> The two right hand columns are one array, split at the boundary. The :color[sorted tail]{hex="#A78BFA"} is finished and never touched again; the heap is everything before it, and it shrinks by one every pass.

**(iii) Result and cost.**

:mark[**2, 5, 9, 13, 17, 22, 26, 31, 40, 48**]{hex="#204A2E"}

The build is $O(n)$ and each of the $n - 1$ extractions sinks a value through at most $\log n$ levels, so heapsort is **:color[O(n log n)]{hex="#EAB308"}** in the best, average and worst case. It sorted in place, using **32 swaps** and **50 comparisons**, with no second array.

## Part C: operate on a heap

Insert, remove the root, and the index arithmetic. Several of these ask about an index whose right child does not exist, which is the check most answers forget.

### Q23. Operating on a max-heap

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

The array `30, 20, 25, 10, 15, 5` is a **max-heap**.

![Q23, the heap](/notes/img/algorithms/ch11-q23.svg)

**(i)** Insert **28**. Show each swap and give the resulting array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Remove the root from the **original** heap. Show each swap and give the resulting array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iii)** For index **2**, give the parent and both children, and say whether each one exists. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(iv)** State the height of the heap. &nbsp; :mark[**1 mark**]{hex="#3A3A3E"}

**Solution.**

**(i) Inserting 28.**

A new value goes into the **next free slot**, index :color[6]{hex="#2DD4BF"}, and then climbs while it beats its parent. Nothing else moves.

| Step | What happens | Array |
| --- | --- | --- |
| 1 | 28 goes on the end, the next free slot | `30, 20, 25, 10, 15, 5, 28` |
| 2 | 28 beats its parent 25, so they swap | `30, 20, 28, 10, 15, 5, 25` |
| 3 | 28 does not beat its parent 30, so it stays | `30, 20, 28, 10, 15, 5, 25` |

![Q23 after the insertion](/notes/img/algorithms/ch11-q23i.svg)

:mark[**30, 20, 28, 10, 15, 5, 25**]{hex="#204A2E"}

**(ii) Removing the root.**

The root :color[30]{hex="#EF4444"} comes off. The **last** value is moved into the gap so the tree stays complete, and then it sinks while a child beats it.

| Step | What happens | Array |
| --- | --- | --- |
| 1 | 30 comes off the top, and the last value 5 is moved into the gap | `5, 20, 25, 10, 15` |
| 2 | 25 is the stronger child and beats 5, so they swap | `25, 20, 5, 10, 15` |
| 3 | 5 already beats nothing, it is a leaf, so it stays | `25, 20, 5, 10, 15` |

![Q23 after removing the root](/notes/img/algorithms/ch11-q23r.svg)

:mark[**30 is removed, leaving 25, 20, 5, 10, 15**]{hex="#204A2E"}

**(iii) The neighbours of index 2.**

| | Formula | Index | Exists? |
| --- | --- | --- | --- |
| Parent | $(i - 1) \div 2$ | $1 \div 2 = 0$ | yes, holding 30 |
| Left child | $2i + 1$ | $4 + 1 = 5$ | yes, holding 5 |
| Right child | $2i + 2$ | $4 + 2 = 6$ | :color[no]{hex="#EF4444"}, 6 is past the end |

> With $n = 6$, an index is a real node only while it is **less than 6**. Forgetting that check is the most common way to lose a mark here.

**(iv) The height.**

A complete tree of 6 nodes has height $\lfloor \log_2 6 \rfloor = 2$.

:mark[**Height 2**]{hex="#204A2E"}

### Q24. Operating on a min-heap

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

The array `5, 12, 9, 20, 15, 11` is a **min-heap**.

![Q24, the heap](/notes/img/algorithms/ch11-q24.svg)

**(i)** Insert **3**. Show each swap and give the resulting array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Remove the root from the **original** heap. Show each swap and give the resulting array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iii)** For index **1**, give the parent and both children, and say whether each one exists. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(iv)** State the height of the heap. &nbsp; :mark[**1 mark**]{hex="#3A3A3E"}

**Solution.**

**(i) Inserting 3.**

A new value goes into the **next free slot**, index :color[6]{hex="#2DD4BF"}, and then climbs while it beats its parent. Nothing else moves.

| Step | What happens | Array |
| --- | --- | --- |
| 1 | 3 goes on the end, the next free slot | `5, 12, 9, 20, 15, 11, 3` |
| 2 | 3 beats its parent 9, so they swap | `5, 12, 3, 20, 15, 11, 9` |
| 3 | 3 beats its parent 5, so they swap | `3, 12, 5, 20, 15, 11, 9` |
| 4 | it has reached the root, so it stops | `3, 12, 5, 20, 15, 11, 9` |

![Q24 after the insertion](/notes/img/algorithms/ch11-q24i.svg)

:mark[**3, 12, 5, 20, 15, 11, 9**]{hex="#204A2E"}

**(ii) Removing the root.**

The root :color[5]{hex="#EF4444"} comes off. The **last** value is moved into the gap so the tree stays complete, and then it sinks while a child beats it.

| Step | What happens | Array |
| --- | --- | --- |
| 1 | 5 comes off the top, and the last value 11 is moved into the gap | `11, 12, 9, 20, 15` |
| 2 | 9 is the stronger child and beats 11, so they swap | `9, 12, 11, 20, 15` |
| 3 | 11 already beats nothing, it is a leaf, so it stays | `9, 12, 11, 20, 15` |

![Q24 after removing the root](/notes/img/algorithms/ch11-q24r.svg)

:mark[**5 is removed, leaving 9, 12, 11, 20, 15**]{hex="#204A2E"}

**(iii) The neighbours of index 1.**

| | Formula | Index | Exists? |
| --- | --- | --- | --- |
| Parent | $(i - 1) \div 2$ | $0 \div 2 = 0$ | yes, holding 5 |
| Left child | $2i + 1$ | $2 + 1 = 3$ | yes, holding 20 |
| Right child | $2i + 2$ | $2 + 2 = 4$ | yes, holding 15 |

> With $n = 6$, an index is a real node only while it is **less than 6**. Forgetting that check is the most common way to lose a mark here.

**(iv) The height.**

A complete tree of 6 nodes has height $\lfloor \log_2 6 \rfloor = 2$.

:mark[**Height 2**]{hex="#204A2E"}

### Q25. Operating on a max-heap

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

The array `50, 40, 45, 20, 30, 35, 25` is a **max-heap**.

![Q25, the heap](/notes/img/algorithms/ch11-q25.svg)

**(i)** Insert **47**. Show each swap and give the resulting array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Remove the root from the **original** heap. Show each swap and give the resulting array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iii)** For index **3**, give the parent and both children, and say whether each one exists. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(iv)** State the height of the heap. &nbsp; :mark[**1 mark**]{hex="#3A3A3E"}

**Solution.**

**(i) Inserting 47.**

A new value goes into the **next free slot**, index :color[7]{hex="#2DD4BF"}, and then climbs while it beats its parent. Nothing else moves.

| Step | What happens | Array |
| --- | --- | --- |
| 1 | 47 goes on the end, the next free slot | `50, 40, 45, 20, 30, 35, 25, 47` |
| 2 | 47 beats its parent 20, so they swap | `50, 40, 45, 47, 30, 35, 25, 20` |
| 3 | 47 beats its parent 40, so they swap | `50, 47, 45, 40, 30, 35, 25, 20` |
| 4 | 47 does not beat its parent 50, so it stays | `50, 47, 45, 40, 30, 35, 25, 20` |

![Q25 after the insertion](/notes/img/algorithms/ch11-q25i.svg)

:mark[**50, 47, 45, 40, 30, 35, 25, 20**]{hex="#204A2E"}

**(ii) Removing the root.**

The root :color[50]{hex="#EF4444"} comes off. The **last** value is moved into the gap so the tree stays complete, and then it sinks while a child beats it.

| Step | What happens | Array |
| --- | --- | --- |
| 1 | 50 comes off the top, and the last value 25 is moved into the gap | `25, 40, 45, 20, 30, 35` |
| 2 | 45 is the stronger child and beats 25, so they swap | `45, 40, 25, 20, 30, 35` |
| 3 | 35 is the stronger child and beats 25, so they swap | `45, 40, 35, 20, 30, 25` |
| 4 | 25 already beats nothing, it is a leaf, so it stays | `45, 40, 35, 20, 30, 25` |

![Q25 after removing the root](/notes/img/algorithms/ch11-q25r.svg)

:mark[**50 is removed, leaving 45, 40, 35, 20, 30, 25**]{hex="#204A2E"}

**(iii) The neighbours of index 3.**

| | Formula | Index | Exists? |
| --- | --- | --- | --- |
| Parent | $(i - 1) \div 2$ | $2 \div 2 = 1$ | yes, holding 40 |
| Left child | $2i + 1$ | $6 + 1 = 7$ | :color[no]{hex="#EF4444"}, 7 is past the end |
| Right child | $2i + 2$ | $6 + 2 = 8$ | :color[no]{hex="#EF4444"}, 8 is past the end |

> With $n = 7$, an index is a real node only while it is **less than 7**. Forgetting that check is the most common way to lose a mark here.

**(iv) The height.**

A complete tree of 7 nodes has height $\lfloor \log_2 7 \rfloor = 2$.

:mark[**Height 2**]{hex="#204A2E"}

### Q26. Operating on a max-heap

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

The array `64, 48, 55, 32, 40, 50, 20, 12, 28` is a **max-heap**.

![Q26, the heap](/notes/img/algorithms/ch11-q26.svg)

**(i)** Insert **60**. Show each swap and give the resulting array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Remove the root from the **original** heap. Show each swap and give the resulting array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iii)** For index **4**, give the parent and both children, and say whether each one exists. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(iv)** State the height of the heap. &nbsp; :mark[**1 mark**]{hex="#3A3A3E"}

**Solution.**

**(i) Inserting 60.**

A new value goes into the **next free slot**, index :color[9]{hex="#2DD4BF"}, and then climbs while it beats its parent. Nothing else moves.

| Step | What happens | Array |
| --- | --- | --- |
| 1 | 60 goes on the end, the next free slot | `64, 48, 55, 32, 40, 50, 20, 12, 28, 60` |
| 2 | 60 beats its parent 40, so they swap | `64, 48, 55, 32, 60, 50, 20, 12, 28, 40` |
| 3 | 60 beats its parent 48, so they swap | `64, 60, 55, 32, 48, 50, 20, 12, 28, 40` |
| 4 | 60 does not beat its parent 64, so it stays | `64, 60, 55, 32, 48, 50, 20, 12, 28, 40` |

![Q26 after the insertion](/notes/img/algorithms/ch11-q26i.svg)

:mark[**64, 60, 55, 32, 48, 50, 20, 12, 28, 40**]{hex="#204A2E"}

**(ii) Removing the root.**

The root :color[64]{hex="#EF4444"} comes off. The **last** value is moved into the gap so the tree stays complete, and then it sinks while a child beats it.

| Step | What happens | Array |
| --- | --- | --- |
| 1 | 64 comes off the top, and the last value 28 is moved into the gap | `28, 48, 55, 32, 40, 50, 20, 12` |
| 2 | 55 is the stronger child and beats 28, so they swap | `55, 48, 28, 32, 40, 50, 20, 12` |
| 3 | 50 is the stronger child and beats 28, so they swap | `55, 48, 50, 32, 40, 28, 20, 12` |
| 4 | 28 already beats nothing, it is a leaf, so it stays | `55, 48, 50, 32, 40, 28, 20, 12` |

![Q26 after removing the root](/notes/img/algorithms/ch11-q26r.svg)

:mark[**64 is removed, leaving 55, 48, 50, 32, 40, 28, 20, 12**]{hex="#204A2E"}

**(iii) The neighbours of index 4.**

| | Formula | Index | Exists? |
| --- | --- | --- | --- |
| Parent | $(i - 1) \div 2$ | $3 \div 2 = 1$ | yes, holding 48 |
| Left child | $2i + 1$ | $8 + 1 = 9$ | :color[no]{hex="#EF4444"}, 9 is past the end |
| Right child | $2i + 2$ | $8 + 2 = 10$ | :color[no]{hex="#EF4444"}, 10 is past the end |

> With $n = 9$, an index is a real node only while it is **less than 9**. Forgetting that check is the most common way to lose a mark here.

**(iv) The height.**

A complete tree of 9 nodes has height $\lfloor \log_2 9 \rfloor = 3$.

:mark[**Height 3**]{hex="#204A2E"}

### Q27. Operating on a min-heap

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

The array `8, 14, 11, 26, 18, 22, 15, 30` is a **min-heap**.

![Q27, the heap](/notes/img/algorithms/ch11-q27.svg)

**(i)** Insert **9**. Show each swap and give the resulting array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Remove the root from the **original** heap. Show each swap and give the resulting array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iii)** For index **3**, give the parent and both children, and say whether each one exists. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(iv)** State the height of the heap. &nbsp; :mark[**1 mark**]{hex="#3A3A3E"}

**Solution.**

**(i) Inserting 9.**

A new value goes into the **next free slot**, index :color[8]{hex="#2DD4BF"}, and then climbs while it beats its parent. Nothing else moves.

| Step | What happens | Array |
| --- | --- | --- |
| 1 | 9 goes on the end, the next free slot | `8, 14, 11, 26, 18, 22, 15, 30, 9` |
| 2 | 9 beats its parent 26, so they swap | `8, 14, 11, 9, 18, 22, 15, 30, 26` |
| 3 | 9 beats its parent 14, so they swap | `8, 9, 11, 14, 18, 22, 15, 30, 26` |
| 4 | 9 does not beat its parent 8, so it stays | `8, 9, 11, 14, 18, 22, 15, 30, 26` |

![Q27 after the insertion](/notes/img/algorithms/ch11-q27i.svg)

:mark[**8, 9, 11, 14, 18, 22, 15, 30, 26**]{hex="#204A2E"}

**(ii) Removing the root.**

The root :color[8]{hex="#EF4444"} comes off. The **last** value is moved into the gap so the tree stays complete, and then it sinks while a child beats it.

| Step | What happens | Array |
| --- | --- | --- |
| 1 | 8 comes off the top, and the last value 30 is moved into the gap | `30, 14, 11, 26, 18, 22, 15` |
| 2 | 11 is the stronger child and beats 30, so they swap | `11, 14, 30, 26, 18, 22, 15` |
| 3 | 15 is the stronger child and beats 30, so they swap | `11, 14, 15, 26, 18, 22, 30` |
| 4 | 30 already beats nothing, it is a leaf, so it stays | `11, 14, 15, 26, 18, 22, 30` |

![Q27 after removing the root](/notes/img/algorithms/ch11-q27r.svg)

:mark[**8 is removed, leaving 11, 14, 15, 26, 18, 22, 30**]{hex="#204A2E"}

**(iii) The neighbours of index 3.**

| | Formula | Index | Exists? |
| --- | --- | --- | --- |
| Parent | $(i - 1) \div 2$ | $2 \div 2 = 1$ | yes, holding 14 |
| Left child | $2i + 1$ | $6 + 1 = 7$ | yes, holding 30 |
| Right child | $2i + 2$ | $6 + 2 = 8$ | :color[no]{hex="#EF4444"}, 8 is past the end |

> With $n = 8$, an index is a real node only while it is **less than 8**. Forgetting that check is the most common way to lose a mark here.

**(iv) The height.**

A complete tree of 8 nodes has height $\lfloor \log_2 8 \rfloor = 3$.

:mark[**Height 3**]{hex="#204A2E"}

### Q28. Operating on a max-heap

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

The array `90, 75, 80, 60, 70, 65, 50, 40, 55` is a **max-heap**.

![Q28, the heap](/notes/img/algorithms/ch11-q28.svg)

**(i)** Insert **85**. Show each swap and give the resulting array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Remove the root from the **original** heap. Show each swap and give the resulting array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iii)** For index **4**, give the parent and both children, and say whether each one exists. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(iv)** State the height of the heap. &nbsp; :mark[**1 mark**]{hex="#3A3A3E"}

**Solution.**

**(i) Inserting 85.**

A new value goes into the **next free slot**, index :color[9]{hex="#2DD4BF"}, and then climbs while it beats its parent. Nothing else moves.

| Step | What happens | Array |
| --- | --- | --- |
| 1 | 85 goes on the end, the next free slot | `90, 75, 80, 60, 70, 65, 50, 40, 55, 85` |
| 2 | 85 beats its parent 70, so they swap | `90, 75, 80, 60, 85, 65, 50, 40, 55, 70` |
| 3 | 85 beats its parent 75, so they swap | `90, 85, 80, 60, 75, 65, 50, 40, 55, 70` |
| 4 | 85 does not beat its parent 90, so it stays | `90, 85, 80, 60, 75, 65, 50, 40, 55, 70` |

![Q28 after the insertion](/notes/img/algorithms/ch11-q28i.svg)

:mark[**90, 85, 80, 60, 75, 65, 50, 40, 55, 70**]{hex="#204A2E"}

**(ii) Removing the root.**

The root :color[90]{hex="#EF4444"} comes off. The **last** value is moved into the gap so the tree stays complete, and then it sinks while a child beats it.

| Step | What happens | Array |
| --- | --- | --- |
| 1 | 90 comes off the top, and the last value 55 is moved into the gap | `55, 75, 80, 60, 70, 65, 50, 40` |
| 2 | 80 is the stronger child and beats 55, so they swap | `80, 75, 55, 60, 70, 65, 50, 40` |
| 3 | 65 is the stronger child and beats 55, so they swap | `80, 75, 65, 60, 70, 55, 50, 40` |
| 4 | 55 already beats nothing, it is a leaf, so it stays | `80, 75, 65, 60, 70, 55, 50, 40` |

![Q28 after removing the root](/notes/img/algorithms/ch11-q28r.svg)

:mark[**90 is removed, leaving 80, 75, 65, 60, 70, 55, 50, 40**]{hex="#204A2E"}

**(iii) The neighbours of index 4.**

| | Formula | Index | Exists? |
| --- | --- | --- | --- |
| Parent | $(i - 1) \div 2$ | $3 \div 2 = 1$ | yes, holding 75 |
| Left child | $2i + 1$ | $8 + 1 = 9$ | :color[no]{hex="#EF4444"}, 9 is past the end |
| Right child | $2i + 2$ | $8 + 2 = 10$ | :color[no]{hex="#EF4444"}, 10 is past the end |

> With $n = 9$, an index is a real node only while it is **less than 9**. Forgetting that check is the most common way to lose a mark here.

**(iv) The height.**

A complete tree of 9 nodes has height $\lfloor \log_2 9 \rfloor = 3$.

:mark[**Height 3**]{hex="#204A2E"}

### Q29. Operating on a max-heap

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

The array `100, 85, 92, 70, 80, 88, 45, 60, 65, 75` is a **max-heap**.

![Q29, the heap](/notes/img/algorithms/ch11-q29.svg)

**(i)** Insert **95**. Show each swap and give the resulting array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Remove the root from the **original** heap. Show each swap and give the resulting array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iii)** For index **4**, give the parent and both children, and say whether each one exists. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(iv)** State the height of the heap. &nbsp; :mark[**1 mark**]{hex="#3A3A3E"}

**Solution.**

**(i) Inserting 95.**

A new value goes into the **next free slot**, index :color[10]{hex="#2DD4BF"}, and then climbs while it beats its parent. Nothing else moves.

| Step | What happens | Array |
| --- | --- | --- |
| 1 | 95 goes on the end, the next free slot | `100, 85, 92, 70, 80, 88, 45, 60, 65, 75, 95` |
| 2 | 95 beats its parent 80, so they swap | `100, 85, 92, 70, 95, 88, 45, 60, 65, 75, 80` |
| 3 | 95 beats its parent 85, so they swap | `100, 95, 92, 70, 85, 88, 45, 60, 65, 75, 80` |
| 4 | 95 does not beat its parent 100, so it stays | `100, 95, 92, 70, 85, 88, 45, 60, 65, 75, 80` |

![Q29 after the insertion](/notes/img/algorithms/ch11-q29i.svg)

:mark[**100, 95, 92, 70, 85, 88, 45, 60, 65, 75, 80**]{hex="#204A2E"}

**(ii) Removing the root.**

The root :color[100]{hex="#EF4444"} comes off. The **last** value is moved into the gap so the tree stays complete, and then it sinks while a child beats it.

| Step | What happens | Array |
| --- | --- | --- |
| 1 | 100 comes off the top, and the last value 75 is moved into the gap | `75, 85, 92, 70, 80, 88, 45, 60, 65` |
| 2 | 92 is the stronger child and beats 75, so they swap | `92, 85, 75, 70, 80, 88, 45, 60, 65` |
| 3 | 88 is the stronger child and beats 75, so they swap | `92, 85, 88, 70, 80, 75, 45, 60, 65` |
| 4 | 75 already beats nothing, it is a leaf, so it stays | `92, 85, 88, 70, 80, 75, 45, 60, 65` |

![Q29 after removing the root](/notes/img/algorithms/ch11-q29r.svg)

:mark[**100 is removed, leaving 92, 85, 88, 70, 80, 75, 45, 60, 65**]{hex="#204A2E"}

**(iii) The neighbours of index 4.**

| | Formula | Index | Exists? |
| --- | --- | --- | --- |
| Parent | $(i - 1) \div 2$ | $3 \div 2 = 1$ | yes, holding 85 |
| Left child | $2i + 1$ | $8 + 1 = 9$ | yes, holding 75 |
| Right child | $2i + 2$ | $8 + 2 = 10$ | :color[no]{hex="#EF4444"}, 10 is past the end |

> With $n = 10$, an index is a real node only while it is **less than 10**. Forgetting that check is the most common way to lose a mark here.

**(iv) The height.**

A complete tree of 10 nodes has height $\lfloor \log_2 10 \rfloor = 3$.

:mark[**Height 3**]{hex="#204A2E"}

### Q30. Operating on a min-heap

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

The array `3, 9, 6, 17, 12, 14, 8, 25, 20, 19` is a **min-heap**.

![Q30, the heap](/notes/img/algorithms/ch11-q30.svg)

**(i)** Insert **5**. Show each swap and give the resulting array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Remove the root from the **original** heap. Show each swap and give the resulting array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iii)** For index **4**, give the parent and both children, and say whether each one exists. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(iv)** State the height of the heap. &nbsp; :mark[**1 mark**]{hex="#3A3A3E"}

**Solution.**

**(i) Inserting 5.**

A new value goes into the **next free slot**, index :color[10]{hex="#2DD4BF"}, and then climbs while it beats its parent. Nothing else moves.

| Step | What happens | Array |
| --- | --- | --- |
| 1 | 5 goes on the end, the next free slot | `3, 9, 6, 17, 12, 14, 8, 25, 20, 19, 5` |
| 2 | 5 beats its parent 12, so they swap | `3, 9, 6, 17, 5, 14, 8, 25, 20, 19, 12` |
| 3 | 5 beats its parent 9, so they swap | `3, 5, 6, 17, 9, 14, 8, 25, 20, 19, 12` |
| 4 | 5 does not beat its parent 3, so it stays | `3, 5, 6, 17, 9, 14, 8, 25, 20, 19, 12` |

![Q30 after the insertion](/notes/img/algorithms/ch11-q30i.svg)

:mark[**3, 5, 6, 17, 9, 14, 8, 25, 20, 19, 12**]{hex="#204A2E"}

**(ii) Removing the root.**

The root :color[3]{hex="#EF4444"} comes off. The **last** value is moved into the gap so the tree stays complete, and then it sinks while a child beats it.

| Step | What happens | Array |
| --- | --- | --- |
| 1 | 3 comes off the top, and the last value 19 is moved into the gap | `19, 9, 6, 17, 12, 14, 8, 25, 20` |
| 2 | 6 is the stronger child and beats 19, so they swap | `6, 9, 19, 17, 12, 14, 8, 25, 20` |
| 3 | 8 is the stronger child and beats 19, so they swap | `6, 9, 8, 17, 12, 14, 19, 25, 20` |
| 4 | 19 already beats nothing, it is a leaf, so it stays | `6, 9, 8, 17, 12, 14, 19, 25, 20` |

![Q30 after removing the root](/notes/img/algorithms/ch11-q30r.svg)

:mark[**3 is removed, leaving 6, 9, 8, 17, 12, 14, 19, 25, 20**]{hex="#204A2E"}

**(iii) The neighbours of index 4.**

| | Formula | Index | Exists? |
| --- | --- | --- | --- |
| Parent | $(i - 1) \div 2$ | $3 \div 2 = 1$ | yes, holding 9 |
| Left child | $2i + 1$ | $8 + 1 = 9$ | yes, holding 19 |
| Right child | $2i + 2$ | $8 + 2 = 10$ | :color[no]{hex="#EF4444"}, 10 is past the end |

> With $n = 10$, an index is a real node only while it is **less than 10**. Forgetting that check is the most common way to lose a mark here.

**(iv) The height.**

A complete tree of 10 nodes has height $\lfloor \log_2 10 \rfloor = 3$.

:mark[**Height 3**]{hex="#204A2E"}

### Q31. Operating on a max-heap

> :mark[**Very hard**]{hex="#5C2323"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

The array `120, 95, 110, 80, 90, 100, 75, 60, 70, 85, 88` is a **max-heap**.

![Q31, the heap](/notes/img/algorithms/ch11-q31.svg)

**(i)** Insert **115**. Show each swap and give the resulting array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Remove the root from the **original** heap. Show each swap and give the resulting array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iii)** For index **5**, give the parent and both children, and say whether each one exists. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(iv)** State the height of the heap. &nbsp; :mark[**1 mark**]{hex="#3A3A3E"}

**Solution.**

**(i) Inserting 115.**

A new value goes into the **next free slot**, index :color[11]{hex="#2DD4BF"}, and then climbs while it beats its parent. Nothing else moves.

| Step | What happens | Array |
| --- | --- | --- |
| 1 | 115 goes on the end, the next free slot | `120, 95, 110, 80, 90, 100, 75, 60, 70, 85, 88, 115` |
| 2 | 115 beats its parent 100, so they swap | `120, 95, 110, 80, 90, 115, 75, 60, 70, 85, 88, 100` |
| 3 | 115 beats its parent 110, so they swap | `120, 95, 115, 80, 90, 110, 75, 60, 70, 85, 88, 100` |
| 4 | 115 does not beat its parent 120, so it stays | `120, 95, 115, 80, 90, 110, 75, 60, 70, 85, 88, 100` |

![Q31 after the insertion](/notes/img/algorithms/ch11-q31i.svg)

:mark[**120, 95, 115, 80, 90, 110, 75, 60, 70, 85, 88, 100**]{hex="#204A2E"}

**(ii) Removing the root.**

The root :color[120]{hex="#EF4444"} comes off. The **last** value is moved into the gap so the tree stays complete, and then it sinks while a child beats it.

| Step | What happens | Array |
| --- | --- | --- |
| 1 | 120 comes off the top, and the last value 88 is moved into the gap | `88, 95, 110, 80, 90, 100, 75, 60, 70, 85` |
| 2 | 110 is the stronger child and beats 88, so they swap | `110, 95, 88, 80, 90, 100, 75, 60, 70, 85` |
| 3 | 100 is the stronger child and beats 88, so they swap | `110, 95, 100, 80, 90, 88, 75, 60, 70, 85` |
| 4 | 88 already beats nothing, it is a leaf, so it stays | `110, 95, 100, 80, 90, 88, 75, 60, 70, 85` |

![Q31 after removing the root](/notes/img/algorithms/ch11-q31r.svg)

:mark[**120 is removed, leaving 110, 95, 100, 80, 90, 88, 75, 60, 70, 85**]{hex="#204A2E"}

**(iii) The neighbours of index 5.**

| | Formula | Index | Exists? |
| --- | --- | --- | --- |
| Parent | $(i - 1) \div 2$ | $4 \div 2 = 2$ | yes, holding 110 |
| Left child | $2i + 1$ | $10 + 1 = 11$ | :color[no]{hex="#EF4444"}, 11 is past the end |
| Right child | $2i + 2$ | $10 + 2 = 12$ | :color[no]{hex="#EF4444"}, 12 is past the end |

> With $n = 11$, an index is a real node only while it is **less than 11**. Forgetting that check is the most common way to lose a mark here.

**(iv) The height.**

A complete tree of 11 nodes has height $\lfloor \log_2 11 \rfloor = 3$.

:mark[**Height 3**]{hex="#204A2E"}

### Q32. Operating on a min-heap

> :mark[**Very hard**]{hex="#5C2323"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

The array `2, 11, 7, 23, 15, 13, 9, 40, 30, 18, 21` is a **min-heap**.

![Q32, the heap](/notes/img/algorithms/ch11-q32.svg)

**(i)** Insert **6**. Show each swap and give the resulting array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Remove the root from the **original** heap. Show each swap and give the resulting array. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iii)** For index **5**, give the parent and both children, and say whether each one exists. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(iv)** State the height of the heap. &nbsp; :mark[**1 mark**]{hex="#3A3A3E"}

**Solution.**

**(i) Inserting 6.**

A new value goes into the **next free slot**, index :color[11]{hex="#2DD4BF"}, and then climbs while it beats its parent. Nothing else moves.

| Step | What happens | Array |
| --- | --- | --- |
| 1 | 6 goes on the end, the next free slot | `2, 11, 7, 23, 15, 13, 9, 40, 30, 18, 21, 6` |
| 2 | 6 beats its parent 13, so they swap | `2, 11, 7, 23, 15, 6, 9, 40, 30, 18, 21, 13` |
| 3 | 6 beats its parent 7, so they swap | `2, 11, 6, 23, 15, 7, 9, 40, 30, 18, 21, 13` |
| 4 | 6 does not beat its parent 2, so it stays | `2, 11, 6, 23, 15, 7, 9, 40, 30, 18, 21, 13` |

![Q32 after the insertion](/notes/img/algorithms/ch11-q32i.svg)

:mark[**2, 11, 6, 23, 15, 7, 9, 40, 30, 18, 21, 13**]{hex="#204A2E"}

**(ii) Removing the root.**

The root :color[2]{hex="#EF4444"} comes off. The **last** value is moved into the gap so the tree stays complete, and then it sinks while a child beats it.

| Step | What happens | Array |
| --- | --- | --- |
| 1 | 2 comes off the top, and the last value 21 is moved into the gap | `21, 11, 7, 23, 15, 13, 9, 40, 30, 18` |
| 2 | 7 is the stronger child and beats 21, so they swap | `7, 11, 21, 23, 15, 13, 9, 40, 30, 18` |
| 3 | 9 is the stronger child and beats 21, so they swap | `7, 11, 9, 23, 15, 13, 21, 40, 30, 18` |
| 4 | 21 already beats nothing, it is a leaf, so it stays | `7, 11, 9, 23, 15, 13, 21, 40, 30, 18` |

![Q32 after removing the root](/notes/img/algorithms/ch11-q32r.svg)

:mark[**2 is removed, leaving 7, 11, 9, 23, 15, 13, 21, 40, 30, 18**]{hex="#204A2E"}

**(iii) The neighbours of index 5.**

| | Formula | Index | Exists? |
| --- | --- | --- | --- |
| Parent | $(i - 1) \div 2$ | $4 \div 2 = 2$ | yes, holding 7 |
| Left child | $2i + 1$ | $10 + 1 = 11$ | :color[no]{hex="#EF4444"}, 11 is past the end |
| Right child | $2i + 2$ | $10 + 2 = 12$ | :color[no]{hex="#EF4444"}, 12 is past the end |

> With $n = 11$, an index is a real node only while it is **less than 11**. Forgetting that check is the most common way to lose a mark here.

**(iv) The height.**

A complete tree of 11 nodes has height $\lfloor \log_2 11 \rfloor = 3$.

:mark[**Height 3**]{hex="#204A2E"}

---

# Self test

1. State the max-heap property in one sentence, without using the word sorted.
2. Are a node's two children ordered against each other?
3. What is the shape rule, and what does it buy you?
4. Give the parent, left child and right child formulas from index $i$.
5. Which index is the last parent, and why does that matter?
6. When is a child index not a real node?
7. When do you upheap and when do you downheap?
8. In a downheap, which child do you swap with, and what goes wrong if you pick the other one?
9. Where does a newly inserted value go before it moves?
10. When you remove the root, which value replaces it, and why that one?
11. What does a bottom up build cost, and what is the argument for it?
12. Why do the two build methods give different arrays, and is that a mistake?
13. Does a max-heap sort ascending or descending?
14. Why is heapsort $O(n \log n)$ in the worst case when quicksort is not?
15. Is heapsort stable? Is it in place?
16. What does it cost to find a value that is not the maximum, and why?
17. Name three algorithms that need a priority queue.

# Summary

| Idea | The short version |
| --- | --- |
| Max-heap | every parent ≥ both children. Min-heap is the reverse. |
| Not ordered | siblings, cousins and in-order walks tell you nothing |
| Shape | always complete, so the height is always $\lfloor \log_2 n \rfloor$ |
| Storage | one array, no pointers, filled level by level |
| Parent, children | $(i-1) \div 2$, &nbsp; $2i+1$, &nbsp; $2i+2$ |
| Last parent | index $n \div 2 - 1$; everything after it is a leaf |
| Upheap | too strong for its parent, so it climbs. $O(\log n)$ |
| Downheap | too weak for its children, so it sinks past the **stronger** one. $O(\log n)$ |
| Insert | next free slot, then upheap |
| Remove root | answer is index 0; last value fills the gap, then downheap |
| Build top down | $n$ inserts, $O(n \log n)$ |
| Build bottom up | sink each parent backwards from $n \div 2 - 1$, $O(n)$ |
| Heaps are not unique | the two builds give different, equally correct arrays |
| Heapsort | build, then swap the root to the back and shrink |
| Heapsort cost | $O(n \log n)$ always, $O(1)$ extra space, not stable |
| Priority queue | insert and remove-highest both $O(\log n)$, peek $O(1)$ |
| Finding anything else | $O(n)$. A heap is not a search structure. |
