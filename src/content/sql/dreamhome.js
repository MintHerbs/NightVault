// The DreamHome estate-agency schema, shared by every SQL console in the
// Database Systems Semester 1 lectures.
//
// One schema across lectures 3 to 6 is the point: the DDL lecture builds these
// tables, the DML lectures query and modify the very same rows, and the views
// lecture builds views over them. A student who learns what is in Staff once
// never has to re-learn a new toy table three lectures later, and the running
// example matches the one the lecture slides already use.
//
// Everything here runs on PGlite (real Postgres, in the reader's tab). The
// lectures are taught in SQL Server dialect, so where the two differ the
// statement shown is written to be valid in both wherever that is possible,
// and the note calls out the difference where it is not.
//
// Identifier case: Postgres folds an unquoted `staffNo` to `staffno`. The DDL
// is left unquoted, because quoting every identifier would be a lie about what
// students write in an exam. LABELS below restores the camelCase spelling in
// the result grids. See NoteSqlConsole's ResultGrid.

/** Column display names, undoing Postgres's case folding in the result grids. */
const LABELS = {
  branchno: 'branchNo',
  staffno: 'staffNo',
  propertyno: 'propertyNo',
  clientno: 'clientNo',
  ownerno: 'ownerNo',
  fname: 'fName',
  lname: 'lName',
  dob: 'DOB',
  postcode: 'postcode',
  viewdate: 'viewDate',
  preftype: 'prefType',
  maxrent: 'maxRent',
  telno: 'telNo',
  salcount: 'salCount',
  mycount: 'myCount',
  mysum: 'mySum',
  saldiff: 'salDiff',
}

/** Branch and Staff only: the two tables lecture 3 builds by hand. */
const BRANCH_DDL = `CREATE TABLE Branch (
  branchNo  CHAR(4)     NOT NULL,
  street    VARCHAR(25) NOT NULL,
  city      VARCHAR(15) NOT NULL,
  postcode  VARCHAR(8),
  PRIMARY KEY (branchNo)
);`

const BRANCH_ROWS = `INSERT INTO Branch VALUES
  ('B005', '22 Deer Rd',   'London',   'SW1 4EH'),
  ('B007', '16 Argyll St', 'Aberdeen', 'AB2 3SU'),
  ('B003', '163 Main St',  'Glasgow',  'G11 9QX'),
  ('B004', '32 Manse Rd',  'Bristol',  'BS99 1NZ'),
  ('B002', '56 Clover Dr', 'London',   'NW10 6EU');`

const STAFF_DDL = `CREATE TABLE Staff (
  staffNo   CHAR(5)      NOT NULL,
  fName     VARCHAR(15)  NOT NULL,
  lName     VARCHAR(15)  NOT NULL,
  position  VARCHAR(10)  NOT NULL,
  sex       CHAR(1)      CHECK (sex IN ('M', 'F')),
  DOB       DATE,
  salary    DECIMAL(7,2) NOT NULL,
  branchNo  CHAR(4)      NOT NULL,
  PRIMARY KEY (staffNo),
  FOREIGN KEY (branchNo) REFERENCES Branch
    ON DELETE NO ACTION ON UPDATE CASCADE
);`

const STAFF_ROWS = `INSERT INTO Staff VALUES
  ('SL21', 'John',  'White', 'Manager',    'M', '1945-10-01', 30000, 'B005'),
  ('SG37', 'Ann',   'Beech', 'Assistant',  'F', '1960-11-10', 12000, 'B003'),
  ('SG14', 'David', 'Ford',  'Supervisor', 'M', '1958-03-24', 18000, 'B003'),
  ('SA9',  'Mary',  'Howe',  'Assistant',  'F', '1970-02-19',  9000, 'B007'),
  ('SG5',  'Susan', 'Brand', 'Manager',    'F', '1940-06-03', 24000, 'B003'),
  ('SL41', 'Julie', 'Lee',   'Assistant',  'F', '1965-06-13',  9000, 'B005');`

const CLIENT_DDL = `CREATE TABLE Client (
  clientNo  CHAR(4)     NOT NULL,
  fName     VARCHAR(15) NOT NULL,
  lName     VARCHAR(15) NOT NULL,
  telNo     VARCHAR(13),
  prefType  VARCHAR(6),
  maxRent   DECIMAL(6,2),
  PRIMARY KEY (clientNo)
);`

const CLIENT_ROWS = `INSERT INTO Client VALUES
  ('CR76', 'John',  'Kay',     '0207-774-5632', 'Flat',  425),
  ('CR56', 'Aline', 'Stewart', '0141-848-1825', 'Flat',  350),
  ('CR74', 'Mike',  'Ritchie', '01475-392178',  'House', 750),
  ('CR62', 'Mary',  'Tregear', '01224-196720',  'Flat',  600);`

const PROPERTY_DDL = `CREATE TABLE PropertyForRent (
  propertyNo  CHAR(4)      NOT NULL,
  street      VARCHAR(25)  NOT NULL,
  city        VARCHAR(15)  NOT NULL,
  postcode    VARCHAR(8),
  type        VARCHAR(6)   NOT NULL DEFAULT 'Flat',
  rooms       SMALLINT     NOT NULL DEFAULT 4,
  rent        DECIMAL(6,2) NOT NULL DEFAULT 600,
  staffNo     CHAR(5),
  branchNo    CHAR(4)      NOT NULL,
  PRIMARY KEY (propertyNo),
  FOREIGN KEY (staffNo)  REFERENCES Staff  ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (branchNo) REFERENCES Branch ON DELETE NO ACTION ON UPDATE CASCADE
);`

const PROPERTY_ROWS = `INSERT INTO PropertyForRent VALUES
  ('PA14', '16 Holhead',    'Aberdeen', 'AB7 5SU', 'House', 6, 650, 'SA9',  'B007'),
  ('PL94', '6 Argyll St',   'London',   'NW2',     'Flat',  4, 400, 'SL41', 'B005'),
  ('PG4',  '6 Lawrence St', 'Glasgow',  'G11 9QX', 'Flat',  3, 350, NULL,   'B003'),
  ('PG36', '2 Manor Rd',    'Glasgow',  'G32 4QX', 'Flat',  3, 375, 'SG37', 'B003'),
  ('PG21', '18 Dale Rd',    'Glasgow',  'G12',     'House', 5, 600, 'SG37', 'B003'),
  ('PG16', '5 Novar Dr',    'Glasgow',  'G12 9AX', 'Flat',  4, 450, 'SG14', 'B003');`

const VIEWING_DDL = `CREATE TABLE Viewing (
  clientNo    CHAR(4) NOT NULL,
  propertyNo  CHAR(4) NOT NULL,
  viewDate    DATE    NOT NULL,
  comment     VARCHAR(40),
  PRIMARY KEY (clientNo, propertyNo),
  FOREIGN KEY (clientNo)   REFERENCES Client,
  FOREIGN KEY (propertyNo) REFERENCES PropertyForRent
);`

const VIEWING_ROWS = `INSERT INTO Viewing VALUES
  ('CR56', 'PA14', '2024-05-24', 'too small'),
  ('CR76', 'PG4',  '2024-04-20', 'too remote'),
  ('CR56', 'PG4',  '2024-05-26', NULL),
  ('CR62', 'PA14', '2024-05-14', 'no dining room'),
  ('CR56', 'PG36', '2024-04-28', NULL);`

/** Every table, already populated. Consoles that teach querying rather than
 *  building start from here so the reader is not made to sit through five
 *  CREATE TABLEs again before the first SELECT. */
export const FULL_SETUP = [
  BRANCH_DDL, BRANCH_ROWS,
  STAFF_DDL, STAFF_ROWS,
  CLIENT_DDL, CLIENT_ROWS,
  PROPERTY_DDL, PROPERTY_ROWS,
  VIEWING_DDL, VIEWING_ROWS,
].join('\n')

export const dreamhomeScripts = [
  // ---------------------------------------------------------------- lecture 3
  {
    id: 'ddl-build-branch-staff',
    label: 'Building Branch and Staff',
    dialect: 'sqlserver',
    editable: true,
    labels: LABELS,
    watch: ['Branch', 'Staff'],
    steps: [
      {
        note: 'Create the parent table first. Branch has to exist before anything can reference it.',
        sql: BRANCH_DDL,
      },
      {
        note: 'Five branches. Watch the Branch panel below fill up.',
        sql: BRANCH_ROWS,
      },
      {
        note: 'Now Staff. The FOREIGN KEY line is what ties a member of staff to a real branch.',
        sql: STAFF_DDL,
      },
      {
        note: 'Six members of staff, every one of them pointing at a branch that exists.',
        sql: STAFF_ROWS,
      },
      {
        expectError: true,
        note: 'Referential integrity, tested. B999 is not a branch, so this insert is rejected. Read the error: this is the constraint doing its job, not a bug.',
        sql: `INSERT INTO Staff VALUES
  ('SX99', 'Nadia', 'Khan', 'Assistant', 'F', '1992-01-05', 15000, 'B999');`,
      },
      {
        expectError: true,
        note: 'The domain constraint is just as strict. sex is CHECKed against M and F, so Z cannot get in.',
        sql: `INSERT INTO Staff VALUES
  ('SX98', 'Omar', 'Diallo', 'Assistant', 'Z', '1990-07-11', 15000, 'B003');`,
      },
      {
        expectError: true,
        note: 'Entity integrity. SL21 is already the primary key of a row, and a primary key is unique by definition.',
        sql: `INSERT INTO Staff VALUES
  ('SL21', 'Clone', 'White', 'Manager', 'M', '1945-10-01', 30000, 'B005');`,
      },
      {
        note: 'ALTER TABLE adds a column to a table that already holds rows. The existing six rows get NULL for it.',
        sql: 'ALTER TABLE Staff ADD COLUMN email VARCHAR(40);',
      },
      {
        note: 'And a table constraint can be added after the fact. Nobody at DreamHome earns below 8000, so this one is accepted.',
        sql: 'ALTER TABLE Staff ADD CONSTRAINT salary_floor CHECK (salary >= 8000);',
      },
      {
        expectError: true,
        note: 'The constraint is live from now on. A 5000 salary is refused.',
        sql: `INSERT INTO Staff VALUES
  ('SX97', 'Ben', 'Cole', 'Assistant', 'M', '1995-03-02', 5000, 'B003', NULL);`,
      },
    ],
  },

  // ---------------------------------------------------------------- lecture 4
  {
    id: 'dml-insert-update-delete',
    label: 'INSERT, UPDATE and DELETE',
    dialect: 'sqlserver',
    editable: true,
    labels: LABELS,
    setup: FULL_SETUP,
    watch: ['Staff'],
    steps: [
      {
        note: 'Where we are starting: six members of staff.',
        sql: 'SELECT staffNo, fName, lName, position, salary, branchNo FROM Staff ORDER BY staffNo;',
      },
      {
        note: 'A full-row INSERT. Give a value for every column, in the order the table declares them.',
        sql: `INSERT INTO Staff VALUES
  ('SG44', 'Anne', 'Jones', 'Assistant', 'F', '1980-09-15', 11000, 'B003');`,
      },
      {
        note: 'A column-list INSERT. Naming the columns lets you leave the rest to their defaults, and stops a change in column order from silently corrupting your data.',
        sql: `INSERT INTO Staff (staffNo, fName, lName, position, salary, branchNo)
VALUES ('SG45', 'Peter', 'Watts', 'Assistant', 10500, 'B003');`,
      },
      {
        note: 'UPDATE with no WHERE clause touches every row. A 3 percent rise for the whole company.',
        sql: 'UPDATE Staff SET salary = salary * 1.03;',
      },
      {
        note: 'With a WHERE clause it touches only the rows that match. Managers get a further rise.',
        sql: "UPDATE Staff SET salary = salary * 1.05 WHERE position = 'Manager';",
      },
      {
        note: 'DELETE removes whole rows. This one removes the two we just added.',
        sql: "DELETE FROM Staff WHERE staffNo IN ('SG44', 'SG45');",
      },
      {
        note: 'And the same six rows are left, with their new salaries.',
        sql: 'SELECT staffNo, fName, lName, position, salary FROM Staff ORDER BY salary DESC;',
      },
    ],
  },

  // ---------------------------------------------------------------- lecture 5
  {
    id: 'dml-grouping-and-joins',
    label: 'Grouping, joins and subqueries',
    dialect: 'sqlserver',
    editable: true,
    labels: LABELS,
    setup: FULL_SETUP,
    steps: [
      {
        note: 'GROUP BY collapses the rows sharing a branchNo into one row each.',
        sql: `SELECT branchNo, COUNT(staffNo) AS myCount, SUM(salary) AS mySum
FROM Staff
GROUP BY branchNo
ORDER BY branchNo;`,
      },
      {
        note: 'HAVING filters the groups after they are formed. WHERE could not do this: at WHERE time the groups do not exist yet.',
        sql: `SELECT branchNo, COUNT(staffNo) AS myCount, SUM(salary) AS mySum
FROM Staff
GROUP BY branchNo
HAVING COUNT(staffNo) > 1
ORDER BY branchNo;`,
      },
      {
        note: 'A scalar subquery. The inner SELECT returns one value, and the outer one compares against it.',
        sql: `SELECT staffNo, fName, lName, position
FROM Staff
WHERE branchNo = (SELECT branchNo FROM Branch WHERE street = '163 Main St');`,
      },
      {
        note: 'You cannot write salary > AVG(salary) directly. The aggregate has to come from a subquery.',
        sql: `SELECT staffNo, fName, lName, salary,
       salary - (SELECT AVG(salary) FROM Staff) AS salDiff
FROM Staff
WHERE salary > (SELECT AVG(salary) FROM Staff);`,
      },
      {
        note: 'ANY is satisfied by one match. This finds staff paid more than at least one person at B003.',
        sql: `SELECT staffNo, fName, lName, salary
FROM Staff
WHERE salary > ANY (SELECT salary FROM Staff WHERE branchNo = 'B003');`,
      },
      {
        note: 'ALL demands every match. Same query, far fewer rows.',
        sql: `SELECT staffNo, fName, lName, salary
FROM Staff
WHERE salary > ALL (SELECT salary FROM Staff WHERE branchNo = 'B003');`,
      },
      {
        note: 'A join, written the modern way. Each client is paired with the viewings they made.',
        sql: `SELECT c.clientNo, c.fName, c.lName, v.propertyNo, v.comment
FROM Client c JOIN Viewing v ON c.clientNo = v.clientNo
ORDER BY c.clientNo, v.propertyNo;`,
      },
      {
        note: 'A three-table join. Follow the chain: client to viewing, viewing to property.',
        sql: `SELECT c.lName, p.propertyNo, p.city, p.rent
FROM Client c
  JOIN Viewing v          ON c.clientNo = v.clientNo
  JOIN PropertyForRent p  ON v.propertyNo = p.propertyNo
ORDER BY c.lName, p.propertyNo;`,
      },
      {
        note: 'A LEFT OUTER JOIN keeps clients who viewed nothing, padding the missing side with NULL. CR74 has never viewed a property, and an inner join would have hidden that.',
        sql: `SELECT c.clientNo, c.lName, v.propertyNo
FROM Client c LEFT JOIN Viewing v ON c.clientNo = v.clientNo
ORDER BY c.clientNo;`,
      },
      {
        note: 'EXISTS asks only whether the subquery found anything at all, so what it selects does not matter.',
        sql: `SELECT s.staffNo, s.fName, s.lName, s.position
FROM Staff s
WHERE EXISTS (
  SELECT 1 FROM Branch b
  WHERE s.branchNo = b.branchNo AND b.city = 'London'
);`,
      },
    ],
  },

  // ---------------------------------------------------------------- lecture 6
  {
    id: 'views-and-privileges',
    label: 'Views',
    dialect: 'sqlserver',
    editable: true,
    labels: LABELS,
    setup: FULL_SETUP,
    watch: ['Staff'],
    steps: [
      {
        note: 'A view is a stored query, not a stored table. Nothing is copied here.',
        sql: `CREATE VIEW Manager3Staff AS
SELECT staffNo, fName, lName, position, salary
FROM Staff
WHERE branchNo = 'B003';`,
      },
      {
        note: 'Query it exactly as if it were a table.',
        sql: 'SELECT * FROM Manager3Staff ORDER BY staffNo;',
      },
      {
        note: 'This is the part that matters. Change the underlying table.',
        sql: "UPDATE Staff SET salary = 13000 WHERE staffNo = 'SG37';",
      },
      {
        note: 'The view has changed too, because it was never a copy. It re-runs its query every time you look at it.',
        sql: 'SELECT * FROM Manager3Staff ORDER BY staffNo;',
      },
      {
        note: 'A view can aggregate as well. This one hides individual salaries and exposes only the totals.',
        sql: `CREATE VIEW BranchSalaries AS
SELECT branchNo, COUNT(staffNo) AS salCount, SUM(salary) AS mySum
FROM Staff
GROUP BY branchNo;`,
      },
      {
        note: 'Which is the security argument for views: a user granted this and nothing else can see what a branch costs without ever seeing what any one person earns.',
        sql: 'SELECT * FROM BranchSalaries ORDER BY branchNo;',
      },
      {
        expectError: true,
        note: 'An aggregated view is not updatable, and Postgres says so plainly. There is no single row behind a SUM to change.',
        sql: "UPDATE BranchSalaries SET mySum = 1 WHERE branchNo = 'B003';",
      },
      {
        note: 'DROP VIEW removes the definition. The Staff rows behind it are untouched, which is the whole point.',
        sql: 'DROP VIEW BranchSalaries;',
      },
    ],
  },
]
