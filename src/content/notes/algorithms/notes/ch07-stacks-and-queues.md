# Chapter 7: Stacks and Queues

Chapter 6 gave you containers you can reach into anywhere. A **stack** and a **queue** are the opposite idea: the same data, with a rule about **where you are allowed to touch it**.

That rule is the entire subject. Everything else in this chapter follows from it.

> A :color[stack]{hex="#5B8CFF"} has one opening. Whatever went in last is the only thing you can take out.
>
> A :color[queue]{hex="#2DD4BF"} has two, one at each end. Things go in at the back and come out at the front, so whatever went in first comes out first.

## The two containers, side by side

![A stack, where push and pop both happen at the top, beside a queue, where items enter at the rear and leave at the front](/notes/img/algorithms/ch07-stack-vs-queue.svg)

Same three items, entered in the same order, and the containers hand them back in **opposite** orders. That is the whole difference:

| | :color[Stack]{hex="#5B8CFF"} | :color[Queue]{hex="#2DD4BF"} |
| --- | --- | --- |
| Rule | **LIFO**, last in first out | **FIFO**, first in first out |
| Openings | one, called the **top** | two, the **front** and the **rear** |
| Put in | `push` | `enqueue` |
| Take out | `pop`, from the top | `dequeue`, from the front |
| Look without removing | `peek` at the top | `peek` at the front |
| Real thing it is like | a pile of plates | a queue at a counter |
| Turns up in | undo, recursion, backtracking, bracket matching | scheduling, buffers, breadth first search |

### Watch it happen

A, B and C go in, in that order, and two come back out:

![An animation of A, B and C entering a stack and a queue in that order, where the stack gives back C then B and the queue gives back A then B](/notes/img/algorithms/ch07-lifo-fifo.svg)

Watch which one leaves first. The :color[stack]{hex="#5B8CFF"} hands back **C**, the newest thing it was given. The :color[queue]{hex="#2DD4BF"} hands back **A**, the oldest. Same arrivals, opposite departures.

:mark[**A stack reverses the order of what you put in. A queue preserves it.**]{hex="#3A3A3E"}

That one sentence solves half the exam questions at the end of this chapter.

## Writing them

Both are usually built on top of something you already have. In Python that is a `list` for the stack and a `deque` for the queue:

![A Stack class built on a Python list beside a Queue class built on a deque](/notes/img/algorithms/ch07-ops.svg)

Every method in both classes is **:color[O(1)]{hex="#9CA3AF"}**, and there is one reason to be careful about that.

### The trap: a list is a bad queue

A list looks like it would do for a queue, and it will run, and it will be slow:

| Written as | Cost | Why |
| --- | --- | --- |
| `items.append(v)` | **:color[O(1)]{hex="#9CA3AF"}** amortised | there is room at the end, as in Chapter 6 |
| `items.pop()` | **:color[O(1)]{hex="#9CA3AF"}** | nothing else moves |
| `items.pop(0)` | **:color[O(n)]{hex="#22C55E"}** | **every remaining item shifts down one place** |
| `deque.popleft()` | **:color[O(1)]{hex="#9CA3AF"}** | a deque is open at both ends by design |

Dequeue $n$ items from a list with `pop(0)` and you have paid $1 + 2 + \dots + n$ shifts, which is **:color[O(n²)]{hex="#F97316"}** for a job that should have been **:color[O(n)]{hex="#22C55E"}**. This is the single most common way a correct queue answer loses marks.

:mark[**`pop()` is free. `pop(0)` is not.**]{hex="#5C2323"}

## Writing them out of nodes

An exam will often ask for the version that does not lean on a built in container: a chain of **nodes**, each holding a value and a pointer to the next one.

![A linked stack that pushes at the head, beside a linked queue that keeps a front pointer and a rear pointer](/notes/img/algorithms/ch07-linked.svg)

Read the two `__init__` methods against each other, because that is where the difference lives:

- The :color[stack]{hex="#5B8CFF"} keeps **one** pointer, `top`. A push builds a node, points it at the old top, and becomes the new top. Both ends of the operation are the head of the chain, so one pointer is enough.
- The :color[queue]{hex="#2DD4BF"} keeps **two**, `front` and `rear`, because it is used at both ends. Without `rear`, an enqueue would have to walk the whole chain to find the end, which would make it **:color[O(n)]{hex="#22C55E"}** instead of **:color[O(1)]{hex="#9CA3AF"}**.

Two details in `LinkedQueue` are worth a mark each:

> **Enqueueing into an empty queue** has to set `front` as well as `rear`, because there was no previous node to point at the new one.
>
> **Dequeueing the last node** has to clear `rear` as well as `front`. Miss it and `rear` still points at a node that is no longer in the queue, and the next enqueue attaches to a chain nobody can reach.

### The linked list you get for free

There is nothing else in a linked list. A chain of nodes **is** the list, and these two classes are just two policies for where you are allowed to join it:

- Enqueue $1, 2, 3$ into a `LinkedQueue` and the chain reads $1 \to 2 \to 3$. You have built a singly linked list **in order**, which is what a queue's rear pointer is for.
- Push $1, 2, 3$ onto a `LinkedStack` and the chain reads $3 \to 2 \to 1$. Same nodes, same values, **reversed**, because a push always joins at the head.

So "build a linked list" and "build a stack" are the same code with different names, and the queue is that code with one extra pointer.

## What everything costs

| Operation | :color[Stack]{hex="#5B8CFF"} | :color[Queue]{hex="#2DD4BF"} |
| --- | --- | --- |
| `push` / `enqueue` | **:color[O(1)]{hex="#9CA3AF"}** | **:color[O(1)]{hex="#9CA3AF"}** |
| `pop` / `dequeue` | **:color[O(1)]{hex="#9CA3AF"}** | **:color[O(1)]{hex="#9CA3AF"}** |
| `peek` | **:color[O(1)]{hex="#9CA3AF"}** | **:color[O(1)]{hex="#9CA3AF"}** |
| `is_empty`, `size` | **:color[O(1)]{hex="#9CA3AF"}** | **:color[O(1)]{hex="#9CA3AF"}** |
| Search for a value | **:color[O(n)]{hex="#22C55E"}**, and it empties the container | **:color[O(n)]{hex="#22C55E"}**, same |
| Space for $n$ items | **:color[O(n)]{hex="#22C55E"}** | **:color[O(n)]{hex="#22C55E"}** |

Notice what is missing. There is no "read the item in the middle", because the rule does not allow it. If a question needs that, the answer is not a stack or a queue.

---

# Exam questions

The shape these come in is always the same: *here is some data, rearrange it, and the only tools you may use are these containers.* You are being marked on whether you can get a job done through the openings you are allowed.

> Questions **S1 to S3** are stack questions, **Q1 to Q3** are queue questions. Each one gives the plan first, then a trace you should be able to reproduce under exam conditions, then the code, then what it costs.
>
> In every trace, containers are written **bottom to top** for a stack and **front to rear** for a queue. So `S = [1, 2, 3]` has $3$ on top, and `Q = [1, 2, 3]` will give you $1$ next.

# Problems using stacks

## S1. Sort a stack using one more stack

> You are given a stack of numbers. Sort it into ascending order, smallest at the bottom. You may use **one extra stack** and a single variable. No lists, no arrays, no recursion, no sorting function.

**The plan.** Keep the helper stack sorted at all times, largest on top. Take a value off the input, and before it can go on the helper, pour back every helper item that is **larger** than it. Now the value's place is the top of the helper, so put it there. The poured back items come round again later.

The insight to state in an exam: this is **insertion sort**, with the pouring back doing the job that shifting along an array normally does.

**The trace**, on $S = [3, 1, 4, 2]$ with $2$ on top:

| Step | Popped | Poured back | $S$ after | $H$ after |
| --- | --- | --- | --- | --- |
| 1 | $2$ | none | $[3, 1, 4]$ | $[2]$ |
| 2 | $4$ | none | $[3, 1]$ | $[2, 4]$ |
| 3 | $1$ | $4$, then $2$ | $[3, 4, 2]$ | $[1]$ |
| 4 | $2$ | none | $[3, 4]$ | $[1, 2]$ |
| 5 | $4$ | none | $[3]$ | $[1, 2, 4]$ |
| 6 | $3$ | $4$ | $[4]$ | $[1, 2, 3]$ |
| 7 | $4$ | none | $[\;]$ | $[1, 2, 3, 4]$ |

Seven pops for four values, and every one of those extra pops is an item that had to be poured back and read again.

![Sorting a stack into ascending order using a second stack as a sorted helper](/notes/img/algorithms/ch07-s1-sort-two-stacks.svg)

**The cost.** Each of the $n$ values is placed once, and placing it can pour back up to everything already in the helper. Worst case, that is $1 + 2 + \dots + (n-1)$ moves, so **:color[O(n²)]{hex="#F97316"}** time and **:color[O(n)]{hex="#22C55E"}** extra space. The worst case is input already sorted the wrong way round, where every single value forces a full pour.

> If the question allows it, say what the $O(n^2)$ buys you: nothing else fits through one opening. You cannot do better than quadratic with two stacks and no indexing.

## S2. Build a queue out of two stacks

> Using **only stacks**, build something that behaves like a queue: `enqueue` and `dequeue` in first in first out order.

**The plan.** A stack reverses what you put in it. Pour one stack into another and you have reversed it **twice**, which puts it the right way round again. So keep two:

- `inbox` takes arrivals. Newest on top, wrong order for leaving.
- `outbox` holds departures. It is the inbox poured over, so oldest is on top.

Only pour when the outbox has run **empty**. Pouring early is the classic mistake: it interleaves a new arrival with the older ones and breaks the order.

**The trace.** `A B C` in, one out, `D` in, three out:

| Step | `inbox` | `outbox` | Came out |
| --- | --- | --- | --- |
| enqueue A | $[A]$ | $[\;]$ | |
| enqueue B | $[A, B]$ | $[\;]$ | |
| enqueue C | $[A, B, C]$ | $[\;]$ | |
| **dequeue** | $[\;]$ | $[C, B]$ | $A$ |
| enqueue D | $[D]$ | $[C, B]$ | |
| **dequeue** | $[D]$ | $[C]$ | $B$ |
| **dequeue** | $[D]$ | $[\;]$ | $C$ |
| **dequeue** | $[\;]$ | $[\;]$ | $D$ |

Look at row 4. One pour handed back $A$ and left $B$ and $C$ sitting in the right order for the next two dequeues, which cost nothing. Then $D$ waited in the inbox until the outbox emptied.

![A queue built from an inbox stack and an outbox stack, pouring one into the other only when the outbox runs empty](/notes/img/algorithms/ch07-s2-queue-from-stacks.svg)

**The cost.** A single `dequeue` can be **:color[O(n)]{hex="#22C55E"}**, because it might have to pour everything. But every item is pushed at most twice and popped at most twice in its whole life, so $n$ operations cost $O(n)$ between them:

$$
\text{amortised cost per operation} = \frac{O(n)}{n} = \textcolor{#9CA3AF}{O(1)}
$$

:mark[**Worst case per call is $O(n)$, amortised is $O(1)$.**]{hex="#3A3A3E"} Say both. Saying only the first is incomplete, saying only the second is wrong.

## S3. Evaluate an arithmetic expression with a stack

> Convert $3 + 4 \times 2 \div (1 - 5)$ into postfix, then evaluate the postfix, using a stack for each job.

**Why postfix.** Infix needs precedence rules and brackets to be read correctly. Postfix needs neither: operands come first, the operator comes when both of its operands are known, and there is exactly one reading. Getting there is what a stack is for.

**Plan for the conversion (the shunting yard).** Walk the tokens left to right:

| Token | What to do |
| --- | --- |
| Operand | send it **straight to the output** |
| `(` | push it |
| `)` | pop to the output until you meet `(`, then discard the `(` |
| Operator | while the top is an operator of **equal or higher** precedence, pop it to the output, then push this one |
| End | pop whatever is left to the output |

**The conversion trace**, on `3 + 4 * 2 / ( 1 - 5 )`:

| Token | Stack | Output |
| --- | --- | --- |
| `3` | | `3` |
| `+` | `+` | `3` |
| `4` | `+` | `3 4` |
| `*` | `+ *` | `3 4` |
| `2` | `+ *` | `3 4 2` |
| `/` | `+ /` | `3 4 2 *` |
| `(` | `+ / (` | `3 4 2 *` |
| `1` | `+ / (` | `3 4 2 * 1` |
| `-` | `+ / ( -` | `3 4 2 * 1` |
| `5` | `+ / ( -` | `3 4 2 * 1 5` |
| `)` | `+ /` | `3 4 2 * 1 5 -` |
| end | | `3 4 2 * 1 5 - / +` |

Two rows carry the marks. At `/`, the `*` on the top has **equal** precedence so it comes off first, which is what makes $4 \times 2$ happen before the division. At `)`, everything down to the `(` comes off and the bracket pair is thrown away, having done its job.

**Plan for the evaluation.** Walk the postfix: numbers get pushed, and an operator pops **two** and pushes the result.

| Token | Stack |
| --- | --- |
| `3` | $[3]$ |
| `4` | $[3, 4]$ |
| `2` | $[3, 4, 2]$ |
| `*` | $[3, 8]$ |
| `1` | $[3, 8, 1]$ |
| `5` | $[3, 8, 1, 5]$ |
| `-` | $[3, 8, -4]$ |
| `/` | $[3, -2.0]$ |
| `+` | $[1.0]$ |

![Converting infix to postfix with an operator stack, then evaluating the postfix with an operand stack](/notes/img/algorithms/ch07-s3-postfix.svg)

> **The order trap.** The **second** value you pop is the **left** operand. For $8 \div (-4)$ the stack gives you $-4$ first and $8$ second, so it is `a / b` with `b` popped first. Get this backwards and `+` and `*` still look right while `-` and `/` silently give the wrong answer, which is exactly the sort of bug an exam question is built around.

**The cost.** Every token is pushed once and popped once in each pass, so both passes are **:color[O(n)]{hex="#22C55E"}** in the number of tokens, with **:color[O(n)]{hex="#22C55E"}** space for the stack. The answer here is $3 + \frac{8}{-4} = 1.0$.

# Problems using queues

## Q1. Build a stack out of two queues

> Using **only queues**, build something that behaves like a stack.

**The plan.** This is S2 in a mirror, and it does not come out as neatly, because a queue does not reverse anything. So instead of reversing on the way out, rearrange on the way **in**: put the newcomer into an empty spare queue **first**, then line everything else up behind it. The newest item is now at the front, where a dequeue will find it.

You have to choose which operation pays:

| | `push` | `pop` |
| --- | --- | --- |
| Costly push (used here) | **:color[O(n)]{hex="#22C55E"}** | **:color[O(1)]{hex="#9CA3AF"}** |
| Costly pop (the alternative) | **:color[O(1)]{hex="#9CA3AF"}** | **:color[O(n)]{hex="#22C55E"}** |

There is no arrangement where both are $O(1)$, and unlike S2 there is **no amortised escape**: every single push does the full lap, so the cost cannot be spread over later operations. Being able to say that is what separates a full answer from half of one.

**The trace**, front to rear:

| Step | `main` | Came out |
| --- | --- | --- |
| push A | $[A]$ | |
| push B | $[B, A]$ | |
| push C | $[C, B, A]$ | |
| **pop** | $[B, A]$ | $C$ |
| push D | $[D, B, A]$ | |
| **pop** | $[B, A]$ | $D$ |
| **pop** | $[A]$ | $B$ |
| **pop** | $[\;]$ | $A$ |

Out came $C, D, B, A$, which is last in first out at every step.

![A stack built from two queues, where each push puts the newcomer into the spare queue first and lines everything else up behind it](/notes/img/algorithms/ch07-q1-stack-from-queues.svg)

**The cost.** `push` moves every existing item once, so **:color[O(n)]{hex="#22C55E"}**, and `pop` is a single dequeue, so **:color[O(1)]{hex="#9CA3AF"}**. Building $n$ items costs **:color[O(n²)]{hex="#F97316"}** in total.

## Q2. Sort an array with ten queues

> Sort $[329, 457, 657, 839, 436, 720, 355]$ into ascending order **without comparing any two numbers to each other**. You may use ten queues, numbered $0$ to $9$.

**The plan.** This is **radix sort**, and it is the question queues were invented for. Deal each number into the bucket for one of its digits, then collect the buckets back up in order, $0$ first. Repeat for the next digit along. Three digit numbers need three passes: units, then tens, then hundreds.

The reason it has to be a **queue** and not a stack is the whole point of the question:

> Collecting a bucket must hand back the numbers **in the order they were dealt into it**. That keeps the work of the earlier passes intact, which is what makes the sort correct. A stack would hand each bucket back reversed and undo the previous pass. A sort with this property is called :mark[**stable**]{hex="#204A2E"}.

**The trace.** Empty buckets are left out:

| Pass | Digit | Buckets | Order after collecting |
| --- | --- | --- | --- |
| 1 | units | $0$: $720$ $\cdot$ $5$: $355$ $\cdot$ $6$: $436$ $\cdot$ $7$: $457, 657$ $\cdot$ $9$: $329, 839$ | $720, 355, 436, 457, 657, 329, 839$ |
| 2 | tens | $2$: $720, 329$ $\cdot$ $3$: $436, 839$ $\cdot$ $5$: $355, 457, 657$ | $720, 329, 436, 839, 355, 457, 657$ |
| 3 | hundreds | $3$: $329, 355$ $\cdot$ $4$: $436, 457$ $\cdot$ $6$: $657$ $\cdot$ $7$: $720$ $\cdot$ $8$: $839$ | $329, 355, 436, 457, 657, 720, 839$ |

Follow $457$ and $657$. Pass 1 puts them in bucket $7$ in that order, pass 2 puts them both in bucket $5$ and **keeps** that order, so by the time the hundreds digit separates them the units digit has already been settled. Stability is doing all the work.

![Radix sort dealing values into ten queues by one digit at a time and collecting them back in bucket order](/notes/img/algorithms/ch07-q2-radix-queues.svg)

**The cost.** Each pass deals $n$ values and collects $n$ values, so a pass is **:color[O(n)]{hex="#22C55E"}**, and there are $d$ passes, one per digit:

$$
O(d \cdot n) \quad \text{with } d = \text{the number of digits}
$$

For fixed width numbers $d$ is a constant, which makes this **:color[O(n)]{hex="#22C55E"}**, beating the **:color[O(n log n)]{hex="#EAB308"}** floor that applies to sorts built on comparisons. There is no contradiction: that floor only binds sorts that compare, and this one never does. It costs **:color[O(n)]{hex="#22C55E"}** extra space for the buckets.

## Q3. Interleave the two halves of a queue

> A queue holds $[1, 2, 3, 4, 5, 6]$, an even number of items. Rearrange it into $[1, 4, 2, 5, 3, 6]$: first of the front half, first of the back half, second of the front half, and so on. You may use **one stack**, and the queue must stay a queue throughout.

**The plan.** The last step is a zip: alternately take one item from a stack and one from the front of the queue. For that to work, the front half has to be sitting on the stack in the **right** order, and a stack reverses whatever you feed it. So you feed it the front half **twice**: reversed once, then reversed again, which is back where it started.

Four moves, then the zip:

1. Move the front half onto the stack. It is now reversed.
2. Enqueue it all back. It goes to the rear, still reversed.
3. Rotate $n/2$ items from front to rear, which brings that reversed half back to the front.
4. Move it onto the stack again. Two reversals cancel, so the stack is now in the original order with $1$ on top.

**The trace**, queue front to rear and stack bottom to top:

| Step | $Q$ | $S$ |
| --- | --- | --- |
| start | $[1, 2, 3, 4, 5, 6]$ | $[\;]$ |
| 1. half onto the stack | $[4, 5, 6]$ | $[1, 2, 3]$ |
| 2. back on, reversed | $[4, 5, 6, 3, 2, 1]$ | $[\;]$ |
| 3. rotate three | $[3, 2, 1, 4, 5, 6]$ | $[\;]$ |
| 4. onto the stack again | $[4, 5, 6]$ | $[3, 2, 1]$ |
| zip: $1$ then $4$ | $[5, 6, 1, 4]$ | $[3, 2]$ |
| zip: $2$ then $5$ | $[6, 1, 4, 2, 5]$ | $[3]$ |
| zip: $3$ then $6$ | $[1, 4, 2, 5, 3, 6]$ | $[\;]$ |

After step 4 the stack reads $[3, 2, 1]$ bottom to top, so $1$ comes off first, which is exactly what the zip needs.

![Interleaving the two halves of a queue by reversing the front half twice on a stack and then zipping the halves together](/notes/img/algorithms/ch07-q3-interleave.svg)

**The cost.** Every step touches each item a fixed number of times, so **:color[O(n)]{hex="#22C55E"}** time and **:color[O(n)]{hex="#22C55E"}** space for the stack. Nothing is ever indexed and nothing is ever compared.

---

## Self test

1. Three items go into a stack and a queue in the order $X, Y, Z$. What comes out of each, in order?
2. Why does `LinkedQueue` need a `rear` pointer, and what would enqueue cost without one?
3. Why is dequeueing $n$ items from a Python list with `pop(0)` $O(n^2)$?
4. In S2, why must you pour the inbox into the outbox only when the outbox is empty?
5. In S2 a dequeue can cost $O(n)$, yet the answer is $O(1)$. In Q1 a push costs $O(n)$ and there is no such rescue. What is the difference?
6. Radix sort with ten stacks instead of ten queues. What breaks?
7. In S3, which of the two values you pop is the left operand, and which operators would still look correct if you got it backwards?

> **Answers.**
> 1. The stack gives $Z, Y, X$. The queue gives $X, Y, Z$.
> 2. Without `rear` you would have to walk from `front` to the end of the chain to attach a node, making enqueue $O(n)$ instead of $O(1)$.
> 3. `pop(0)` shifts every remaining element down one place, so it is $O(n)$, and doing it $n$ times gives $1 + 2 + \dots + n$, which is $O(n^2)$.
> 4. Because a pour reverses the inbox as a block. Pour while the outbox still holds older items and the newer ones end up sitting on top of them, in front of items that arrived earlier.
> 5. In S2 each item is pushed and popped at most twice **in its whole life**, so the expensive pour cannot happen again for those items, and the cost spreads over all the operations. In Q1 every push moves every item again, so the cost is paid afresh each time and never amortises away.
> 6. Stability. A stack hands a bucket back reversed, which destroys the order the earlier passes established, so the result is not sorted.
> 7. The second value popped is the left operand. Get it backwards and `+` and `*` are unaffected because they commute, while `-` and `/` quietly give the wrong answer.

## Chapter summary

- A :color[stack]{hex="#5B8CFF"} is **LIFO** with one opening; a :color[queue]{hex="#2DD4BF"} is **FIFO** with two. Every property of both follows from that.
- A stack **reverses** the order of what it is given, a queue **preserves** it. Two reversals cancel, which is how you build a queue from two stacks and how you interleave a queue with one stack.
- All the basic operations are **:color[O(1)]{hex="#9CA3AF"}** on both, as long as you do not use `list.pop(0)`.
- A linked stack needs one pointer, a linked queue needs two. The chain of nodes underneath is an ordinary singly linked list.
- When a question hands you a restricted container, it is asking whether you can get the job done through the openings you are allowed. Read what the container does to **order** first, and the method usually follows.
