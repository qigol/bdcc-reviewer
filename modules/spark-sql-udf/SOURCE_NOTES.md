# Source notes — Spark SQL and User-Defined Functions

## Source
- File: `Spark SQL API.ipynb` (course lab notebook, 87 cells, folder `spark-sql-exercises/`, with `seeds.json`) | Date: 2026-10-23 (file date)
- Sections: setup (cells 0–8), User-defined functions (9–24), Pandas UDF (25–38), Problems 1–3 (39–47), SQL statements (48–64), Problems 4–10 (65–85).
- The notebook reads `/mnt/data/public/...` on the course server (NYC green taxi Q4 2017, a Twitter sample, Gutenberg texts). Those files are not available here. Its only recorded outputs are `trips.printSchema()` (19 columns) and an interrupted tweets read.

## Recording runtime vs. the course's runtime
- **Recorded on:** Python 3.14.1 + PySpark 4.3.0 (pandas 2.3.3, pyarrow 26.0.0, Java 17, `local[*]` on Windows).
- **The course runs:** Python 3.12 (the notebook's own traceback shows `/opt/conda/lib/python3.12/...`) and the Spark 4.0/4.1 era (`py4j-0.10.9.9` under `/usr/local/spark/python/lib`).
- **Decision:** the user chose to keep the 3.14 / 4.3 runs and not re-record (2026-11-03).
- **Difference 1, the Arrow default.** In PySpark 4.3, `spark.sql.execution.pythonUDF.arrow.enabled` starts as `'true'` (real run `ar.default`), so a plain `@udf` already uses Arrow. The notebook says Python UDFs use pickle by default, which holds where that setting starts false.
  - The lessons always attach the version to the claim ("in PySpark 4.3, the version these runs used"), and they show both behaviours with an explicit `useArrow=True` / `useArrow=False`.
  - They never claim pickle is the default.
  - With a mismatched return type, the two differ: pickle gives NULL, Arrow casts the value or raises an error.
- **Difference 2, traceback carets.** Python 3.14 underlines a failing call with `~` and `^` marks (for example `~~~~~~~~~^^^^`). The Python 3.12 traceback printed in the notebook underlines with `^` only. The exception lines themselves (class and message) are Spark's, not Python's.
- Other text that depends on the version: error class names and messages are those of Spark 4.3. The classes used here (`TABLE_OR_VIEW_NOT_FOUND`, `UNRESOLVED_ROUTINE`, `UNRESOLVED_COLUMN`, `MISSING_AGGREGATION`, `PARSE_SYNTAX_ERROR`, `UDF_RETURN_TYPE`) also exist in Spark 4.0, but the wording of a message may differ slightly.

## Real runs (how every learner-visible output was made)
- Harness (build scratchpad, `run/harness.py`): each cell's code runs in one shared namespace, in order. The harness records stdout, the echo of a last bare expression (as Jupyter's Out[]) and a trimmed traceback: frames outside the cell become `  ...`, worker frames inside a PythonException are collapsed the same way, and local folders become `<work>` and `<site-packages>`. Output: `run/out1.json` … `out4.json`. Script `build/build_logic.mjs` copies them into `REAL` in logic.js (never typed by hand).
- Versions: PySpark 4.3.0, `local[*]`, Python 3.14.1 (uv venv), pandas 2.3.3 (pinned below 3: PySpark warns that pandas 3 is not fully supported), pyarrow 26.0.0, Zulu JRE 17, Windows. Date 2026-11-03.
- Hidden harness setup, not shown to learners: session time zone UTC, console progress bar off, log level OFF, a pre-created `spark-warehouse` folder (without it, the first catalog access on Windows fails asking for winutils). The shown setup cell is the notebook's own builder (`local[*]`, Arrow for pandas on).
- Cell numbers in tracebacks (`<cell 13>`) are harness positions, not notebook positions; Code widget titles avoid numbers, except the Application cells, which were recorded with cell numbers 1–7 to match their titles.
- Not used (memory addresses or Py4J internals in the text): `udf.type`, `udf.call_column`, `sql.register_clip`. Dropped: `rt.int_for_double_*` (a UDF reading a timestamp got the machine's local time, 16:00 instead of 08:00, an artefact of the Windows worker's time zone).

## Data
- `taxi12`: the 12 real trips used by spark-df-basics/-debugging/-formats (10 of 19 columns). Read with `header=True, inferSchema=True`. The notebook's `RatecodeID` is not among the 10 columns, so its first SELECT example filters on `VendorID == 1` instead (3 trips), and `applyInPandas` groups by `VendorID` instead of `RatecodeID`.
- `tweets8`: 8 synthetic tweets written for this module in the shape of the course sample (`id`, `text`, nested `user{id, name, screen_name, description, statuses_count, friends_count, created_at}`, `place{country_code}`, `entities.hashtags[].text`). Ids are 16 digits so JavaScript holds them exactly. Tweets 7–8 have `place: null`. Means were chosen to be hand-computable (PH 1550, US 1500, JP 640, NULL 2550; all 8: 1673.75).
- `seeds.json`: `{"a": 193602, "b": 15914, "c": 1}` (copied numbers only).

## Concept inventory (notebook order)
1. Built-in functions in `select`/`withColumn`/`where` (cell 8) — `setup.builtin_chain`.
2. A UDF with `@udf`; arguments are columns, the function receives row values (cells 10–17) — `udf.def`, `udf.show`. New for the module: the same function without `@udf` (`udf.plain_*`), and a UDF called on plain numbers (`udf.call_values`, NOT_EXPECTED_TYPE).
3. Pickle by default (the notebook's claim; in PySpark 4.3 the default is Arrow, see "Recording runtime"), `useArrow=True`, or the setting `spark.sql.execution.pythonUDF.arrow.enabled` (cells 12–15) — `udf.arrow_*`, `ar.*`.
4. `returnType`, default StringType; StructType for nested fields (cells 18–21) — `udf.struct_*`; DDL string (22–24) — `udf.ddl_*`.
5. Pandas UDF kinds by type hint (26): Series→Series (28–29) `pd.clip_*`; Iterator[Series] (31) `pd.mask_id`; Iterator[Tuple[Series, …]] (33) `pd.fare_rate`; Series→Scalar (35) `pd.mean_udf`; `applyInPandas` (37–38) `pd.standardize_*`.
6. Temp views and `spark.sql` (49–53) `sql.view_*`, `sql.select`, `sql.where`; `explain` (55) `sql.explain`.
7. Register a UDF for SQL (56–58) `sql.register_pair`, `sql.pair_show`; register a lambda with a type (59–61) `sql.register_double`, `sql.double_show`; CASE WHEN (62) `sql.case_when`; register a pandas UDF (63–64) `sql.clip_show`.

## Formulas
- Row UDF: `out_i = f(pu_i, do_i)`, i = 1..n.
- Batches: calls = ⌈n / B⌉ (B = `spark.sql.execution.arrow.maxRecordsPerBatch`, default 10,000).
- Clip: `clip(x) = min(max(x, lo), hi)` (np.clip).
- Hash: `h(x) = (a·x + b) mod c` (numpy int64; logic.js `hashInt64` wraps at 64 bits like numpy).
- Series to scalar: `x̄_g = (1/n_g) Σ_{i∈g} x_i`.
- applyInPandas: `normed_i = fare_i / max_{j∈g} fare_j`.
- CASE: long when `2·d_i > t` (FLOAT arithmetic).
- GROUP BY AVG: `t̄_g = (1/n_g) Σ_{i∈g} t_i`.

## Worked examples (real outputs; engine checks in examples.yaml, fn realMatch)
- `pair_code` on taxi12 → 41-238, 97-137, 7-261, … (12 rows, 11 different codes) — `udf.show` [pair-code-show]; SQL after register, LIMIT 10 — `sql.pair_show` [pair-code-sql-show].
- Plain function on Columns → the string `Column<'PULocationID'>-Column<'DOLocationID'>`, then select fails with UNRESOLVED_COLUMN — `udf.plain_columns`, `udf.plain_select_cols`.
- Return types: no type → `23.0` as string (`udf.double_default_show`, schema `string`); `'double'` → 23.0; `'int'` with Arrow → 23; `'int'` with `useArrow=False` → NULL (`ar.int_pickle_show`) [int-pickle-nulls, int-arrow-no-nulls]; text for int: pickle NULL (`ar.label_pickle_show`), Arrow ArrowInvalid error (`ar.label_arrow_show`).
- Struct: `{101, {Ana Santos, Nurse. Coffee first.}}` … — `udf.struct_show_full` [struct-show], DDL `udf.ddl_show` [ddl-show]; schema `udf.struct_schema`; dot path `udf.struct_dot`.
- Arrow default in PySpark 4.3: `spark.conf.get("spark.sql.execution.pythonUDF.arrow.enabled")` → `'true'` (`ar.default`).
- Batches: one batch of 12 (`pd.batch_show_all`); with maxRecordsPerBatch 5 → 5, 5, 2 (`pd.batch_small`) [batches-default, batches-of-5].
- Clip 0–100 changes nothing (`pd.clip_show`) [clip-100-show]; clip 0–5 changes trips 2, 3, 6, 12 (`pd.clip5_show`) [clip-5-show, clip-counts].
- mask_id with seeds.json (c = 1) → 0 for all 8 ids (`pd.mask_id`) [mask-id-seeds]; with c = 1000 on user ids → 716, 318, 920, 522, 124, 726, 328, 930 (`pd.mask_demo`) [mask-demo-show, mask-demo-first]; `return` instead of `yield` → UDF_RETURN_TYPE (`pd.mask_return`).
- fare_rate → 5.927835, 4.3307085, …, trip 4 highest 10.810811 (`pd.fare_rate`) [fare-rate-show, fare-rate-top]; with one column → ValueError unpack (`pd.fare_rate_one`).
- mean_udf per country → NULL 2550.0, JP 640.0, PH 1550.0, US 1500.0 (`pd.mean_udf`) [mean-udf-show]; all 1673.75 (`pd.mean_udf_all`, `pd.mean_udf_select`); Series→Series in agg → MISSING_AGGREGATION (`pd.clip_in_agg`).
- applyInPandas by VendorID → vendor 1: 1.0, 0.17391305, 0.89855075; vendor 2: … (`pd.standardize_show`, FLOAT), with columns kept (`pd.standardize_keep`) [normed-show].
- SQL: before the view → TABLE_OR_VIEW_NOT_FOUND (`sql.before_view`); WHERE fare_amount > 20 → 4 rows (`sql.where`) [where-show, where-count]; returns a DataFrame (`sql.type`); plan (`sql.explain`); UDF before register → UNRESOLVED_ROUTINE (`sql.udf_before_register`).
- double_distance FLOAT → 3.88, 10.16, 19.6, … (`sql.double_show`); CASE > 10 → 3 long of the first 10 (`sql.case_when`) [case-show, case-count]; all 12 → 4 long (`sql.case_when_all`).
- Lambda without a type, ORDER BY dd DESC → text order 4.3, 3.88, …, 2.0, 19.6, 16.2, 14.2, 10.16, 0.74 (`sql.notype_show`) [text-order]; typed → 19.6 first (`sql.typed_order`) [typed-order].
- Alias with a space: bare → PARSE_SYNTAX_ERROR (`sql.alias_space_bad`); single quotes → PARSE_SYNTAX_ERROR (`sql.alias_single_quotes`); backticks → vendor 1 4.116666666666666, vendor 2 1.3055555555555556 (`sql.alias_space_ok`) [group-avg-show]; no alias → `avg(tip_amount)` (`sql.alias_none`).
- COUNT per zone → 7:4, 33:2, 41:2, 74:2, 75:1, 97:1 (`sql.group_count`); ungrouped column → MISSING_AGGREGATION (`sql.group_missing`); misspelled column (`sql.typo_column`).
- Application (cells recorded as 1–7): see `app.*` keys. View fixes (`app.c1.*`), band in SQL (`app.c2.*`, BOOLEAN → all NULL), alias (`app.c3.*`; double quotes and a dash also fail), iterator in SQL (`app.c4.*`), lambda order (`app.c5`, `app.c5.typed`), aggregate in GROUP BY (`app.c6.*`; AVG gives the same 29.125 / 8.5625).

## Conventions & ambiguities
- **Arrow default.** The notebook says Python UDFs use pickle by default. In PySpark 4.3, the version these runs used, `spark.sql.execution.pythonUDF.arrow.enabled` is already `'true'` (`ar.default`), so a plain `@udf` uses Arrow. The module says so, and shows both behaviours with explicit `useArrow=True/False`. A function registered with `spark.udf.register` behaved like pickle (BOOLEAN mismatch → NULL, `app.c2.bool`), while `@udf('boolean', useArrow=True)` raised an error (`ar.bool_arrow_show`).
- **Group order.** `groupby(...).agg(...)` output order is what the real run printed (NULL, JP, PH, US); the module never claims it is guaranteed.
- **Float columns.** FLOAT results (clip, fare_rate, double_distance) are 32-bit; logic.js uses `Math.fround` and Java's float printing, so the engine reproduces the real text byte for byte.

## Errata
- None found in the notebook's code. Its prose says pickle is the default for Python UDFs; that holds for versions where the Arrow setting starts false, not for PySpark 4.3 (see Conventions).

## Beyond the notebook
- The plain-function failure, the batch-size UDF (`batch_size`), clip with hi = 5, the hash with c = 1000, the misuses (return vs yield, one column for fare_rate, Series→Series in agg), the alias failures and the untyped-lambda sort — all added to show real errors; each is a real run.
- The graded Problems 1–10 are not solved, and their exact specifications (letter-a counter, z-score, fare struct, mean fare per pickup zone named `mean fare amount`, pickup hours, friendliest users, hashtags, tokens, love, creation years) are not used as examples.
- Problem assertion numbers (255 zones, 2286 hours, 413 #PCAs, …) are full-dataset values; they are not reproduced or used.

## Skill map
- udf-wrap: concepts 2; scene plain-function; section udf-per-row.
- udf-return-type: 4; scene return-types; section struct-return.
- arrow-transfer: 3, batches; scene pickle-or-arrow; section arrow-batches.
- pandas-series-udf: 5 (Series→Series); scene whole-batches; section clip-series.
- iterator-udf: 5 (Iterator kinds); scene iterators; section iterator-hash.
- grouped-pandas: 5 (Series→Scalar, applyInPandas); scene one-per-group; section group-mean.
- temp-view-sql: 6; scene tables-by-name; section sql-where.
- sql-udf-register: 7; scene functions-in-sql; section sql-case-udf.
- sql-clauses: 6–7 (CASE, GROUP BY, alias); scene group-and-name; section sql-group-alias.
