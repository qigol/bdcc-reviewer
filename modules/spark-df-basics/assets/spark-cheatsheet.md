# Spark DataFrames cheat sheet (Databricks Free Edition)

One page for all six sessions. The error lines below are real Spark 4.0.1 output, trimmed to the line you read.

## 1. A typical first cell

```python
BASE = "/Volumes/workspace/default/bdcc"     # the course volume (a Databricks storage folder)
from pyspark.sql import functions as F       # Spark's toolbox, under the short name F
trips = spark.read.csv(f"{BASE}/nyctaxi/green_tripdata_2017-1*.csv", header=True, inferSchema=True)
```

- `spark` already exists on Databricks. `SparkSession.builder.getOrCreate()` hands back that same session.
- Run cells from top to bottom. What counts is the order you ran them, not their order on the page.
- After a restart or a long break Python forgets every variable and import. Run the session's first cell again.
- Each session in the course notebook begins with its own setup cell. Run that one: Session 2 reads without
  `inferSchema` on purpose, and Sessions 5 and 6 read Parquet and JSON.

## 2. Imports: write `F.`

| Style | You then write | Verdict |
|---|---|---|
| `from pyspark.sql import functions as F` | `F.col("fare_amount")`, `F.desc("count")`, `F.mean(...)` | Use this. The `F.` shows which toolbox a tool came from. |
| `from pyspark.sql.functions import desc` | `desc("count")` | Fine for a few tools. Import them at the top of the section that uses them. |
| `from pyspark.sql.functions import *` | `desc("count")` | Avoid. It replaces 12 of Python's own tools, such as `round`, `max`, `min`, `sum` and `filter`. |

## 3. Look at the data before you change any code

| Command | What it gives you |
|---|---|
| `trips.show(5)`, `trips.show(3, truncate=False, vertical=True)` | A few rows as a text table; `vertical` prints one line per column |
| `trips.columns` | The exact column names, as a Python list |
| `trips.printSchema()`, `trips.dtypes` | Each column's name and type (`string`, `integer`, `double`, `timestamp`...) |
| `trips.count()` | The number of rows |
| `trips.describe("fare_amount").show()`, `trips.summary().show()` | count, mean, stddev, min, max (`summary` adds 25%, 50%, 75%) |
| `trips.limit(10).toPandas()` | A 10-row sample as a pandas table. Never `toPandas()` on everything. |
| `type(x)` | What kind of object `x` is: DataFrame, Column, list, int, GroupedData... |
| `trips.explain()` | Spark's plan, without running it |

Reading tips: a CSV read with `header=True` only gives every column the type `string`. Then `min` and `max`
compare text ("8.5" beats "34.5"). Use `inferSchema=True`, or a schema string that lists every column in the file's
order (the notebook's fixed schema cell in Session 2). Spark matches schema fields to CSV columns by position, not by name.

## 3b. Build an answer (Sessions 3, 5 and 6)

| To do this | Write |
|---|---|
| Keep some columns | `trips.select("PULocationID", "fare_amount")` |
| Keep some rows | `trips.filter(trips.fare_amount > 50)` |
| Combine conditions: `&` and, `\|` or, `~` not; each condition in parentheses | `trips.filter((trips.VendorID == 1) & (trips.tip_amount > 0))` |
| Count per group, biggest first, ties broken by name | `trips.groupBy("PULocationID").count().orderBy(F.desc("count"), "PULocationID")` |
| An average per group, with a column name you choose | `trips.groupBy("PULocationID").agg(F.mean("tip_amount").alias("avg_tip"))` |
| The first row, as plain Python values | `row = result.first()`, then `tuple(row)` |
| A field inside a struct (JSON) | `events.select("actor.login", "repo.name")` |
| One row per item of an array | `events.select(F.explode("payload.commits").alias("commit"))` |
| Wrap a chain in a function | `def top_pickups(df):` and, on the next line, `return df.groupBy(...)...` |

## 4. Does Spark check the name now, or later?

Spark builds a plan and checks most names only when an **action** runs. A few commands look at the column list straight away.

| Waits for an action (the error appears at `show`, `count`, `first`...) | Checks at once (the error appears on that line) |
|---|---|
| `select("typo")` | `groupBy("typo")` |
| `filter(F.col("typo") > 10)` | `trips["typo"]` |
| `orderBy("typo")` | `trips.typo` |
| `withColumn("x", F.col("typo") * 2)` | `groupBy("VendorID").mean("typo")` or `.sum("a_text_column")` |
| `agg(F.mean("typo"))` | |

Actions: `show`, `count`, `first`, `toPandas`, `describe(...).show()`, writes. So the mistake may sit in a cell above the one that fails.

## 5. Common errors: read the last line first

Read two things, last line first: the last line, then the line that points at your cell (`File "<cell N>"`; Databricks prints `File <command-...>`).
Class names are shown here without their long `pyspark.errors.exceptions...` prefix. Column names ignore upper and lower case.

| Last line (real, trimmed) | Usual cause | Fix |
|---|---|---|
| `NameError: name 'trips' is not defined` | The cell that creates `trips` has not run in this session | Run the cells above in order |
| `NameError: name 'desc' is not defined` | Missing import, often after a restart | Write `F.desc(...)`, or import at the top of the section |
| ``AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `PULocatonID` cannot be resolved. Did you mean one of the following? [`PULocationID`, ...]`` | A misspelled column, or a field inside a struct (`login` lives in `actor`) | Copy the name from `trips.columns` or `printSchema()`; write `"actor.login"` |
| ``PySparkAttributeError: [ATTRIBUTE_NOT_SUPPORTED] Attribute `PULocatonID` is not supported.. Did you mean: 'PULocationID'?`` | `trips.PULocatonID`: a misspelled name after the dot | Fix the spelling, or use `F.col("PULocationID")` |
| `PySparkTypeError: [NOT_NUMERIC_COLUMNS] Numeric aggregation function can only be applied on numeric columns, got ['total_amount'].` | `.sum(...)` or `.mean(...)` on a text column (read without types) | Read with `inferSchema=True` or a schema, or cast the column |
| `NumberFormatException: [CAST_INVALID_INPUT] The value 'Y' of the type "STRING" cannot be cast to "BIGINT" because it is malformed.` | A schema type that does not fit the data (`store_and_fwd_flag INT`) | Declare the type that fits (`STRING`) and read again |
| `SparkException: [FAILED_READ_FILE.NO_HINT] Encountered error while reading file dbfs:/Volumes/...` | `mode="FAILFAST"` met a value that does not fit the schema | Read the `Caused by:` lines of the full error, then fix the schema |
| `AssertionError` (no message), after `round(4.567, 1)` or `sum([1, 2, 3])` | `from pyspark.sql.functions import *` replaced Python's `round` and `sum` | Restart Python, drop `import *`, use `F.round` for columns |
| `TypeError: max() takes 1 positional argument but 2 were given` | The same wildcard import replaced `max` | Same fix |
| `TypeError: '>' not supported between instances of 'str' and 'int'` | `trips.filter("total_amount" > 1000)`: text, not a column | `trips.filter(trips.total_amount > 1000)` or `trips.filter("total_amount > 1000")` |
| `PySparkValueError: [CANNOT_CONVERT_COLUMN_INTO_BOOL] Cannot convert column into bool: please use '&' for 'and', '\|' for 'or', '~' for 'not' ...` | Python `and` / `or` between two conditions | `(cond1) & (cond2)`, each condition in parentheses |
| `AttributeError: 'GroupedData' object has no attribute 'show'` | `groupBy(...)` with nothing after it | Add `.count()` or `.agg(...)` before `.show()` |
| `AttributeError: 'NoneType' object has no attribute 'show'` | A function without `return` | Add `return` in front of the result |
| `AssertionError:`, then `Items are not equal:`, `ACTUAL: 251`, `DESIRED: 255` on the next lines | A test cell expected another value | Compare ACTUAL with DESIRED; check the names in the spec and the test |
| No error at all, but `NULL` in a whole column, or `describe()` count 0 | A **silent null**: values that do not fit the declared type became NULL | Compare `printSchema()` with real values; read with `mode="FAILFAST"` |

## 6. Finding help on your own

- `type(x)`: what is it? `help(x)`: its manual, for example `help(trips.show)`, `help(spark.read.csv)`, `help(F.explode)`.
- `dir(F)` lists every tool in the toolbox. Keep the ones you need: `[name for name in dir(F) if "hour" in name]` gives `['hour', 'hours']`.
- A manual may point elsewhere. `help(spark.read.csv)` lists `mode` but sends you to the CSV "Data Source Option" page.
- Online manuals:
  - functions: https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/functions.html
  - data types: https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/data_types.html
  - CSV options (`mode`, `header`, `inferSchema`...): https://spark.apache.org/docs/latest/sql-data-sources-csv.html#data-source-option
- The Databricks **Assistant** answers questions about your notebook. Give it all four parts, then test its answer:

```text
1. The code I ran:            <paste the whole cell>
2. The full error, as text:   <paste it>
3. printSchema() of the DataFrame involved:   <paste it>
4. What I expected:           <the result you wanted, and why>
```

## 7. Files and paths (all under `BASE = "/Volumes/workspace/default/bdcc"`)

| Data | Path | Read it with |
|---|---|---|
| Taxi trips, CSV: 3 monthly files, 19 columns, header line | `f"{BASE}/nyctaxi/green_tripdata_2017-1*.csv"` | `spark.read.csv(path, header=True, inferSchema=True)`, or `schema=...` |
| Taxi trips, Parquet folder (types stored in the files) | `f"{BASE}/nyctaxi/green_2017"` | `spark.read.parquet(path)` |
| GitHub events, JSON Lines, gzip | `f"{BASE}/gharchive/*.json.gz"` | `spark.read.json(path)` |
| Books, plain text | `f"{BASE}/gutenberg/1/1/1/*/*/?????.txt"` | `spark.read.text(path)`; `wholetext=True` gives one row per file |
| Your own results | `f"{BASE}/output/..."` | `df.write.parquet(path, mode="overwrite", partitionBy=["col"])` |

- `*` and `?` in a path are a glob: `*` matches any text, `?` one character. One read can take many files.
- `dbutils.fs.ls(path)` lists a folder. `dbutils.fs.rm(path, True)` deletes a folder and everything in it: double-check the path.
- `F.col("_metadata.file_path")` tells you which file each row came from. Paths showed as `dbfs:/Volumes/...` in our local run; Databricks may print them a little differently.
- Fresh start: `dbutils.library.restartPython()` (or "Restart Python" / "Clear state" in the compute menu). Then run the section's first cell.
- First time only: run `00-setup-data.ipynb`, which downloads the data, fills the volume and writes the two lesson files under `lessons/`.
