# Source notes — pandas I: Finding, Reading and Checking Data

## Source
- File: midterm-exam/Problem 1.ipynb, Problem 2.ipynb (BDCC 2026 Fall) | Date: 2026-11-03
- Used for the *shape* of the tasks only: a spec names a data folder (Food.com recipes and interactions), Problem 1a
  names a file, 1b and 1c pass only a user, Problem 2 needs the `tags` column as lists. No exam code, thresholds or
  assert values are reused.
- Lesson data: food-mini, invented (8 Filipino recipes, 8 users, 30 reviews) in the Food.com file layout:
  `RAW_interactions.csv` (user_id, recipe_id, date, rating, review), `RAW_recipes.csv` (name, id, minutes,
  contributor_id, submitted, tags, n_steps, ingredients, n_ingredients), `interactions_train.csv` (a subset with
  codes u, i), `README.txt`. Files in `assets/food-mini/`, written by make_data.py.

## Concept inventory (lecture order)
1. Finding the file in a folder — scene new-folder, section find-and-read
2. Peeking at a CSV; header row; quoted commas — scene peek-then-read
3. pd.read_csv with the full path; FileNotFoundError — scene peek-then-read
4. shape, dtypes, value_counts, nunique; KeyError on a column typo — scene look-first, section check-the-load
5. Lists saved as text; ast.literal_eval; converters; explode — scene lists-in-disguise, section lists-as-text
6. groupby count; >= vs >; isin — scene count-cut-pivot, section utility-matrix
7. pivot to a utility matrix; NaN; duplicate-entry ValueError — same
8. loc (label) vs iloc (position); IndexError, KeyError — scene count-cut-pivot, section graded-functions
9. Self-contained graded functions; NameError in a fresh kernel; missing return → AttributeError — scene fresh-kernel

## Formulas (verbatim, as TeX)
- None: this is a workflow module. Key lines appear as `keyFormula` in each section.

## Worked examples (exact numbers)
- Every output comes from record.py, which runs each lesson cell for real (Python 3.12.12, pandas 2.2.3) in fresh
  namespaces ("kernels"), numbering cells like Jupyter. The course server runs Python 3.12 (Lab 1 metadata); pandas
  2.2 is assumed there, which matters for `object` dtypes (pandas 3 prints `str`).
- Recording conventions: stdout plus the repr of a final bare expression (Jupyter's text output);
  `display.max_columns = 20` and `display.width = 200` so `head()` shows every column, as Jupyter's HTML table does;
  library frames in tracebacks collapse into one `  ...` line and caret lines are left out; the local data folder is
  shown as `/mnt/data/public`.
- An `os.listdir` call on a misspelled folder was dropped: on Windows it raises `[WinError 3]`, not the Linux
  `[Errno 2]` students see. read_csv's FileNotFoundError is the same on both and teaches the same error.
- Counts per recipe 1207:6, 2318:5, 3542:4, 4415:4, 5021:3, 6110:2, 7064:5, 8233:1 → examples counts-per-recipe,
  keep-at-least-4 (>= 4 keeps 5, > 4 keeps 3, 24 rows)
- Utility matrix (8, 5), every cell → utility-matrix
- Tags text lengths 99, 92, 86; tag counts 7, 7, 6, 6, 6, 6, 7, 6 → tags-as-text

## Conventions & ambiguities
- A rating of 0 is a review left without stars (as in Food.com). Lessons show that `count()` counts it and `mean()`
  includes it, and say the spec decides; they do not claim a course convention.
- `rated_by(user)` takes a user id (a label) and uses `loc`.

## Errata
- None.

## Beyond the slides
- The whole module is beyond the lectures: it teaches the notebook workflow the midterm assumed.

## Skill map
- find-files: listing, README, subsets (train/test/sample)
- peek-file: first lines, header, quoting
- read-csv: full path, FileNotFoundError
- inspect-frame: shape, dtypes, value_counts, nunique, KeyError
- list-columns: stringified lists, literal_eval, converters, explode
- threshold-filter: groupby count, >= vs >, isin
- pivot-matrix: pivot, NaN, duplicates
- loc-iloc: label vs position, IndexError, KeyError
- self-contained: fresh kernel, NameError, missing return
