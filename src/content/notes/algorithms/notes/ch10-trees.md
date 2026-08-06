# Chapter 10: Trees

Every structure so far has been a line. An array is a line you can jump into, a linked list is a line you have to walk, a stack and a queue are lines with a rule about which end you may touch. A **tree** is the first structure that branches, and that one change is worth a great deal.

A sorted array can be searched by halving, in $O(\log n)$, but inserting into it costs $O(n)$ because everything after the gap shifts. A linked list inserts in $O(1)$ but has to be walked from the front to find anything. A **binary search tree** does both in $O(\log n)$, as long as it keeps its shape. The whole second half of this chapter is about that last clause.

> The chapter runs on seven colours, and each one keeps its meaning to the last page.
>
> | Colour | What it is |
> | --- | --- |
> | **:color[root]{hex="#EAB308"}** | the root of the tree, or of the subtree being worked on |
> | **:color[internal node]{hex="#5B8CFF"}** | an ordinary node, one with at least one child |
> | **:color[leaf]{hex="#22C55E"}** | a node with no children at all |
> | **:color[visiting]{hex="#FF5FA2"}** | the node being looked at this step |
> | **:color[visited]{hex="#A78BFA"}** | a node already dealt with |
> | **:color[removing]{hex="#EF4444"}** | a node or a link that is about to go |
> | **:color[just inserted]{hex="#2DD4BF"}** | a node added this step |

## What a binary tree is

A **binary tree** is a collection of **nodes**. Each node holds a value and has **at most two** children, named the **left child** and the **right child**. One node is the **root**, and every other node has exactly one parent.

Two phrases in that definition do more work than they look:

- **At most two.** A node may have zero, one or two children. One child is perfectly legal, and **which side it sits on matters**: a node with only a right child is a different tree from a node with only a left child, and the traversals come out differently.
- **Exactly one parent.** Nothing points back up, and no two branches ever rejoin. That is what makes it a tree and not a graph.

![A binary tree with root, edge, parent, child, sibling, leaf, subtree and level all labelled](/notes/img/algorithms/ch10-anatomy.svg)

### The words you are expected to use

Exam questions are written in this vocabulary, so a question you cannot parse is usually a word you have not pinned down rather than an idea you have not understood.

| Term | What it means |
| --- | --- |
| **Root** | the one node with no parent. A tree has exactly one, drawn at the :color[top]{hex="#EAB308"}. |
| **Edge** | the link from a parent down to a child. A tree with $n$ nodes has exactly $n-1$ edges. |
| **Parent** | the node directly above another. |
| **Child** | the node directly below another, on the left or on the right. |
| **Siblings** | two nodes with the same parent. |
| **Ancestors** | every node on the path from a node up to the root. |
| **Descendants** | every node below a node, all the way down. |
| **Leaf** (external node) | a node with **no** children, drawn in :color[green]{hex="#22C55E"} throughout. |
| **Internal node** | a node with at least one child. |
| **Subtree** | any node together with all of its descendants. Every node is the root of its own subtree. |
| **Level** | all the nodes at the same distance from the root. The root is level 0. |
| **Degree** of a node | how many children it has, so 0, 1 or 2. |
| **Size** | how many nodes the tree has in total. |

> **Subtree is the word that carries the weight.** Almost every definition and every algorithm in this chapter is written in terms of a node and its two subtrees, and then applied again inside each of them. Once you read a tree as a root with two smaller trees hanging off it, the recursion stops being a trick and becomes the obvious way to say things.

## Height and depth

These two are constantly mixed up, and they are measured in opposite directions.

- **Depth** of a node: how many edges from the **root down to it**. The root has depth 0. Depth is a property of a node.
- **Height** of a node: how many edges from it **down to its deepest leaf**. A leaf has height 0. The **height of the tree** is the height of its root.

![Depth measured from the root down beside height measured from a node down to its deepest leaf](/notes/img/algorithms/ch10-height-depth.svg)

Written as a recurrence, height is one line, and it is the shape of every algorithm in this chapter:

$$
height(node) = 1 + \max\big(height(left), \; height(right)\big), \qquad height(\text{empty}) = -1
$$

The $-1$ for an empty tree is what makes a single node come out at $1 + \max(-1,-1) = 0$.

> **The convention this chapter uses.** Height counts **edges**, so a single node has height 0 and an empty tree has height $-1$. Some courses count **nodes** on the path instead, which makes every height in this chapter exactly one larger. Check your own slides once, then be consistent: the marks come from the working, and an examiner will forgive the convention long before they forgive switching between the two halfway down the page.

## The kinds of binary tree

![Full, complete, perfect, balanced and degenerate binary trees side by side](/notes/img/algorithms/ch10-kinds.svg)

| Kind | The rule | The usual trap |
| --- | --- | --- |
| **Full** | every node has **either 0 or 2** children, never 1 | a single node with one child breaks it, no matter how tidy the rest is |
| **Complete** | every level is filled except possibly the last, and the last fills **from the left** | a gap on the left of the bottom row breaks it even if the tree looks even |
| **Perfect** | every level, including the last, is completely filled | only possible when the size is $2^{h+1}-1$, so 1, 3, 7, 15, 31 |
| **Balanced** | at **every** node, the two subtree heights differ by at most 1 | checking only the root is not enough |
| **Degenerate** | every node has one child, so the tree is a line | this is what an unlucky insertion order produces |

> **The balanced definition, exactly.** A binary tree is balanced if the difference in height between any node's left and right subtree is at most 1. The word doing the work is **:color[any]{hex="#EF4444"}**. A tree can be perfectly even at the root and still be unbalanced three levels down, so the check has to be made at every node.

Perfect implies complete, and perfect implies full. The other directions do not hold, and questions are built out of exactly that gap.

## Why the shape matters

Every operation in the second half of this chapter walks from the root to somewhere, so every cost is the **height**, not the size. The height is where all the difference between a good tree and a useless one lives.

| $n$ nodes | Height if balanced | Height if degenerate |
| --- | --- | --- |
| 7 | 2 | 6 |
| 15 | 3 | 14 |
| 1,000 | 9 | 999 |
| 1,000,000 | 19 | 999,999 |

A balanced tree has height $\lfloor \log_2 n \rfloor$, so a search is **:color[O(log n)]{hex="#22C55E"}**. A degenerate tree has height $n-1$, it is a linked list wearing a tree's clothes, and every operation collapses to **:color[O(n)]{hex="#EF4444"}**. Same code, same keys, million to one difference in work.

---

# The three traversals

To **traverse** a tree is to visit every node exactly once and write the values out in some order. A line has one obvious order. A tree has three, and they differ in exactly one thing: **when the root is dealt with, relative to its two subtrees**.

![The three traversal orders shown as the position of the root on a three node tree](/notes/img/algorithms/ch10-traversal-rule.svg)

| Traversal | Rule | Shorthand | The root comes out |
| --- | --- | --- | --- |
| **Pre-order** | **:color[Root, Left, Right]{hex="#FF5FA2"}** | RoLR | **first** |
| **In-order** | **:color[Left, Root, Right]{hex="#FF5FA2"}** | LRoR | **in the middle** |
| **Post-order** | **:color[Left, Right, Root]{hex="#FF5FA2"}** | LRRo | **last** |

:mark[**The rule applies at every node, not once at the top.**]{hex="#3A3A3E"} When the rule says Left, it means *do the whole left subtree by this same rule* before anything else. Nearly every wrong traversal in an exam is that sentence being skipped.

## Pre-order: Root, Left, Right

Deal with the node, then everything on its left, then everything on its right.

```
preorder(node):
    if node is None: return
    output node.value      # Root
    preorder(node.left)    # Left
    preorder(node.right)   # Right
```

![An animation of a pre-order traversal on a ten node binary tree](/notes/img/algorithms/ch10-preorder.svg)

Because the root is emitted before either subtree, a pre-order walk hands you **a node before any of its descendants**. That is why it is the traversal you use to **copy** a tree: insert the values in pre-order and the shape rebuilds itself exactly.

## In-order: Left, Root, Right

Everything on the left first, then the node, then everything on the right.

```
inorder(node):
    if node is None: return
    inorder(node.left)     # Left
    output node.value      # Root
    inorder(node.right)    # Right
```

![An animation of an in-order traversal on a ten node binary tree](/notes/img/algorithms/ch10-inorder.svg)

In-order is the one with a special property, and it only shows up later in this chapter: the in-order walk of a **:color[binary search tree]{hex="#22C55E"}** comes out **sorted**. On an ordinary binary tree it is just an order, but on a search tree it is a free correctness check, and this chapter uses it after every insertion and every deletion.

## Post-order: Left, Right, Root

Both subtrees first, the node last.

```
postorder(node):
    if node is None: return
    postorder(node.left)   # Left
    postorder(node.right)  # Right
    output node.value      # Root
```

![An animation of a post-order traversal on a ten node binary tree](/notes/img/algorithms/ch10-postorder.svg)

Post-order emits **every descendant before the node itself**, which is exactly what you want when you are **deleting** a tree or **freeing** it: you can never destroy a node while something below it still needs reaching. It is also how you evaluate an expression tree, because both operands are produced before the operator.

### Doing one by hand, in one pass

Under exam pressure the recursion is slow and easy to lose your place in. Use the outline trick instead.

Imagine drawing a loop that starts at the root, hugs the outside of the whole tree, and comes back. It passes every node **three times**: once on its left, once underneath it, once on its right. Which pass you write the node down on is the whole difference:

| Traversal | Write the node down when the loop passes |
| --- | --- |
| **Pre-order** | on its **left** side |
| **In-order** | **underneath** it |
| **Post-order** | on its **right** side |

One loop, three traversals, no stack to keep in your head. If a question asks for two of them, draw the loop once and read it off twice.

### Reading a traversal backwards

Questions often run the other way and hand you the output instead of the tree.

- The **first** value of a pre-order walk is always the **root**.
- The **last** value of a post-order walk is always the **root**.
- An in-order walk of a search tree is **sorted**, so it tells you the keys but nothing about the shape.

> **One traversal is never enough to rebuild a tree.** Pre-order gives you the root but no way to tell where the left subtree stops. Pair it with in-order, which splits the rest into everything-before-the-root and everything-after, and the tree is determined. **In-order plus pre-order** works, **in-order plus post-order** works, and **:color[pre-order plus post-order does not]{hex="#EF4444"}**, because neither of them can tell a single left child from a single right child.

---

# Binary search trees

A **binary search tree** is a binary tree with one extra rule imposed on the values, and that rule is what turns a shape into a data structure.

## The ordering rule

:mark[**For every node: every key in its left subtree is smaller, and every key in its right subtree is larger.**]{hex="#1B4A46"}

![A binary search tree beside a binary tree that breaks the ordering rule](/notes/img/algorithms/ch10-bst-property.svg)

The trap is the word **:color[subtree]{hex="#EF4444"}**. The rule is not about a node and its two children, it is about a node and **everything** beneath it on each side. A node can be larger than its parent and still be in the wrong place, because it also has to be on the correct side of its grandparent, and of every ancestor above that.

The quickest way to test a tree you have been handed is the in-order walk. If it is not sorted, it is not a search tree, and the first value out of order tells you which node is the problem.

## Searching, and find min and find max

Start at the root and compare. Equal means found. Smaller means the key can only be in the left subtree, so go left. Larger means go right. Run off the bottom and the key is not there.

```
search(node, key):
    while node is not None:
        if key == node.value: return node
        node = node.left if key < node.value else node.right
    return None            # ran out of tree, the key is absent
```

Every comparison discards an entire subtree, which is why the cost is the **height** and not the size.

![An animated search down a binary search tree, with the routes to the minimum and maximum marked](/notes/img/algorithms/ch10-bst-search.svg)

**Find min and find max need no comparisons at all.** The smallest key has nothing smaller than it, so nothing can be on its left, so it is the node you reach by going **left until you cannot**. The largest is the same walk to the **right**. Neither is a search: there are no decisions to make, only one direction to keep taking.

```
minimum(node):                 maximum(node):
    while node.left:               while node.right:
        node = node.left               node = node.right
    return node                    return node
```

> Note that the minimum is **not** always a leaf. If it has a right child, it is an internal node. What it can never have is a left child.

## Inserting

Insertion is a search that failed, with a node put where the search stopped.

Walk down exactly as a search would. When the walk asks for a child that is not there, that empty spot is the only place the key can legally go, so put it there.

![An animation inserting a key into a binary search tree as a new leaf](/notes/img/algorithms/ch10-bst-insert.svg)

:mark[**A newly inserted key always becomes a leaf. Nothing already in the tree ever moves.**]{hex="#1B4A46"}

That is worth saying twice, because it is the most common way to lose marks on a drawing question. You are not allowed to rebalance, rotate or reorder anything to make the picture look nicer. Whatever the walk produces is the answer, however lopsided.

A key that is already present is normally **not** inserted again, which keeps the keys a set. Watch for this in questions that feed a traversal into a tree that already shares some of those values: the duplicates are quietly dropped, and the mark scheme expects you to say so rather than draw a second copy.

### The order you insert in decides the shape

![The same seven keys inserted in two orders, giving a balanced tree and a degenerate one](/notes/img/algorithms/ch10-insert-order.svg)

Same seven keys, same algorithm, two different trees. Insert them in the middle-out order and you get a perfect tree of height 2. Insert them already sorted and every key is larger than the last, so every one goes right, and you get a **:color[degenerate]{hex="#EF4444"}** tree of height 6: a linked list with extra steps.

This is the worst case, and it is not a rare one. **Sorted input is the input that breaks a plain search tree**, and sorted input is extremely common. Searching the good tree takes 3 comparisons, the bad one takes 7. At a thousand keys it is 10 against 1,000. Self balancing trees, AVL and red-black, exist entirely to stop this, by rotating after an insert so the height stays $O(\log n)$ whatever order the keys arrive in.

## Deleting

Deletion is the only operation with real cases in it, because removing a node leaves a hole that its children still have to hang from. Find the node first, then apply whichever of three situations it is in.

![The three cases of deleting a node from a binary search tree](/notes/img/algorithms/ch10-bst-delete.svg)

| Case | The node has | What to do |
| --- | --- | --- |
| **1** | no children, it is a :color[leaf]{hex="#22C55E"} | detach it. Nothing else changes. |
| **2** | exactly :color[one child]{hex="#5B8CFF"} | lift that child, and everything below it, into the gap. |
| **3** | :color[two children]{hex="#FF5FA2"} | copy in its **in-order successor**, then delete that successor from the right subtree. |

Cases 1 and 2 are obvious once you see them. Case 3 is the one worth understanding rather than memorising.

The node has two subtrees hanging off it and only one value can sit in the hole, so which value can go there without breaking the ordering rule? It has to be larger than everything on the left and smaller than everything on the right, and there are only two keys in the whole tree that qualify: the largest key on the left, or the smallest key on the right. The second of those is the **in-order successor**, and it is the convention this chapter uses.

Finding it is the walk you already know: go **:color[one step right]{hex="#2DD4BF"}**, then **:color[left until you cannot]{hex="#2DD4BF"}**. Copy its value into the node, then delete the successor from the right subtree. That second deletion is always easy, because the smallest node in a subtree has no left child, so it is a case 1 or a case 2 and the recursion stops.

### Deleting the root

![An animation deleting the root of a binary search tree using its in-order successor](/notes/img/algorithms/ch10-delete-root.svg)

Deleting the root is **not** a fourth case. The same three rules apply to it, and if it has two children then case 3 handles it exactly as it handles any other node. The only difference worth noticing is cosmetic: the tree ends up with a different value at the top, so the picture changes more than the structure does.

The one genuinely special situation is deleting the root of a tree that has **only** the root. Then the tree becomes empty, and whatever variable was pointing at the root now points at nothing.

## What everything costs

$h$ is the height of the tree. Every operation is a walk from the root, so every operation is $O(h)$, and the only question is what $h$ is.

| Operation | Balanced | Degenerate | Why |
| --- | --- | --- | --- |
| Search | :color[O(log n)]{hex="#A78BFA"} | :color[O(n)]{hex="#EF4444"} | one walk from the root |
| Find min or max | :color[O(log n)]{hex="#A78BFA"} | :color[O(n)]{hex="#EF4444"} | one walk, no comparisons |
| Insert | :color[O(log n)]{hex="#A78BFA"} | :color[O(n)]{hex="#EF4444"} | a failed search, then one link |
| Delete | :color[O(log n)]{hex="#A78BFA"} | :color[O(n)]{hex="#EF4444"} | a search, then at most one more walk down |
| Any traversal | :color[O(n)]{hex="#22C55E"} | :color[O(n)]{hex="#22C55E"} | every node is visited once, shape is irrelevant |
| Space | :color[O(n)]{hex="#22C55E"} | :color[O(n)]{hex="#22C55E"} | one node per key |

The traversal row is the one that does not move. Visiting everything costs everything, however the tree is shaped. Recursion adds $O(h)$ of stack on top of that, which is another reason a degenerate tree is unpleasant: a recursive traversal of a million-node line is a million frames deep.

## The marks: what to write down

These questions are marked on the working, and the working is short. What earns the marks:

1. **For a traversal**, write the rule you are using once, at the top: Root Left Right, or Left Root Right, or Left Right Root. Then the sequence. A wrong sequence with the right rule stated usually keeps a mark; a right sequence with nothing else earns exactly what it is.
2. **For a height**, say which convention you are counting in. One clause is enough.
3. **For is-it-full**, name the offending node. "No" on its own is not a justification, and "node 7 has only one child" is the entire answer.
4. **For an insertion**, show the route down for each key, not only the final picture. If the drawing goes wrong at the third key, the routes for the first two are still worth something.
5. **For a deletion**, name the case and name the successor before you draw. Two sentences.
6. **Draw the final tree**, always, even when the question only says state. It is faster than describing it and it is what the mark scheme is holding.

And the free check: **the in-order walk of your finished search tree must be sorted**. It takes ten seconds and it catches almost every mistake this topic can produce.

---

# Examples

Both of these are past exam questions, worked exactly as they should be written out.

## Example 1: reading a tree

![Figure 1, a binary tree of 10 nodes](/notes/img/algorithms/ch10-ex1.svg)

**(a)** List all the leaf nodes of the tree. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree. &nbsp; :mark[**1 mark**]{hex="#3A3A3E"}

**(c)** Is this a full binary tree? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(d)** Write down the **post-order** traversal of the tree. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The leaf nodes.**

A leaf is a node with no children at all, so read the bottom of every branch.

:mark[**Answer: 2, 11, 20, 4, 3** &nbsp; (5 leaves)]{hex="#204A2E"}

**(b) The height.**

Count the **edges** on the longest root to leaf path. The deepest leaf is :color[11]{hex="#22C55E"}, reached by 5 to 10 to 7 to 11, which is **3 edges**.

:mark[**Answer: height 3** &nbsp; (counting nodes instead gives 4)]{hex="#204A2E"}

**(c) Is it full?**

A tree is full when **every** node has either no children or exactly two. So one node with a single child is enough to break it, and here node :color[7]{hex="#EF4444"} has exactly one child.

:mark[**Answer: no.** Node 7 has only one child.]{hex="#5C2323"}

**(d) The post-order traversal.**

The rule is **:color[Left, Right, Root]{hex="#FF5FA2"}**, applied at **every** node.

| Taken in this order | Gives |
| --- | --- |
| left subtree | `2, 11, 7, 10` |
| right subtree | `20, 4, 9, 3, 2` |
| root 5 | `5` |

**Answer:** :color[2]{hex="#22C55E"}, :color[11]{hex="#22C55E"}, 7, 10, :color[20]{hex="#22C55E"}, :color[4]{hex="#22C55E"}, 9, :color[3]{hex="#22C55E"}, 2, :color[5]{hex="#EAB308"}

:mark[**2, 11, 7, 10, 20, 4, 9, 3, 2, 5**]{hex="#204A2E"}

> Check: the root :color[5]{hex="#EAB308"} is **last**, which it always is in post-order.

## Example 2: a traversal feeding a search tree

![Figure (a), a binary tree](/notes/img/algorithms/ch10-ex2a.svg)

![Figure (b), a binary search tree](/notes/img/algorithms/ch10-ex2b.svg)

**(i)** Write down the **post-order** traversal of the tree in **figure (a)**. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Insert the values obtained in **(i)**, in that order, into the binary search tree in **figure (b)**. Draw the resulting tree. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(iii)** State the height of the search tree before and after the insertions. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The post-order traversal of figure (a).**

The rule is **:color[Left, Right, Root]{hex="#FF5FA2"}**, applied at every node.

**Answer:** :color[11]{hex="#22C55E"}, 10, :color[9]{hex="#22C55E"}, :color[8]{hex="#22C55E"}, 2, :color[12]{hex="#EAB308"}

:mark[**11, 10, 9, 8, 2, 12**]{hex="#204A2E"}

**(ii) Inserting those values into figure (b).**

Every insertion starts at the root and walks down: **smaller goes left, larger goes right**. The key becomes a new leaf wherever the walk runs out of tree. Nothing is ever rearranged, and a key already present is not added twice.

| Key | Route from the root | What happens |
| --- | --- | --- |
| :color[11]{hex="#2DD4BF"} | `8 to 10 to 14 to 13` | 11 becomes the left child of 13 |
| :color[10]{hex="#EF4444"} | `8 to 10` | 10 is already in the tree, so nothing is added |
| :color[9]{hex="#2DD4BF"} | `8 to 10` | 9 becomes the left child of 10 |
| :color[8]{hex="#EF4444"} | `8` | 8 is already in the tree, so nothing is added |
| :color[2]{hex="#2DD4BF"} | `8 to 3 to 1` | 2 becomes the right child of 1 |
| :color[12]{hex="#2DD4BF"} | `8 to 10 to 14 to 13 to 11` | 12 becomes the right child of 11 |

> The trap in this question: :color[10, 8]{hex="#EF4444"} are already in the tree, so they add nothing. Duplicates are not stored twice.

![The search tree after the insertions](/notes/img/algorithms/ch10-ex2c.svg)

:mark[**In-order check: 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14**]{hex="#204A2E"}

> That check is worth doing every time. The in-order walk of a correct search tree is the sorted list of its keys, so if it comes out sorted, the tree is right.

**(iii) Height before and after.**

Before: **3**. After: **5**. The insertions all landed down one side, so the tree got **2** levels taller and no better balanced.

:mark[**Answer: 3 before, 5 after**]{hex="#204A2E"}

---

# 32 practice questions

Three shapes, matching the three ways this topic is asked. Every tree here is drawn from the same specification that produced its answer, so the pictures and the solutions cannot disagree.

| Part | Shape | Questions |
| --- | --- | --- |
| **A** | one tree, read it | Q1 to Q12 |
| **B** | a traversal feeding a search tree | Q13 to Q22 |
| **C** | search tree operations | Q23 to Q32 |

## Part A: read the tree

Leaves, height, full or not, and one traversal. The same four parts as the exam question in Example 1, over twelve different shapes.

### Q1. Read the tree

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**9 marks**]{hex="#3A3A3E"}

![A binary tree of 7 nodes](/notes/img/algorithms/ch10-q1.svg)

**(a)** List all the leaf nodes of the tree. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree. &nbsp; :mark[**1 mark**]{hex="#3A3A3E"}

**(c)** Is this a full binary tree? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(d)** Write down the **post-order** traversal of the tree. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The leaf nodes.**

A leaf is a node with no children at all, so read the bottom of every branch.

:mark[**Answer: 1, 3, 5, 7** &nbsp; (4 leaves)]{hex="#204A2E"}

**(b) The height.**

Count the **edges** on the longest root to leaf path. The deepest leaf is :color[1]{hex="#22C55E"}, reached by 4 to 2 to 1, which is **2 edges**.

:mark[**Answer: height 2** &nbsp; (counting nodes instead gives 3)]{hex="#204A2E"}

**(c) Is it full?**

A tree is full when **every** node has either no children or exactly two. Check each internal node in turn: none of them has a single child.

:mark[**Answer: yes, it is full.** Every node has 0 or 2 children.]{hex="#204A2E"}

**(d) The post-order traversal.**

The rule is **:color[Left, Right, Root]{hex="#FF5FA2"}**, applied at **every** node.

| Taken in this order | Gives |
| --- | --- |
| left subtree | `1, 3, 2` |
| right subtree | `5, 7, 6` |
| root 4 | `4` |

**Answer:** :color[1]{hex="#22C55E"}, :color[3]{hex="#22C55E"}, 2, :color[5]{hex="#22C55E"}, :color[7]{hex="#22C55E"}, 6, :color[4]{hex="#EAB308"}

:mark[**1, 3, 2, 5, 7, 6, 4**]{hex="#204A2E"}

> Check: the root :color[4]{hex="#EAB308"} is **last**, which it always is in post-order.

### Q2. Read the tree

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**9 marks**]{hex="#3A3A3E"}

![A binary tree of 6 nodes](/notes/img/algorithms/ch10-q2.svg)

**(a)** List all the leaf nodes of the tree. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree. &nbsp; :mark[**1 mark**]{hex="#3A3A3E"}

**(c)** Is this a full binary tree? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(d)** Write down the **in-order** traversal of the tree. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The leaf nodes.**

A leaf is a node with no children at all, so read the bottom of every branch.

:mark[**Answer: 1, 6, 14** &nbsp; (3 leaves)]{hex="#204A2E"}

**(b) The height.**

Count the **edges** on the longest root to leaf path. The deepest leaf is :color[1]{hex="#22C55E"}, reached by 8 to 3 to 1, which is **2 edges**.

:mark[**Answer: height 2** &nbsp; (counting nodes instead gives 3)]{hex="#204A2E"}

**(c) Is it full?**

A tree is full when **every** node has either no children or exactly two. So one node with a single child is enough to break it, and here node :color[10]{hex="#EF4444"} has exactly one child.

:mark[**Answer: no.** Node 10 has only one child.]{hex="#5C2323"}

**(d) The in-order traversal.**

The rule is **:color[Left, Root, Right]{hex="#FF5FA2"}**, applied at **every** node.

| Taken in this order | Gives |
| --- | --- |
| left subtree | `1, 3, 6` |
| root 8 | `8` |
| right subtree | `10, 14` |

**Answer:** :color[1]{hex="#22C55E"}, 3, :color[6]{hex="#22C55E"}, :color[8]{hex="#EAB308"}, 10, :color[14]{hex="#22C55E"}

:mark[**1, 3, 6, 8, 10, 14**]{hex="#204A2E"}

> Check: the root :color[8]{hex="#EAB308"} sits with the whole left subtree (3 nodes) before it and the whole right subtree after it.

### Q3. Read the tree

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**9 marks**]{hex="#3A3A3E"}

![A binary tree of 7 nodes](/notes/img/algorithms/ch10-q3.svg)

**(a)** List all the leaf nodes of the tree. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree. &nbsp; :mark[**1 mark**]{hex="#3A3A3E"}

**(c)** Is this a full binary tree? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(d)** Write down the **pre-order** traversal of the tree. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The leaf nodes.**

A leaf is a node with no children at all, so read the bottom of every branch.

:mark[**Answer: 4, 5, 6, 7** &nbsp; (4 leaves)]{hex="#204A2E"}

**(b) The height.**

Count the **edges** on the longest root to leaf path. The deepest leaf is :color[4]{hex="#22C55E"}, reached by 1 to 2 to 4, which is **2 edges**.

:mark[**Answer: height 2** &nbsp; (counting nodes instead gives 3)]{hex="#204A2E"}

**(c) Is it full?**

A tree is full when **every** node has either no children or exactly two. Check each internal node in turn: none of them has a single child.

:mark[**Answer: yes, it is full.** Every node has 0 or 2 children.]{hex="#204A2E"}

**(d) The pre-order traversal.**

The rule is **:color[Root, Left, Right]{hex="#FF5FA2"}**, applied at **every** node.

| Taken in this order | Gives |
| --- | --- |
| root 1 | `1` |
| left subtree | `2, 4, 5` |
| right subtree | `3, 6, 7` |

**Answer:** :color[1]{hex="#EAB308"}, 2, :color[4]{hex="#22C55E"}, :color[5]{hex="#22C55E"}, 3, :color[6]{hex="#22C55E"}, :color[7]{hex="#22C55E"}

:mark[**1, 2, 4, 5, 3, 6, 7**]{hex="#204A2E"}

> Check: the root :color[1]{hex="#EAB308"} is **first**, which it always is in pre-order.

### Q4. Read the tree

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**9 marks**]{hex="#3A3A3E"}

![A binary tree of 9 nodes](/notes/img/algorithms/ch10-q4.svg)

**(a)** List all the leaf nodes of the tree. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree. &nbsp; :mark[**1 mark**]{hex="#3A3A3E"}

**(c)** Is this a full binary tree? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(d)** Write down the **post-order** traversal of the tree. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The leaf nodes.**

A leaf is a node with no children at all, so read the bottom of every branch.

:mark[**Answer: 1, 7, 11, 20** &nbsp; (4 leaves)]{hex="#204A2E"}

**(b) The height.**

Count the **edges** on the longest root to leaf path. The deepest leaf is :color[1]{hex="#22C55E"}, reached by 9 to 5 to 2 to 1, which is **3 edges**.

:mark[**Answer: height 3** &nbsp; (counting nodes instead gives 4)]{hex="#204A2E"}

**(c) Is it full?**

A tree is full when **every** node has either no children or exactly two. So one node with a single child is enough to break it, and here nodes :color[2]{hex="#EF4444"}, :color[15]{hex="#EF4444"} have exactly one child.

:mark[**Answer: no.** Nodes 2, 15 have only one child.]{hex="#5C2323"}

**(d) The post-order traversal.**

The rule is **:color[Left, Right, Root]{hex="#FF5FA2"}**, applied at **every** node.

| Taken in this order | Gives |
| --- | --- |
| left subtree | `1, 2, 7, 5` |
| right subtree | `11, 20, 15, 12` |
| root 9 | `9` |

**Answer:** :color[1]{hex="#22C55E"}, 2, :color[7]{hex="#22C55E"}, 5, :color[11]{hex="#22C55E"}, :color[20]{hex="#22C55E"}, 15, 12, :color[9]{hex="#EAB308"}

:mark[**1, 2, 7, 5, 11, 20, 15, 12, 9**]{hex="#204A2E"}

> Check: the root :color[9]{hex="#EAB308"} is **last**, which it always is in post-order.

### Q5. Read the tree

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**9 marks**]{hex="#3A3A3E"}

![A binary tree of 11 nodes](/notes/img/algorithms/ch10-q5.svg)

**(a)** List all the leaf nodes of the tree. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree. &nbsp; :mark[**1 mark**]{hex="#3A3A3E"}

**(c)** Is this a full binary tree? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(d)** Write down the **in-order** traversal of the tree. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The leaf nodes.**

A leaf is a node with no children at all, so read the bottom of every branch.

:mark[**Answer: 4, 12, 25, 41, 58, 70** &nbsp; (6 leaves)]{hex="#204A2E"}

**(b) The height.**

Count the **edges** on the longest root to leaf path. The deepest leaf is :color[4]{hex="#22C55E"}, reached by 30 to 18 to 9 to 4, which is **3 edges**.

:mark[**Answer: height 3** &nbsp; (counting nodes instead gives 4)]{hex="#204A2E"}

**(c) Is it full?**

A tree is full when **every** node has either no children or exactly two. Check each internal node in turn: none of them has a single child.

:mark[**Answer: yes, it is full.** Every node has 0 or 2 children.]{hex="#204A2E"}

**(d) The in-order traversal.**

The rule is **:color[Left, Root, Right]{hex="#FF5FA2"}**, applied at **every** node.

| Taken in this order | Gives |
| --- | --- |
| left subtree | `4, 9, 12, 18, 25` |
| root 30 | `30` |
| right subtree | `41, 52, 58, 63, 70` |

**Answer:** :color[4]{hex="#22C55E"}, 9, :color[12]{hex="#22C55E"}, 18, :color[25]{hex="#22C55E"}, :color[30]{hex="#EAB308"}, :color[41]{hex="#22C55E"}, 52, :color[58]{hex="#22C55E"}, 63, :color[70]{hex="#22C55E"}

:mark[**4, 9, 12, 18, 25, 30, 41, 52, 58, 63, 70**]{hex="#204A2E"}

> Check: the root :color[30]{hex="#EAB308"} sits with the whole left subtree (5 nodes) before it and the whole right subtree after it.

### Q6. Read the tree

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**9 marks**]{hex="#3A3A3E"}

![A binary tree of 9 nodes](/notes/img/algorithms/ch10-q6.svg)

**(a)** List all the leaf nodes of the tree. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree. &nbsp; :mark[**1 mark**]{hex="#3A3A3E"}

**(c)** Is this a full binary tree? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(d)** Write down the **pre-order** traversal of the tree. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The leaf nodes.**

A leaf is a node with no children at all, so read the bottom of every branch.

:mark[**Answer: 2, 4, 6, 9** &nbsp; (4 leaves)]{hex="#204A2E"}

**(b) The height.**

Count the **edges** on the longest root to leaf path. The deepest leaf is :color[2]{hex="#22C55E"}, reached by 7 to 3 to 1 to 2, which is **3 edges**.

:mark[**Answer: height 3** &nbsp; (counting nodes instead gives 4)]{hex="#204A2E"}

**(c) Is it full?**

A tree is full when **every** node has either no children or exactly two. So one node with a single child is enough to break it, and here nodes :color[1]{hex="#EF4444"}, :color[11]{hex="#EF4444"} have exactly one child.

:mark[**Answer: no.** Nodes 1, 11 have only one child.]{hex="#5C2323"}

**(d) The pre-order traversal.**

The rule is **:color[Root, Left, Right]{hex="#FF5FA2"}**, applied at **every** node.

| Taken in this order | Gives |
| --- | --- |
| root 7 | `7` |
| left subtree | `3, 1, 2, 5, 4, 6` |
| right subtree | `11, 9` |

**Answer:** :color[7]{hex="#EAB308"}, 3, 1, :color[2]{hex="#22C55E"}, 5, :color[4]{hex="#22C55E"}, :color[6]{hex="#22C55E"}, 11, :color[9]{hex="#22C55E"}

:mark[**7, 3, 1, 2, 5, 4, 6, 11, 9**]{hex="#204A2E"}

> Check: the root :color[7]{hex="#EAB308"} is **first**, which it always is in pre-order.

### Q7. Read the tree

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**9 marks**]{hex="#3A3A3E"}

![A binary tree of 10 nodes](/notes/img/algorithms/ch10-q7.svg)

**(a)** List all the leaf nodes of the tree. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree. &nbsp; :mark[**1 mark**]{hex="#3A3A3E"}

**(c)** Is this a full binary tree? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(d)** Write down the **post-order** traversal of the tree. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The leaf nodes.**

A leaf is a node with no children at all, so read the bottom of every branch.

:mark[**Answer: 12, 30, 55, 68, 90** &nbsp; (5 leaves)]{hex="#204A2E"}

**(b) The height.**

Count the **edges** on the longest root to leaf path. The deepest leaf is :color[30]{hex="#22C55E"}, reached by 50 to 25 to 37 to 30, which is **3 edges**.

:mark[**Answer: height 3** &nbsp; (counting nodes instead gives 4)]{hex="#204A2E"}

**(c) Is it full?**

A tree is full when **every** node has either no children or exactly two. So one node with a single child is enough to break it, and here node :color[37]{hex="#EF4444"} has exactly one child.

:mark[**Answer: no.** Node 37 has only one child.]{hex="#5C2323"}

**(d) The post-order traversal.**

The rule is **:color[Left, Right, Root]{hex="#FF5FA2"}**, applied at **every** node.

| Taken in this order | Gives |
| --- | --- |
| left subtree | `12, 30, 37, 25` |
| right subtree | `55, 68, 60, 90, 75` |
| root 50 | `50` |

**Answer:** :color[12]{hex="#22C55E"}, :color[30]{hex="#22C55E"}, 37, 25, :color[55]{hex="#22C55E"}, :color[68]{hex="#22C55E"}, 60, :color[90]{hex="#22C55E"}, 75, :color[50]{hex="#EAB308"}

:mark[**12, 30, 37, 25, 55, 68, 60, 90, 75, 50**]{hex="#204A2E"}

> Check: the root :color[50]{hex="#EAB308"} is **last**, which it always is in post-order.

### Q8. Read the tree

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

![A binary tree of 11 nodes](/notes/img/algorithms/ch10-q8.svg)

**(a)** List all the leaf nodes of the tree. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree. &nbsp; :mark[**1 mark**]{hex="#3A3A3E"}

**(c)** Is this a full binary tree? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(d)** Write down the **post-order** traversal of the tree. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

**(e)** Is the tree balanced? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The leaf nodes.**

A leaf is a node with no children at all, so read the bottom of every branch.

:mark[**Answer: 40, 60, 70, 15, 25** &nbsp; (5 leaves)]{hex="#204A2E"}

**(b) The height.**

Count the **edges** on the longest root to leaf path. The deepest leaf is :color[40]{hex="#22C55E"}, reached by 10 to 20 to 30 to 40, which is **3 edges**.

:mark[**Answer: height 3** &nbsp; (counting nodes instead gives 4)]{hex="#204A2E"}

**(c) Is it full?**

A tree is full when **every** node has either no children or exactly two. So one node with a single child is enough to break it, and here nodes :color[30]{hex="#EF4444"}, :color[80]{hex="#EF4444"} have exactly one child.

:mark[**Answer: no.** Nodes 30, 80 have only one child.]{hex="#5C2323"}

**(d) The post-order traversal.**

The rule is **:color[Left, Right, Root]{hex="#FF5FA2"}**, applied at **every** node.

| Taken in this order | Gives |
| --- | --- |
| left subtree | `40, 30, 60, 70, 50, 20` |
| right subtree | `15, 25, 90, 80` |
| root 10 | `10` |

**Answer:** :color[40]{hex="#22C55E"}, 30, :color[60]{hex="#22C55E"}, :color[70]{hex="#22C55E"}, 50, 20, :color[15]{hex="#22C55E"}, :color[25]{hex="#22C55E"}, 90, 80, :color[10]{hex="#EAB308"}

:mark[**40, 30, 60, 70, 50, 20, 15, 25, 90, 80, 10**]{hex="#204A2E"}

> Check: the root :color[10]{hex="#EAB308"} is **last**, which it always is in post-order.

**(e) Is it balanced?**

Balanced means that at **every** node the left and right subtree heights differ by at most one. Checking the root alone is not enough.

Node :color[80]{hex="#EF4444"} has a left subtree of height **-1** and a right subtree of height **1**, a difference of **2**.

:mark[**Answer: no.** Node 80 fails, -1 against 1.]{hex="#5C2323"}

### Q9. Read the tree

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

![A binary tree of 11 nodes](/notes/img/algorithms/ch10-q9.svg)

**(a)** List all the leaf nodes of the tree. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree. &nbsp; :mark[**1 mark**]{hex="#3A3A3E"}

**(c)** Is this a full binary tree? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(d)** Write down the **in-order** traversal of the tree. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

**(e)** Is the tree balanced? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The leaf nodes.**

A leaf is a node with no children at all, so read the bottom of every branch.

:mark[**Answer: 3, 5, 7, 9, 11** &nbsp; (5 leaves)]{hex="#204A2E"}

**(b) The height.**

Count the **edges** on the longest root to leaf path. The deepest leaf is :color[3]{hex="#22C55E"}, reached by 6 to 2 to 1 to 3, which is **3 edges**.

:mark[**Answer: height 3** &nbsp; (counting nodes instead gives 4)]{hex="#204A2E"}

**(c) Is it full?**

A tree is full when **every** node has either no children or exactly two. So one node with a single child is enough to break it, and here nodes :color[1]{hex="#EF4444"}, :color[4]{hex="#EF4444"} have exactly one child.

:mark[**Answer: no.** Nodes 1, 4 have only one child.]{hex="#5C2323"}

**(d) The in-order traversal.**

The rule is **:color[Left, Root, Right]{hex="#FF5FA2"}**, applied at **every** node.

| Taken in this order | Gives |
| --- | --- |
| left subtree | `1, 3, 2, 4, 5` |
| root 6 | `6` |
| right subtree | `7, 8, 9, 10, 11` |

**Answer:** 1, :color[3]{hex="#22C55E"}, 2, 4, :color[5]{hex="#22C55E"}, :color[6]{hex="#EAB308"}, :color[7]{hex="#22C55E"}, 8, :color[9]{hex="#22C55E"}, 10, :color[11]{hex="#22C55E"}

:mark[**1, 3, 2, 4, 5, 6, 7, 8, 9, 10, 11**]{hex="#204A2E"}

> Check: the root :color[6]{hex="#EAB308"} sits with the whole left subtree (5 nodes) before it and the whole right subtree after it.

**(e) Is it balanced?**

Balanced means that at **every** node the left and right subtree heights differ by at most one. Checking the root alone is not enough.

:mark[**Answer: yes.** No node has subtrees differing by more than one.]{hex="#204A2E"}

### Q10. Read the tree

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

![A binary tree of 12 nodes](/notes/img/algorithms/ch10-q10.svg)

**(a)** List all the leaf nodes of the tree. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree. &nbsp; :mark[**1 mark**]{hex="#3A3A3E"}

**(c)** Is this a full binary tree? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(d)** Write down the **pre-order** traversal of the tree. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

**(e)** Is the tree balanced? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The leaf nodes.**

A leaf is a node with no children at all, so read the bottom of every branch.

:mark[**Answer: 6, 30, 60, 120, 175, 250** &nbsp; (6 leaves)]{hex="#204A2E"}

**(b) The height.**

Count the **edges** on the longest root to leaf path. The deepest leaf is :color[6]{hex="#22C55E"}, reached by 100 to 50 to 25 to 12 to 6, which is **4 edges**.

:mark[**Answer: height 4** &nbsp; (counting nodes instead gives 5)]{hex="#204A2E"}

**(c) Is it full?**

A tree is full when **every** node has either no children or exactly two. So one node with a single child is enough to break it, and here node :color[12]{hex="#EF4444"} has exactly one child.

:mark[**Answer: no.** Node 12 has only one child.]{hex="#5C2323"}

**(d) The pre-order traversal.**

The rule is **:color[Root, Left, Right]{hex="#FF5FA2"}**, applied at **every** node.

| Taken in this order | Gives |
| --- | --- |
| root 100 | `100` |
| left subtree | `50, 25, 12, 6, 30, 60` |
| right subtree | `150, 120, 200, 175, 250` |

**Answer:** :color[100]{hex="#EAB308"}, 50, 25, 12, :color[6]{hex="#22C55E"}, :color[30]{hex="#22C55E"}, :color[60]{hex="#22C55E"}, 150, :color[120]{hex="#22C55E"}, 200, :color[175]{hex="#22C55E"}, :color[250]{hex="#22C55E"}

:mark[**100, 50, 25, 12, 6, 30, 60, 150, 120, 200, 175, 250**]{hex="#204A2E"}

> Check: the root :color[100]{hex="#EAB308"} is **first**, which it always is in pre-order.

**(e) Is it balanced?**

Balanced means that at **every** node the left and right subtree heights differ by at most one. Checking the root alone is not enough.

Node :color[50]{hex="#EF4444"} has a left subtree of height **2** and a right subtree of height **0**, a difference of **2**.

:mark[**Answer: no.** Node 50 fails, 2 against 0.]{hex="#5C2323"}

### Q11. Read the tree

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

![A binary tree of 11 nodes](/notes/img/algorithms/ch10-q11.svg)

**(a)** List all the leaf nodes of the tree. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree. &nbsp; :mark[**1 mark**]{hex="#3A3A3E"}

**(c)** Is this a full binary tree? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(d)** Write down the **post-order** traversal of the tree. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

**(e)** Is the tree balanced? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The leaf nodes.**

A leaf is a node with no children at all, so read the bottom of every branch.

:mark[**Answer: 1, 5, 11, 15, 22** &nbsp; (5 leaves)]{hex="#204A2E"}

**(b) The height.**

Count the **edges** on the longest root to leaf path. The deepest leaf is :color[1]{hex="#22C55E"}, reached by 12 to 7 to 3 to 1, which is **3 edges**.

:mark[**Answer: height 3** &nbsp; (counting nodes instead gives 4)]{hex="#204A2E"}

**(c) Is it full?**

A tree is full when **every** node has either no children or exactly two. So one node with a single child is enough to break it, and here nodes :color[9]{hex="#EF4444"}, :color[25]{hex="#EF4444"} have exactly one child.

:mark[**Answer: no.** Nodes 9, 25 have only one child.]{hex="#5C2323"}

**(d) The post-order traversal.**

The rule is **:color[Left, Right, Root]{hex="#FF5FA2"}**, applied at **every** node.

| Taken in this order | Gives |
| --- | --- |
| left subtree | `1, 5, 3, 11, 9, 7` |
| right subtree | `15, 22, 25, 20` |
| root 12 | `12` |

**Answer:** :color[1]{hex="#22C55E"}, :color[5]{hex="#22C55E"}, 3, :color[11]{hex="#22C55E"}, 9, 7, :color[15]{hex="#22C55E"}, :color[22]{hex="#22C55E"}, 25, 20, :color[12]{hex="#EAB308"}

:mark[**1, 5, 3, 11, 9, 7, 15, 22, 25, 20, 12**]{hex="#204A2E"}

> Check: the root :color[12]{hex="#EAB308"} is **last**, which it always is in post-order.

**(e) Is it balanced?**

Balanced means that at **every** node the left and right subtree heights differ by at most one. Checking the root alone is not enough.

:mark[**Answer: yes.** No node has subtrees differing by more than one.]{hex="#204A2E"}

### Q12. Read the tree

> :mark[**Very hard**]{hex="#5C2323"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

![A binary tree of 13 nodes](/notes/img/algorithms/ch10-q12.svg)

**(a)** List all the leaf nodes of the tree. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(b)** State the height of the tree. &nbsp; :mark[**1 mark**]{hex="#3A3A3E"}

**(c)** Is this a full binary tree? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**(d)** Write down the **post-order** traversal of the tree. &nbsp; :mark[**5 marks**]{hex="#3A3A3E"}

**(e)** Is the tree balanced? Justify your answer. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(a) The leaf nodes.**

A leaf is a node with no children at all, so read the bottom of every branch.

:mark[**Answer: 16, 9, 10, 11, 12, 7** &nbsp; (6 leaves)]{hex="#204A2E"}

**(b) The height.**

Count the **edges** on the longest root to leaf path. The deepest leaf is :color[16]{hex="#22C55E"}, reached by 1 to 2 to 4 to 8 to 16, which is **4 edges**.

:mark[**Answer: height 4** &nbsp; (counting nodes instead gives 5)]{hex="#204A2E"}

**(c) Is it full?**

A tree is full when **every** node has either no children or exactly two. So one node with a single child is enough to break it, and here nodes :color[8]{hex="#EF4444"}, :color[6]{hex="#EF4444"} have exactly one child.

:mark[**Answer: no.** Nodes 8, 6 have only one child.]{hex="#5C2323"}

**(d) The post-order traversal.**

The rule is **:color[Left, Right, Root]{hex="#FF5FA2"}**, applied at **every** node.

| Taken in this order | Gives |
| --- | --- |
| left subtree | `16, 8, 9, 4, 10, 11, 5, 2` |
| right subtree | `12, 6, 7, 3` |
| root 1 | `1` |

**Answer:** :color[16]{hex="#22C55E"}, 8, :color[9]{hex="#22C55E"}, 4, :color[10]{hex="#22C55E"}, :color[11]{hex="#22C55E"}, 5, 2, :color[12]{hex="#22C55E"}, 6, :color[7]{hex="#22C55E"}, 3, :color[1]{hex="#EAB308"}

:mark[**16, 8, 9, 4, 10, 11, 5, 2, 12, 6, 7, 3, 1**]{hex="#204A2E"}

> Check: the root :color[1]{hex="#EAB308"} is **last**, which it always is in post-order.

**(e) Is it balanced?**

Balanced means that at **every** node the left and right subtree heights differ by at most one. Checking the root alone is not enough.

:mark[**Answer: yes.** No node has subtrees differing by more than one.]{hex="#204A2E"}

## Part B: a traversal feeding a search tree

Take a traversal off one tree, then insert those values into another. The shape of Example 2, and the place where duplicates and height changes are usually hiding.

### Q13. Traverse, then insert

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

![Figure (a), a binary tree](/notes/img/algorithms/ch10-q13a.svg)

![Figure (b), a binary search tree](/notes/img/algorithms/ch10-q13b.svg)

**(i)** Write down the **post-order** traversal of the tree in **figure (a)**. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Insert the values obtained in **(i)**, in that order, into the binary search tree in **figure (b)**. Draw the resulting tree. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(iii)** State the height of the search tree before and after the insertions. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The post-order traversal of figure (a).**

The rule is **:color[Left, Right, Root]{hex="#FF5FA2"}**, applied at every node.

**Answer:** :color[4]{hex="#22C55E"}, 2, :color[6]{hex="#22C55E"}, :color[3]{hex="#22C55E"}, 9, :color[7]{hex="#EAB308"}

:mark[**4, 2, 6, 3, 9, 7**]{hex="#204A2E"}

**(ii) Inserting those values into figure (b).**

Every insertion starts at the root and walks down: **smaller goes left, larger goes right**. The key becomes a new leaf wherever the walk runs out of tree. Nothing is ever rearranged, and a key already present is not added twice.

| Key | Route from the root | What happens |
| --- | --- | --- |
| :color[4]{hex="#2DD4BF"} | `25 to 15 to 10` | 4 becomes the left child of 10 |
| :color[2]{hex="#2DD4BF"} | `25 to 15 to 10 to 4` | 2 becomes the left child of 4 |
| :color[6]{hex="#2DD4BF"} | `25 to 15 to 10 to 4` | 6 becomes the right child of 4 |
| :color[3]{hex="#2DD4BF"} | `25 to 15 to 10 to 4 to 2` | 3 becomes the right child of 2 |
| :color[9]{hex="#2DD4BF"} | `25 to 15 to 10 to 4 to 6` | 9 becomes the right child of 6 |
| :color[7]{hex="#2DD4BF"} | `25 to 15 to 10 to 4 to 6 to 9` | 7 becomes the left child of 9 |

![The search tree after the insertions](/notes/img/algorithms/ch10-q13c.svg)

:mark[**In-order check: 2, 3, 4, 6, 7, 9, 10, 15, 20, 25, 30, 35, 40**]{hex="#204A2E"}

> That check is worth doing every time. The in-order walk of a correct search tree is the sorted list of its keys, so if it comes out sorted, the tree is right.

**(iii) Height before and after.**

Before: **2**. After: **6**. The insertions all landed down one side, so the tree got **4** levels taller and no better balanced.

:mark[**Answer: 2 before, 6 after**]{hex="#204A2E"}

### Q14. Traverse, then insert

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

![Figure (a), a binary tree](/notes/img/algorithms/ch10-q14a.svg)

![Figure (b), a binary search tree](/notes/img/algorithms/ch10-q14b.svg)

**(i)** Write down the **post-order** traversal of the tree in **figure (a)**. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Insert the values obtained in **(i)**, in that order, into the binary search tree in **figure (b)**. Draw the resulting tree. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(iii)** State the height of the search tree before and after the insertions. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The post-order traversal of figure (a).**

The rule is **:color[Left, Right, Root]{hex="#FF5FA2"}**, applied at every node.

**Answer:** :color[2]{hex="#22C55E"}, :color[4]{hex="#22C55E"}, 3, :color[7]{hex="#22C55E"}, 9, :color[5]{hex="#EAB308"}

:mark[**2, 4, 3, 7, 9, 5**]{hex="#204A2E"}

**(ii) Inserting those values into figure (b).**

Every insertion starts at the root and walks down: **smaller goes left, larger goes right**. The key becomes a new leaf wherever the walk runs out of tree. Nothing is ever rearranged, and a key already present is not added twice.

| Key | Route from the root | What happens |
| --- | --- | --- |
| :color[2]{hex="#2DD4BF"} | `20 to 10 to 5` | 2 becomes the left child of 5 |
| :color[4]{hex="#2DD4BF"} | `20 to 10 to 5 to 2` | 4 becomes the right child of 2 |
| :color[3]{hex="#2DD4BF"} | `20 to 10 to 5 to 2 to 4` | 3 becomes the left child of 4 |
| :color[7]{hex="#2DD4BF"} | `20 to 10 to 5` | 7 becomes the right child of 5 |
| :color[9]{hex="#2DD4BF"} | `20 to 10 to 5 to 7` | 9 becomes the right child of 7 |
| :color[5]{hex="#EF4444"} | `20 to 10 to 5` | 5 is already in the tree, so nothing is added |

> The trap in this question: :color[5]{hex="#EF4444"} is already in the tree, so it adds nothing. Duplicates are not stored twice.

![The search tree after the insertions](/notes/img/algorithms/ch10-q14c.svg)

:mark[**In-order check: 2, 3, 4, 5, 7, 9, 10, 15, 20, 25, 30, 35**]{hex="#204A2E"}

> That check is worth doing every time. The in-order walk of a correct search tree is the sorted list of its keys, so if it comes out sorted, the tree is right.

**(iii) Height before and after.**

Before: **2**. After: **5**. The insertions all landed down one side, so the tree got **3** levels taller and no better balanced.

:mark[**Answer: 2 before, 5 after**]{hex="#204A2E"}

### Q15. Traverse, then insert

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

![Figure (a), a binary tree](/notes/img/algorithms/ch10-q15a.svg)

![Figure (b), a binary search tree](/notes/img/algorithms/ch10-q15b.svg)

**(i)** Write down the **pre-order** traversal of the tree in **figure (a)**. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Insert the values obtained in **(i)**, in that order, into the binary search tree in **figure (b)**. Draw the resulting tree. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(iii)** State the height of the search tree before and after the insertions. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The pre-order traversal of figure (a).**

The rule is **:color[Root, Left, Right]{hex="#FF5FA2"}**, applied at every node.

**Answer:** :color[40]{hex="#EAB308"}, 22, :color[11]{hex="#22C55E"}, :color[33]{hex="#22C55E"}, 66, :color[55]{hex="#22C55E"}

:mark[**40, 22, 11, 33, 66, 55**]{hex="#204A2E"}

**(ii) Inserting those values into figure (b).**

Every insertion starts at the root and walks down: **smaller goes left, larger goes right**. The key becomes a new leaf wherever the walk runs out of tree. Nothing is ever rearranged, and a key already present is not added twice.

| Key | Route from the root | What happens |
| --- | --- | --- |
| :color[40]{hex="#2DD4BF"} | `50 to 30 to 45` | 40 becomes the left child of 45 |
| :color[22]{hex="#2DD4BF"} | `50 to 30 to 20` | 22 becomes the right child of 20 |
| :color[11]{hex="#2DD4BF"} | `50 to 30 to 20` | 11 becomes the left child of 20 |
| :color[33]{hex="#2DD4BF"} | `50 to 30 to 45 to 40` | 33 becomes the left child of 40 |
| :color[66]{hex="#2DD4BF"} | `50 to 70 to 60` | 66 becomes the right child of 60 |
| :color[55]{hex="#2DD4BF"} | `50 to 70 to 60` | 55 becomes the left child of 60 |

![The search tree after the insertions](/notes/img/algorithms/ch10-q15c.svg)

:mark[**In-order check: 11, 20, 22, 30, 33, 40, 45, 50, 55, 60, 66, 70, 80**]{hex="#204A2E"}

> That check is worth doing every time. The in-order walk of a correct search tree is the sorted list of its keys, so if it comes out sorted, the tree is right.

**(iii) Height before and after.**

Before: **2**. After: **4**. The insertions all landed down one side, so the tree got **2** levels taller and no better balanced.

:mark[**Answer: 2 before, 4 after**]{hex="#204A2E"}

### Q16. Traverse, then insert

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

![Figure (a), a binary tree](/notes/img/algorithms/ch10-q16a.svg)

![Figure (b), a binary search tree](/notes/img/algorithms/ch10-q16b.svg)

**(i)** Write down the **post-order** traversal of the tree in **figure (a)**. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Insert the values obtained in **(i)**, in that order, into the binary search tree in **figure (b)**. Draw the resulting tree. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(iii)** State the height of the search tree before and after the insertions. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The post-order traversal of figure (a).**

The rule is **:color[Left, Right, Root]{hex="#FF5FA2"}**, applied at every node.

**Answer:** :color[3]{hex="#22C55E"}, :color[6]{hex="#22C55E"}, 9, 7, :color[18]{hex="#22C55E"}, 21, :color[14]{hex="#EAB308"}

:mark[**3, 6, 9, 7, 18, 21, 14**]{hex="#204A2E"}

**(ii) Inserting those values into figure (b).**

Every insertion starts at the root and walks down: **smaller goes left, larger goes right**. The key becomes a new leaf wherever the walk runs out of tree. Nothing is ever rearranged, and a key already present is not added twice.

| Key | Route from the root | What happens |
| --- | --- | --- |
| :color[3]{hex="#2DD4BF"} | `15 to 8 to 4` | 3 becomes the left child of 4 |
| :color[6]{hex="#2DD4BF"} | `15 to 8 to 4` | 6 becomes the right child of 4 |
| :color[9]{hex="#2DD4BF"} | `15 to 8 to 12` | 9 becomes the left child of 12 |
| :color[7]{hex="#2DD4BF"} | `15 to 8 to 4 to 6` | 7 becomes the right child of 6 |
| :color[18]{hex="#2DD4BF"} | `15 to 25 to 20` | 18 becomes the left child of 20 |
| :color[21]{hex="#2DD4BF"} | `15 to 25 to 20` | 21 becomes the right child of 20 |
| :color[14]{hex="#2DD4BF"} | `15 to 8 to 12` | 14 becomes the right child of 12 |

![The search tree after the insertions](/notes/img/algorithms/ch10-q16c.svg)

:mark[**In-order check: 3, 4, 6, 7, 8, 9, 12, 14, 15, 18, 20, 21, 25, 30**]{hex="#204A2E"}

> That check is worth doing every time. The in-order walk of a correct search tree is the sorted list of its keys, so if it comes out sorted, the tree is right.

**(iii) Height before and after.**

Before: **2**. After: **4**. The insertions all landed down one side, so the tree got **2** levels taller and no better balanced.

:mark[**Answer: 2 before, 4 after**]{hex="#204A2E"}

### Q17. Traverse, then insert

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

![Figure (a), a binary tree](/notes/img/algorithms/ch10-q17a.svg)

![Figure (b), a binary search tree](/notes/img/algorithms/ch10-q17b.svg)

**(i)** Write down the **in-order** traversal of the tree in **figure (a)**. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Insert the values obtained in **(i)**, in that order, into the binary search tree in **figure (b)**. Draw the resulting tree. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(iii)** State the height of the search tree before and after the insertions. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The in-order traversal of figure (a).**

The rule is **:color[Left, Root, Right]{hex="#FF5FA2"}**, applied at every node.

**Answer:** :color[28]{hex="#22C55E"}, 32, 45, :color[50]{hex="#22C55E"}, :color[60]{hex="#EAB308"}, :color[70]{hex="#22C55E"}, 75, :color[90]{hex="#22C55E"}

:mark[**28, 32, 45, 50, 60, 70, 75, 90**]{hex="#204A2E"}

**(ii) Inserting those values into figure (b).**

Every insertion starts at the root and walks down: **smaller goes left, larger goes right**. The key becomes a new leaf wherever the walk runs out of tree. Nothing is ever rearranged, and a key already present is not added twice.

| Key | Route from the root | What happens |
| --- | --- | --- |
| :color[28]{hex="#2DD4BF"} | `55 to 35 to 25` | 28 becomes the right child of 25 |
| :color[32]{hex="#2DD4BF"} | `55 to 35 to 25 to 28` | 32 becomes the right child of 28 |
| :color[45]{hex="#2DD4BF"} | `55 to 35 to 40` | 45 becomes the right child of 40 |
| :color[50]{hex="#2DD4BF"} | `55 to 35 to 40 to 45` | 50 becomes the right child of 45 |
| :color[60]{hex="#2DD4BF"} | `55 to 80 to 65` | 60 becomes the left child of 65 |
| :color[70]{hex="#2DD4BF"} | `55 to 80 to 65` | 70 becomes the right child of 65 |
| :color[75]{hex="#2DD4BF"} | `55 to 80 to 65 to 70` | 75 becomes the right child of 70 |
| :color[90]{hex="#2DD4BF"} | `55 to 80 to 95` | 90 becomes the left child of 95 |

![The search tree after the insertions](/notes/img/algorithms/ch10-q17c.svg)

:mark[**In-order check: 25, 28, 32, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 95**]{hex="#204A2E"}

> That check is worth doing every time. The in-order walk of a correct search tree is the sorted list of its keys, so if it comes out sorted, the tree is right.

**(iii) Height before and after.**

Before: **2**. After: **4**. The insertions all landed down one side, so the tree got **2** levels taller and no better balanced.

:mark[**Answer: 2 before, 4 after**]{hex="#204A2E"}

### Q18. Traverse, then insert

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

![Figure (a), a binary tree](/notes/img/algorithms/ch10-q18a.svg)

![Figure (b), a binary search tree](/notes/img/algorithms/ch10-q18b.svg)

**(i)** Write down the **post-order** traversal of the tree in **figure (a)**. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Insert the values obtained in **(i)**, in that order, into the binary search tree in **figure (b)**. Draw the resulting tree. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(iii)** State the height of the search tree before and after the insertions. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The post-order traversal of figure (a).**

The rule is **:color[Left, Right, Root]{hex="#FF5FA2"}**, applied at every node.

**Answer:** :color[2]{hex="#22C55E"}, 4, :color[13]{hex="#22C55E"}, 8, :color[21]{hex="#22C55E"}, :color[29]{hex="#22C55E"}, 31, 26, :color[17]{hex="#EAB308"}

:mark[**2, 4, 13, 8, 21, 29, 31, 26, 17**]{hex="#204A2E"}

**(ii) Inserting those values into figure (b).**

Every insertion starts at the root and walks down: **smaller goes left, larger goes right**. The key becomes a new leaf wherever the walk runs out of tree. Nothing is ever rearranged, and a key already present is not added twice.

| Key | Route from the root | What happens |
| --- | --- | --- |
| :color[2]{hex="#2DD4BF"} | `20 to 12 to 6` | 2 becomes the left child of 6 |
| :color[4]{hex="#2DD4BF"} | `20 to 12 to 6 to 2` | 4 becomes the right child of 2 |
| :color[13]{hex="#2DD4BF"} | `20 to 12 to 16` | 13 becomes the left child of 16 |
| :color[8]{hex="#2DD4BF"} | `20 to 12 to 6` | 8 becomes the right child of 6 |
| :color[21]{hex="#2DD4BF"} | `20 to 28 to 24` | 21 becomes the left child of 24 |
| :color[29]{hex="#2DD4BF"} | `20 to 28 to 34` | 29 becomes the left child of 34 |
| :color[31]{hex="#2DD4BF"} | `20 to 28 to 34 to 29` | 31 becomes the right child of 29 |
| :color[26]{hex="#2DD4BF"} | `20 to 28 to 24` | 26 becomes the right child of 24 |
| :color[17]{hex="#2DD4BF"} | `20 to 12 to 16` | 17 becomes the right child of 16 |

![The search tree after the insertions](/notes/img/algorithms/ch10-q18c.svg)

:mark[**In-order check: 2, 4, 6, 8, 12, 13, 16, 17, 20, 21, 24, 26, 28, 29, 31, 34**]{hex="#204A2E"}

> That check is worth doing every time. The in-order walk of a correct search tree is the sorted list of its keys, so if it comes out sorted, the tree is right.

**(iii) Height before and after.**

Before: **2**. After: **4**. The insertions all landed down one side, so the tree got **2** levels taller and no better balanced.

:mark[**Answer: 2 before, 4 after**]{hex="#204A2E"}

### Q19. Traverse, then insert

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

![Figure (a), a binary tree](/notes/img/algorithms/ch10-q19a.svg)

![Figure (b), a binary search tree](/notes/img/algorithms/ch10-q19b.svg)

**(i)** Write down the **pre-order** traversal of the tree in **figure (a)**. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Insert the values obtained in **(i)**, in that order, into the binary search tree in **figure (b)**. Draw the resulting tree. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(iii)** State the height of the search tree before and after the insertions. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The pre-order traversal of figure (a).**

The rule is **:color[Root, Left, Right]{hex="#FF5FA2"}**, applied at every node.

**Answer:** :color[36]{hex="#EAB308"}, 19, :color[7]{hex="#22C55E"}, 23, :color[14]{hex="#22C55E"}, 48, 41, :color[44]{hex="#22C55E"}, :color[57]{hex="#22C55E"}

:mark[**36, 19, 7, 23, 14, 48, 41, 44, 57**]{hex="#204A2E"}

**(ii) Inserting those values into figure (b).**

Every insertion starts at the root and walks down: **smaller goes left, larger goes right**. The key becomes a new leaf wherever the walk runs out of tree. Nothing is ever rearranged, and a key already present is not added twice.

| Key | Route from the root | What happens |
| --- | --- | --- |
| :color[36]{hex="#2DD4BF"} | `40 to 25 to 32` | 36 becomes the right child of 32 |
| :color[19]{hex="#2DD4BF"} | `40 to 25 to 15` | 19 becomes the right child of 15 |
| :color[7]{hex="#2DD4BF"} | `40 to 25 to 15` | 7 becomes the left child of 15 |
| :color[23]{hex="#2DD4BF"} | `40 to 25 to 15 to 19` | 23 becomes the right child of 19 |
| :color[14]{hex="#2DD4BF"} | `40 to 25 to 15 to 7` | 14 becomes the right child of 7 |
| :color[48]{hex="#2DD4BF"} | `40 to 60 to 50` | 48 becomes the left child of 50 |
| :color[41]{hex="#2DD4BF"} | `40 to 60 to 50 to 48` | 41 becomes the left child of 48 |
| :color[44]{hex="#2DD4BF"} | `40 to 60 to 50 to 48 to 41` | 44 becomes the right child of 41 |
| :color[57]{hex="#2DD4BF"} | `40 to 60 to 50` | 57 becomes the right child of 50 |

![The search tree after the insertions](/notes/img/algorithms/ch10-q19c.svg)

:mark[**In-order check: 7, 14, 15, 19, 23, 25, 32, 36, 40, 41, 44, 48, 50, 57, 60, 70**]{hex="#204A2E"}

> That check is worth doing every time. The in-order walk of a correct search tree is the sorted list of its keys, so if it comes out sorted, the tree is right.

**(iii) Height before and after.**

Before: **2**. After: **5**. The insertions all landed down one side, so the tree got **3** levels taller and no better balanced.

:mark[**Answer: 2 before, 5 after**]{hex="#204A2E"}

### Q20. Traverse, then insert

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

![Figure (a), a binary tree](/notes/img/algorithms/ch10-q20a.svg)

![Figure (b), a binary search tree](/notes/img/algorithms/ch10-q20b.svg)

**(i)** Write down the **post-order** traversal of the tree in **figure (a)**. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Insert the values obtained in **(i)**, in that order, into the binary search tree in **figure (b)**. Draw the resulting tree. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(iii)** State the height of the search tree before and after the insertions. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The post-order traversal of figure (a).**

The rule is **:color[Left, Right, Root]{hex="#FF5FA2"}**, applied at every node.

**Answer:** :color[2]{hex="#22C55E"}, 1, :color[4]{hex="#22C55E"}, :color[6]{hex="#22C55E"}, 5, :color[8]{hex="#22C55E"}, :color[10]{hex="#22C55E"}, 9, 7, :color[3]{hex="#EAB308"}

:mark[**2, 1, 4, 6, 5, 8, 10, 9, 7, 3**]{hex="#204A2E"}

**(ii) Inserting those values into figure (b).**

Every insertion starts at the root and walks down: **smaller goes left, larger goes right**. The key becomes a new leaf wherever the walk runs out of tree. Nothing is ever rearranged, and a key already present is not added twice.

| Key | Route from the root | What happens |
| --- | --- | --- |
| :color[2]{hex="#EF4444"} | `11 to 6 to 2` | 2 is already in the tree, so nothing is added |
| :color[1]{hex="#2DD4BF"} | `11 to 6 to 2` | 1 becomes the left child of 2 |
| :color[4]{hex="#2DD4BF"} | `11 to 6 to 2` | 4 becomes the right child of 2 |
| :color[6]{hex="#EF4444"} | `11 to 6` | 6 is already in the tree, so nothing is added |
| :color[5]{hex="#2DD4BF"} | `11 to 6 to 2 to 4` | 5 becomes the right child of 4 |
| :color[8]{hex="#2DD4BF"} | `11 to 6 to 9` | 8 becomes the left child of 9 |
| :color[10]{hex="#2DD4BF"} | `11 to 6 to 9` | 10 becomes the right child of 9 |
| :color[9]{hex="#EF4444"} | `11 to 6 to 9` | 9 is already in the tree, so nothing is added |
| :color[7]{hex="#2DD4BF"} | `11 to 6 to 9 to 8` | 7 becomes the left child of 8 |
| :color[3]{hex="#2DD4BF"} | `11 to 6 to 2 to 4` | 3 becomes the left child of 4 |

> The trap in this question: :color[2, 6, 9]{hex="#EF4444"} are already in the tree, so they add nothing. Duplicates are not stored twice.

![The search tree after the insertions](/notes/img/algorithms/ch10-q20c.svg)

:mark[**In-order check: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 17, 22**]{hex="#204A2E"}

> That check is worth doing every time. The in-order walk of a correct search tree is the sorted list of its keys, so if it comes out sorted, the tree is right.

**(iii) Height before and after.**

Before: **2**. After: **4**. The insertions all landed down one side, so the tree got **2** levels taller and no better balanced.

:mark[**Answer: 2 before, 4 after**]{hex="#204A2E"}

### Q21. Traverse, then insert

> :mark[**Very hard**]{hex="#5C2323"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

![Figure (a), a binary tree](/notes/img/algorithms/ch10-q21a.svg)

![Figure (b), a binary search tree](/notes/img/algorithms/ch10-q21b.svg)

**(i)** Write down the **post-order** traversal of the tree in **figure (a)**. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Insert the values obtained in **(i)**, in that order, into the binary search tree in **figure (b)**. Draw the resulting tree. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(iii)** State the height of the search tree before and after the insertions. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The post-order traversal of figure (a).**

The rule is **:color[Left, Right, Root]{hex="#FF5FA2"}**, applied at every node.

**Answer:** :color[6]{hex="#22C55E"}, :color[20]{hex="#22C55E"}, 13, :color[41]{hex="#22C55E"}, 34, 27, :color[68]{hex="#22C55E"}, :color[89]{hex="#22C55E"}, :color[100]{hex="#22C55E"}, 95, 82, :color[55]{hex="#EAB308"}

:mark[**6, 20, 13, 41, 34, 27, 68, 89, 100, 95, 82, 55**]{hex="#204A2E"}

**(ii) Inserting those values into figure (b).**

Every insertion starts at the root and walks down: **smaller goes left, larger goes right**. The key becomes a new leaf wherever the walk runs out of tree. Nothing is ever rearranged, and a key already present is not added twice.

| Key | Route from the root | What happens |
| --- | --- | --- |
| :color[6]{hex="#2DD4BF"} | `60 to 30 to 15` | 6 becomes the left child of 15 |
| :color[20]{hex="#2DD4BF"} | `60 to 30 to 15` | 20 becomes the right child of 15 |
| :color[13]{hex="#2DD4BF"} | `60 to 30 to 15 to 6` | 13 becomes the right child of 6 |
| :color[41]{hex="#2DD4BF"} | `60 to 30 to 45` | 41 becomes the left child of 45 |
| :color[34]{hex="#2DD4BF"} | `60 to 30 to 45 to 41` | 34 becomes the left child of 41 |
| :color[27]{hex="#2DD4BF"} | `60 to 30 to 15 to 20` | 27 becomes the right child of 20 |
| :color[68]{hex="#2DD4BF"} | `60 to 90 to 75` | 68 becomes the left child of 75 |
| :color[89]{hex="#2DD4BF"} | `60 to 90 to 75` | 89 becomes the right child of 75 |
| :color[100]{hex="#2DD4BF"} | `60 to 90 to 99` | 100 becomes the right child of 99 |
| :color[95]{hex="#2DD4BF"} | `60 to 90 to 99` | 95 becomes the left child of 99 |
| :color[82]{hex="#2DD4BF"} | `60 to 90 to 75 to 89` | 82 becomes the left child of 89 |
| :color[55]{hex="#2DD4BF"} | `60 to 30 to 45` | 55 becomes the right child of 45 |

![The search tree after the insertions](/notes/img/algorithms/ch10-q21c.svg)

:mark[**In-order check: 6, 13, 15, 20, 27, 30, 34, 41, 45, 55, 60, 68, 75, 82, 89, 90, 95, 99, 100**]{hex="#204A2E"}

> That check is worth doing every time. The in-order walk of a correct search tree is the sorted list of its keys, so if it comes out sorted, the tree is right.

**(iii) Height before and after.**

Before: **2**. After: **4**. The insertions all landed down one side, so the tree got **2** levels taller and no better balanced.

:mark[**Answer: 2 before, 4 after**]{hex="#204A2E"}

### Q22. Traverse, then insert

> :mark[**Very hard**]{hex="#5C2323"} &nbsp; :mark[**12 marks**]{hex="#3A3A3E"}

![Figure (a), a binary tree](/notes/img/algorithms/ch10-q22a.svg)

![Figure (b), a binary search tree](/notes/img/algorithms/ch10-q22b.svg)

**(i)** Write down the **in-order** traversal of the tree in **figure (a)**. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(ii)** Insert the values obtained in **(i)**, in that order, into the binary search tree in **figure (b)**. Draw the resulting tree. &nbsp; :mark[**6 marks**]{hex="#3A3A3E"}

**(iii)** State the height of the search tree before and after the insertions. &nbsp; :mark[**2 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) The in-order traversal of figure (a).**

The rule is **:color[Left, Root, Right]{hex="#FF5FA2"}**, applied at every node.

**Answer:** :color[8]{hex="#22C55E"}, 16, :color[24]{hex="#22C55E"}, 32, :color[48]{hex="#22C55E"}, :color[64]{hex="#EAB308"}, :color[72]{hex="#22C55E"}, 80, :color[88]{hex="#22C55E"}, 96, :color[112]{hex="#22C55E"}

:mark[**8, 16, 24, 32, 48, 64, 72, 80, 88, 96, 112**]{hex="#204A2E"}

**(ii) Inserting those values into figure (b).**

Every insertion starts at the root and walks down: **smaller goes left, larger goes right**. The key becomes a new leaf wherever the walk runs out of tree. Nothing is ever rearranged, and a key already present is not added twice.

| Key | Route from the root | What happens |
| --- | --- | --- |
| :color[8]{hex="#2DD4BF"} | `70 to 40 to 20` | 8 becomes the left child of 20 |
| :color[16]{hex="#2DD4BF"} | `70 to 40 to 20 to 8` | 16 becomes the right child of 8 |
| :color[24]{hex="#2DD4BF"} | `70 to 40 to 20` | 24 becomes the right child of 20 |
| :color[32]{hex="#2DD4BF"} | `70 to 40 to 20 to 24` | 32 becomes the right child of 24 |
| :color[48]{hex="#2DD4BF"} | `70 to 40 to 55` | 48 becomes the left child of 55 |
| :color[64]{hex="#2DD4BF"} | `70 to 40 to 55` | 64 becomes the right child of 55 |
| :color[72]{hex="#2DD4BF"} | `70 to 100 to 85` | 72 becomes the left child of 85 |
| :color[80]{hex="#2DD4BF"} | `70 to 100 to 85 to 72` | 80 becomes the right child of 72 |
| :color[88]{hex="#2DD4BF"} | `70 to 100 to 85` | 88 becomes the right child of 85 |
| :color[96]{hex="#2DD4BF"} | `70 to 100 to 85 to 88` | 96 becomes the right child of 88 |
| :color[112]{hex="#2DD4BF"} | `70 to 100 to 120` | 112 becomes the left child of 120 |

![The search tree after the insertions](/notes/img/algorithms/ch10-q22c.svg)

:mark[**In-order check: 8, 16, 20, 24, 32, 40, 48, 55, 64, 70, 72, 80, 85, 88, 96, 100, 112, 120**]{hex="#204A2E"}

> That check is worth doing every time. The in-order walk of a correct search tree is the sorted list of its keys, so if it comes out sorted, the tree is right.

**(iii) Height before and after.**

Before: **2**. After: **4**. The insertions all landed down one side, so the tree got **2** levels taller and no better balanced.

:mark[**Answer: 2 before, 4 after**]{hex="#204A2E"}

## Part C: search tree operations

Find min and max, search, insert, delete. Between them these ten cover all three deletion cases, including deleting the root.

### Q23. Search tree operations

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

![A binary search tree](/notes/img/algorithms/ch10-q23.svg)

**(i)** State the minimum and the maximum key, and give the path followed to each. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Search for **40** and then for **55**. List the nodes visited in each case. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iii)** Insert **35, 65, 10**, in that order. Draw the resulting tree. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iv)** Delete **20** from the **original** tree. State which case applies and draw the result. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) Minimum and maximum.**

No searching is needed for either. The smallest key is as far **left** as you can go, the largest as far **right**, so both are a single walk with no decisions.

| | Path | Value |
| --- | --- | --- |
| Minimum, keep going left | `50 to 30 to 20` | **20** |
| Maximum, keep going right | `50 to 70 to 80` | **80** |

:mark[**Answer: minimum 20, maximum 80**]{hex="#204A2E"}

**(ii) The two searches.**

At each node, compare. Equal means found, smaller means go left, larger means go right. You stop either on the key or on a missing child.

| Looking for | Nodes visited | Outcome |
| --- | --- | --- |
| :color[40]{hex="#FF5FA2"} | `50 to 30 to 40` | **found** at 40, after 3 comparisons |
| :color[55]{hex="#EF4444"} | `50 to 70 to 60` | **not found**, the walk runs off the bottom at 60 |

> Both searches touched at most **3** of the 7 nodes. That is the whole point of a search tree: every comparison throws away a subtree.

**(iii) The insertions.**

| Key | Route from the root | What happens |
| --- | --- | --- |
| :color[35]{hex="#2DD4BF"} | `50 to 30 to 40` | 35 becomes the left child of 40 |
| :color[65]{hex="#2DD4BF"} | `50 to 70 to 60` | 65 becomes the right child of 60 |
| :color[10]{hex="#2DD4BF"} | `50 to 30 to 20` | 10 becomes the left child of 20 |

![The search tree after the insertions](/notes/img/algorithms/ch10-q23i.svg)

:mark[**In-order check: 10, 20, 30, 35, 40, 50, 60, 65, 70, 80**]{hex="#204A2E"}

**(iv) Deleting 20.**

First find it: `50 to 30 to 20`.

:color[20]{hex="#EF4444"} has **no children**, which is the easy case. Detach it and nothing else moves.

![The search tree after the deletion](/notes/img/algorithms/ch10-q23d.svg)

:mark[**Answer: the a leaf case. In-order check: 30, 40, 50, 60, 70, 80**]{hex="#204A2E"}

### Q24. Search tree operations

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

![A binary search tree](/notes/img/algorithms/ch10-q24.svg)

**(i)** State the minimum and the maximum key, and give the path followed to each. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Search for **18** and then for **20**. List the nodes visited in each case. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iii)** Insert **1, 6, 30**, in that order. Draw the resulting tree. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iv)** Delete **23** from the **original** tree. State which case applies and draw the result. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) Minimum and maximum.**

No searching is needed for either. The smallest key is as far **left** as you can go, the largest as far **right**, so both are a single walk with no decisions.

| | Path | Value |
| --- | --- | --- |
| Minimum, keep going left | `15 to 9 to 4` | **4** |
| Maximum, keep going right | `15 to 23 to 27` | **27** |

:mark[**Answer: minimum 4, maximum 27**]{hex="#204A2E"}

**(ii) The two searches.**

At each node, compare. Equal means found, smaller means go left, larger means go right. You stop either on the key or on a missing child.

| Looking for | Nodes visited | Outcome |
| --- | --- | --- |
| :color[18]{hex="#FF5FA2"} | `15 to 23 to 18` | **found** at 18, after 3 comparisons |
| :color[20]{hex="#EF4444"} | `15 to 23 to 18` | **not found**, the walk runs off the bottom at 18 |

> Both searches touched at most **3** of the 7 nodes. That is the whole point of a search tree: every comparison throws away a subtree.

**(iii) The insertions.**

| Key | Route from the root | What happens |
| --- | --- | --- |
| :color[1]{hex="#2DD4BF"} | `15 to 9 to 4` | 1 becomes the left child of 4 |
| :color[6]{hex="#2DD4BF"} | `15 to 9 to 4` | 6 becomes the right child of 4 |
| :color[30]{hex="#2DD4BF"} | `15 to 23 to 27` | 30 becomes the right child of 27 |

![The search tree after the insertions](/notes/img/algorithms/ch10-q24i.svg)

:mark[**In-order check: 1, 4, 6, 9, 12, 15, 18, 23, 27, 30**]{hex="#204A2E"}

**(iv) Deleting 23.**

First find it: `15 to 23`.

:color[23]{hex="#EF4444"} has **two children**, so it cannot simply be removed: something has to take its place, and only one value can. That value is the **in-order successor**, the smallest key in its right subtree, which here is :color[27]{hex="#2DD4BF"}.

Copy :color[27]{hex="#2DD4BF"} into the node, then delete the original 27 from the right subtree. That second delete is always easy, because the smallest node in a subtree has no left child.

![The search tree after the deletion](/notes/img/algorithms/ch10-q24d.svg)

:mark[**Answer: the two children case. In-order check: 4, 9, 12, 15, 18, 27**]{hex="#204A2E"}

### Q25. Search tree operations

> :mark[**Easy**]{hex="#204A2E"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

![A binary search tree](/notes/img/algorithms/ch10-q25.svg)

**(i)** State the minimum and the maximum key, and give the path followed to each. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Search for **32** and then for **45**. List the nodes visited in each case. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iii)** Insert **3, 20, 60**, in that order. Draw the resulting tree. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iv)** Delete **18** from the **original** tree. State which case applies and draw the result. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) Minimum and maximum.**

No searching is needed for either. The smallest key is as far **left** as you can go, the largest as far **right**, so both are a single walk with no decisions.

| | Path | Value |
| --- | --- | --- |
| Minimum, keep going left | `25 to 12 to 6` | **6** |
| Maximum, keep going right | `25 to 40 to 55` | **55** |

:mark[**Answer: minimum 6, maximum 55**]{hex="#204A2E"}

**(ii) The two searches.**

At each node, compare. Equal means found, smaller means go left, larger means go right. You stop either on the key or on a missing child.

| Looking for | Nodes visited | Outcome |
| --- | --- | --- |
| :color[32]{hex="#FF5FA2"} | `25 to 40 to 32` | **found** at 32, after 3 comparisons |
| :color[45]{hex="#EF4444"} | `25 to 40 to 55` | **not found**, the walk runs off the bottom at 55 |

> Both searches touched at most **3** of the 7 nodes. That is the whole point of a search tree: every comparison throws away a subtree.

**(iii) The insertions.**

| Key | Route from the root | What happens |
| --- | --- | --- |
| :color[3]{hex="#2DD4BF"} | `25 to 12 to 6` | 3 becomes the left child of 6 |
| :color[20]{hex="#2DD4BF"} | `25 to 12 to 18` | 20 becomes the right child of 18 |
| :color[60]{hex="#2DD4BF"} | `25 to 40 to 55` | 60 becomes the right child of 55 |

![The search tree after the insertions](/notes/img/algorithms/ch10-q25i.svg)

:mark[**In-order check: 3, 6, 12, 18, 20, 25, 32, 40, 55, 60**]{hex="#204A2E"}

**(iv) Deleting 18.**

First find it: `25 to 12 to 18`.

:color[18]{hex="#EF4444"} has **no children**, which is the easy case. Detach it and nothing else moves.

![The search tree after the deletion](/notes/img/algorithms/ch10-q25d.svg)

:mark[**Answer: the a leaf case. In-order check: 6, 12, 25, 32, 40, 55**]{hex="#204A2E"}

### Q26. Search tree operations

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

![A binary search tree](/notes/img/algorithms/ch10-q26.svg)

**(i)** State the minimum and the maximum key, and give the path followed to each. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Search for **88** and then for **50**. List the nodes visited in each case. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iii)** Insert **5, 33, 100**, in that order. Draw the resulting tree. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iv)** Delete **80** from the **original** tree. State which case applies and draw the result. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) Minimum and maximum.**

No searching is needed for either. The smallest key is as far **left** as you can go, the largest as far **right**, so both are a single walk with no decisions.

| | Path | Value |
| --- | --- | --- |
| Minimum, keep going left | `60 to 35 to 20 to 10` | **10** |
| Maximum, keep going right | `60 to 80 to 95 to 110` | **110** |

:mark[**Answer: minimum 10, maximum 110**]{hex="#204A2E"}

**(ii) The two searches.**

At each node, compare. Equal means found, smaller means go left, larger means go right. You stop either on the key or on a missing child.

| Looking for | Nodes visited | Outcome |
| --- | --- | --- |
| :color[88]{hex="#FF5FA2"} | `60 to 80 to 95 to 88` | **found** at 88, after 4 comparisons |
| :color[50]{hex="#EF4444"} | `60 to 35 to 45` | **not found**, the walk runs off the bottom at 45 |

> Both searches touched at most **4** of the 11 nodes. That is the whole point of a search tree: every comparison throws away a subtree.

**(iii) The insertions.**

| Key | Route from the root | What happens |
| --- | --- | --- |
| :color[5]{hex="#2DD4BF"} | `60 to 35 to 20 to 10` | 5 becomes the left child of 10 |
| :color[33]{hex="#2DD4BF"} | `60 to 35 to 20 to 28` | 33 becomes the right child of 28 |
| :color[100]{hex="#2DD4BF"} | `60 to 80 to 95 to 110` | 100 becomes the left child of 110 |

![The search tree after the insertions](/notes/img/algorithms/ch10-q26i.svg)

:mark[**In-order check: 5, 10, 20, 28, 33, 35, 45, 60, 72, 80, 88, 95, 100, 110**]{hex="#204A2E"}

**(iv) Deleting 80.**

First find it: `60 to 80`.

:color[80]{hex="#EF4444"} has **two children**, so it cannot simply be removed: something has to take its place, and only one value can. That value is the **in-order successor**, the smallest key in its right subtree, which here is :color[88]{hex="#2DD4BF"}.

Copy :color[88]{hex="#2DD4BF"} into the node, then delete the original 88 from the right subtree. That second delete is always easy, because the smallest node in a subtree has no left child.

![The search tree after the deletion](/notes/img/algorithms/ch10-q26d.svg)

:mark[**Answer: the two children case. In-order check: 10, 20, 28, 35, 45, 60, 72, 88, 95, 110**]{hex="#204A2E"}

### Q27. Search tree operations

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

![A binary search tree](/notes/img/algorithms/ch10-q27.svg)

**(i)** State the minimum and the maximum key, and give the path followed to each. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Search for **16** and then for **25**. List the nodes visited in each case. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iii)** Insert **8, 26, 74**, in that order. Draw the resulting tree. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iv)** Delete **11** from the **original** tree. State which case applies and draw the result. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) Minimum and maximum.**

No searching is needed for either. The smallest key is as far **left** as you can go, the largest as far **right**, so both are a single walk with no decisions.

| | Path | Value |
| --- | --- | --- |
| Minimum, keep going left | `42 to 21 to 11` | **11** |
| Maximum, keep going right | `42 to 66 to 78 to 90` | **90** |

:mark[**Answer: minimum 11, maximum 90**]{hex="#204A2E"}

**(ii) The two searches.**

At each node, compare. Equal means found, smaller means go left, larger means go right. You stop either on the key or on a missing child.

| Looking for | Nodes visited | Outcome |
| --- | --- | --- |
| :color[16]{hex="#FF5FA2"} | `42 to 21 to 11 to 16` | **found** at 16, after 4 comparisons |
| :color[25]{hex="#EF4444"} | `42 to 21 to 30` | **not found**, the walk runs off the bottom at 30 |

> Both searches touched at most **4** of the 10 nodes. That is the whole point of a search tree: every comparison throws away a subtree.

**(iii) The insertions.**

| Key | Route from the root | What happens |
| --- | --- | --- |
| :color[8]{hex="#2DD4BF"} | `42 to 21 to 11` | 8 becomes the left child of 11 |
| :color[26]{hex="#2DD4BF"} | `42 to 21 to 30` | 26 becomes the left child of 30 |
| :color[74]{hex="#2DD4BF"} | `42 to 66 to 78 to 70` | 74 becomes the right child of 70 |

![The search tree after the insertions](/notes/img/algorithms/ch10-q27i.svg)

:mark[**In-order check: 8, 11, 16, 21, 26, 30, 42, 55, 66, 70, 74, 78, 90**]{hex="#204A2E"}

**(iv) Deleting 11.**

First find it: `42 to 21 to 11`.

:color[11]{hex="#EF4444"} has **exactly one child**. Lift that child, :color[16]{hex="#2DD4BF"}, and the subtree hanging beneath it, straight into the gap. The ordering still holds because everything in that subtree was already on the correct side of 11's parent.

![The search tree after the deletion](/notes/img/algorithms/ch10-q27d.svg)

:mark[**Answer: the one child case. In-order check: 16, 21, 30, 42, 55, 66, 70, 78, 90**]{hex="#204A2E"}

### Q28. Search tree operations

> :mark[**Medium**]{hex="#565426"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

![A binary search tree](/notes/img/algorithms/ch10-q28.svg)

**(i)** State the minimum and the maximum key, and give the path followed to each. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Search for **55** and then for **90**. List the nodes visited in each case. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iii)** Insert **15, 60, 200**, in that order. Draw the resulting tree. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iv)** Delete **100** from the **original** tree. State which case applies and draw the result. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) Minimum and maximum.**

No searching is needed for either. The smallest key is as far **left** as you can go, the largest as far **right**, so both are a single walk with no decisions.

| | Path | Value |
| --- | --- | --- |
| Minimum, keep going left | `100 to 45 to 22` | **22** |
| Maximum, keep going right | `100 to 160 to 190 to 220` | **220** |

:mark[**Answer: minimum 22, maximum 220**]{hex="#204A2E"}

**(ii) The two searches.**

At each node, compare. Equal means found, smaller means go left, larger means go right. You stop either on the key or on a missing child.

| Looking for | Nodes visited | Outcome |
| --- | --- | --- |
| :color[55]{hex="#FF5FA2"} | `100 to 45 to 70 to 55` | **found** at 55, after 4 comparisons |
| :color[90]{hex="#EF4444"} | `100 to 45 to 70 to 85` | **not found**, the walk runs off the bottom at 85 |

> Both searches touched at most **4** of the 12 nodes. That is the whole point of a search tree: every comparison throws away a subtree.

**(iii) The insertions.**

| Key | Route from the root | What happens |
| --- | --- | --- |
| :color[15]{hex="#2DD4BF"} | `100 to 45 to 22` | 15 becomes the left child of 22 |
| :color[60]{hex="#2DD4BF"} | `100 to 45 to 70 to 55` | 60 becomes the right child of 55 |
| :color[200]{hex="#2DD4BF"} | `100 to 160 to 190 to 220` | 200 becomes the left child of 220 |

![The search tree after the insertions](/notes/img/algorithms/ch10-q28i.svg)

:mark[**In-order check: 15, 22, 33, 45, 55, 60, 70, 85, 100, 130, 160, 175, 190, 200, 220**]{hex="#204A2E"}

**(iv) Deleting 100.**

First find it: `100`.

:color[100]{hex="#EF4444"} has **two children**, so it cannot simply be removed: something has to take its place, and only one value can. That value is the **in-order successor**, the smallest key in its right subtree, which here is :color[130]{hex="#2DD4BF"}.

Copy :color[130]{hex="#2DD4BF"} into the node, then delete the original 130 from the right subtree. That second delete is always easy, because the smallest node in a subtree has no left child.

> This one is the **root**. Deleting the root is not a special case: the same three rules apply. The only difference is that the tree gets a new root value, :color[130]{hex="#2DD4BF"}.

![The search tree after the deletion](/notes/img/algorithms/ch10-q28d.svg)

:mark[**Answer: the two children case. In-order check: 22, 33, 45, 55, 70, 85, 130, 160, 175, 190, 220**]{hex="#204A2E"}

### Q29. Search tree operations

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

![A binary search tree](/notes/img/algorithms/ch10-q29.svg)

**(i)** State the minimum and the maximum key, and give the path followed to each. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Search for **60** and then for **50**. List the nodes visited in each case. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iii)** Insert **3, 35, 92**, in that order. Draw the resulting tree. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iv)** Delete **88** from the **original** tree. State which case applies and draw the result. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) Minimum and maximum.**

No searching is needed for either. The smallest key is as far **left** as you can go, the largest as far **right**, so both are a single walk with no decisions.

| | Path | Value |
| --- | --- | --- |
| Minimum, keep going left | `55 to 28 to 14 to 7` | **7** |
| Maximum, keep going right | `55 to 76 to 88 to 95` | **95** |

:mark[**Answer: minimum 7, maximum 95**]{hex="#204A2E"}

**(ii) The two searches.**

At each node, compare. Equal means found, smaller means go left, larger means go right. You stop either on the key or on a missing child.

| Looking for | Nodes visited | Outcome |
| --- | --- | --- |
| :color[60]{hex="#FF5FA2"} | `55 to 76 to 64 to 60` | **found** at 60, after 4 comparisons |
| :color[50]{hex="#EF4444"} | `55 to 28 to 38 to 47` | **not found**, the walk runs off the bottom at 47 |

> Both searches touched at most **4** of the 14 nodes. That is the whole point of a search tree: every comparison throws away a subtree.

**(iii) The insertions.**

| Key | Route from the root | What happens |
| --- | --- | --- |
| :color[3]{hex="#2DD4BF"} | `55 to 28 to 14 to 7` | 3 becomes the left child of 7 |
| :color[35]{hex="#2DD4BF"} | `55 to 28 to 38 to 32` | 35 becomes the right child of 32 |
| :color[92]{hex="#2DD4BF"} | `55 to 76 to 88 to 95` | 92 becomes the left child of 95 |

![The search tree after the insertions](/notes/img/algorithms/ch10-q29i.svg)

:mark[**In-order check: 3, 7, 14, 21, 28, 32, 35, 38, 47, 55, 60, 64, 70, 76, 88, 92, 95**]{hex="#204A2E"}

**(iv) Deleting 88.**

First find it: `55 to 76 to 88`.

:color[88]{hex="#EF4444"} has **exactly one child**. Lift that child, :color[95]{hex="#2DD4BF"}, and the subtree hanging beneath it, straight into the gap. The ordering still holds because everything in that subtree was already on the correct side of 88's parent.

![The search tree after the deletion](/notes/img/algorithms/ch10-q29d.svg)

:mark[**Answer: the one child case. In-order check: 7, 14, 21, 28, 32, 38, 47, 55, 60, 64, 70, 76, 95**]{hex="#204A2E"}

### Q30. Search tree operations

> :mark[**Hard**]{hex="#5C3A1A"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

![A binary search tree](/notes/img/algorithms/ch10-q30.svg)

**(i)** State the minimum and the maximum key, and give the path followed to each. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Search for **39** and then for **30**. List the nodes visited in each case. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iii)** Insert **2, 29, 80**, in that order. Draw the resulting tree. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iv)** Delete **33** from the **original** tree. State which case applies and draw the result. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) Minimum and maximum.**

No searching is needed for either. The smallest key is as far **left** as you can go, the largest as far **right**, so both are a single walk with no decisions.

| | Path | Value |
| --- | --- | --- |
| Minimum, keep going left | `33 to 17 to 8 to 4` | **4** |
| Maximum, keep going right | `33 to 58 to 72 to 85` | **85** |

:mark[**Answer: minimum 4, maximum 85**]{hex="#204A2E"}

**(ii) The two searches.**

At each node, compare. Equal means found, smaller means go left, larger means go right. You stop either on the key or on a missing child.

| Looking for | Nodes visited | Outcome |
| --- | --- | --- |
| :color[39]{hex="#FF5FA2"} | `33 to 58 to 44 to 39` | **found** at 39, after 4 comparisons |
| :color[30]{hex="#EF4444"} | `33 to 17 to 25` | **not found**, the walk runs off the bottom at 25 |

> Both searches touched at most **4** of the 13 nodes. That is the whole point of a search tree: every comparison throws away a subtree.

**(iii) The insertions.**

| Key | Route from the root | What happens |
| --- | --- | --- |
| :color[2]{hex="#2DD4BF"} | `33 to 17 to 8 to 4` | 2 becomes the left child of 4 |
| :color[29]{hex="#2DD4BF"} | `33 to 17 to 25` | 29 becomes the right child of 25 |
| :color[80]{hex="#2DD4BF"} | `33 to 58 to 72 to 85` | 80 becomes the left child of 85 |

![The search tree after the insertions](/notes/img/algorithms/ch10-q30i.svg)

:mark[**In-order check: 2, 4, 8, 12, 17, 25, 29, 33, 39, 44, 50, 58, 66, 72, 80, 85**]{hex="#204A2E"}

**(iv) Deleting 33.**

First find it: `33`.

:color[33]{hex="#EF4444"} has **two children**, so it cannot simply be removed: something has to take its place, and only one value can. That value is the **in-order successor**, the smallest key in its right subtree, which here is :color[39]{hex="#2DD4BF"}.

Copy :color[39]{hex="#2DD4BF"} into the node, then delete the original 39 from the right subtree. That second delete is always easy, because the smallest node in a subtree has no left child.

> This one is the **root**. Deleting the root is not a special case: the same three rules apply. The only difference is that the tree gets a new root value, :color[39]{hex="#2DD4BF"}.

![The search tree after the deletion](/notes/img/algorithms/ch10-q30d.svg)

:mark[**Answer: the two children case. In-order check: 4, 8, 12, 17, 25, 39, 44, 50, 58, 66, 72, 85**]{hex="#204A2E"}

### Q31. Search tree operations

> :mark[**Very hard**]{hex="#5C2323"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

![A binary search tree](/notes/img/algorithms/ch10-q31.svg)

**(i)** State the minimum and the maximum key, and give the path followed to each. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Search for **104** and then for **68**. List the nodes visited in each case. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iii)** Insert **2, 44, 100**, in that order. Draw the resulting tree. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iv)** Delete **32** from the **original** tree. State which case applies and draw the result. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) Minimum and maximum.**

No searching is needed for either. The smallest key is as far **left** as you can go, the largest as far **right**, so both are a single walk with no decisions.

| | Path | Value |
| --- | --- | --- |
| Minimum, keep going left | `64 to 32 to 16 to 8 to 4` | **4** |
| Maximum, keep going right | `64 to 96 to 112 to 120` | **120** |

:mark[**Answer: minimum 4, maximum 120**]{hex="#204A2E"}

**(ii) The two searches.**

At each node, compare. Equal means found, smaller means go left, larger means go right. You stop either on the key or on a missing child.

| Looking for | Nodes visited | Outcome |
| --- | --- | --- |
| :color[104]{hex="#FF5FA2"} | `64 to 96 to 112 to 104` | **found** at 104, after 4 comparisons |
| :color[68]{hex="#EF4444"} | `64 to 96 to 80 to 72` | **not found**, the walk runs off the bottom at 72 |

> Both searches touched at most **4** of the 17 nodes. That is the whole point of a search tree: every comparison throws away a subtree.

**(iii) The insertions.**

| Key | Route from the root | What happens |
| --- | --- | --- |
| :color[2]{hex="#2DD4BF"} | `64 to 32 to 16 to 8 to 4` | 2 becomes the left child of 4 |
| :color[44]{hex="#2DD4BF"} | `64 to 32 to 48 to 40` | 44 becomes the right child of 40 |
| :color[100]{hex="#2DD4BF"} | `64 to 96 to 112 to 104` | 100 becomes the left child of 104 |

![The search tree after the insertions](/notes/img/algorithms/ch10-q31i.svg)

:mark[**In-order check: 2, 4, 8, 12, 16, 24, 32, 40, 44, 48, 56, 64, 72, 80, 88, 96, 100, 104, 112, 120**]{hex="#204A2E"}

**(iv) Deleting 32.**

First find it: `64 to 32`.

:color[32]{hex="#EF4444"} has **two children**, so it cannot simply be removed: something has to take its place, and only one value can. That value is the **in-order successor**, the smallest key in its right subtree, which here is :color[40]{hex="#2DD4BF"}.

Copy :color[40]{hex="#2DD4BF"} into the node, then delete the original 40 from the right subtree. That second delete is always easy, because the smallest node in a subtree has no left child.

![The search tree after the deletion](/notes/img/algorithms/ch10-q31d.svg)

:mark[**Answer: the two children case. In-order check: 4, 8, 12, 16, 24, 40, 48, 56, 64, 72, 80, 88, 96, 104, 112, 120**]{hex="#204A2E"}

### Q32. Search tree operations

> :mark[**Very hard**]{hex="#5C2323"} &nbsp; :mark[**15 marks**]{hex="#3A3A3E"}

![A binary search tree](/notes/img/algorithms/ch10-q32.svg)

**(i)** State the minimum and the maximum key, and give the path followed to each. &nbsp; :mark[**3 marks**]{hex="#3A3A3E"}

**(ii)** Search for **135** and then for **200**. List the nodes visited in each case. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iii)** Insert **10, 50, 250**, in that order. Draw the resulting tree. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**(iv)** Delete **210** from the **original** tree. State which case applies and draw the result. &nbsp; :mark[**4 marks**]{hex="#3A3A3E"}

**Solution.**

**(i) Minimum and maximum.**

No searching is needed for either. The smallest key is as far **left** as you can go, the largest as far **right**, so both are a single walk with no decisions.

| | Path | Value |
| --- | --- | --- |
| Minimum, keep going left | `120 to 60 to 30 to 15` | **15** |
| Maximum, keep going right | `120 to 180 to 210 to 240` | **240** |

:mark[**Answer: minimum 15, maximum 240**]{hex="#204A2E"}

**(ii) The two searches.**

At each node, compare. Equal means found, smaller means go left, larger means go right. You stop either on the key or on a missing child.

| Looking for | Nodes visited | Outcome |
| --- | --- | --- |
| :color[135]{hex="#FF5FA2"} | `120 to 180 to 150 to 135` | **found** at 135, after 4 comparisons |
| :color[200]{hex="#EF4444"} | `120 to 180 to 210` | **not found**, the walk runs off the bottom at 210 |

> Both searches touched at most **4** of the 14 nodes. That is the whole point of a search tree: every comparison throws away a subtree.

**(iii) The insertions.**

| Key | Route from the root | What happens |
| --- | --- | --- |
| :color[10]{hex="#2DD4BF"} | `120 to 60 to 30 to 15` | 10 becomes the left child of 15 |
| :color[50]{hex="#2DD4BF"} | `120 to 60 to 30 to 45` | 50 becomes the right child of 45 |
| :color[250]{hex="#2DD4BF"} | `120 to 180 to 210 to 240` | 250 becomes the right child of 240 |

![The search tree after the insertions](/notes/img/algorithms/ch10-q32i.svg)

:mark[**In-order check: 10, 15, 30, 45, 50, 60, 75, 90, 105, 120, 135, 150, 165, 180, 210, 240, 250**]{hex="#204A2E"}

**(iv) Deleting 210.**

First find it: `120 to 180 to 210`.

:color[210]{hex="#EF4444"} has **exactly one child**. Lift that child, :color[240]{hex="#2DD4BF"}, and the subtree hanging beneath it, straight into the gap. The ordering still holds because everything in that subtree was already on the correct side of 210's parent.

![The search tree after the deletion](/notes/img/algorithms/ch10-q32d.svg)

:mark[**Answer: the one child case. In-order check: 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 240**]{hex="#204A2E"}

---

# Self test

Answer these without looking back. If one of them makes you hesitate, that is the section to reread.

1. A node has one child. Is the tree still a binary tree? Is it still **full**?
2. What is the height of a tree with a single node, and of an empty tree?
3. Give the rule for each of the three traversals in the Root, Left, Right shorthand.
4. Where does the root appear in a pre-order walk? In a post-order walk?
5. Why is one traversal never enough to rebuild a tree, and which two together are?
6. Why is pre-order plus post-order still not enough?
7. State the search tree ordering rule using the word **subtree**, not the word **child**.
8. How do you find the minimum key, and how many comparisons does it take?
9. Where does a newly inserted key always end up?
10. Seven keys are inserted in sorted order. What is the height of the result?
11. Name the three deletion cases and what each one does.
12. In the two-children case, which node replaces the deleted one, and how do you find it?
13. Why is that replacement's own deletion always easy?
14. Is deleting the root a fourth case?
15. Which operation costs $O(n)$ no matter how well balanced the tree is?
16. What is the one check that catches nearly every mistake in this topic?

# Summary

| Idea | The short version |
| --- | --- |
| Binary tree | each node has at most two children, one root, one parent each |
| Height | edges down to the deepest leaf, a leaf is 0, empty is $-1$ |
| Depth | edges down from the root, the root is 0 |
| Full | every node has 0 or 2 children |
| Complete | every level filled except the last, which fills from the left |
| Balanced | at **every** node the subtree heights differ by at most 1 |
| Pre-order | Root, Left, Right. Root comes out first. Used to copy a tree. |
| In-order | Left, Root, Right. Sorted on a search tree. |
| Post-order | Left, Right, Root. Root comes out last. Used to delete a tree. |
| Rebuilding a tree | in-order plus one other. Pre plus post is not enough. |
| Search tree rule | left subtree all smaller, right subtree all larger, at every node |
| Search, insert, delete | $O(h)$, so $O(\log n)$ balanced and $O(n)$ degenerate |
| Find min or max | leftmost or rightmost node, no comparisons |
| Insert | always becomes a leaf, nothing already there moves |
| Insert sorted keys | gives a degenerate tree, the worst case |
| Delete | leaf, one child, or two children plus the in-order successor |
| The free check | the in-order walk of a correct search tree is sorted |
