# Chapter 3: Models and Migrations

*Week 3 · 2+1 hrs · Lab 3: Database design · Deliverable: Project specification document*

## Why we need a database

HTML/CSS/JS live in the browser and vanish on refresh. Anything that needs to survive, like an applicant's details, has to be stored somewhere permanent: a **database**. A relational database stores data in **tables** (rows and columns), like a very strict spreadsheet.

| Term | Meaning |
| --- | --- |
| Table | A collection of one type of thing, e.g. all applicants. |
| Row | One record, e.g. one applicant. |
| Column | One field, e.g. email. |
| Primary key (PK) | A unique id for every row. |
| Foreign key (FK) | A column that points to another table's PK. This is how tables relate. |

## The ERD (Entity-Relationship Diagram)

Before writing code, draw the tables and how they connect. Ours for the recruitment feature:

![ERD: Mission, Role, Applicant](/notes/img/web/ch03-erd.svg)

## Models: tables written as Python

In Django, you don't write SQL to create tables. You write a **model**, a Python class, and Django builds the table for you.

```python recruitment/models.py
from django.db import models

class Role(models.Model):
    title = models.CharField(max_length=60)

class Mission(models.Model):
    name = models.CharField(max_length=100)
    total_seats = models.IntegerField(default=24)

class Applicant(models.Model):
    full_name = models.CharField(max_length=120)
    email     = models.EmailField()
    role      = models.ForeignKey(Role, on_delete=models.PROTECT)
    mission   = models.ForeignKey(Mission, on_delete=models.CASCADE)
```

`ForeignKey` is the PK/FK link from the ERD, written in Python.

## Migrations: what and why

A **migration** is a file describing one change to the database schema: create this table, add this column, etc. Django compares your models to the last known schema and writes the migration for you.

```bash terminal
python manage.py makemigrations   # write the migration file
python manage.py migrate          # actually apply it to the DB
```

Why this matters:

* **History.** Every schema change is a tracked file, like git commits for your database shape.
* **Team safety.** Everyone runs the same migrations, so everyone's database ends up identical.
* **No manual SQL.** You never hand-write `CREATE TABLE` or `ALTER TABLE`, Django does it correctly.
* **Reversible.** Migrations can be undone if something goes wrong.

> **Rule of thumb:** change a model, then always `makemigrations` and `migrate` right away. Forgetting this is the most common Django bug: the code expects a column the database doesn't have yet.
