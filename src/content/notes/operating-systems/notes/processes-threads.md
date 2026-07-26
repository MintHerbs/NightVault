# Processes & Threads

---

## Table of Contents
1. [What is a Process?](#1-what-is-a-process)
2. [Process States](#2-process-states)
3. [Process Control Block (PCB)](#3-process-control-block-pcb)
4. [Interrupts & Interrupt Handling](#4-interrupts--interrupt-handling)
5. [Multiprogramming & CPU Utilization](#5-multiprogramming--cpu-utilization)
6. [Threads](#6-threads)
7. [Per-Process vs Per-Thread Items](#7-per-process-vs-per-thread-items)
8. [POSIX Threads (Pthreads)](#8-posix-threads-pthreads)
9. [User-Level Threads](#9-user-level-threads)
10. [Kernel Threads](#10-kernel-threads)
11. [Synchronization & Mutual Exclusion](#11-synchronization--mutual-exclusion)
    - [Race Conditions](#111-race-conditions)
    - [Critical Sections](#112-critical-sections--requirements-for-a-good-solution)
    - [Disabling Interrupts](#113-solution-1--disabling-interrupts)
    - [Strict Alternation](#114-solution-2--strict-alternation)
    - [Peterson's Solution](#115-solution-3--petersons-solution)
    - [TSL Instruction](#116-solution-4--tsl-instruction)
    - [Sleep & Wakeup](#117-solution-5--sleep--wakeup)
    - [Semaphores](#118-solution-6--semaphores)
    - [Mutexes](#119-solution-7--mutexes)
    - [Monitors](#1110-solution-8--monitors)
    - [Message Passing](#1111-solution-9--message-passing)
    - [Barriers](#1112-solution-10--barriers)
    - [Read-Copy-Update (RCU)](#1113-solution-11--read-copy-update-rcu)
12. [Exam Questions](#12-exam-questions)

---

## 1. What is a Process?

A **process** is a program in execution. It is the fundamental unit of work in an operating system.

Think of it like baking. A **recipe** is the program (static code on paper). When you actively follow the recipe; mixing ingredients, using the oven, etc. that active activity is the **process**. You (the CPU) are executing the recipe (the program), and the kitchen with all its ingredients and tools is the **process environment** (memory, files, resources).

Key points:
- A **program** is a passive, static file on disk.
- A **process** is a program that is currently being executed by the CPU.
- **Multiprogramming** is the technique of having multiple processes in memory and switching the CPU between them rapidly, giving the illusion that they all run simultaneously.

> **Diagram needed here:** Insert Figure 2.1 — Multiprogramming four programs: (a) one CPU switching between processes, (b) conceptual model of independent sequential processes, (c) timeline showing only one program active at a time.

---

## 2. Process States

A process can be in one of **three states** at any given time:

| State       | Description                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------- |
| **Running** | The process is currently using the CPU.                                                             |
| **Ready**   | The process is waiting its turn; it is ready to run but the CPU is occupied.                        |
| **Blocked** | The process is waiting for an event (e.g., I/O to complete) and cannot run even if the CPU is free. |

![image](/notes/img/operating-systems/6.webp)

### State Transitions

There are **four transitions** between states:

1. **Running → Blocked:** The process blocks itself waiting for something (e.g., reads from keyboard, waits for disk I/O).
2. **Running → Ready:** The scheduler decides to give the CPU to another process (preemption, e.g., time quantum expired).
3. **Ready → Running:** The scheduler picks this process to run next.
4. **Blocked → Ready:** The event the process was waiting for has occurred (e.g., I/O completed, keyboard input arrived).

### What causes a process to go BLOCKED?
- Performing I/O (e.g., reading from a file, keyboard, or terminal)
- Waiting for a resource to become available
- Executing a `read()` system call

### What does NOT cause a process to go BLOCKED?
- Completing its time quantum (fancy term for saying maximum amount of CPU time) this moves the process to **Ready**, not Blocked.

---

## 3. Process Control Block (PCB)

To manage processes, the OS maintains a **process table**, a table of structures where each entry corresponds to one process. Each entry is called a **Process Control Block (PCB)**.

The PCB stores everything the OS needs to know about a process so it can be paused and resumed correctly. Think of it as a "bookmark" for the process.

### PCB Fields (organized by category)

| Process Management | Memory Management | File Management |
|---|---|---|
| Registers | Pointer to text segment | Root directory |
| Program counter | Pointer to data segment | Working directory |
| Program status word | Pointer to stack segment | File descriptors |
| Stack pointer | | User ID |
| Process state | | Group ID |
| Priority | | |
| Scheduling parameters | | |
| Process ID | | |
| Parent process | | |
| Signals | | |
| CPU time used | | |

---

## 4. Interrupts & Interrupt Handling

While a process runs, hardware events can interrupt it. For example, when a disk finishes reading data, it sends an interrupt signal to the CPU.

### Interrupt Vector

Associated with each I/O device is a reserved memory location near the bottom of memory called an **interrupt vector**. It contains the address of the **interrupt service procedure** (also called the **interrupt handler**).

### Steps When an Interrupt Occurs

1. **Hardware stacks** the program counter, Program Status Word (PSW), and registers.
2. **Hardware loads** the new program counter from the interrupt vector.
3. **Assembly-language procedure saves** all registers (to preserve the process state).
4. **Assembly-language procedure sets up** a new stack for the interrupt handler.
5. **C interrupt service routine runs** (typically reads and buffers input).
6. **Scheduler decides** which process to run next.
7. **C procedure returns** to assembly code.
8. **Assembly-language procedure starts up** the new current process.

---

## 5. Multiprogramming & CPU Utilization

### Why Multiprogramming?

Processes spend a lot of time waiting for I/O. If only one process runs at a time (monoprogramming), the CPU is idle whenever that process is waiting. Multiprogramming keeps the CPU busy by switching to another process during I/O waits.

### CPU Utilization Formula

Let:
- **n** = number of processes in memory
- **p** = fraction of time a process spends waiting for I/O

Then:

> **CPU Utilization = 1 − p^n**  (Remember this formula cos you will use it in MCQ questions)

**Example:** If each process waits for I/O 80% of the time (p = 0.8):
- With 1 process: CPU = 1 − 0.8¹ = 20%
- With 2 processes: CPU = 1 − 0.8² = 1 − 0.64 = 36%
- With 5 processes: CPU = 1 − 0.8⁵ = 1 − 0.33 = 67%
- With 10 processes: CPU = 1 − 0.8¹⁰ = 1 − 0.11 = 89%

More processes in memory → higher CPU utilization (up to a point).

![image](/notes/img/operating-systems/7.webp)

### Key Assumption

The formula **assumes** that the I/O waits of all processes are **independent** — they do not all wait at the same time. In reality, this is an approximation.

---

## 6. Threads

### What is a Thread?

A **thread** is a lightweight, schedulable unit of execution *within a process*. Threads allow multiple tasks to happen concurrently inside the same process.

> Think of a restaurant. The restaurant itself is the **process**. The chef, the waiter, and the cashier are all **threads** — they work independently but share the same kitchen, ingredients (memory), and customers (resources).

### Why Use Threads?

- When multiple activities need to happen in parallel within the same application.
- Example: A **word processor** can have:
  - Thread 1: Interacts with the user (keyboard input)
  - Thread 2: Reformats the document
  - Thread 3: Saves to disk in the background
- Example: A **web server** uses a dispatcher thread to receive requests and worker threads to handle them.
- Threads are **cheaper** to create and manage than processes.
- They are often called **lightweight processes**.

![image](/notes/img/operating-systems/8.webp)

### Thread vs Process

| Feature                    | Process               | Thread                                        |
| -------------------------- | --------------------- | --------------------------------------------- |
| Shares address space?      | No (each has its own) | Yes (shares with all threads in same process) |
| Creation cost              | High                  | Low                                           |
| Communication              | Via IPC (complex)     | Via shared memory (easy but risky)            |
| Protection from each other | Yes                   | No                                            |

---

## 7. Per-Process vs Per-Thread Items

Not everything is shared between threads. Some things are shared across the entire process; others belong to each thread individually.

### Per-Process Items (Shared by all threads)
- Address space
- Global variables
- Open files
- Child processes
- Pending alarms
- Signals and signal handlers
- Accounting information

### Per-Thread Items (Private to each thread)
- **Program counter** (each thread tracks its own next instruction)
- **Registers** (each thread has its own CPU register state)
- **Stack** (each thread has its own call stack)
- **State** (running, blocked, ready)

---

## 8. POSIX Threads (Pthreads)

**POSIX** (Portable Operating System Interface) is a standard defined by IEEE that defines the API for Unix-compatible operating systems.

The POSIX thread standard is defined in **IEEE 1003.1c**. The thread package it defines is called **Pthreads**.

### Properties of Pthreads

Every Pthread thread has:
- A unique identifier
- A set of registers (including program counter)
- A set of attributes (stack size, scheduling parameters, etc.)

### Major Pthreads Functions

| Function | Description |
|---|---|
| `pthread_create` | Create a new thread |
| `pthread_exit` | Terminate the calling thread |
| `pthread_join` | Wait for a specific thread to exit |
| `pthread_yield` | Release the CPU so another thread can run |
| `pthread_attr_init` | Create and initialize a thread's attribute structure |
| `pthread_attr_destroy` | Remove a thread's attribute structure |

### Pthread Mutex Functions

| Function | Description |
|---|---|
| `pthread_mutex_init` | Create a mutex |
| `pthread_mutex_destroy` | Destroy an existing mutex |
| `pthread_mutex_lock` | Acquire a lock — **blocks** if not available |
| `pthread_mutex_trylock` | Acquire a lock — **fails immediately** if not available |
| `pthread_mutex_unlock` | Release a lock |

> **`lock` vs `trylock`:** `lock` will cause the thread to wait (block) until the mutex is free. `trylock` will immediately return an error if the mutex is taken — useful when you don't want to block.

### Pthread Condition Variable Functions

| Function | Description |
|---|---|
| `pthread_cond_init` | Create a condition variable |
| `pthread_cond_destroy` | Destroy a condition variable |
| `pthread_cond_wait` | Block waiting for a signal on the condition variable |
| `pthread_cond_signal` | Wake up one thread waiting on the condition variable |
| `pthread_cond_broadcast` | Wake up ALL threads waiting on the condition variable |

---

## 9. User-Level Threads

**User-level threads** are managed entirely in user space by a runtime library, without the kernel's knowledge.

### How They Work

- Each process has its own **thread table** to track its threads.
- When a thread wants to block voluntarily, it calls `thread_yield()` in the runtime library, which saves its state and loads another thread's state.
- The kernel sees only **one thread per process**.

### Advantages

- Thread switching is **much faster** than process switching (no kernel mode transition needed).
- Each application can have its **own customized scheduling algorithm**.
- They **scale better** — a process can have a very large number of user-level threads.

### Disadvantages

- If **one thread makes a blocking system call**, the **entire process blocks** — even threads that could have run.
- A **page fault** by any thread blocks the entire process.
- User-level threads are **not preemptive** — they must voluntarily yield the CPU (using `thread_yield`).

### Partial Solution

Send a **clock signal** (software interrupt) to the runtime system at regular intervals (e.g., every 1 second) to simulate preemption. However, high-frequency interrupts add overhead.

---

## 10. Kernel Threads

**Kernel threads** are managed directly by the OS kernel. The kernel has a thread table that tracks all threads in the system.

### How They Work

- All thread management calls (create, block, yield) are **system calls**.
- When a thread blocks, the kernel can run a different thread from **any process**.

### Advantages

- A blocking system call by one thread does **not** block other threads of the same process.
- A page fault by one thread does **not** affect other threads of the same process.
- Kernel threads can take advantage of **multiprocessor systems** — multiple threads from the same process can run in parallel on different CPUs.

### Disadvantages

- Creating and destroying kernel threads is **more expensive** (requires kernel mode transition).
- Switching between kernel threads is also **more expensive** than user-level thread switching.

### When a User-Level Thread Blocks in a Hybrid System

If a user-level thread makes a blocking system call in a system that also uses kernel threads, the kernel notifies the user-level thread system through an **upcall**, allowing the runtime to schedule another user-level thread onto a different kernel thread.

---

## 11. Synchronization & Mutual Exclusion

### 11.1 Race Conditions

A **race condition** occurs when two or more processes/threads access shared data, and the final result depends on the precise timing of their execution.

> **Example (Spooler Directory):** Imagine two processes A and B both want to print a file. A shared variable `in` points to the next free slot in the print queue. If both read `in = 7` at the same time, both write their file name to slot 7, and one file gets overwritten. The `in` variable should have become 9 but it's only 8.

![image](/notes/img/operating-systems/9.webp)

---

### 11.2 Critical Sections & Requirements for a Good Solution

A **critical section** (or critical region) is the part of a program where a shared resource (e.g., shared variable, file) is accessed.

For a good solution to prevent race conditions, **four conditions** must be satisfied:

1. **Mutual Exclusion:** No two processes may be in their critical sections at the same time.
2. **Progress:** No process outside its critical section may block other processes from entering theirs.
3. **Bounded Waiting:** No process should wait forever to enter its critical section (no starvation).
4. **No assumptions about speed:** The solution must not assume anything about the relative speeds of processes or number of CPUs.


![image](/notes/img/operating-systems/10.webp)

### 11.3 Solution 1- Disabling Interrupts

The simplest approach: before entering the critical section, a process **disables interrupts**. After leaving, it re-enables them.

**Disadvantage:**
- Disabling interrupts is a **privileged operation** — only the kernel should do it, not user processes.
- On **multiprocessor systems**, disabling interrupts on one CPU does not stop other CPUs from accessing shared data.
- If a process forgets to re-enable interrupts, the entire system can freeze.

---

### 11.4 Solution 2 - Strict Alternation

Uses a shared variable `turn` to alternate between two processes.

Process 0 waits while `turn != 0`; Process 1 waits while `turn != 1`.

**Disadvantage:**
- Requires **strict alternation** — if Process 0 finishes much faster than Process 1, it still must wait for Process 1 to take its turn, even if Process 1 is not interested in entering its critical section.
- This is **busy waiting** (spinning in a loop checking the variable) — wastes CPU time.

---

### 11.5 Solution 3 - Peterson's Solution

A software-based solution that correctly provides mutual exclusion for **two processes** without busy waiting problems of strict alternation.

Uses two variables: `turn` (whose turn it is) and `interested[N]` (whether each process wants to enter).

```c
#define FALSE 0
#define TRUE  1
#define N     2   /* number of processes */

int turn;
int interested[N];  /* all initially 0 (FALSE) */

void enter_region(int process) {
    int other = 1 - process;          /* the other process */
    interested[process] = TRUE;       /* show interest */
    turn = process;                   /* set flag */
    while (turn == process && interested[other] == TRUE); /* wait */
}

void leave_region(int process) {
    interested[process] = FALSE;      /* indicate departure */
}
```

**Disadvantage:**
- Still uses **busy waiting** (the `while` loop spins).
- Busy waiting can cause **priority inversion**: if a low-priority process L is in its critical section and a high-priority process H is spinning waiting, H will hog the CPU but never get in (since L never gets CPU time to leave).

---

### 11.6 Solution 4 - TSL Instruction

**TSL (Test-and-Set Lock)** is a hardware-supported atomic instruction. It reads a memory word into a register and sets that word to 1 — all in a single, uninterruptible operation.

```asm
enter_region:
    TSL REGISTER, LOCK    ; copy lock to register, set lock to 1
    CMP REGISTER, #0      ; was lock zero?
    JNE enter_region      ; if not zero, lock was set, so loop
    RET                   ; return; critical region entered

leave_region:
    MOVE LOCK, #0         ; store 0 in lock
    RET                   ; return to caller
```

A similar instruction is **XCHG** (exchange), which atomically swaps the contents of a register and a memory location.

**Disadvantage:** Also uses busy waiting → can cause priority inversion.

---

### 11.7 Solution 5 - Sleep & Wakeup

Instead of busy waiting, processes can **sleep** (block themselves) when they can't enter the critical section and be **woken up** by another process when the resource is free.

**The Producer-Consumer Problem:**
- A **producer** creates items and puts them in a shared buffer.
- A **consumer** removes items from the buffer.
- If the buffer is full, the producer sleeps. If empty, the consumer sleeps.

**The Fatal Race Condition Problem with Sleep/Wakeup:**

A **lost wakeup** can occur:
1. Consumer reads `count = 0`, is about to call `sleep()`.
2. Before it calls sleep, the producer runs, increments `count` to 1, and calls `wakeup(consumer)`.
3. Consumer hasn't actually slept yet, so the wakeup signal is **lost**.
4. Consumer now goes to sleep, and the producer eventually fills the buffer and also goes to sleep.
5. **Both are asleep forever** — deadlock.

**Solution:** Use a **wakeup waiting bit** or (better) use **semaphores**.

---

### 11.8 Solution 6 - Semaphores

A **semaphore** is a special integer variable that can only be accessed through two **atomic** operations:

- **`down(s)` / `wait(s)` / `P(s)`:** If `s > 0`, decrement it and continue. If `s == 0`, block the process.
- **`up(s)` / `signal(s)` / `V(s)`:** Increment `s`. If processes are blocked on this semaphore, wake one up.

The key: these operations are **atomic** — they cannot be interrupted halfway.

**Solving the Producer-Consumer problem with semaphores:**

```c
semaphore mutex = 1;    /* controls access to critical region */
semaphore empty = N;    /* counts empty buffer slots */
semaphore full  = 0;    /* counts full buffer slots */

void producer(void) {
    int item;
    while (TRUE) {
        item = produce_item();
        down(&empty);       /* decrement empty count */
        down(&mutex);       /* enter critical region */
        insert_item(item);
        up(&mutex);         /* leave critical region */
        up(&full);          /* increment full count */
    }
}

void consumer(void) {
    int item;
    while (TRUE) {
        down(&full);        /* decrement full count */
        down(&mutex);       /* enter critical region */
        item = remove_item();
        up(&mutex);         /* leave critical region */
        up(&empty);         /* increment empty count */
        consume_item(item);
    }
}
```

> ⚠️ **Order matters!** Always do `down` on the counting semaphore (`empty` or `full`) **before** `down` on the mutex. Reversing the order can cause **deadlock**.

---

### 11.9 Solution 7 - Mutexes

A **mutex** (mutual exclusion variable) is a **binary semaphore** — it can only be 0 (unlocked) or 1 (locked). It is used when the counting ability of a semaphore is not needed.

- `mutex_lock()`: acquire the mutex (block if already locked)
- `mutex_unlock()`: release the mutex

In Pthreads:
- `pthread_mutex_lock` — blocks until lock is available
- `pthread_mutex_trylock` — returns immediately with error if lock is not available (non-blocking)
- `pthread_mutex_unlock` — releases the lock

**Difference between `lock` and `trylock`:**
- `lock`: The thread **waits (blocks)** until it can acquire the mutex.
- `trylock`: The thread tries to acquire the mutex; if it **fails**, it returns an error code immediately without blocking.

---

### 11.10 Solution 8 — Monitors

A **monitor** is a high-level synchronization construct. It is a collection of procedures, data structures, and variables grouped together into a special module or package, designed to control access to a shared resource.

Key properties:
- **Only one process/thread can be active inside the monitor at any time** — mutual exclusion is automatic.
- If a process inside the monitor cannot continue (e.g., buffer is full), it calls `wait(c)` on a **condition variable `c`**, which blocks it and allows another process to enter the monitor.
- When a process is done and the condition may now be true, it calls `signal(c)` to wake up one blocked process.

```
monitor ProducerConsumer
    condition full, empty;
    integer count;

    procedure insert(item: integer);
    begin
        if count = N then wait(full);
        insert_item(item);
        count := count + 1;
        if count = 1 then signal(empty)
    end;

    function remove: integer;
    begin
        if count = 0 then wait(empty);
        remove := remove_item;
        count := count - 1;
        if count = N - 1 then signal(full)
    end;

    count := 0;
end monitor;
```

**Advantage over semaphores:** The programmer cannot accidentally forget to call `down` before accessing shared data — the monitor enforces mutual exclusion automatically.

> In Java, methods declared with `synchronized` act as monitors.

---

### 11.11 Solution 9 - Message Passing

Instead of sharing memory, processes can communicate by explicitly **sending and receiving messages** using `send(destination, &message)` and `receive(source, &message)`.

Useful for:
- Distributed systems where processes are on different machines.
- When shared memory is not available.

The consumer sends N empty message slots to the producer. The producer fills them and sends them back. Mutual exclusion is handled naturally by the message passing mechanism.

---

### 11.12 Solution 10 - Barriers

A **barrier** is a synchronization mechanism for a group of processes. No process is allowed to proceed past the barrier until **all processes** have reached it.

Use case: Parallel computations where all processes must finish one phase before any begins the next phase.


---

### 11.13 Solution 11 -  Read-Copy-Update (RCU)

**RCU** is a synchronization mechanism that allows **multiple readers** to access data simultaneously **without locks**, while writes are handled carefully.

How it works:
1. Readers access the current version of the data without locking.
2. A writer makes a **copy** of the data structure, modifies the copy, then **atomically replaces the pointer** to the new version.
3. Old versions are freed only after all readers that were using them have finished.

Used in the Linux kernel for data structures that are read much more often than written.

---

---

## 12. Exam Questions (The Good Shit)

> These questions are taken from the course exam question bank. Questions have been filtered to include only those relevant to Processes & Threads.

---

### MCQ — Multiple Choice Questions

---

**Q1.** Which of the following reason(s) explain the need for processes to communicate?
I. To share data
II. To synchronize
III. To avoid race conditions
IV. To prevent page faults

A. I only
B. II, III and IV
C. I and III only
**D. I, II and III ✓**

> **Answer: D.** Processes communicate to share data, synchronize, and avoid race conditions. Preventing page faults is a memory management concern, not a reason for IPC.

---

**Q2.** Which of the following is shared by all threads belonging to a process?

A. Stack
B. State
**C. Address Space ✓**
D. Registers

> **Answer: C.** All threads in a process share the same address space (and global variables, open files, etc.). Stack, state, and registers are per-thread items.

---

**Q3.** A number of reasons could cause the termination of a process. If a process tries to look for a file which does not exist, which of the following would cause the process to terminate?

A. Normal Exit
B. Error Exit
**C. Fatal Error ✓**
D. Killed by another process

> **Answer: C.** A file-not-found error that the program cannot handle is a fatal error — an unrecoverable error that forces the OS to terminate the process.

---

**Q4.** If 2 processes do I/O 80% of the time, what would be the CPU usage assuming that the processes never wait for the CPU at the same time?

A. 0.8²
**B. 1 − 0.8² ✓**
C. 0.2²
D. 1 − 0.2²

> **Answer: B.** CPU utilization = 1 − p^n = 1 − 0.8² = 1 − 0.64 = **36%**. With p = 0.8 (80% I/O time) and n = 2 processes.

---

**Q5.** If two processes do I/O operations 20% of the time, what would be the CPU usage assuming that the processes never wait for the CPU at the same time?

A. 0.8²
B. 1 − 0.8²
C. 0.2²
**D. 1 − 0.2² ✓**

> **Answer: D.** CPU utilization = 1 − p^n = 1 − 0.2² = 1 − 0.04 = **96%**. With p = 0.2 (20% I/O time) and n = 2 processes.

---

**Q6.** Which of the following is a per-thread item rather than a per-process item?

A. Open files
B. Child processes
C. Signals
**D. Stack ✓**

> **Answer: D.** The stack is private to each thread. Open files, child processes, and signals are per-process (shared by all threads).

---

**Q7.** In which of the following is a process NOT likely to go into the blocked state?

A. It has to perform output to a file
**B. It has completed a time quantum ✓**
C. It causes a page fault
D. It has to perform input from terminal

> **Answer: B.** Completing a time quantum moves a process from Running to **Ready** (not Blocked). I/O operations and page faults move a process to the Blocked state.

---

**Q8.** In the solution to mutual exclusion using monitors, when a process cannot continue because it has to wait for another process:

**A. It does a wait on a condition variable ✓**
B. It does a wait on a semaphore
C. It does a signal on a condition variable
D. It does a signal on a semaphore

> **Answer: A.** In a monitor, a blocked process calls `wait(c)` on a condition variable, which suspends it inside the monitor.

---

**Q9.** In the solution to mutual exclusion using monitors, when a process exits the monitor, it can wake up a blocked process through:

A. A signal on a semaphore
B. A wait on a condition variable
C. A wait on a semaphore
**D. A signal on a condition variable ✓**

> **Answer: D.** When a process exits or no longer needs exclusive access, it calls `signal(c)` on a condition variable to wake up a waiting process.

---

**Q10.** One advantage of kernel threads as compared to user-level threads is that:

A. Kernel threads are less expensive to create than user-level threads
B. Kernel threads have more scheduling flexibility than user-level threads
**C. Multiple kernel threads within a process can make use of different processors in parallel ✓**
D. Multiple kernel threads within a process can make use of different address spaces

> **Answer: C.** Kernel threads are visible to the OS and can be scheduled on different CPUs simultaneously, enabling true parallelism.

---

**Q11.** One disadvantage of Shortest-Job-First scheduling in a dynamic computer system is that it may cause:

A. Priority Inversion
**B. Starvation ✓**
C. Deadlock
D. Race Conditions

> **Answer: B.** Long jobs may never get to run if short jobs keep arriving — this is starvation.

---

**Q12.** Peterson's solution and TSL both provide for workable means of providing for mutual exclusion. However, the disadvantage of both is that they use busy waiting, which can result in:

**A. Priority Inversion ✓**
B. Disabling interrupts
C. Unnecessarily blocking the processes
D. Race Conditions

> **Answer: A.** Busy waiting causes priority inversion: a low-priority process holds the lock while a high-priority process spins waiting for it, but the low-priority process never gets CPU time to release it.

---

**Q13.** Which of the following operations is required when switching from one process to another?
I. Changing from user to kernel mode
II. The state of the current process must be saved
III. An appropriate process must be found
IV. Hardware registers may have to be reloaded

A. I only
B. I and II
C. I, II and III
**D. I, II, III and IV ✓**

> **Answer: D.** All four operations are required during a context switch.

---

**Q14.** When asked for a CPU scheduling scheme that can potentially cause starvation, students gave:
I. Shortest Job First
II. Round Robin
III. Priority Scheduling

A. All three are correct
B. I only is correct
**C. I and III only are correct ✓**
D. II only is correct

> **Answer: C.** SJF can starve long jobs; Priority Scheduling can starve low-priority processes. Round Robin gives each process an equal quantum, so no process starves.

---

**Q15.** When asked for a page replacement algorithm that uses the R bit, students gave:
I. The clock algorithm
II. The second-chance algorithm
III. The not-recently used algorithm

**A. All three are correct ✓**
B. I only is correct
C. I and II only are correct
D. I and III only are correct

> **Answer: A.** All three algorithms (clock, second-chance, NRU) use the reference (R) bit to determine which page to replace.

---

**Q16.** A CPU register containing the address of the next instruction to be fetched for the currently running process is known as the:

A. Processor Status Word
B. Next Instruction Register
C. Stack Pointer
**D. Program Counter ✓**

> **Answer: D.** The Program Counter (PC) holds the address of the next instruction.

---

**Q17.** Students were asked to give an example of a technique that can successfully provide for mutual exclusion but can cause priority inversion. Among the answers given were:
I. TSL
II. Peterson's solution

A. I only is correct
B. II only is correct
**C. Both are correct ✓**
D. None is correct

> **Answer: C.** Both TSL and Peterson's solution use busy waiting, which can lead to priority inversion.

---

**Q18.** In a producer-consumer problem using a bounded buffer, semaphores S1 (counts empty slots) and S2 (counts full slots). The consumer is likely to do:

**A. An up on S1 and a down on S2 ✓**
B. An up on S1 and an up on S2
C. A down on S1 and an up on S2
D. A down on S1 and a down on S2

> **Answer: A.** The consumer takes an item from the buffer: decrements S2 (one fewer full slot) and increments S1 (one more empty slot after consuming).

---

**Q19.** In a computer system, processes spend on average 20% of the time processing and 80% of the time doing I/O. The minimum number of processes required to keep the CPU busy for at least 75% of the time is:

A. 2
B. 5
**C. 7 ✓**
D. 10

> **Answer: C.** With p = 0.8: 1 − 0.8^n ≥ 0.75 → 0.8^n ≤ 0.25. At n=6: 0.8^6 ≈ 0.262 (CPU ≈ 73.8% — not enough). At n=7: 0.8^7 ≈ 0.210 (CPU ≈ 79% ≥ 75% ✓).

---

**Q20.** The data structure that contains information about a process' state, program counter, stack pointer, together with other process management information, is known as the:

A. Scheduler
B. Interrupt vector
**C. Process control block ✓**
D. Thread

> **Answer: C.** The Process Control Block (PCB) is the OS data structure that stores all information about a process.

---

**Q21.** A computer system uses guaranteed scheduling. Which process is scheduled based on which has received the least CPU time relative to what it was promised?

> **Answer:** The process with the lowest ratio of (CPU time received) / (CPU time entitled to receive) is scheduled next.

---

**Q22.** One disadvantage of providing for Mutual Exclusion through the TSL instruction is that:

**A. It causes busy waiting, which consumes processor time and causes priority inversion ✓**
B. It disables interrupts
C. It blocks the memory locations
D. It blocks processes from entering their critical sections

> **Answer: A.** TSL uses busy waiting (spinning), which wastes CPU time and can cause priority inversion.

---

**Q23.** The Peterson's solution is a means of providing for:

A. Busy waiting
**B. Mutual exclusion ✓**
C. Disabling interrupts
D. Test and set lock

> **Answer: B.** Peterson's solution is a software algorithm designed to achieve mutual exclusion between two processes.

---

**Q24.** Which of the following operations is performed on a semaphore by a process wishing to **enter** its critical section?

A. up
**B. down ✓**
C. signal
D. wait (also acceptable)

> **Answer: B.** A process does `down(semaphore)` (also called `P` or `wait`) to enter its critical section. If the semaphore is 0, the process blocks.

---

**Q25.** A _________________________ is a collection of procedures, data structures and variables grouped together as a package, with the aim of controlling access to the critical section.

A. Monitor
B. Semaphore
C. Mutex
**D. Monitor ✓** (also A)

> **Answer: A.** A **monitor** is a high-level synchronization construct that encapsulates data and procedures to ensure only one process is active inside it at a time.

---

**Q26.** When asked for an event that causes a process to enter a blocked state, students gave:
I. Performing a read from a keyboard
II. Writing a block on the disk

A. I only is correct
B. II only is correct
C. None is correct
**D. Both are correct ✓**

> **Answer: D.** Both reading from a keyboard and writing to a disk involve I/O, which causes the process to block while waiting for the operation to complete.

---

**Q27.** Which of the following is an operation whereby a process tries to acquire a lock and **blocks** if it is unsuccessful?

A. Pthread_mutex_init
**B. Pthread_mutex_lock ✓**
C. Pthread_mutex_trylock
D. Pthread_mutex_unlock

> **Answer: B.** `pthread_mutex_lock` blocks the calling thread until the mutex becomes available. `pthread_mutex_trylock` would fail without blocking.

---

**Q28.** Assuming a process P has three user-level threads P1, P2, P3 and process Q has user-level threads Q1 and Q2. Given that P2 makes a blocking system call, and all other threads are ready, which of the following lists contains all possible schedulable threads?

A. P1, P3, Q1 and Q2
B. P2 and Q1
**C. Q1 and Q2 ✓**
D. P1, P2, P3, Q1 and Q2

> **Answer: C.** With user-level threads, the kernel sees only one thread per process. When P2 makes a blocking system call, the entire process P is blocked (the kernel blocks P's single kernel-visible thread). Only Q1 and Q2 (from a different process) remain schedulable.

---

**Q29.** Which is used when the semaphore's ability to count is not required?

A. Monitor
B. Run time thread environment
C. Semaphore
**D. Mutex ✓**

> **Answer: D.** A mutex is a binary semaphore used specifically when you only need a lock (locked/unlocked), not a counting mechanism.

---

**Q30.** Which of the following scheduling algorithms uses pre-emption based on a clock and assigns a quantum to each process?

A. FIFO
B. Shortest Job First
**C. Round Robin ✓**
D. Priority Scheduling

> **Answer: C.** Round Robin preempts each process after a fixed time quantum (clock-based preemption) and cycles through all ready processes.

---

**Q31.** A low priority process L, in its critical section, prevents a high priority process H from entering its critical section. This situation is called:

A. Pre-emption
**B. Priority Inversion ✓**
C. Deadlock
D. Lost-Wakeup

> **Answer: B.** Priority inversion occurs when a low-priority process effectively blocks a high-priority process by holding a resource the high-priority process needs.

---

**Q32.** Which of the following is a collection of procedures, data structures, and variables grouped together into a special module or package?

**A. Monitor ✓**
B. Run time thread environment
C. Semaphore
D. Mutex

> **Answer: A.** A monitor groups data and procedures together to control access to a shared resource.

---

**Q33.** Which of the following operations is required when switching from one process to another?
I. Changing from user to kernel mode
II. The state of the current process must be saved
III. An appropriate process must be found
IV. Hardware registers may have to be reloaded

**A. I, II, III and IV ✓**

> **Answer: D (I, II, III and IV).** All four steps are necessary for a context switch.

---

**Q34.** When a user-level thread makes a blocking system call, the kernel notifies the user-level thread system through a(n):

**A. Upcall ✓**
B. Wakeup
C. SIGTERM
D. Sleep

> **Answer: A.** An upcall is a mechanism where the kernel notifies the user-level thread runtime that a thread has blocked, so the runtime can schedule another thread.

---

**Q35.** The main reason why TSL is not used as the main synchronization mechanism in inter-process communication is that:

A. It uses interrupts
B. It causes processes to block
**C. It uses busy waiting ✓**
D. It cannot synchronize more than two processes at a time

> **Answer: C.** TSL's main drawback is busy waiting — the process spins in a loop checking the lock, wasting CPU time.

---

**Q36.** Which of the following lists the processing entities in ascending order of creation time?

A. Process, user-level thread, kernel thread
**B. Process, kernel thread, user-level thread ✓**
C. Kernel thread, process, user-level thread
D. User-level thread, kernel thread, process

> **Answer: B.** Processes were the original OS concept. Kernel threads were added to support true parallelism. User-level thread libraries were developed on top of these.

---

**Q37.** The main disadvantage of the Peterson's solution for mutual exclusion is that:

**A. It can potentially cause priority inversion ✓**
B. It disables interrupts
C. It is a hardware solution
D. It can potentially cause race conditions on lock variables

> **Answer: A.** Peterson's solution uses busy waiting, which leads to priority inversion.

---

**Q38.** Which of the following scheduling algorithms used pre-emption based on a clock and assigns a quantum to each process?

A. FIFO
B. Shortest Job First
**C. Round Robin ✓**
D. Priority Scheduling

> **Answer: C.**

---

**Q39.** In the two-level page table, the entries in the top level page table contain:

**A. Pointers to the physical memory addresses of the start of the second-level page tables ✓**
B. Pointers to the physical disk block addresses
C. TLB addresses
D. Pointers to virtual addresses

> **Answer: A.** *(Note: This is a memory management question — included for completeness.)*

---

### Fill in the Blanks

---

**Q1.** In a multithreading system, each thread has its own ____________ which holds the address of the next instruction to be executed by the thread.

> **Answer: program counter**

---

**Q2.** To implement processes, the OS maintains a table of structures called the process table. The entry for a process is known as the process ____________.

> **Answer: control block** (Process Control Block / PCB)

---

**Q3.** One disadvantage of the shortest-job-first scheduling scheme is that in a dynamic system it can potentially cause ____________ to long jobs.

> **Answer: starvation**

---

**Q4.** In the Rate-Monotonic scheduling scheme, the scheduling priority of a process is inversely proportional to its ____________.

> **Answer: time period** (i.e., a process that must run every 25ms has higher priority than one that runs every 50ms)

---

**Q5.** In memory management, two important issues handled by the base and limit registers are ____________ and protection.

> **Answer: relocation**

---

**Q6.** User-level threads are ____________; they have to yield voluntarily.

> **Answer: not preemptive** (non-preemptive)

---

**Q7.** Multithreading using ____________ threads has the advantage that threads belonging to the same process can make use of multiple processors in parallel.

> **Answer: kernel**

---

**Q8.** One advantage of a(n) ____________ thread implementation is that it allows each process to have its own customized thread scheduling algorithm.

> **Answer: user-level**

---

**Q9.** For controlling entry to critical sections between threads, a form of binary semaphore known as a(n) ____________ is often used.

> **Answer: mutex**

---

**Q10.** A(n) ____________ CPU scheduling algorithm picks up a process to run and allows it to run until it either completes its task or voluntarily blocks.

> **Answer: non-preemptive** (or FCFS/FIFO)

---

**Q11.** The ____________ is a structure holding information about a running process.

> **Answer: Process Control Block (PCB)**

---

**Q12.** The Peterson's solution for providing mutual exclusion has the disadvantage that it can cause ____________.

> **Answer: busy waiting** (and consequently, priority inversion)

---

**Q13.** Each I/O device has a reserved location near the bottom of memory called an interrupt vector which contains the address of the ____________.

> **Answer: interrupt service procedure** (interrupt handler)

---

**Q14.** To avoid race conditions, processes should have ____________ over the critical section of code.

> **Answer: mutual exclusion**

---

**Q15.** The ____________ of a computer system is a measure of the number of tasks completed in a given time.

> **Answer: throughput**

---

**Q16.** One disadvantage of Shortest-Job-First scheduling in a dynamic computer system is that it may cause ____________ of processes having long processing times.

> **Answer: starvation**

---

**Q17.** Each entry in the process table is called a ____________.

> **Answer: Process Control Block (PCB)**

---

**Q18.** When processes access shared data, the lines of code where the shared data is accessed are collectively known as the ____________.

> **Answer: critical section**

---

**Q19.** When a process P is currently being executed, and the scheduler picks up another process Q to run, P is said to move to a ____________ state.

> **Answer: ready**

---

**Q20.** Pthread is a thread implementation package based on the ____________ standard.

> **Answer: POSIX**

---

**Q21.** A(n) ____________ scheduling algorithm picks up a process and lets it run until it finishes.

> **Answer: non-preemptive** (also acceptable: run-to-completion)

---

**Q22.** In the ____________ CPU scheduling scheme, a process can donate its CPU share to another process through the transfer of tickets.

> **Answer: lottery scheduling**

---

**Q23.** Busy waiting should be avoided because it wastes CPU time and can cause ____________.

> **Answer: priority inversion**

---

**Q24.** The section of code in a program where access is made to shared variables is known as the ____________ section and should be protected through mutual exclusion.

> **Answer: critical**

---

**Q25.** The situation when two processes are reading or writing the same data, and the result depends on who runs precisely when, is called a ____________.

> **Answer: race condition**

---

**Q26.** The part of a program where a shared resource is being accessed is called the ____________.

> **Answer: critical section**

---

**Q27.** A process which spends much less time waiting for I/O than doing computation is called a ____________ process.

> **Answer: CPU-bound**

---

**Q28.** In Rate Monotonic Scheduling, a process which needs to run every 25 ms will be assigned a priority of ____________.

> **Answer: 1/25 = 0.04** (In Rate Monotonic Scheduling, priority = 1/period. The shorter the period, the higher the priority.)

---

**Q29.** With a clock rate of 60 Hz and a 32-bit counter, the clock is expected to overflow in ____________ hours.

> **Answer:** 2^32 ticks ÷ 60 ticks/sec = 71,582,788 seconds ÷ 3600 = **≈ 19,884 hours** (about 828 days)

---

**Q30.** Associated with each I/O device is a location near the bottom of memory known as the ____________ that contains the address of the interrupt service procedure.

> **Answer: interrupt vector**

---

### Theory Questions & Answers

---

**Theory Q1.** Explain what a process is and describe the three-state process model showing all possible state transitions with the events that cause each transition. [3 + 2 marks]

> **Answer:**
>
> A **process** is a program in execution. It includes the program code, its current activity (represented by the program counter), the process stack, the heap, and the resources allocated to it (open files, I/O devices, etc.).
>
[state diagram from above]
>
> The three states are:
> - **Running:** The process is actively using the CPU.
> - **Ready:** The process is waiting to be assigned to the CPU; it is able to run but another process is currently running.
> - **Blocked:** The process is waiting for some event (e.g., I/O completion) to occur before it can proceed.
>
> The four transitions and their causes:
> 1. **Running → Blocked:** The process requests I/O or waits for a resource that is not immediately available (e.g., reads from keyboard).
> 2. **Running → Ready:** The scheduler preempts the process (e.g., its time quantum has expired or a higher-priority process becomes ready).
> 3. **Ready → Running:** The scheduler selects this process to run next.
> 4. **Blocked → Ready:** The event the process was waiting for has occurred (e.g., I/O completes, data arrives).

---

**Theory Q2.** Discuss the advantages and disadvantages of user-level threads. [6 marks]

> **Answer:**
>
> **Advantages of User-Level Threads:**
> 1. **Fast thread switching:** Switching between user-level threads does not require a system call or a mode switch to the kernel. It is as fast as a function call. This makes scheduling much faster.
> 2. **Customized scheduling:** Each process can implement its own thread scheduling algorithm tailored to its specific needs, without changing the OS kernel.
> 3. **Better scalability:** A process can support a very large number of user-level threads since the kernel is not involved in managing them.
> 4. **Portability:** User-level thread libraries can run on any OS, even those that don't natively support threads.
>
> **Disadvantages of User-Level Threads:**
> 1. **Blocking system calls block the entire process:** If a user-level thread makes a blocking system call (e.g., read from a file), the entire process — including all other threads — is blocked by the kernel. This defeats the purpose of threading.
> 2. **Page faults block all threads:** If one thread causes a page fault, the kernel blocks the entire process.
> 3. **Not truly preemptive:** User-level threads must voluntarily yield the CPU (call `thread_yield`). A thread that does not yield can monopolize the CPU within its process.
> 4. **Cannot exploit multiple processors:** The kernel only sees one thread for the whole process. Even on a multi-CPU machine, only one user-level thread can run at a time within a process.

---

**Theory Q3.** A student wrote the following code trying to implement mutual exclusion using Peterson's algorithm:

```c
Process(int i)
While (TRUE)
{
    criticalsection();
    enter_region(i);
    noncriticalsection();
    leave_region
    noncriticalsection();
}
```

Comment on the efficiency of this code to achieve its purpose. [3 marks]

> **Answer:** This code is **incorrect** and will **not achieve mutual exclusion**.
>
> The fundamental error is the **order of calls**: `criticalsection()` is called **before** `enter_region(i)`. The `enter_region()` call is supposed to be the gate that prevents multiple processes from being in the critical section simultaneously. By calling `criticalsection()` first (before requesting entry), the process enters the critical section without acquiring the lock — meaning multiple processes can be in the critical section at the same time, violating mutual exclusion.
>
> The correct order should be: `enter_region(i)` → `critical_section()` → `leave_region(i)` → `noncritical_region()`.

---

**Theory Q4.** Explain the disadvantages of Mutual Exclusion through disabling interrupts. [3 marks]

> **Answer:**
> 1. **Not feasible for user processes:** Disabling interrupts is a privileged operation that can only be performed by the kernel. Giving user processes this ability would be dangerous — a malicious or buggy process could disable interrupts and never re-enable them, hanging the entire system.
> 2. **Does not work on multiprocessor systems:** Disabling interrupts on one CPU does not prevent other CPUs from accessing the shared memory. Other CPUs continue running and can still enter the critical section.
> 3. **Risk of system freeze:** If a process disables interrupts and crashes or forgets to re-enable them, no interrupt will ever be handled again, effectively freezing the computer.

---

**Theory Q5.** Consider 3 processes A, B and C with processing times 24, 3, and 3 seconds respectively and assume they joined the ready queue at time t=0, t=17, and t=19 respectively. Calculate the average waiting time using First-Come First-Served (FCFS). [4 marks]

> **Answer:**
>
> FCFS serves processes in order of arrival.
>
> Execution order:
> - A arrives at t=0, runs from t=0 to t=24. **Waiting time = 0 seconds.**
> - B arrives at t=17, but A is still running. B waits until t=24. Runs from t=24 to t=27. **Waiting time = 24 − 17 = 7 seconds.**
> - C arrives at t=19, waits until t=27. Runs from t=27 to t=30. **Waiting time = 27 − 19 = 8 seconds.**
>
> **Average waiting time = (0 + 7 + 8) / 3 = 15/3 = 5 seconds.**

---

**Theory Q6.** Using Sleep and Wakeup to achieve mutual exclusion in a producer-consumer problem, both the producer and the consumer can end up sleeping forever. Explain how this situation can arise and suggest one possible solution. [marks from slides Q2f]

> **Answer:**
>
> **How both end up sleeping (the lost wakeup problem):**
> 1. The consumer checks `count == 0` and finds it true (buffer is empty).
> 2. Before the consumer calls `sleep()`, the CPU switches to the producer.
> 3. The producer inserts an item, increments `count` to 1, and calls `wakeup(consumer)`.
> 4. Since the consumer hasn't actually gone to sleep yet, this wakeup call is **lost** (ignored).
> 5. The consumer now executes `sleep()` and sleeps.
> 6. The producer continues filling the buffer. When the buffer is full, it calls `sleep()`.
> 7. **Both processes are now asleep indefinitely** — a deadlock.
>
> **Solution:** Use a **semaphore** instead of sleep/wakeup. Semaphores are atomic — the check and the block happen as a single uninterruptible operation. This eliminates the window between checking the condition and actually sleeping.

---

**Theory Q7.** List 4 events that result in process creation. [4 marks]

> **Answer:**
> 1. **System initialization:** When the OS boots, it creates several processes (e.g., daemons, init process).
> 2. **Execution of a process creation system call by a running process:** A running process calls `fork()` (Unix) to create a child process.
> 3. **A user request to create a new process:** A user types a command or double-clicks an application.
> 4. **Initiation of a batch job:** In batch systems, when a new job is submitted, the OS creates a process for it.

---

**Theory Q8.** Explain what an interrupt vector is and what its importance is. [2 marks]

> **Answer:**
> An **interrupt vector** is a reserved memory location (near the bottom of memory) associated with each I/O device. It contains the **memory address of the interrupt service procedure** (interrupt handler) for that device.
>
> **Importance:** When an interrupt occurs, the hardware automatically looks up the interrupt vector for that device and jumps to the corresponding interrupt handler. This allows the OS to respond to hardware events quickly and in a structured way without having to search for the appropriate handler.

---

**Theory Q9.** Explain what multiprogramming is and give an important assumption when it is modelled. [2 marks]

> **Answer:**
> **Multiprogramming** is the technique of keeping multiple processes in memory simultaneously and switching the CPU between them. When one process is waiting for I/O, the CPU is given to another process. This keeps the CPU busy more of the time.
>
> **Important assumption:** The probabilistic model for CPU utilization (CPU = 1 − p^n) assumes that the I/O waiting times of all processes are **independent** — they are not all waiting simultaneously at the exact same time. In reality, this is only an approximation.

---

**Theory Q10.** List 6 main functions present in the PTHREAD library and explain what each function achieves. [6 marks]

> **Answer:**
> 1. `pthread_create` — Creates a new thread and starts it running a specified function.
> 2. `pthread_exit` — Terminates the calling thread (without terminating the whole process).
> 3. `pthread_join` — Makes the calling thread block and wait until a specified thread has exited.
> 4. `pthread_yield` — Causes the calling thread to voluntarily release the CPU so another thread can run.
> 5. `pthread_mutex_lock` — Acquires a mutex lock; blocks if the mutex is already locked.
> 6. `pthread_mutex_unlock` — Releases a mutex lock that the calling thread holds.

---

**Theory Q11.** Give three advantages of Kernel Threads. [3 marks]

> **Answer:**
> 1. **Blocking system calls do not block the entire process:** If one kernel thread makes a blocking call (e.g., reads a file), the kernel can schedule another thread from the same process to continue running.
> 2. **Page faults do not block the entire process:** A page fault in one kernel thread only blocks that thread; other threads of the same process can continue executing.
> 3. **Can exploit multiprocessor systems:** Since the kernel knows about all threads, it can schedule multiple threads from the same process on different CPUs simultaneously, achieving true parallelism.

---

**Theory Q12.** Explain what a critical section is for a process. [1 mark]

> **Answer:** A **critical section** is the portion of a program's code where it accesses a shared resource (such as a shared variable, file, or data structure) that must not be accessed by more than one process or thread at the same time. It is the region that must be protected by mutual exclusion.

---

**Theory Q13.** What are the 4 conditions which need to be met to come up with a good solution to prevent Race Conditions? [4 marks]

> **Answer:**
> 1. **Mutual Exclusion:** No two processes may be in their critical sections simultaneously.
> 2. **Progress:** No process running outside its critical section may block another process from entering its critical section.
> 3. **Bounded Waiting (No Starvation):** No process should have to wait indefinitely to enter its critical section.
> 4. **No assumptions about speed:** The solution must not rely on assumptions about the relative speeds of processes or the number of CPUs.

---

**Theory Q14.** Explain what a semaphore is, what problem it solves, and how it is different from a mutex. [4 marks]

> **Answer:**
> A **semaphore** is a special integer variable that can only be modified through two atomic operations: `down()` (decrement, also called `wait` or `P`) and `up()` (increment, also called `signal` or `V`). These operations are atomic — they cannot be interrupted.
>
> **Problem it solves:** Semaphores solve the race condition / mutual exclusion problem without busy waiting. When `down()` is called and the semaphore is 0, the process is blocked (put to sleep) rather than spinning. It is also used for **synchronization** (e.g., the producer-consumer problem — tracking how many items are in the buffer).
>
> **Difference from mutex:**
> - A **mutex** is a binary lock (0 or 1 — locked or unlocked). It is used strictly for mutual exclusion.
> - A **semaphore** can count beyond 1, making it useful for tracking resources (e.g., number of empty buffer slots). It can also be used for signaling between processes.
> - A mutex should only be unlocked by the thread that locked it. A semaphore can be signaled by any thread.

---

**Theory Q15.** Outline the difference between `pthread_mutex_lock` and `pthread_mutex_trylock`. [2 marks]

> **Answer:**
> - `pthread_mutex_lock`: Attempts to acquire the mutex. If the mutex is already locked by another thread, **the calling thread blocks** (sleeps) and waits until the mutex becomes available.
> - `pthread_mutex_trylock`: Attempts to acquire the mutex. If the mutex is already locked, **the call returns immediately with an error code** (EBUSY) without blocking the thread. The thread can then decide what to do next instead of being forced to wait.

---

**Theory Q16.** Explain why it can be inefficient to choose a small quantum in process scheduling. [2 marks]

> **Answer:** With a very small time quantum, processes are switched very frequently. Each context switch has overhead: the OS must save the current process's state (registers, PC, etc.) and load the next process's state. If the quantum is too small, the CPU spends more time performing context switches than actually running processes. For example, if the quantum is 1ms and a context switch takes 1ms, the CPU is only 50% efficient. A small quantum also does not allow processes to finish meaningful work before being preempted.

---

**Theory Q17.** List two per-process items and two per-thread items kept by the OS. [2 marks]

> **Answer:**
> **Per-process items (any 2):** Address space, global variables, open files, child processes, pending alarms, signals and signal handlers, accounting information.
>
> **Per-thread items (any 2):** Program counter, registers, stack, state.

---

**Theory Q18.** Give one advantage and one disadvantage of using multithreading over the creation of multiple processes. [2 marks]

> **Answer:**
> **Advantage:** Threads within the same process share the same address space and resources (files, memory), making communication between them much faster and easier than between separate processes (which require IPC mechanisms like pipes or shared memory).
>
> **Disadvantage:** Threads are not protected from each other. A bug in one thread (e.g., writing to a wrong memory address) can corrupt data used by another thread or crash the entire process. With separate processes, each process has its own protected memory space.

---

**Theory Q19.** On large computers, multiprogramming is usually used. Give two reasons. [2 marks]

> **Answer:**
> 1. **Fairness:** With multiple users, each user's processes should get a share of CPU time. Monoprogramming would force everyone to wait while one job runs to completion.
> 2. **CPU efficiency:** Processes spend a significant amount of time waiting for I/O. Without multiprogramming, the CPU would sit idle during these waits. Multiprogramming keeps the CPU busy by switching to another ready process.

---

**Theory Q20.** Discuss the importance of multithreading in applications such as web servers. [2 marks]

> **Answer:** A web server must handle many client requests simultaneously. Without multithreading, the server would handle one request at a time — all other clients must wait. With multithreading, a **dispatcher thread** accepts incoming connections and hands them off to **worker threads**. Each worker handles one request independently. If one worker is waiting for disk I/O (e.g., fetching a file), other workers can still serve other clients. This dramatically improves throughput and responsiveness. Threads are cheaper to create than new processes, and sharing the web page cache (in the same address space) is efficient.

---

### Coding Questions & Answers

---

**Coding Q1.** Write a program which allows the user to populate a global array with 10 integers. The program should then create 2 threads. The first thread displays all the even numbers; the second thread displays the odd numbers. The user chooses which thread runs first. Use mutex locks to ensure the first thread finishes before the second starts displaying. [20 marks]

```c
#include <stdio.h>
#include <pthread.h>
#include <stdlib.h>

#define SIZE 10

int arr[SIZE];
pthread_mutex_t mutex1 = PTHREAD_MUTEX_INITIALIZER;
pthread_mutex_t mutex2 = PTHREAD_MUTEX_INITIALIZER;

/* Thread function: prints even numbers */
void *print_even(void *arg) {
    pthread_mutex_lock(&mutex1);   /* acquire lock before printing */
    printf("Even numbers: ");
    for (int i = 0; i < SIZE; i++) {
        if (arr[i] % 2 == 0)
            printf("%d ", arr[i]);
    }
    printf("\n");
    pthread_mutex_unlock(&mutex2); /* signal the other thread to go */
    pthread_exit(NULL);
}

/* Thread function: prints odd numbers */
void *print_odd(void *arg) {
    pthread_mutex_lock(&mutex2);   /* wait for permission */
    printf("Odd numbers: ");
    for (int i = 0; i < SIZE; i++) {
        if (arr[i] % 2 != 0)
            printf("%d ", arr[i]);
    }
    printf("\n");
    pthread_mutex_unlock(&mutex1);
    pthread_exit(NULL);
}

int main() {
    pthread_t t1, t2;
    int choice;

    /* Populate the array */
    printf("Enter 10 integers:\n");
    for (int i = 0; i < SIZE; i++) {
        printf("arr[%d] = ", i);
        scanf("%d", &arr[i]);
    }

    /* Ask user which thread runs first */
    printf("Which thread runs first? (1 = Even, 2 = Odd): ");
    scanf("%d", &choice);

    if (choice == 1) {
        /* Even thread runs first: lock mutex2 so odd waits */
        pthread_mutex_lock(&mutex2);
        pthread_create(&t1, NULL, print_even, NULL);
        pthread_create(&t2, NULL, print_odd, NULL);
    } else {
        /* Odd thread runs first: lock mutex1 so even waits */
        pthread_mutex_lock(&mutex1);
        pthread_create(&t1, NULL, print_even, NULL);
        pthread_create(&t2, NULL, print_odd, NULL);
    }

    pthread_join(t1, NULL);
    pthread_join(t2, NULL);

    pthread_mutex_destroy(&mutex1);
    pthread_mutex_destroy(&mutex2);

    return 0;
}
```

> **Explanation:**
> - Two mutexes are used: `mutex1` controls the even-thread's turn, `mutex2` controls the odd-thread's turn.
> - If the user wants even first: `mutex2` is pre-locked (so odd blocks), even thread runs and when done, unlocks `mutex2` to release odd.
> - If the user wants odd first: `mutex1` is pre-locked (so even blocks), odd thread runs first.
> - `pthread_join` ensures the main program waits for both threads to finish.

---

**Coding Q2.** Write a program that creates a child process. The parent displays "I am the parent" with the child's PID. The child displays "I am a child" with the parent's PID. Each should display its message once. [5 marks]

```c
#include <stdio.h>
#include <unistd.h>
#include <sys/types.h>

int main() {
    pid_t pid = fork();   /* create child process */

    if (pid < 0) {
        /* fork failed */
        perror("fork failed");
        return 1;
    } else if (pid == 0) {
        /* Child process */
        sleep(1);   /* let parent print first */
        printf("I am a child. My parent's PID is: %d\n", getppid());
    } else {
        /* Parent process */
        printf("I am the parent. My child's PID is: %d\n", pid);
    }

    return 0;
}
```

> **Explanation:**
> - `fork()` creates a copy of the current process. It returns 0 to the child, and the child's PID to the parent.
> - `getppid()` returns the parent's PID.
> - `sleep(1)` ensures the parent prints first before the child.

---

**Coding Q3.** Write a program that allows the user to create two processes P1 and P2. P1 allows the user to enter 2 values A and B and sends these values to P2 via a pipe. P2 calculates A×B and sends the result back to P1 to be displayed. [8 marks]

```c
#include <stdio.h>
#include <unistd.h>
#include <sys/types.h>

int main() {
    int pipe1[2];  /* P1 -> P2 */
    int pipe2[2];  /* P2 -> P1 */
    pid_t pid;
    int A, B, result;

    if (pipe(pipe1) == -1 || pipe(pipe2) == -1) {
        perror("pipe");
        return 1;
    }

    pid = fork();

    if (pid < 0) {
        perror("fork");
        return 1;

    } else if (pid == 0) {
        /* P2 (Child): reads A and B, computes A*B, sends result back */
        close(pipe1[1]);  /* close write end of pipe1 */
        close(pipe2[0]);  /* close read end of pipe2 */

        int vals[2];
        read(pipe1[0], vals, sizeof(vals));
        result = vals[0] * vals[1];
        write(pipe2[1], &result, sizeof(result));

        close(pipe1[0]);
        close(pipe2[1]);

    } else {
        /* P1 (Parent): gets input, sends to P2, reads result */
        close(pipe1[0]);  /* close read end of pipe1 */
        close(pipe2[1]);  /* close write end of pipe2 */

        printf("P1: Enter value A: ");
        scanf("%d", &A);
        printf("P1: Enter value B: ");
        scanf("%d", &B);

        int vals[2] = {A, B};
        write(pipe1[1], vals, sizeof(vals));

        read(pipe2[0], &result, sizeof(result));
        printf("P1: Result of %d * %d = %d\n", A, B, result);

        close(pipe1[1]);
        close(pipe2[0]);
    }

    return 0;
}
```

> **Explanation:**
> - Two pipes are created: `pipe1` for P1→P2 communication, `pipe2` for P2→P1 communication.
> - P1 (parent) reads A and B from the user, writes them to `pipe1`.
> - P2 (child) reads A and B from `pipe1`, computes A×B, writes the result to `pipe2`.
> - P1 reads the result from `pipe2` and displays it.
> - Unused pipe ends are closed in each process to avoid blocking.

---

**Coding Q4.** A file "CSE2022Y.dat" contains data written from a struct `employee`. Write a `main()` function that creates two threads that continuously read data from the file and use `DisplayEmployee()` to display it. Use a synchronization primitive to prevent both threads from accessing the file at the same time. [6 marks]

```c
#include <stdio.h>
#include <pthread.h>
#include <fcntl.h>
#include <unistd.h>

struct employee {
    char surname[20];
    char firstname[20];
    int  Age;
    float Salary;
};

void DisplayEmployee(struct employee X);  /* provided — no implementation needed */

pthread_mutex_t file_mutex = PTHREAD_MUTEX_INITIALIZER;

void *read_and_display(void *arg) {
    int fd = *(int *)arg;   /* file descriptor passed as parameter */
    struct employee emp;

    while (1) {
        pthread_mutex_lock(&file_mutex);   /* lock before reading */

        ssize_t bytes = read(fd, &emp, sizeof(struct employee));

        pthread_mutex_unlock(&file_mutex); /* unlock after reading */

        if (bytes <= 0) break;             /* end of file or error */

        DisplayEmployee(emp);
    }

    pthread_exit(NULL);
}

int main() {
    pthread_t t1, t2;

    int fd = open("CSE2022Y.dat", O_RDONLY);
    if (fd == -1) {
        perror("open");
        return 1;
    }

    /* Pass file descriptor to both threads */
    pthread_create(&t1, NULL, read_and_display, &fd);
    pthread_create(&t2, NULL, read_and_display, &fd);

    pthread_join(t1, NULL);
    pthread_join(t2, NULL);

    close(fd);
    pthread_mutex_destroy(&file_mutex);

    return 0;
}
```

> **Explanation:**
> - A single `pthread_mutex_t` protects the file read operation.
> - Both threads share the same file descriptor `fd`. The mutex ensures that only one thread reads from the file at a time, preventing data corruption from interleaved reads.
> - `read()` reads one `employee` struct at a time. When it returns 0 or negative, the thread exits.
> - The file descriptor is passed to the thread function as a `void*` argument and cast back.

---

*End of Process & Threads Notes*
