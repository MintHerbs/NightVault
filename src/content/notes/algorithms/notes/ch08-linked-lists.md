# Chapter 8: Linked Lists

A Python list keeps its values **side by side in one block**, which is why `x[500]` is instant and why inserting at the front means shifting everything along.

A **linked list** gives that up. It keeps each value in its own little box, called a **node**, and each node holds a reference to the next one. Nothing is side by side, nothing has a position, and the only way in is through the first node.

You give up the instant `x[500]`. What you buy is this: once you are standing at the right place, putting a node in or taking one out is **three assignments, whatever the size of the list**. No shifting, no resizing, no copying.

> Chapter 7 already used a node, at the end, to build a stack and a queue without a built in container. This chapter is that idea taken seriously.

## The three kinds

![The three kinds of linked list: singly linked, doubly linked and circular, drawn one under the other](/notes/img/algorithms/ch08-three-kinds.svg)

**Singly linked.** Each node knows only the node **after** it. You can walk forwards, never backwards, and the last node's `next` is `None`, which is what tells you the list has ended. This is the default, and it is what the rest of this chapter builds first.

**Doubly linked.** Each node also knows the node **before** it. That one extra field buys you backwards traversal and, more usefully, the ability to remove a node you are standing on without having to go back and find the one in front of it. It costs one extra reference per node, and every operation has to keep **two** links straight instead of one.

**Circular.** The last node's `next` points back at the first, so the chain has no end. You can start anywhere and reach everything. There is no `None` to stop at, so a traversal that looks for one **never stops**: you stop when you arrive back where you started.

| | Singly | Doubly | Circular |
| --- | --- | --- | --- |
| Links per node | 1 | 2 | 1 |
| The last node points to | `None` | `None`, and back to the one before | **the first node** |
| Walk backwards | no | **yes** | only by going all the way round |
| Extra memory | one reference per node | **two** per node | one per node |
| Stop a traversal when | you reach `None` | you reach `None` | **you are back at the start** |
| Good for | the general case | undo and redo, browser history, deques | round robin turns, a repeating playlist |

### How to read the pictures

Every diagram below uses the same code:

> A **blue** box is an ordinary node. A **green** box or arrow is something being **added** this step. A **red cross** is a link being **broken**. An **amber** label is a named reference you hold in a variable, like `head` or `current_node`. A **cyan dot** inside a node means that field points somewhere; a **slash** means it is `None`.

---

# Building a singly linked list

## Step 1. You need a node

Everything starts here. A node is an object with exactly two things in it: the value, and a reference to whatever comes next.

![One node, made of a data field holding a value and a next field holding a reference to the following node](/notes/img/algorithms/ch08-node.svg)

![The Node class](/notes/img/algorithms/ch08-node-code.svg)

`self.next = None` in the constructor is the important line. A brand new node points at nothing, and it stays that way until you connect it to something. A node whose `next` is `None` is either the only node, or the last one.

> **A small trap in `__str__`.** It returns `self.data`, and Python requires `__str__` to return a **string**. `print(Node("hello"))` works; `print(Node(10))` raises `TypeError: __str__ returned non-string (type int)`. It never fires in this chapter because `LinkedList.__str__` calls `str(current_node.data)` rather than printing the node itself, but `return str(self.data)` would be the safe version.

## Step 2. Connect two of them

There is no ceremony to this. Assign one node's `next` to another node, and they are linked.

![Two nodes joined by setting the first node's next reference to the second node](/notes/img/algorithms/ch08-two-nodes.svg)

![Joining nodes by hand](/notes/img/algorithms/ch08-connect-code.svg)

That loop at the bottom is already a full traversal, written without a class. Read it once: start at the first node, print, move to `next`, stop when you fall off the end into `None`.

:mark[**Three nodes and two assignments is a linked list. The class that follows only makes it tidy.**]{hex="#3A3A3E"}

## Step 3. Give the list a handle

Holding a variable for every node does not scale. The list object keeps **one** reference, to the first node, and a count so you do not have to walk the list to answer "how many?".

![A LinkedList object holding a head reference and a size, pointing at the first of three nodes](/notes/img/algorithms/ch08-list-object.svg)

![The list object](/notes/img/algorithms/ch08-list-code.svg)

`head` is the whole of the list's memory. Lose it and every node becomes unreachable at once, which is exactly the mechanism used to delete things later on.

## Step 4. Walk it

You cannot ask for the fifth node. You can only ask the fourth node who comes next. Every operation in the rest of this chapter is built out of this walk.

![Walking a linked list one node at a time until the current node is None](/notes/img/algorithms/ch08-traverse.svg)

![Walking it](/notes/img/algorithms/ch08-traverse-code.svg)

`while current_node:` works because **`None` is falsy** in Python, so the loop ends exactly when it runs off the end. Writing `while current_node is not None:` says the same thing and says it more plainly, which is why `__str__` below it does exactly that.

Reaching the $k$th node takes $k$ steps, so a full traversal is **:color[O(n)]{hex="#22C55E"}**. That single fact explains every cost in this chapter.

## Step 5. Insert at the beginning

![Inserting at the beginning: the new node points at the old head, then head points at the new node](/notes/img/algorithms/ch08-insert-beginning.svg)

![insertBeginning](/notes/img/algorithms/ch08-insert-beginning-code.svg)

Two assignments, and **the order of them is the whole question**:

> **1.** `new_node.next = self.head` while `head` still points at the old first node.
>
> **2.** `self.head = new_node`, now that the new node is safely attached to the rest.

Do it the other way round and step 1 has nothing to save: `head` already points at the new node, `new_node.next` ends up pointing at itself, and every other node in the list is unreachable. :mark[**Attach before you reassign.**]{hex="#5C2323"}

Nothing was walked and nothing was shifted, so this is **:color[O(1)]{hex="#9CA3AF"}** no matter how long the list is. That is the operation linked lists exist for.

## Step 6. Insert at the end

![Inserting at the end: walk to the last node, then point its next at the new node](/notes/img/algorithms/ch08-insert-end.svg)

![insertEnd](/notes/img/algorithms/ch08-insert-end-code.svg)

Two things to notice.

**The empty case is separate.** If `head` is `None` there is no last node to attach to, so the new node becomes the head. Every method that changes the front of the list needs this branch.

**The walk is the cost.** `while tail.next is not None` is the traversal from step 4, and it is what makes this **:color[O(n)]{hex="#22C55E"}** while `insertBeginning` is $O(1)$. Note the condition: it stops on `tail.next` being `None`, not `tail`, because you want to **stand on** the last node, not walk past it.

> A list that also stores a `tail` reference makes this $O(1)$ too. That is exactly what the doubly linked list further down does, and what `LinkedQueue` in chapter 7 did.

## Step 7. Insert in order

This is the one exam questions are built on, because it needs **two** references at once.

![Inserting in order: the new node points at current, then previous points at the new node](/notes/img/algorithms/ch08-insert-order.svg)

![insertOrder](/notes/img/algorithms/ch08-insert-order-code.svg)

The problem: to splice a node in between two others you have to change the **previous** node's `next`, and a singly linked node cannot look backwards. The fix is to walk with two references, one trailing the other:

```
previous_node   current_node
```

Walk while `current_node.data < data`. When the loop stops, `current_node` is the first node that should come **after** the new one, and `previous_node` is the last one that should come **before** it. The new node goes between them, in this order:

> **1.** `new_node.next = current_node`
>
> **2.** `previous_node.next = new_node`

Same rule as step 5. Attach the new node to the tail of the list first, then let go of the old link.

Three cases are handled separately at the top of the method, and each one is a mark:

| Case | What happens |
| --- | --- |
| The list is empty | the new node becomes the head |
| The new value is smaller than the head's | hand the job to `insertBeginning` |
| Anything else | walk with two references and splice |

The walk makes this **:color[O(n)]{hex="#22C55E"}**. Note that it also stops correctly at the **end** of the list: `current_node` becomes `None`, `new_node.next = None`, and the new node is the last one.

## Step 8. Remove the first node

![Removing the first node by moving head to the second node](/notes/img/algorithms/ch08-remove-first.svg)

![removeFirst](/notes/img/algorithms/ch08-remove-first-code.svg)

There is no delete here, and there does not need to be. Move `head` on by one and the old first node is simply no longer reachable from anywhere; Python's garbage collector clears it up when it notices. One assignment, so **:color[O(1)]{hex="#9CA3AF"}**.

## Step 9. Remove the last node

![Removing the last node by walking to the second to last node and setting its next to None](/notes/img/algorithms/ch08-remove-last.svg)

![removeLast](/notes/img/algorithms/ch08-remove-last-code.svg)

You cannot cut the last node loose from the last node, because the thing that has to change is the `next` of the node **before** it. So you walk to the second to last node, which is what the double condition finds:

$$
\text{stop when } \texttt{current\_node.next.next} \text{ is } \texttt{None}
$$

`while current_node.next and current_node.next.next` reads as "while there are at least two nodes ahead of me". When it stops, `current_node` is the second to last, and setting its `next` to `None` makes it the last. **:color[O(n)]{hex="#22C55E"}**, because of the walk.

> **A real bug, worth knowing about.** The one node branch returns early:
>
> ```
> if self.head.next is None:   # there is only one node
>     self.head = None
>     return                   # <- returns before self.size -= 1
> ```
>
> The node is unlinked correctly, but `size` is never decremented. Run it and the list prints as empty while reporting a size of 1:
>
> ```
> before   7 -> NULL size 1
> after    NULL size 1
> ```
>
> Adding `self.size -= 1` before that `return` fixes it. Worth fixing, and worth remembering that a special case with its own `return` is exactly where bookkeeping gets forgotten.

## Step 10. Remove by value, and modify

![Removing a node from the middle by pointing the previous node past it](/notes/img/algorithms/ch08-remove-value.svg)

![remove, and modifyNode](/notes/img/algorithms/ch08-remove-code.svg)

The line that does the work is

```
current_node.next = current_node.next.next
```

which reads as "skip the node after me". Notice how the whole method is written to look **one node ahead**: it tests `current_node.next.data`, not `current_node.data`. That is not a stylistic choice, it is forced. When you find the node you want, you need the one **before** it to unlink it, and a singly linked node cannot look back. Testing one ahead means that when you find a match you are already standing where you need to be.

The head is handled separately at the top, because the head has nothing before it. `modifyNode` needs none of this: it changes the value in place, and the links do not move at all.

Both are **:color[O(n)]{hex="#22C55E"}**: they may have to look at every node.

## Step 11. The whole thing, running

![The main function that builds a list with insertOrder and then removes from it](/notes/img/algorithms/ch08-main-code.svg)

What it prints:

```
Initially: isEmpty? True
9 -> 10 -> 15 -> 60 -> 90 -> 95 -> NULL
Size: 6

Remove first node:
10 -> 15 -> 60 -> 90 -> 95 -> NULL
Size: 5

Remove last node:
10 -> 15 -> 60 -> 90 -> NULL
Size: 4

Remove node with element 15:
10 -> 60 -> 90 -> NULL
Size: 3

Update node with element 60 to 65:
10 -> 65 -> 90 -> NULL
```

The values went in as $10, 60, 9, 15, 90, 95$ and came out sorted, without a sort ever being called. Every one of the six `insertOrder` calls put its node in the right place on the way in.

> `if __name__ == "__main__":` means the `main()` below it runs when you execute the file, and does **not** run when some other file imports it. Without it, importing this module to reuse the `LinkedList` class would print the whole demo.

## What a singly linked list costs

| Operation | Linked list | Python `list` | Why |
| --- | --- | --- | --- |
| Read the $k$th item | **:color[O(n)]{hex="#22C55E"}** | **:color[O(1)]{hex="#9CA3AF"}** | you have to walk; a list can calculate the address |
| Insert at the front | **:color[O(1)]{hex="#9CA3AF"}** | **:color[O(n)]{hex="#22C55E"}** | two assignments; a list has to shift everything up |
| Insert at the back | **:color[O(n)]{hex="#22C55E"}** | **:color[O(1)]{hex="#9CA3AF"}** amortised | the walk, unless you keep a `tail` |
| Insert in order | **:color[O(n)]{hex="#22C55E"}** | **:color[O(n)]{hex="#22C55E"}** | both have to find the place |
| Remove the first | **:color[O(1)]{hex="#9CA3AF"}** | **:color[O(n)]{hex="#22C55E"}** | `pop(0)` shifts, as chapter 7 warned |
| Remove by value | **:color[O(n)]{hex="#22C55E"}** | **:color[O(n)]{hex="#22C55E"}** | both have to find it first |
| Memory per item | value **plus a reference** | value | the price of the chain |

:mark[**Positions are cheap in a list and expensive in a linked list. Rearranging is the other way round.**]{hex="#3A3A3E"}

---

# The doubly linked list

Everything above holds. The change is one field.

![A doubly linked node with a prev field, a data field and a next field](/notes/img/algorithms/ch08-doubly-node.svg)

![The doubly linked node](/notes/img/algorithms/ch08-doubly-node-code.svg)

That one line pays for itself twice. It lets you walk backwards, and it means any node you are holding already knows the node in front of it, which is precisely what step 7 and step 10 had to work around with a trailing `previous_node`.

The list keeps a `tail` as well as a `head`, so both ends are $O(1)$.

## Inserting at the beginning

![Inserting at the beginning of a doubly linked list, where three links have to be rewired](/notes/img/algorithms/ch08-doubly-insert-beginning.svg)

Three rewires instead of two, and the same discipline: attach the new node to the list before you move `head`.

> **1.** `new_node.next = self.head`
>
> **2.** `self.head.prev = new_node`, so the chain agrees in both directions
>
> **3.** `self.head = new_node`

Step 2 is the one people forget, and the list will look perfectly correct until somebody walks it backwards.

![The doubly linked list](/notes/img/algorithms/ch08-doubly-code.svg)

The empty case appears in both inserts, and it is the same idea each time: with no nodes there is nothing to point back at, so the new node is both the head **and** the tail.

## Removing, and why this is the real prize

![Removing from the middle of a doubly linked list by rerouting the two links around it](/notes/img/algorithms/ch08-doubly-remove.svg)

Compare this with step 10. There is no looking one ahead, no trailing reference, no special case for "the node before it". The node itself knows both of its neighbours, so you simply introduce them to each other:

> `current_node.prev.next = current_node.next`
>
> `current_node.next.prev = current_node.prev`

The two `if`s in the code are the ends of the list, where one of those neighbours does not exist: no `prev` means it was the head, no `next` means it was the tail, and in each case a list level reference has to move instead.

:mark[**Given the node, removal is $O(1)$ in a doubly linked list and $O(n)$ in a singly linked one.**]{hex="#204A2E"} Finding the node is still $O(n)$ either way.

## Walking it both ways

![Traversing a doubly linked list forwards from head and backwards from tail](/notes/img/algorithms/ch08-doubly-traverse-code.svg)

The two methods are the same six lines with two words swapped: start at `tail` instead of `head`, follow `prev` instead of `next`. That symmetry is the whole point of the extra field.

---

# The circular linked list

The node is unchanged. It is the ordinary singly linked `Node`, and it is what the list does with the last one that differs.

![A circular linked list where the last node points back to the first](/notes/img/algorithms/ch08-circular.svg)

This version keeps **`tail`** rather than `head`, which looks odd until you see the trick:

$$
\texttt{tail.next} \; \text{is the head}
$$

One reference gives you both ends. From `tail` you can attach to the back in one move, and `tail.next` hands you the front, so inserting at either end is **:color[O(1)]{hex="#9CA3AF"}** without keeping two references.

## Inserting at the end

![Inserting at the end of a circular linked list using the tail reference, without walking the list](/notes/img/algorithms/ch08-circular-insert.svg)

![The circular linked list](/notes/img/algorithms/ch08-circular-code.svg)

> **1.** `new_node.next = self.tail.next`, so the new node closes the ring by pointing at the head
>
> **2.** `self.tail.next = new_node`, so the old last node points at it
>
> **3.** `self.tail = new_node`

The empty case is the nicest line in the chapter: a ring of one node **points at itself**, `new_node.next = new_node`, and every other method then works without a special case for it.

## Traversing without an end

This is where circular lists catch people out:

> ```
> while current_node is not None:      # never ends
> ```
>
> There is no `None` in a circular list. That loop runs for ever.

The stopping rule has to be "until I am back where I started", which is why `traverse` uses `while True` with the check at the bottom:

```
current_node = current_node.next
if current_node is self.tail.next:   # back at the head
    break
```

Note `is` and not `==`. You are asking whether it is **the same node**, not whether it holds an equal value, and a list with two nodes holding $10$ would stop far too early with `==`.

![Removing from a circular linked list](/notes/img/algorithms/ch08-circular-remove-code.svg)

Removal carries the same shape: walk with a trailing reference like the singly linked version, but the loop is bounded by "one full lap" rather than by `None`, and two cases have to move `tail` (removing the only node, and removing the tail itself).

Running it:

```
10 -> 20 -> 30 -> 40 -> (back to 10) size 4
after remove(20)    10 -> 30 -> 40 -> (back to 10) size 3
after remove(40)    10 -> 30 -> (back to 10) size 2 tail 30
after removing all  empty size 0 empty? True
```

And walking a three node ring for twelve steps gives `A B C A B C A B C A B C`, which is the property the whole structure exists for: **round robin**, where each turn hands on to the next and the last hands back to the first. Process scheduling, a multiplayer turn order, a repeating playlist.

---

## All three at once

| | Singly | Doubly | Circular |
| --- | --- | --- | --- |
| Insert at the front | **:color[O(1)]{hex="#9CA3AF"}** | **:color[O(1)]{hex="#9CA3AF"}** | **:color[O(1)]{hex="#9CA3AF"}** with `tail` |
| Insert at the back | **:color[O(n)]{hex="#22C55E"}** without a `tail` | **:color[O(1)]{hex="#9CA3AF"}** | **:color[O(1)]{hex="#9CA3AF"}** |
| Remove a node you are standing on | **:color[O(n)]{hex="#22C55E"}** | **:color[O(1)]{hex="#9CA3AF"}** | **:color[O(n)]{hex="#22C55E"}** |
| Search | **:color[O(n)]{hex="#22C55E"}** | **:color[O(n)]{hex="#22C55E"}** | **:color[O(n)]{hex="#22C55E"}** |
| Walk backwards | no | **yes** | one lap forwards |
| References per node | 1 | 2 | 1 |
| Ends when | `next is None` | `next is None` | you are back at the start |

## Self test

1. Why is `insertBeginning` $O(1)$ but `insertEnd` $O(n)$, when both are two or three assignments?
2. In `insertBeginning`, what goes wrong if you write `self.head = new_node` first?
3. Why does `remove(data)` test `current_node.next.data` rather than `current_node.data`?
4. `removeLast` stops when `current_node.next.next` is `None`. What would stopping at `current_node.next` give you instead?
5. What is the one line of difference between a `Node` and a `DNode`, and which two operations does it change the cost of?
6. A circular list holds one node. What does its `next` point at?
7. Why does the circular traversal compare with `is` rather than `==`?
8. You are handed a reference to a node in the middle of a list and told to delete it. For which of the three kinds can you do that in $O(1)$?

> **Answers.**
> 1. `insertEnd` has to **find** the last node first, and finding it means walking every node. The assignments are cheap in both; the search is not.
> 2. `head` would already point at the new node, so `new_node.next = self.head` would point the new node at **itself**, and the rest of the list would be unreachable.
> 3. Because unlinking a node means changing the `next` of the node **before** it, and a singly linked node cannot look backwards. Testing one ahead means that when you find the match you are already standing on the node you need to change.
> 4. The **last** node instead of the second to last, and from there you cannot unlink it, because the field that has to change belongs to the node before.
> 5. `self.prev = None`. It makes removing a node you are holding $O(1)$ instead of $O(n)$, and it makes backwards traversal possible at all.
> 6. Itself. `new_node.next = new_node`.
> 7. `is` asks whether it is the same node. `==` asks whether the values are equal, so a list containing the same value twice would stop the loop early.
> 8. The doubly linked one. The other two need the previous node, and finding it costs a walk.

## Chapter summary

- A linked list is **nodes plus references**. The list object holds only `head` (and usually a `size`), and every node knows only its neighbours.
- You cannot jump to a position. Everything is built from one walk, which is why so many operations are **:color[O(n)]{hex="#22C55E"}** even though the assignments themselves are free.
- What you buy is the front of the list and rearranging: inserting or removing at a known place is **:color[O(1)]{hex="#9CA3AF"}**, with nothing shifted and nothing copied.
- **Attach before you reassign.** Nearly every bug in this chapter is pointer surgery done in the wrong order, and it always loses the rest of the list.
- **Doubly** costs one reference per node and buys backwards traversal plus $O(1)$ removal of a node you are holding. **Circular** costs nothing extra and buys a list with no end, at the price of a traversal that must stop on returning to the start rather than on `None`.
