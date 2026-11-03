// Qdigo module: pandas-read-data (pandas I: finding, reading and checking data).
// REAL holds every lesson output, recorded by running the cells for real (Python 3.12.12, pandas 2.2.3;
// see SOURCE_NOTES.md). The small pandas equivalents below are checked against REAL in examples.yaml.
export default function register(sdk) {
  const REAL = {
   "pd.explore.ls": {
    "code": "import os\n\nDATA = \"/mnt/data/public/food-mini\"\nsorted(os.listdir(DATA))",
    "out": "['RAW_interactions.csv', 'RAW_recipes.csv', 'README.txt', 'interactions_train.csv']\n",
    "err": "",
    "cell": 1
   },
   "pd.explore.peek": {
    "code": "with open(DATA + \"/RAW_interactions.csv\") as f:\n    for _ in range(3):\n        print(f.readline(), end=\"\")",
    "out": "user_id,recipe_id,date,rating,review\n1101,1207,2019-04-01,5,Tastes like my lola's.\n1388,2318,2019-08-02,5,Perfect with longganisa.\n",
    "err": "",
    "cell": 2
   },
   "pd.explore.read": {
    "code": "import pandas as pd\n\ninteractions = pd.read_csv(DATA + \"/RAW_interactions.csv\")\ninteractions.shape",
    "out": "(30, 5)\n",
    "err": "",
    "cell": 3
   },
   "pd.explore.read_wrong": {
    "code": "pd.read_csv(DATA + \"/interactions.csv\")",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 4>\", line 1, in <module>\n    pd.read_csv(DATA + \"/interactions.csv\")\n  ...\nFileNotFoundError: [Errno 2] No such file or directory: '/mnt/data/public/food-mini/interactions.csv'",
    "cell": 4
   },
   "pd.explore.read_noprefix": {
    "code": "pd.read_csv(\"RAW_interactions.csv\")",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 5>\", line 1, in <module>\n    pd.read_csv(\"RAW_interactions.csv\")\n  ...\nFileNotFoundError: [Errno 2] No such file or directory: 'RAW_interactions.csv'",
    "cell": 5
   },
   "pd.explore.head": {
    "code": "interactions.head()",
    "out": "   user_id  recipe_id        date  rating                                  review\n0     1101       1207  2019-04-01       5                  Tastes like my lola's.\n1     1388       2318  2019-08-02       5                Perfect with longganisa.\n2     1245       1207  2019-09-14       4  A bit salty, so I used less soy sauce.\n3     1101       2318  2019-10-05       4                         Quick and good.\n4     1502       1207  2020-02-11       5                Made it twice this week.\n",
    "err": "",
    "cell": 6
   },
   "pd.explore.dtypes": {
    "code": "interactions.dtypes",
    "out": "user_id       int64\nrecipe_id     int64\ndate         object\nrating        int64\nreview       object\ndtype: object\n",
    "err": "",
    "cell": 7
   },
   "pd.explore.columns": {
    "code": "interactions.columns.tolist()",
    "out": "['user_id', 'recipe_id', 'date', 'rating', 'review']\n",
    "err": "",
    "cell": 8
   },
   "pd.explore.col_typo": {
    "code": "interactions[\"ratings\"]",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 9>\", line 1, in <module>\n    interactions[\"ratings\"]\n  ...\nKeyError: 'ratings'",
    "cell": 9
   },
   "pd.explore.ratings_vc": {
    "code": "interactions[\"rating\"].value_counts().sort_index()",
    "out": "rating\n0     2\n3     3\n4    11\n5    14\nName: count, dtype: int64\n",
    "err": "",
    "cell": 10
   },
   "pd.explore.train_cols": {
    "code": "pd.read_csv(DATA + \"/interactions_train.csv\").columns.tolist()",
    "out": "['user_id', 'recipe_id', 'date', 'rating', 'u', 'i']\n",
    "err": "",
    "cell": 11
   },
   "pd.explore.train_shape": {
    "code": "pd.read_csv(DATA + \"/interactions_train.csv\").shape",
    "out": "(19, 6)\n",
    "err": "",
    "cell": 12
   },
   "pd.explore.nunique": {
    "code": "interactions[\"user_id\"].nunique(), interactions[\"recipe_id\"].nunique()",
    "out": "(8, 8)\n",
    "err": "",
    "cell": 13
   },
   "pd.tags.read": {
    "code": "import pandas as pd\n\nrecipes = pd.read_csv(\"/mnt/data/public/food-mini/RAW_recipes.csv\")\nrecipes[[\"name\", \"id\", \"tags\"]].head(3)",
    "out": "                name    id                                               tags\n0      chicken adobo  1207  ['60-minutes-or-less', 'time-to-make', 'course...\n1  garlic fried rice  2318  ['30-minutes-or-less', 'time-to-make', 'course...\n2      pancit canton  3542  ['60-minutes-or-less', 'time-to-make', 'course...\n",
    "err": "",
    "cell": 1
   },
   "pd.tags.first_tags": {
    "code": "recipes.loc[0, \"tags\"]",
    "out": "\"['60-minutes-or-less', 'time-to-make', 'course', 'main-ingredient', 'main-dish', 'chicken', 'easy']\"\n",
    "err": "",
    "cell": 2
   },
   "pd.tags.type_str": {
    "code": "type(recipes.loc[0, \"tags\"])",
    "out": "<class 'str'>\n",
    "err": "",
    "cell": 3
   },
   "pd.tags.len_str": {
    "code": "recipes[\"tags\"].str.len().head(3)",
    "out": "0    99\n1    92\n2    86\nName: tags, dtype: int64\n",
    "err": "",
    "cell": 4
   },
   "pd.tags.in_str": {
    "code": "\"dinner\" in recipes.loc[2, \"tags\"]",
    "out": "True\n",
    "err": "",
    "cell": 5
   },
   "pd.tags.naive_split": {
    "code": "recipes.loc[0, \"tags\"][1:-1].split(\", \")",
    "out": "[\"'60-minutes-or-less'\", \"'time-to-make'\", \"'course'\", \"'main-ingredient'\", \"'main-dish'\", \"'chicken'\", \"'easy'\"]\n",
    "err": "",
    "cell": 6
   },
   "pd.tags.literal": {
    "code": "import ast\n\nast.literal_eval(recipes.loc[0, \"tags\"])",
    "out": "['60-minutes-or-less', 'time-to-make', 'course', 'main-ingredient', 'main-dish', 'chicken', 'easy']\n",
    "err": "",
    "cell": 7
   },
   "pd.tags.converters": {
    "code": "recipes = pd.read_csv(\"/mnt/data/public/food-mini/RAW_recipes.csv\", converters={\"tags\": ast.literal_eval})\ntype(recipes.loc[0, \"tags\"]), len(recipes.loc[0, \"tags\"])",
    "out": "(<class 'list'>, 7)\n",
    "err": "",
    "cell": 8
   },
   "pd.tags.in_list": {
    "code": "\"dinner\" in recipes.loc[2, \"tags\"]",
    "out": "False\n",
    "err": "",
    "cell": 9
   },
   "pd.tags.n_tags": {
    "code": "recipes[\"tags\"].str.len().tolist()",
    "out": "[7, 7, 6, 6, 6, 6, 7, 6]\n",
    "err": "",
    "cell": 10
   },
   "pd.tags.explode": {
    "code": "recipes[\"tags\"].explode().value_counts().head(6)",
    "out": "tags\ntime-to-make          8\ncourse                8\neasy                  4\nmain-ingredient       3\n60-minutes-or-less    3\ndinner-party          3\nName: count, dtype: int64\n",
    "err": "",
    "cell": 11
   },
   "pd.tags.easy": {
    "code": "recipes[recipes[\"tags\"].apply(lambda t: \"easy\" in t)][\"name\"].tolist()",
    "out": "['chicken adobo', 'garlic fried rice', 'turon', 'tortang talong']\n",
    "err": "",
    "cell": 12
   },
   "pd.matrix.setup": {
    "code": "import pandas as pd\n\ninteractions = pd.read_csv(\"/mnt/data/public/food-mini/RAW_interactions.csv\")\ncounts = interactions.groupby(\"recipe_id\")[\"rating\"].count()\ncounts",
    "out": "recipe_id\n1207    6\n2318    5\n3542    4\n4415    4\n5021    3\n6110    2\n7064    5\n8233    1\nName: rating, dtype: int64\n",
    "err": "",
    "cell": 1
   },
   "pd.matrix.keep_ge": {
    "code": "counts[counts >= 4].index.tolist()",
    "out": "[1207, 2318, 3542, 4415, 7064]\n",
    "err": "",
    "cell": 2
   },
   "pd.matrix.keep_gt": {
    "code": "counts[counts > 4].index.tolist()",
    "out": "[1207, 2318, 7064]\n",
    "err": "",
    "cell": 3
   },
   "pd.matrix.filtered": {
    "code": "keep = counts[counts >= 4].index\nrated = interactions[interactions[\"recipe_id\"].isin(keep)]\nrated.shape",
    "out": "(24, 5)\n",
    "err": "",
    "cell": 4
   },
   "pd.matrix.pivot": {
    "code": "util = rated.pivot(index=\"user_id\", columns=\"recipe_id\", values=\"rating\")\nutil.shape",
    "out": "(8, 5)\n",
    "err": "",
    "cell": 5
   },
   "pd.matrix.util_show": {
    "code": "util",
    "out": "recipe_id  1207  2318  3542  4415  7064\nuser_id                                \n1101        5.0   4.0   NaN   5.0   3.0\n1245        4.0   NaN   5.0   NaN   4.0\n1388        5.0   5.0   0.0   NaN   NaN\n1502        5.0   3.0   NaN   5.0   4.0\n1690        4.0   NaN   4.0   NaN   NaN\n1734        NaN   4.0   NaN   4.0   5.0\n1876        5.0   NaN   5.0   NaN   4.0\n1923        NaN   5.0   NaN   0.0   NaN\n",
    "err": "",
    "cell": 6
   },
   "pd.matrix.util_axes": {
    "code": "util.index.tolist(), util.columns.tolist()",
    "out": "([1101, 1245, 1388, 1502, 1690, 1734, 1876, 1923], [1207, 2318, 3542, 4415, 7064])\n",
    "err": "",
    "cell": 7
   },
   "pd.matrix.loc_user": {
    "code": "util.loc[1101].dropna()",
    "out": "recipe_id\n1207    5.0\n2318    4.0\n4415    5.0\n7064    3.0\nName: 1101, dtype: float64\n",
    "err": "",
    "cell": 8
   },
   "pd.matrix.iloc_zero": {
    "code": "util.iloc[0].dropna()",
    "out": "recipe_id\n1207    5.0\n2318    4.0\n4415    5.0\n7064    3.0\nName: 1101, dtype: float64\n",
    "err": "",
    "cell": 9
   },
   "pd.matrix.iloc_user": {
    "code": "util.iloc[1101]",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 10>\", line 1, in <module>\n    util.iloc[1101]\n  ...\nIndexError: single positional indexer is out-of-bounds",
    "cell": 10
   },
   "pd.matrix.loc_zero": {
    "code": "util.loc[0]",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 11>\", line 1, in <module>\n    util.loc[0]\n  ...\nKeyError: 0",
    "cell": 11
   },
   "pd.matrix.dup_pivot": {
    "code": "twice = pd.concat([rated, rated.head(1)])\ntwice.pivot(index=\"user_id\", columns=\"recipe_id\", values=\"rating\")",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 12>\", line 2, in <module>\n    twice.pivot(index=\"user_id\", columns=\"recipe_id\", values=\"rating\")\n  ...\nValueError: Index contains duplicate entries, cannot reshape",
    "cell": 12
   },
   "pd.funcs.define": {
    "code": "import pandas as pd\n\ndef create_utility_matrix():\n    df = pd.read_csv(\"/mnt/data/public/food-mini/RAW_interactions.csv\")\n    counts = df.groupby(\"recipe_id\")[\"rating\"].count()\n    keep = counts[counts >= 4].index\n    rated = df[df[\"recipe_id\"].isin(keep)]\n    return rated.pivot(index=\"user_id\", columns=\"recipe_id\", values=\"rating\")\n\ndf_utility = create_utility_matrix()\ndf_utility.shape",
    "out": "(8, 5)\n",
    "err": "",
    "cell": 1
   },
   "pd.funcs.uses_global": {
    "code": "def rated_by(user):\n    return df_utility.loc[user].dropna().index.tolist()\n\nrated_by(1502)",
    "out": "[1207, 2318, 4415, 7064]\n",
    "err": "",
    "cell": 2
   },
   "pd.funcs.no_return": {
    "code": "def create_utility_matrix_v2():\n    df = pd.read_csv(\"/mnt/data/public/food-mini/RAW_interactions.csv\")\n    util = df.pivot_table(index=\"user_id\", columns=\"recipe_id\", values=\"rating\")\n\ncreate_utility_matrix_v2().shape",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 3>\", line 5, in <module>\n    create_utility_matrix_v2().shape\nAttributeError: 'NoneType' object has no attribute 'shape'",
    "cell": 3
   },
   "pd.fresh.uses_global": {
    "code": "def rated_by(user):\n    return df_utility.loc[user].dropna().index.tolist()\n\nrated_by(1502)",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 1>\", line 4, in <module>\n    rated_by(1502)\n  File \"<cell 1>\", line 2, in rated_by\n    return df_utility.loc[user].dropna().index.tolist()\nNameError: name 'df_utility' is not defined",
    "cell": 1
   },
   "pd.fresh_fixed.self_contained": {
    "code": "import pandas as pd\n\ndef create_utility_matrix():\n    df = pd.read_csv(\"/mnt/data/public/food-mini/RAW_interactions.csv\")\n    counts = df.groupby(\"recipe_id\")[\"rating\"].count()\n    keep = counts[counts >= 4].index\n    rated = df[df[\"recipe_id\"].isin(keep)]\n    return rated.pivot(index=\"user_id\", columns=\"recipe_id\", values=\"rating\")\n\ndef rated_by(user):\n    df_utility = create_utility_matrix()\n    return df_utility.loc[user].dropna().index.tolist()\n\nrated_by(1502)",
    "out": "[1207, 2318, 4415, 7064]\n",
    "err": "",
    "cell": 1
   }
  };
  const ENV = {"python":"3.12.12","pandas":"2.2.3"};

  // ------------------------------------------------------------------------------------------
  // The lesson data: food-mini, byte-for-byte the rows of the recorded CSV files (make_data.py).
  // ------------------------------------------------------------------------------------------
  const DATA = '/mnt/data/public/food-mini';
  const FILES = ['RAW_interactions.csv', 'RAW_recipes.csv', 'README.txt', 'interactions_train.csv'];
  // [user_id, recipe_id, date, rating, review]; rating 0 = a review left without stars
  const INTERACTIONS = [
    [1101, 1207, '2019-04-01', 5, "Tastes like my lola's."],
    [1388, 2318, '2019-08-02', 5, 'Perfect with longganisa.'],
    [1245, 1207, '2019-09-14', 4, 'A bit salty, so I used less soy sauce.'],
    [1101, 2318, '2019-10-05', 4, 'Quick and good.'],
    [1502, 1207, '2020-02-11', 5, 'Made it twice this week.'],
    [1245, 3542, '2020-03-03', 5, 'Great for birthdays.'],
    [1388, 1207, '2020-04-18', 5, 'Classic.'],
    [1101, 4415, '2020-06-21', 5, 'Silky, no bubbles!'],
    [1388, 3542, '2020-07-07', 0, 'Can I use bihon instead?'],
    [1502, 2318, '2020-08-30', 3, 'Needed more garlic.'],
    [1690, 1207, '2020-09-12', 4, 'Good, but I prefer it drier.'],
    [1502, 4415, '2020-10-25', 5, 'My family loved it.'],
    [1734, 2318, '2020-12-01', 4, 'Easy breakfast.'],
    [1245, 5021, '2020-12-24', 4, 'Sour enough, add more tamarind if you like.'],
    [1876, 1207, '2021-01-16', 5, 'Best adobo recipe here.'],
    [1690, 3542, '2021-02-02', 4, 'Too much soy sauce for me.'],
    [1101, 7064, '2021-03-09', 3, 'Okay.'],
    [1734, 4415, '2021-04-04', 4, 'Took longer than 90 minutes.'],
    [1388, 6110, '2021-05-01', 4, 'Crispy, use more sugar.'],
    [1690, 5021, '2021-06-13', 5, 'Comfort food on a rainy day.'],
    [1245, 7064, '2021-09-01', 4, 'Simple and filling.'],
    [1923, 2318, '2021-10-10', 5, 'Every morning.'],
    [1876, 3542, '2021-11-20', 5, 'Party favorite.'],
    [1502, 7064, '2022-01-08', 4, 'Good with ketchup.'],
    [1923, 4415, '2022-03-15', 0, 'Steamed or baked?'],
    [1734, 7064, '2022-05-27', 5, 'My kids eat eggplant now.'],
    [1876, 5021, '2022-07-04', 3, 'Missing the gabi.'],
    [1923, 6110, '2022-09-18', 5, "Like the street vendor's."],
    [1690, 8233, '2022-11-11', 5, 'So refreshing, "the" summer dessert.'],
    [1876, 7064, '2023-01-29', 4, 'Nice.'],
  ];
  const INTER_COLS = ['user_id', 'recipe_id', 'date', 'rating', 'review'];
  // [name, id, minutes, tags]
  const RECIPES = [
    ['chicken adobo', 1207, 60, ['60-minutes-or-less', 'time-to-make', 'course', 'main-ingredient', 'main-dish', 'chicken', 'easy']],
    ['garlic fried rice', 2318, 20, ['30-minutes-or-less', 'time-to-make', 'course', 'side-dishes', 'rice', 'easy', 'breakfast']],
    ['pancit canton', 3542, 45, ['60-minutes-or-less', 'time-to-make', 'course', 'main-dish', 'pasta', 'dinner-party']],
    ['leche flan', 4415, 90, ['4-hours-or-less', 'time-to-make', 'course', 'desserts', 'eggs-dairy', 'dinner-party']],
    ['sinigang na baboy', 5021, 75, ['4-hours-or-less', 'time-to-make', 'course', 'main-ingredient', 'soups-stews', 'pork']],
    ['turon', 6110, 30, ['30-minutes-or-less', 'time-to-make', 'course', 'desserts', 'fruit', 'easy']],
    ['tortang talong', 7064, 25, ['30-minutes-or-less', 'time-to-make', 'course', 'main-ingredient', 'vegetables', 'easy', 'breakfast']],
    ['halo-halo', 8233, 40, ['60-minutes-or-less', 'time-to-make', 'course', 'desserts', 'no-cook', 'dinner-party']],
  ];

  // ------------------------------------------------------------------------------------------
  // Real runs (record.py): code, stdout + repr of the last expression, trimmed traceback.
  // ------------------------------------------------------------------------------------------
  const realEntry = (k) => {
    const e = REAL[k];
    if (!e) throw new Error('REAL has no entry ' + k);
    return e;
  };
  const fence = (s, lang) => '```' + (lang || 'text') + '\n' + String(s).replace(/\n+$/, '') + '\n```';
  function finalLine(err) {
    const ls = String(err).split('\n');
    return ls[ls.length - 1];
  }
  const errClass = (line) => line.split(':')[0];

  // One recorded cell: its code, what it printed (as a text block) and, for an error, the final line and class.
  function realCell({ key }) {
    const e = realEntry(key);
    const fl = e.err ? finalLine(e.err) : null;
    const printed = e.out.replace(/\n+$/, '');
    return {
      key, code: e.code, cell: e.cell, ok: !e.err, printed,
      out: fence(e.err ? (e.out + e.err) : (printed || '(no output)')),
      final: fl, ename: fl ? errClass(fl) : null,
      codeMd: fence(e.code, 'python'),
    };
  }

  // ------------------------------------------------------------------------------------------
  // Small pandas equivalents (the lesson's operations on lists of rows). Examples check them against REAL.
  // ------------------------------------------------------------------------------------------
  const uniqSorted = (a) => [...new Set(a)].sort((x, y) => x - y);
  const pyStr = (s) => (s.includes("'") && !s.includes('"') ? '"' + s + '"' : "'" + s.replace(/'/g, "\\'") + "'");
  // repr() of a Python list of strings: how a list is saved into a CSV cell
  const pyListRepr = (xs) => '[' + xs.map(pyStr).join(', ') + ']';
  // one CSV line as Python's csv.writer writes it (quote a field holding a comma or a quote; double the quotes)
  const csvLine = (vals) => vals.map((v) => { const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',');
  const fmtFloat = (x) => (x === null ? 'NaN' : Number.isInteger(x) ? x.toFixed(1) : String(x));

  // df.groupby(item)["rating"].count(): rows per item (no rating is missing in these files), items ascending
  function countBy(rows, itemIdx = 1) {
    const m = {};
    for (const r of rows) m[r[itemIdx]] = (m[r[itemIdx]] || 0) + 1;
    return uniqSorted(rows.map((r) => r[itemIdx])).map((id) => ({ id, count: m[id] }));
  }
  const keepIds = (counts, op, t) => counts.filter((c) => (op === '>' ? c.count > t : c.count >= t)).map((c) => c.id);
  // rated.pivot(index=user, columns=item, values=rating): sorted labels, null = NaN
  function pivotRows(rows, keep, userIdx = 0, itemIdx = 1, ratingIdx = 3) {
    const kept = rows.filter((r) => keep.includes(r[itemIdx]));
    const users = uniqSorted(kept.map((r) => r[userIdx]));
    const items = uniqSorted(kept.map((r) => r[itemIdx]));
    const values = users.map((u) => items.map((i) => { const r = kept.find((x) => x[userIdx] === u && x[itemIdx] === i); return r ? r[ratingIdx] : null; }));
    return { users, items, values, rated: kept.length, cells: users.length * items.length, nan: users.length * items.length - kept.length };
  }
  const mdTable = (cols, rows) => '| ' + cols.join(' | ') + ' |\n|' + cols.map(() => '---').join('|') + '|\n' + rows.map((r) => '| ' + r.join(' | ') + ' |').join('\n');

  // ---- lesson views ------------------------------------------------------------------------
  // The data folder as a Tree (file notes from the README; names from the real listing pd.explore.ls).
  function folderTree() {
    const listed = realEntry('pd.explore.ls').out.trim();
    const notes = {
      'RAW_interactions.csv': 'one row per review: user, recipe, date, rating, text',
      'RAW_recipes.csv': 'one row per recipe: name, minutes, tags, ingredients',
      'README.txt': 'what each file holds',
      'interactions_train.csv': 'a pre-split training set with codes u and i',
    };
    return {
      listed, files: FILES,
      root: { id: 'folder', label: '`' + DATA + '/`', children: FILES.map((f, i) => ({ id: 'f' + i, label: '`' + f + '`', note: notes[f] })) },
    };
  }

  // The first n interaction rows as the CSV file holds them (what a peek shows) and as a Markdown table.
  function interactionsView({ n = 30, cols = ['user_id', 'recipe_id', 'date', 'rating'] }) {
    const idx = cols.map((c) => INTER_COLS.indexOf(c));
    const rows = INTERACTIONS.slice(0, n);
    return {
      n: rows.length,
      md: mdTable(['', ...cols], rows.map((r, i) => [String(i), ...idx.map((j) => String(r[j]))])),
      lines: [INTER_COLS.join(','), ...rows.map(csvLine)],
      raw: fence([INTER_COLS.join(','), ...rows.map(csvLine)].join('\n')),
    };
  }

  // Ratings per recipe and what each cut keeps (section utility-matrix, scene count-and-keep).
  function countsView({ threshold = 4, op = '>=' }) {
    const counts = countBy(INTERACTIONS);
    const keep = keepIds(counts, op, threshold);
    const zeros = INTERACTIONS.filter((r) => r[3] === 0).map((r) => r[1]);
    return {
      counts, keep, nKeep: keep.length,
      ge: keepIds(counts, '>=', threshold), gt: keepIds(counts, '>', threshold),
      nGe: keepIds(counts, '>=', threshold).length, nGt: keepIds(counts, '>', threshold).length,
      zeros, threshold, op,
      rows: counts.map((c) => String(c.id)), cols: ['count'], values: counts.map((c) => [c.count]),
      rated: INTERACTIONS.filter((r) => keep.includes(r[1])).length,
    };
  }

  // The utility matrix for a count cut (Matrix props) plus its shape.
  function utilView({ threshold = 4, op = '>=' }) {
    const keep = keepIds(countBy(INTERACTIONS), op, threshold);
    const p = pivotRows(INTERACTIONS, keep);
    return {
      rows: p.users.map(String), cols: p.items.map(String), values: p.values, emptyLabel: 'NaN',
      users: p.users, items: p.items, nRows: p.users.length, nCols: p.items.length, rated: p.rated, nan: p.nan,
      shape: '(' + p.users.length + ', ' + p.items.length + ')',
    };
  }

  // A user's row: util.loc[user].dropna() as {recipe: rating}
  function userRow({ user, threshold = 4 }) {
    const u = utilView({ threshold });
    const i = u.users.indexOf(user);
    if (i < 0) return { found: false, position: null, items: [], ratings: [] };
    const items = u.items.filter((_, j) => u.values[i][j] !== null);
    return { found: true, position: i, items, ratings: items.map((it) => u.values[i][u.items.indexOf(it)]), n: items.length };
  }

  // The tags column: the saved string, its length in characters, and the real list.
  function tagsView({ row = 0 }) {
    const [name, id, , tags] = RECIPES[row];
    const s = pyListRepr(tags);
    const naive = s.slice(1, -1).split(', ');
    return { name, id, s, chars: s.length, tags, n: tags.length, naive, naiveFirst: naive[0], hasDinnerStr: s.includes('dinner'), hasDinnerList: tags.includes('dinner') };
  }

  // ---- example checks: the JS equivalents give exactly what the real runs printed ------------------
  // a printed Series: an index-name line (when the index is named), one 'label value' line per row, then 'Name: …'
  const parseSeries = (out, named = true) => out.trim().split('\n').slice(named ? 1 : 0, -1).map((l) => l.trim().split(/\s+/).map(Number));
  function checkCounts() {
    const real = parseSeries(realEntry('pd.matrix.setup').out);
    const mine = countBy(INTERACTIONS).map((c) => [c.id, c.count]);
    return { same: JSON.stringify(real) === JSON.stringify(mine), n: mine.length };
  }
  function checkUtil() {
    const lines = realEntry('pd.matrix.util_show').out.trim().split('\n');
    const cols = lines[0].trim().split(/\s+/).slice(1).map(Number);
    const body = lines.slice(2).map((l) => l.trim().split(/\s+/));
    const u = utilView({ threshold: 4 });
    const same = JSON.stringify(cols) === JSON.stringify(u.items) &&
      JSON.stringify(body.map((b) => Number(b[0]))) === JSON.stringify(u.users) &&
      body.every((b, i) => b.slice(1).every((v, j) => v === fmtFloat(u.values[i][j])));
    return { same, shape: u.shape, realShape: realEntry('pd.matrix.pivot').out.trim() };
  }
  function checkTags() {
    const lens = parseSeries(realEntry('pd.tags.len_str').out, false).map((r) => r[1]);
    const mine = [0, 1, 2].map((row) => tagsView({ row }).chars);
    const first = realEntry('pd.tags.first_tags').out.trim();
    return {
      sameLens: JSON.stringify(lens) === JSON.stringify(mine), lens: mine,
      sameRepr: first === '"' + tagsView({ row: 0 }).s + '"',
      nTags: RECIPES.map((r) => r[3].length), realN: realEntry('pd.tags.n_tags').out.trim(),
    };
  }
  function checkCsv() {
    const real = realEntry('pd.explore.peek').out.trim().split('\n');
    const mine = interactionsView({ n: 2 }).lines;
    return { same: JSON.stringify(real) === JSON.stringify(mine) };
  }
  function checkValueCounts() {
    const real = parseSeries(realEntry('pd.explore.ratings_vc').out);
    const by = {};
    for (const r of INTERACTIONS) by[r[3]] = (by[r[3]] || 0) + 1;
    const mine = Object.keys(by).map(Number).sort((a, b) => a - b).map((k) => [k, by[k]]);
    return { same: JSON.stringify(real) === JSON.stringify(mine), zeros: by[0], stars: INTERACTIONS.length - by[0] };
  }

  // ------------------------------------------------------------------------------------------
  // Traces (roles: code = the section's code pane; counts / util = live Matrix widgets)
  // ------------------------------------------------------------------------------------------
  // Section find-and-read: list, peek, read, check, in the order you work.
  function readTrace() {
    const shape = realEntry('pd.explore.read').out.trim();
    const peek = realEntry('pd.explore.peek').out.trim().split('\n');
    const trace = [
      { label: 'List the folder: four files, not one.', code: 'list', math: 'list', vars: { files: FILES.length } },
      { label: 'The spec asks for ratings, so pick `RAW_interactions.csv`.', code: 'path', math: 'path', vars: { path: DATA + '/RAW_interactions.csv' } },
      { label: 'Peek: the first line is the header, five names.', code: 'peek', math: 'peek', vars: { header: peek[0] } },
      { label: 'Read it into a DataFrame with the full path.', code: 'read', math: 'read', vars: { read: 'interactions' } },
      { label: 'Check the shape: ' + shape + ', rows then columns.', code: 'shape', math: 'shape', vars: { shape } },
    ];
    return { trace, steps: trace.length, shape };
  }

  // Section utility-matrix: count each recipe, keep the ones that pass, pivot. Roles: counts, util.
  function matrixTrace({ threshold = 4, op = '>=' }) {
    const cv = countsView({ threshold, op });
    const u = utilView({ threshold, op });
    const trace = [{ label: 'Count the ratings of each recipe.', code: 'counts', math: 'counts', vars: { recipes: cv.counts.length }, ops: [{ role: 'counts', cmd: 'clear' }, { role: 'util', cmd: 'clear' }] }];
    for (const c of cv.counts) {
      const pass = op === '>' ? c.count > threshold : c.count >= threshold;
      trace.push({
        label: 'Recipe ' + c.id + ': ' + c.count + (pass ? ' passes ' : ' fails ') + '`' + op + ' ' + threshold + '`.',
        code: 'keep', math: 'keep', vars: { recipe: c.id, count: c.count, keep: pass },
        ops: [{ role: 'counts', cmd: 'annotate', args: { sel: 'cell:' + c.id + ',count', text: pass ? 'keep' : 'drop' } }, { role: 'counts', cmd: 'highlight', args: { sel: 'row:' + c.id, tone: pass ? 'good' : 'bad' } }],
      });
    }
    trace.push({ label: '`isin` keeps the ' + cv.rated + ' rows about those ' + cv.nKeep + ' recipes.', code: 'isin', math: 'isin', vars: { rows: cv.rated } });
    trace.push({ label: '`pivot` gives users as rows, recipes as columns: ' + u.shape + '.', code: 'pivot', math: 'pivot', vars: { shape: u.shape, nan: u.nan }, ops: [{ role: 'util', cmd: 'highlight', args: { sel: 'missing', tone: 'muted' } }] });
    return { trace, steps: trace.length, shape: u.shape, nKeep: cv.nKeep };
  }

  // Section graded-functions: the same call in a fresh kernel, global version vs self-contained version.
  function functionTrace() {
    const bad = realCell({ key: 'pd.fresh.uses_global' });
    const good = realCell({ key: 'pd.fresh_fixed.self_contained' });
    const trace = [
      { label: 'The grader starts a fresh kernel: no variables yet.', code: 'loader', math: 'loader', vars: { df_utility: 'not defined' } },
      { label: 'Inside the function, build the matrix first.', code: 'load-inside', math: 'load-inside', vars: { df_utility: '(8, 5) DataFrame' } },
      { label: 'Look the user up by label with `loc`.', code: 'loc', math: 'loc', vars: { user: 1502 } },
      { label: 'Return the list: ' + good.printed + '.', code: 'return', math: 'return', vars: { returned: good.printed } },
    ];
    return { trace, steps: trace.length, bad: bad.final, good: good.printed };
  }

  // ------------------------------------------------------------------------------------------
  // Quiz generators
  // ------------------------------------------------------------------------------------------
  const USERS = [1101, 1245, 1388, 1502, 1690, 1734, 1876, 1923];
  const ITEMS = [1207, 2318, 3542, 4415, 5021, 6110, 7064, 8233];
  const distinct = (xs) => new Set(xs).size === xs.length;
  // a random interactions table: unique (user, item) pairs, ratings 1-5, some 0 (no stars) when zeroP > 0
  function drawRatings(rng, n, users, items, zeroP = 0) {
    const pairs = [];
    for (const u of users) for (const i of items) pairs.push([u, i]);
    return rng.sample(pairs, n).map(([u, i]) => [u, i, null, rng.bool(zeroP) ? 0 : rng.int(2, 5)]);
  }
  const ratingsMd = (rows, uName = 'user_id', iName = 'recipe_id') => mdTable(['', uName, iName, 'rating'], rows.map((r, k) => [String(k), String(r[0]), String(r[1]), String(r[3])]));

  // count-keep-ge / count-keep-gt: how many items pass "at least t" vs "more than t"
  function keepCountQ({ rng, difficulty }) {
    const n = [8, 10, 14][difficulty - 1] || 10;
    for (let tries = 0; tries < 300; tries++) {
      const items = rng.sample(ITEMS, 4).sort((a, b) => a - b);
      const rows = drawRatings(rng, n, rng.sample(USERS, 5), items);
      const counts = countBy(rows);
      const t = rng.pick([2, 3, 4]);
      const ge = keepIds(counts, '>=', t).length, gt = keepIds(counts, '>', t).length;
      const rowsGe = rows.filter((r) => keepIds(counts, '>=', t).includes(r[1])).length;
      if (ge === gt || gt === 0 || ge === counts.length || !distinct([ge, gt, rowsGe])) continue;
      return {
        vars: { table: ratingsMd(rows), n, t, ge, gt, rowsGe, countsMd: mdTable(['recipe_id', 'count'], counts.map((c) => [String(c.id), String(c.count)])) },
        misconceptions: [
          { var: 'gt', for: 'ge', feedback: '"At least {=t}" includes recipes with exactly {=t} ratings: use `>=`, not `>`.' },
          { var: 'ge', for: 'gt', feedback: '"More than {=t}" leaves out recipes with exactly {=t} ratings: use `>`, not `>=`.' },
          { var: 'rowsGe', for: ['ge', 'gt'], feedback: 'That counts rating rows. The question asks how many recipes pass.' },
        ],
      };
    }
    throw new Error('keepCountQ: no draw');
  }

  // pivot-hand-calc / matrix case: kept items, matrix rows, matrix columns, NaN cells
  function pivotQ({ rng, difficulty }) {
    const n = [9, 11, 13][difficulty - 1] || 11;
    for (let tries = 0; tries < 2000; tries++) {
      const items = rng.sample(ITEMS, 4).sort((a, b) => a - b);
      const users = rng.sample(USERS, 6).sort((a, b) => a - b);
      const rows = drawRatings(rng, n, users, items);
      const t = rng.pick([3, 4]);
      const keep = keepIds(countBy(rows), '>=', t);
      if (keep.length < 2 || keep.length === 4) continue;
      const p = pivotRows(rows, keep);
      const allUsers = uniqSorted(rows.map((r) => r[0])).length;
      // want a user who drops out with the recipes, so "users in the kept rows" differs from "all users"
      if (p.users.length === allUsers || keep.length === p.users.length || p.nan === 0) continue;
      return {
        vars: { table: ratingsMd(rows), n, t, nKeep: keep.length, keep: keep.join(', '), nUsers: p.users.length, allUsers, rated: p.rated, cells: p.cells, nan: p.nan, users: p.users.join(', ') },
        misconceptions: [
          { var: 'allUsers', for: 'nUsers', feedback: 'A user whose only ratings were for dropped recipes has no row left: count users in the kept rows only.' },
          { var: 'rated', for: 'nan', feedback: 'Those are the filled cells. NaN cells are the empty ones: rows × columns minus filled.' },
          { var: 'cells', for: 'nan', feedback: 'That is every cell of the matrix. Subtract the cells that hold a rating.' },
        ],
      };
    }
    throw new Error('pivotQ: no draw');
  }

  // star-ratings / count-includes-zero / mean-with-zero: one recipe's ratings with a review left without stars
  function ratingStatsQ({ rng, difficulty }) {
    for (let tries = 0; tries < 300; tries++) {
      const k = rng.int(4, [6, 7, 8][difficulty - 1] || 7);
      const ratings = Array.from({ length: k }, () => rng.int(3, 5));
      const zeros = rng.int(1, 2);
      for (let z = 0; z < zeros; z++) ratings.splice(rng.int(0, ratings.length), 0, 0);
      const count = ratings.length, stars = ratings.filter((r) => r > 0).length;
      const total = ratings.reduce((a, b) => a + b, 0);
      const mean = total / count, meanStars = total / stars;
      if (Math.abs(mean - meanStars) < 0.15) continue;
      const users = rng.sample(USERS, count);
      const recipe = rng.pick(ITEMS);
      const rows = users.map((u, i) => [u, recipe, null, ratings[i]]);
      return {
        vars: { table: ratingsMd(rows), recipe, count, stars, zeros, mean, meanStars, total },
        misconceptions: [
          { var: 'stars', for: 'count', feedback: '`count()` counts every non-missing value, and 0 is a value. Reviews without stars are counted too.' },
          { var: 'count', for: 'stars', feedback: 'That includes the 0s. A 0 marks a review without stars, not a star rating.' },
          { var: 'meanStars', for: 'mean', feedback: 'You left out the 0s. `mean()` averages every value in the column, 0s included.' },
          { var: 'mean', for: 'meanStars', feedback: 'That average includes the 0s. Keep only `rating > 0` first.' },
        ],
      };
    }
    throw new Error('ratingStatsQ: no draw');
  }

  // tags-len / tags-count: a list saved into a CSV comes back as a string
  const TAG_POOL = ['30-minutes-or-less', '60-minutes-or-less', 'time-to-make', 'course', 'main-dish', 'desserts', 'easy', 'breakfast', 'pork', 'rice', 'vegetables', 'dinner-party', 'no-cook', 'fruit'];
  function tagsQ({ rng, difficulty }) {
    for (let tries = 0; tries < 100; tries++) {
      const tags = rng.sample(TAG_POOL, [2, 3, 4][difficulty - 1] || 3);
      const s = pyListRepr(tags);
      if (s.length > 70) continue;
      const letters = tags.reduce((a, t) => a + t.length, 0);
      return { vars: { s, chars: s.length, n: tags.length, letters, first: tags[0], tagsMd: tags.map((t) => '`' + t + '`').join(', ') },
        misconceptions: [
          { var: 'n', for: 'chars', feedback: 'That is the number of tags. The column holds one long string, so `.str.len()` counts its characters.' },
          { var: 'chars', for: 'n', feedback: 'That counts characters of the string. After `ast.literal_eval` each cell is a real list: count its items.' },
        ] };
    }
    throw new Error('tagsQ: no draw');
  }

  // peek-values: how many values does one CSV line hold? (a quoted comma is not a separator)
  function peekValuesQ({ rng }) {
    const withComma = INTERACTIONS.filter((r) => r[4].includes(','));
    const r = rng.pick(withComma);
    const line = csvLine(r);
    const commas = (line.match(/,/g) || []).length;
    return { vars: { line, values: 5, naive: commas + 1, header: INTER_COLS.join(',') },
      misconceptions: [{ var: 'naive', feedback: 'You split at every comma. A comma inside double quotes is part of the text, not a separator.' }] };
  }

  // loc-iloc-mcq: label vs position on a small utility matrix
  function locIlocQ({ rng }) {
    for (let tries = 0; tries < 100; tries++) {
      const users = rng.sample(USERS, 4).sort((a, b) => a - b);
      const k = rng.int(0, 3);
      const form = rng.pick(['iloc', 'loc-pos', 'iloc-label']);
      const opts = form === 'iloc'
        ? { code: 'util.iloc[' + k + ']', ans: 'the row of user ' + users[k] }
        : form === 'loc-pos'
          ? { code: 'util.loc[' + k + ']', ans: '`KeyError: ' + k + '`' }
          : { code: 'util.iloc[' + users[k] + ']', ans: '`IndexError: single positional indexer is out-of-bounds`' };
      const pool = ['the row of user ' + users[k], 'the row of user ' + users[(k + 1) % 4], '`KeyError: ' + (form === 'iloc-label' ? users[k] : k) + '`', '`IndexError: single positional indexer is out-of-bounds`'];
      const options = rng.shuffle(pool);
      const answer = options.indexOf(opts.ans);
      if (answer < 0) continue;
      return {
        vars: { code: opts.code, users: users.join(', '), k, user: users[k], form, rowsMd: mdTable(['position', 'user_id (label)'], users.map((u, i) => [String(i), String(u)])) },
        options, answer,
      };
    }
    throw new Error('locIlocQ: no draw');
  }

  // error-which: a real recorded cell that failed; which error does it raise?
  const ERROR_KEYS = ['pd.explore.read_wrong', 'pd.explore.read_noprefix', 'pd.explore.col_typo', 'pd.matrix.iloc_user', 'pd.matrix.loc_zero', 'pd.matrix.dup_pivot', 'pd.funcs.no_return', 'pd.fresh.uses_global'];
  const ERROR_NAMES = ['FileNotFoundError', 'KeyError', 'IndexError', 'ValueError', 'AttributeError', 'NameError'];
  const CONTEXT = {
    'pd.explore.read_wrong': 'The folder holds `RAW_interactions.csv`, `RAW_recipes.csv`, `README.txt` and `interactions_train.csv`.',
    'pd.explore.read_noprefix': 'The notebook runs in your home folder; the data sits in `' + DATA + '`.',
    'pd.explore.col_typo': '`interactions.columns` is `user_id, recipe_id, date, rating, review`.',
    'pd.matrix.iloc_user': '`util` has 8 rows, labelled by user id (1101 to 1923).',
    'pd.matrix.loc_zero': '`util` has 8 rows, labelled by user id (1101 to 1923).',
    'pd.matrix.dup_pivot': '`twice` is `rated` with its first row added again at the end.',
    'pd.funcs.no_return': 'The function body has no `return` line.',
    'pd.fresh.uses_global': 'This is the first cell run after a restart.',
  };
  function errorWhichQ({ rng }) {
    const key = rng.pick(ERROR_KEYS);
    const c = realCell({ key });
    const right = c.ename;
    const options = rng.shuffle([right, ...rng.sample(ERROR_NAMES.filter((e) => e !== right), 3)]);
    return { vars: { code: c.codeMd, context: CONTEXT[key], final: c.final, ename: right }, options, answer: options.indexOf(right) };
  }

  // case-movies (transfer): a MovieLens-style folder, "at least t ratings", then the matrix and one user's row
  function movieCaseQ({ rng }) {
    const MOVIES = [1, 32, 50, 110, 260, 296];
    const MUSERS = [3, 7, 12, 15, 21, 28];
    for (let tries = 0; tries < 400; tries++) {
      const items = rng.sample(MOVIES, 4).sort((a, b) => a - b);
      const users = rng.sample(MUSERS, 5).sort((a, b) => a - b);
      const rows = drawRatings(rng, 12, users, items).map((r) => [r[0], r[1], null, r[3] - rng.pick([0, 0.5])]);
      const counts = countBy(rows);
      const t = rng.pick([3, 4]);
      const keep = keepIds(counts, '>=', t), keepGt = keepIds(counts, '>', t);
      if (keep.length < 2 || keep.length === counts.length || keep.length === keepGt.length) continue;
      const p = pivotRows(rows, keep);
      const allUsers = uniqSorted(rows.map((r) => r[0])).length;
      const ui = rng.int(0, p.users.length - 1);
      const user = p.users[ui];
      const nRated = p.values[ui].filter((v) => v !== null).length;
      const nAll = rows.filter((r) => r[0] === user).length;
      if (!distinct([p.users.length, allUsers]) && tries < 300) continue;
      if (nRated === nAll && tries < 350) continue;
      return {
        vars: {
          table: ratingsMd(rows, 'userId', 'movieId'), t, nKeep: keep.length, nKeepGt: keepGt.length, keep: keep.join(', '),
          nUsers: p.users.length, allUsers, user, nRated, nAll, shape: '(' + p.users.length + ', ' + keep.length + ')',
        },
        misconceptions: [
          { var: 'nKeepGt', for: 'nKeep', feedback: '"At least {=t}" keeps movies with exactly {=t} ratings too: `>=`.' },
          { var: 'allUsers', for: 'nUsers', feedback: 'Users who only rated dropped movies have no row in the matrix.' },
          { var: 'nAll', for: 'nRated', feedback: 'Only kept movies are columns of the matrix; ratings of dropped movies are gone.' },
        ],
      };
    }
    throw new Error('movieCaseQ: no draw');
  }

  return {
    fns: {
      realCell, folderTree, interactionsView, countsView, utilView, userRow, tagsView,
      checkCounts, checkUtil, checkTags, checkCsv, checkValueCounts, readTrace, matrixTrace, functionTrace,
    },
    generators: { keepCountQ, pivotQ, ratingStatsQ, tagsQ, peekValuesQ, locIlocQ, errorWhichQ, movieCaseQ },
  };
}
