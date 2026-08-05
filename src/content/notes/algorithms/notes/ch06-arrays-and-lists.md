# Chapter 6: Arrays and Lists

Python gives you two containers that look identical from the outside and behave differently underneath. The `list` is the one you already use. The **array** is what you reach for when every element is the same kind of number and there are a lot of them.

## The difference, briefly

| | **:color[list]{hex="#5B8CFF"}** | **:color[array.array]{hex="#A78BFA"}** | **:color[numpy.ndarray]{hex="#A78BFA"}** |
| --- | --- | --- | --- |
| Import needed | none, it is built in | `from array import array` | `import numpy as np` |
| Element types | **mixed**, anything at all | one type, fixed by a typecode | one type, fixed by a dtype |
| Dimensions | nested lists, any shape, ragged allowed | one dimension only | any number, but **rectangular** |
| Size | grows and shrinks freely | grows and shrinks | fixed at creation |
| Memory | a pointer per element, so more | the raw values, so less | the raw values, so less |
| Maths on the whole container | no, you write the loop | no | **yes**, element by element |
| Best at | mixed or irregular data | compact storage of one numeric type | numeric work, especially 2D |

The one line to remember: a :color[list]{hex="#5B8CFF"} stores **pointers to objects**, an :color[array]{hex="#A78BFA"} stores the **values themselves**, side by side in memory. Everything else in the table follows from that.

### The trap: `+` means two different things

This is the difference students actually get caught by:

| Expression | :color[list]{hex="#5B8CFF"} | :color[NumPy array]{hex="#A78BFA"} |
| --- | --- | --- |
| `[1, 2] + [3, 4]` | `[1, 2, 3, 4]`, joined end to end | `[4, 6]`, added element by element |
| `[1, 2] * 3` | `[1, 2, 1, 2, 1, 2]`, repeated | `[3, 6]`, each value tripled |

:mark[**On a list, `+` joins. On an array, `+` adds.**]{hex="#5C3A1A"}

### Which one should I use?

> Data of **mixed types**, or rows of **different lengths**, or a container you keep inserting into and deleting from: use a :color[list]{hex="#5B8CFF"}.
>
> A lot of numbers of the **same type**, especially in a rectangular 2D grid, and you want to do maths on them: use a :color[NumPy array]{hex="#A78BFA"}.

The stdlib `array.array` sits between the two. It is compact and it is one dimensional, so it is fine for a long run of numbers but useless for a matrix. Every worked question below therefore uses NumPy on the array side.

## How to read the questions

Each question is solved twice, side by side in one picture: the :color[list]{hex="#5B8CFF"} solution on the **blue left**, the :color[array]{hex="#A78BFA"} solution on the **violet right**. The comments in the code show the printed output, so you can check either version without running it.

---

# Worked questions

## Q1. Multiply two 2x2 matrices

Given $A = \begin{bmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix}$ and $B = \begin{bmatrix} 5 & 6 \\ 7 & 8 \end{bmatrix}$, compute $A \times B$.

![Two by two matrix multiplication, written with nested lists on the left and with a NumPy array on the right](/notes/img/algorithms/ch06-q1-matmul.svg)

Each entry of the answer is a row of $A$ dotted with a column of $B$:

$$
C_{ij} = \sum_{k} A_{ik} B_{kj} \qquad C = \begin{bmatrix} 19 & 22 \\ 43 & 50 \end{bmatrix}
$$

The :color[list]{hex="#5B8CFF"} version writes that sum out as three nested loops, which is exactly the $O(n^3)$ shape from Example 19 in Chapter 2. The :color[array]{hex="#A78BFA"} version is the single operator `@`, which is matrix multiplication in NumPy. It is still $O(n^3)$ work, but the loops run in compiled code rather than in Python.

> Watch the `*` on the array side. `A * B` would multiply the matrices **element by element** and give $\begin{bmatrix} 5 & 12 \\ 21 & 32 \end{bmatrix}$, which is not matrix multiplication. Use `@` or `np.dot`.

:mark[**Array wins on clarity, list wins on showing the method.**]{hex="#3A3A3E"}

## Q2. Find the minimum value in a 2D list

Find the smallest value in

$$
L = [[1,2,3,4],\; [5,6,6,7],\; [4,5,3,2],\; [-3,4,-5,6],\; [11]]
$$

![Finding the minimum of a ragged 2D structure, with nested loops on the left and a flattened NumPy array on the right](/notes/img/algorithms/ch06-q2-min2d.svg)

Look at the rows before writing any code. Four of them hold four values and the last holds one, so $L$ is **ragged**. That single fact decides the question:

- The :color[list]{hex="#5B8CFF"} version does not care. `for row in L` walks whatever is there, and `for value in row` walks however many values that row happens to have.
- The :color[array]{hex="#A78BFA"} version cannot build `np.array(L)` as a numeric 2D array at all, because an array has to be rectangular. You have to **flatten** first, and then `.min()` is one call.

Either way the answer is :mark[**$-5$**]{hex="#204A2E"}, from the fourth row.

The comparison count is the same for both: four rows of four and one row of one is 17 values, so 16 comparisons, which is **:color[O(n)]{hex="#22C55E"}** in the number of values.

:mark[**List wins: ragged data is what lists are for.**]{hex="#1E3A5C"}

## Q3. Total and average of a set of numbers

![Sum and average of a list of numbers, with an explicit loop on the left and sum and mean calls on the right](/notes/img/algorithms/ch06-q3-sum-average.svg)

The :color[list]{hex="#5B8CFF"} version accumulates in a loop, which is the version to write in an exam because it shows the method. In real code you would write `sum(nums) / len(nums)` and get the same answer in one line.

The :color[array]{hex="#A78BFA"} version has `.sum()` and `.mean()` built in, and both walk the values in compiled code. Both versions are **:color[O(n)]{hex="#22C55E"}**: every value must be looked at once.

:mark[**A tie on complexity, array wins on speed for large n.**]{hex="#3A3A3E"}

## Q4. Add two vectors element by element

![Element-wise addition of two vectors, with a comprehension on the left and a plus operator on the right](/notes/img/algorithms/ch06-q4-vector-add.svg)

This is the `+` trap in full. On the :color[list]{hex="#5B8CFF"} side, `x + y` gives `[1, 2, 3, 10, 20, 30]`, which is a joined list of six items and not the sum of anything. To actually add, you have to index both lists in step.

On the :color[array]{hex="#A78BFA"} side, `x + y` is the addition you wanted. NumPy calls this **vectorised** arithmetic, and it is the whole reason the container exists.

:mark[**Array wins clearly.**]{hex="#3B2A5E"}

## Q5. Find every position of a value

![Linear search for every position of a target value, with an indexed loop on the left and np.where on the right](/notes/img/algorithms/ch06-q5-search.svg)

The :color[list]{hex="#5B8CFF"} version is the linear search from Chapter 2: walk the indices, compare, collect the hits. Note it collects **every** match. `data.index(4)` would return only the first one, which is `1`.

The :color[array]{hex="#A78BFA"} version reads as one thought. `data == target` builds a boolean array `[False, True, False, True, False]`, and `np.where(...)` turns that into the indices where it is true.

Both are **:color[O(n)]{hex="#22C55E"}**. Neither can do better on unsorted data, because a value you have not looked at could be the one you want.

:mark[**A tie on complexity, array wins on how it reads.**]{hex="#3A3A3E"}

## Q6. Transpose a matrix

Turn a $2 \times 3$ matrix into a $3 \times 2$ one by swapping rows and columns.

![Transposing a matrix, with a nested comprehension on the left and the T attribute on the right](/notes/img/algorithms/ch06-q6-transpose.svg)

The :color[list]{hex="#5B8CFF"} version builds a new row for each **column** of the original, so the two loop variables swap places compared with the usual row then column order. That is the whole idea of a transpose, written out.

The :color[array]{hex="#A78BFA"} version is `.T`, and it does not even copy the data: NumPy just changes how the same block of memory is read. That makes it **:color[O(1)]{hex="#9CA3AF"}** where the list version is **:color[O(rows × cols)]{hex="#F97316"}**.

:mark[**Array wins, and by more than it looks.**]{hex="#3B2A5E"}

## Q7. List every mark above the average

![Selecting the values above the average, with a loop and an if on the left and boolean indexing on the right](/notes/img/algorithms/ch06-q7-above-average.svg)

Two passes either way: one to work out the average, one to test each value against it, so **:color[O(n)]{hex="#22C55E"}**.

The :color[array]{hex="#A78BFA"} version uses **boolean indexing**: `marks > average` is an array of `True`/`False`, and putting it inside `marks[...]` keeps only the positions that are `True`. It is the same idea as `np.where` in Q5, asking for the values instead of the positions.

:mark[**Array wins on length, list wins on being obvious to a reader.**]{hex="#3A3A3E"}

---

## What each operation costs

The complexity is the same whichever container you choose, with one exception worth knowing. This is the table from Chapter 2, with the array column added:

| Operation | :color[list]{hex="#5B8CFF"} | :color[NumPy array]{hex="#A78BFA"} |
| --- | --- | --- |
| Read or write `x[i]` | **:color[O(1)]{hex="#9CA3AF"}** | **:color[O(1)]{hex="#9CA3AF"}** |
| Append at the end | **:color[O(1)]{hex="#9CA3AF"}** amortised | not possible, the size is fixed |
| Insert or delete in the middle | **:color[O(n)]{hex="#22C55E"}** | **:color[O(n)]{hex="#22C55E"}**, and it rebuilds the array |
| `in`, or a linear search | **:color[O(n)]{hex="#22C55E"}** | **:color[O(n)]{hex="#22C55E"}** |
| Sum, min, max | **:color[O(n)]{hex="#22C55E"}** | **:color[O(n)]{hex="#22C55E"}** |
| Sort | **:color[O(n log n)]{hex="#EAB308"}** | **:color[O(n log n)]{hex="#EAB308"}** |
| Transpose a matrix | **:color[O(n²)]{hex="#F97316"}** | **:color[O(1)]{hex="#9CA3AF"}**, it only changes the view |

> **The constant is not the complexity.** A NumPy sum and a Python loop are both $O(n)$, and the NumPy one is still ten to a hundred times faster because it runs one machine level loop over contiguous memory instead of $n$ trips through the interpreter. Big O hides constants, and here the constant is what you feel.

## Self test

1. What does `[1, 2, 3] * 2` give, and what does `np.array([1, 2, 3]) * 2` give?
2. Why can `np.array(L)` not build a numeric 2D array from the $L$ in Q2?
3. Which container would you use for a row of a database holding a name, an age and a salary, and why?
4. `M` is $100 \times 100$. Is `M.T` cheaper on a list of lists or on a NumPy array, and by how much?
5. Both `sum(nums)` and `arr.sum()` are $O(n)$. Why is one still much faster?

> **Answers.**
> 1. `[1, 2, 3, 1, 2, 3]` for the list, because `*` repeats. `[2, 4, 6]` for the array, because `*` scales each value.
> 2. The rows have different lengths, and an array must be rectangular.
> 3. A list, because the three values are of three different types and an array holds only one type.
> 4. On the array. The list version copies $100 \times 100 = 10{,}000$ values, which is $O(n^2)$; the array version changes how the memory is read and copies nothing, which is $O(1)$.
> 5. Same number of additions, much smaller constant: the array version runs a compiled loop over values packed side by side, the list version goes through the interpreter and follows a pointer for every element.

## Chapter summary

- A :color[list]{hex="#5B8CFF"} holds pointers to any objects, of any types, in any shape. An :color[array]{hex="#A78BFA"} holds raw values of one type, packed together and rectangular.
- `+` **joins** lists and **adds** arrays. Confusing the two is the single most common mistake in this chapter.
- Mixed or ragged data goes in a list. Rectangular numeric data you want to do maths on goes in a NumPy array.
- The complexities mostly match, so choose on fit and on constants, not on Big O. The exception is the transpose, which is free on an array and quadratic on a list of lists.
