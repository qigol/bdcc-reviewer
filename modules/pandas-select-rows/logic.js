// Qdigo module: pandas-select-rows (pandas II: selecting rows by conditions).
// REAL holds every lesson output, recorded by running the cells for real (Python 3.12.12, pandas 2.2.3;
// see SOURCE_NOTES.md; recorder: assets/record2.py). The small pandas equivalents below are checked against REAL in examples.yaml.
export default function register(sdk) {
  const REAL = {
   "pd.mask.load": {
    "code": "import pandas as pd\n\ninteractions = pd.read_csv(\"/mnt/data/public/food-mini/RAW_interactions.csv\")\ninteractions.shape",
    "out": "(30, 5)\n",
    "err": "",
    "cell": 1
   },
   "pd.mask.one_mask": {
    "code": "(interactions[\"rating\"] >= 4).head()",
    "out": "0    True\n1    True\n2    True\n3    True\n4    True\nName: rating, dtype: bool\n",
    "err": "",
    "cell": 2
   },
   "pd.mask.one_filter": {
    "code": "interactions[interactions[\"rating\"] >= 4].shape",
    "out": "(25, 5)\n",
    "err": "",
    "cell": 3
   },
   "pd.mask.mask_sum": {
    "code": "(interactions[\"rating\"] >= 4).sum()",
    "out": "np.int64(25)\n",
    "err": "",
    "cell": 4
   },
   "pd.mask.and_ok": {
    "code": "interactions[(interactions[\"rating\"] >= 4) & (interactions[\"user_id\"] == 1101)][\"recipe_id\"].tolist()",
    "out": "[1207, 2318, 4415]\n",
    "err": "",
    "cell": 5
   },
   "pd.mask.and_word": {
    "code": "interactions[(interactions[\"rating\"] >= 4) and (interactions[\"user_id\"] == 1101)]",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 6>\", line 1, in <module>\n    interactions[(interactions[\"rating\"] >= 4) and (interactions[\"user_id\"] == 1101)]\n  ...\nValueError: The truth value of a Series is ambiguous. Use a.empty, a.bool(), a.item(), a.any() or a.all().",
    "cell": 6
   },
   "pd.mask.no_parens": {
    "code": "interactions[interactions[\"rating\"] >= 4 & interactions[\"user_id\"] == 1101]",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 7>\", line 1, in <module>\n    interactions[interactions[\"rating\"] >= 4 & interactions[\"user_id\"] == 1101]\n  ...\nValueError: The truth value of a Series is ambiguous. Use a.empty, a.bool(), a.item(), a.any() or a.all().",
    "cell": 7
   },
   "pd.mask.or_ok": {
    "code": "interactions[(interactions[\"rating\"] == 0) | (interactions[\"recipe_id\"] == 8233)][\"user_id\"].tolist()",
    "out": "[1388, 1923, 1690]\n",
    "err": "",
    "cell": 8
   },
   "pd.mask.not_ok": {
    "code": "interactions[~interactions[\"recipe_id\"].isin([1207, 2318])].shape",
    "out": "(19, 5)\n",
    "err": "",
    "cell": 9
   },
   "pd.unrated.load": {
    "code": "import pandas as pd\nfrom numpy.testing import assert_equal\n\ninteractions = pd.read_csv(\"/mnt/data/public/food-mini/RAW_interactions.csv\")\nutil = interactions.pivot(index=\"user_id\", columns=\"recipe_id\", values=\"rating\")\nutil.shape",
    "out": "(8, 8)\n",
    "err": "",
    "cell": 1
   },
   "pd.unrated.row": {
    "code": "util.loc[1245]",
    "out": "recipe_id\n1207    4.0\n2318    NaN\n3542    5.0\n4415    NaN\n5021    4.0\n6110    NaN\n7064    4.0\n8233    NaN\nName: 1245, dtype: float64\n",
    "err": "",
    "cell": 2
   },
   "pd.unrated.isna": {
    "code": "util.loc[1245].isna()",
    "out": "recipe_id\n1207    False\n2318     True\n3542    False\n4415     True\n5021    False\n6110     True\n7064    False\n8233     True\nName: 1245, dtype: bool\n",
    "err": "",
    "cell": 3
   },
   "pd.unrated.unrated": {
    "code": "row = util.loc[1245]\nrow[row.isna()].index.tolist()",
    "out": "[2318, 4415, 6110, 8233]\n",
    "err": "",
    "cell": 4
   },
   "pd.unrated.rated": {
    "code": "row[row.notna()].index.tolist()",
    "out": "[1207, 3542, 5021, 7064]\n",
    "err": "",
    "cell": 5
   },
   "pd.unrated.dropna": {
    "code": "row.dropna().index.tolist()",
    "out": "[1207, 3542, 5021, 7064]\n",
    "err": "",
    "cell": 6
   },
   "pd.unrated.eq_nan": {
    "code": "row[row == float(\"nan\")].index.tolist()",
    "out": "[]\n",
    "err": "",
    "cell": 7
   },
   "pd.unrated.assert_ok": {
    "code": "assert_equal(row[row.isna()].index.tolist(), [2318, 4415, 6110, 8233])",
    "out": "",
    "err": "",
    "cell": 8
   },
   "pd.unrated.assert_bad": {
    "code": "assert_equal(row.dropna().index.tolist(), [2318, 4415, 6110, 8233])",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 9>\", line 1, in <module>\n    assert_equal(row.dropna().index.tolist(), [2318, 4415, 6110, 8233])\n  ...\nAssertionError: \nItems are not equal:\nitem=0\n\n ACTUAL: 1207\n DESIRED: 2318",
    "cell": 9
   },
   "pd.corated.load": {
    "code": "import pandas as pd\nfrom numpy.testing import assert_equal\n\ninteractions = pd.read_csv(\"/mnt/data/public/food-mini/RAW_interactions.csv\")\nutil = interactions.pivot(index=\"user_id\", columns=\"recipe_id\", values=\"rating\")\nutil.shape",
    "out": "(8, 8)\n",
    "err": "",
    "cell": 1
   },
   "pd.corated.both": {
    "code": "both = util[1207].notna() & util[2318].notna()\nboth.sum()",
    "out": "np.int64(3)\n",
    "err": "",
    "cell": 2
   },
   "pd.corated.either": {
    "code": "(util[1207].notna() | util[2318].notna()).sum()",
    "out": "np.int64(8)\n",
    "err": "",
    "cell": 3
   },
   "pd.corated.one_col": {
    "code": "util[1207].notna().sum()",
    "out": "np.int64(6)\n",
    "err": "",
    "cell": 4
   },
   "pd.corated.common_all": {
    "code": "common = {j: (util[1207].notna() & util[j].notna()).sum() for j in util.columns if j != 1207}\ncommon",
    "out": "{2318: np.int64(3), 3542: np.int64(4), 4415: np.int64(2), 5021: np.int64(3), 6110: np.int64(1), 7064: np.int64(4), 8233: np.int64(1)}\n",
    "err": "",
    "cell": 5
   },
   "pd.corated.neighbors_ge": {
    "code": "[j for j, c in common.items() if c >= 3]",
    "out": "[2318, 3542, 5021, 7064]\n",
    "err": "",
    "cell": 6
   },
   "pd.corated.neighbors_gt": {
    "code": "[j for j, c in common.items() if c > 3]",
    "out": "[3542, 7064]\n",
    "err": "",
    "cell": 7
   },
   "pd.corated.with_self": {
    "code": "[j for j in util.columns if (util[1207].notna() & util[j].notna()).sum() >= 3]",
    "out": "[1207, 2318, 3542, 5021, 7064]\n",
    "err": "",
    "cell": 8
   },
   "pd.corated.user_rated_nb": {
    "code": "rated = util.loc[1245].notna()\n[j for j in [j for j, c in common.items() if c >= 3] if rated[j]]",
    "out": "[3542, 5021, 7064]\n",
    "err": "",
    "cell": 9
   },
   "pd.topk.load": {
    "code": "import pandas as pd\nfrom numpy.testing import assert_equal\n\ninteractions = pd.read_csv(\"/mnt/data/public/food-mini/RAW_interactions.csv\")\nutil = interactions.pivot(index=\"user_id\", columns=\"recipe_id\", values=\"rating\")\nutil.shape",
    "out": "(8, 8)\n",
    "err": "",
    "cell": 1
   },
   "pd.topk.means": {
    "code": "means = interactions.groupby(\"recipe_id\")[\"rating\"].mean()\nmeans.round(3)",
    "out": "recipe_id\n1207    4.667\n2318    4.200\n3542    3.500\n4415    3.500\n5021    4.000\n6110    4.500\n7064    4.000\n8233    5.000\nName: rating, dtype: float64\n",
    "err": "",
    "cell": 2
   },
   "pd.topk.sorted_ok": {
    "code": "top = means.reset_index().sort_values([\"rating\", \"recipe_id\"], ascending=[False, True])\ntop[\"recipe_id\"].head(5).tolist()",
    "out": "[8233, 1207, 6110, 2318, 5021]\n",
    "err": "",
    "cell": 3
   },
   "pd.topk.sorted_desc_id": {
    "code": "means.reset_index().sort_values([\"rating\", \"recipe_id\"], ascending=[False, False])[\"recipe_id\"].head(5).tolist()",
    "out": "[8233, 1207, 6110, 2318, 7064]\n",
    "err": "",
    "cell": 4
   },
   "pd.topk.sorted_asc": {
    "code": "means.sort_values().head(5).index.tolist()",
    "out": "[4415, 3542, 7064, 5021, 2318]\n",
    "err": "",
    "cell": 6
   },
   "pd.topk.assert_ok": {
    "code": "assert_equal(top[\"recipe_id\"].head(5).tolist(), [8233, 1207, 6110, 2318, 5021])",
    "out": "",
    "err": "",
    "cell": 7
   },
   "pd.topk.assert_tie": {
    "code": "wrong = means.reset_index().sort_values([\"rating\", \"recipe_id\"], ascending=[False, False])\nassert_equal(wrong[\"recipe_id\"].head(5).tolist(), [8233, 1207, 6110, 2318, 5021])",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 8>\", line 2, in <module>\n    assert_equal(wrong[\"recipe_id\"].head(5).tolist(), [8233, 1207, 6110, 2318, 5021])\n  ...\nAssertionError: \nItems are not equal:\nitem=4\n\n ACTUAL: 7064\n DESIRED: 5021",
    "cell": 8
   },
   "pd.topk.exclude_rated": {
    "code": "row = util.loc[1245]\ncand = means[row[row.isna()].index]\ncand.reset_index().sort_values([\"rating\", \"recipe_id\"], ascending=[False, True])[\"recipe_id\"].tolist()",
    "out": "[8233, 6110, 2318, 4415]\n",
    "err": "",
    "cell": 9
   },
   "pd.relative.load": {
    "code": "import ast\nimport pandas as pd\nfrom numpy.testing import assert_equal\n\nrecipes = pd.read_csv(\"/mnt/data/public/food-mini/RAW_recipes.csv\", converters={\"tags\": ast.literal_eval})\ntag_counts = recipes[\"tags\"].explode().value_counts()\nlen(recipes)",
    "out": "8\n",
    "err": "",
    "cell": 1
   },
   "pd.relative.counts": {
    "code": "tag_counts",
    "out": "tags\ntime-to-make          8\ncourse                8\neasy                  4\nmain-ingredient       3\n60-minutes-or-less    3\ndinner-party          3\n30-minutes-or-less    3\ndesserts              3\nmain-dish             2\n4-hours-or-less       2\nbreakfast             2\nside-dishes           1\nchicken               1\npasta                 1\nrice                  1\neggs-dairy            1\nsoups-stews           1\npork                  1\nfruit                 1\nvegetables            1\nno-cook               1\nName: count, dtype: int64\n",
    "err": "",
    "cell": 2
   },
   "pd.relative.minsup": {
    "code": "minsup = len(recipes) * 0.25\nminsup",
    "out": "2.0\n",
    "err": "",
    "cell": 3
   },
   "pd.relative.freq_ge": {
    "code": "tag_counts[tag_counts >= minsup].index.tolist()",
    "out": "['time-to-make', 'course', 'easy', 'main-ingredient', '60-minutes-or-less', 'dinner-party', '30-minutes-or-less', 'desserts', 'main-dish', '4-hours-or-less', 'breakfast']\n",
    "err": "",
    "cell": 4
   },
   "pd.relative.freq_gt": {
    "code": "tag_counts[tag_counts > minsup].index.tolist()",
    "out": "['time-to-make', 'course', 'easy', 'main-ingredient', '60-minutes-or-less', 'dinner-party', '30-minutes-or-less', 'desserts']\n",
    "err": "",
    "cell": 5
   },
   "pd.relative.freq_frac": {
    "code": "tag_counts[tag_counts >= 0.25].index.tolist() == tag_counts.index.tolist()",
    "out": "True\n",
    "err": "",
    "cell": 6
   },
   "pd.relative.rel": {
    "code": "(tag_counts / len(recipes)).head(4)",
    "out": "tags\ntime-to-make       1.000\ncourse             1.000\neasy               0.500\nmain-ingredient    0.375\nName: count, dtype: float64\n",
    "err": "",
    "cell": 7
   },
   "pd.relative.n_tags": {
    "code": "recipes[\"n_tags\"] = recipes[\"tags\"].str.len()\nrecipes[[\"name\", \"n_tags\"]]",
    "out": "                name  n_tags\n0      chicken adobo       7\n1  garlic fried rice       7\n2      pancit canton       6\n3         leche flan       6\n4  sinigang na baboy       6\n5              turon       6\n6     tortang talong       7\n7          halo-halo       6\n",
    "err": "",
    "cell": 8
   },
   "pd.relative.largest_ok": {
    "code": "recipes[recipes[\"n_tags\"] == recipes[\"n_tags\"].max()][\"name\"].tolist()",
    "out": "['chicken adobo', 'garlic fried rice', 'tortang talong']\n",
    "err": "",
    "cell": 9
   },
   "pd.relative.largest_nl": {
    "code": "recipes.nlargest(1, \"n_tags\")[\"name\"].tolist()",
    "out": "['chicken adobo']\n",
    "err": "",
    "cell": 10
   },
   "pd.relative.largest_head": {
    "code": "recipes.sort_values(\"n_tags\", ascending=False).head(1)[\"name\"].tolist()",
    "out": "['chicken adobo']\n",
    "err": "",
    "cell": 11
   },
   "pd.rules.load": {
    "code": "import ast\nimport pandas as pd\nfrom numpy.testing import assert_equal\n\nrecipes = pd.read_csv(\"/mnt/data/public/food-mini/RAW_recipes.csv\", converters={\"tags\": ast.literal_eval})\ntag_counts = recipes[\"tags\"].explode().value_counts()\nlen(recipes)",
    "out": "8\n",
    "err": "",
    "cell": 1
   },
   "pd.rules.build": {
    "code": "from itertools import permutations\n\nn = len(recipes)\ncount = recipes[\"tags\"].explode().value_counts()\nrows = []\nfor a, b in permutations(count.index, 2):\n    both = recipes[\"tags\"].apply(lambda t: a in t and b in t).sum()\n    if both:\n        conf = both / count[a]\n        rows.append((a, b, both / n, conf, conf / (count[b] / n)))\nrules = pd.DataFrame(rows, columns=[\"antecedent\", \"consequent\", \"support\", \"confidence\", \"lift\"])\nrules.shape",
    "out": "(182, 5)\n",
    "err": "",
    "cell": 2
   },
   "pd.rules.strong_ok": {
    "code": "strong = rules[(rules[\"support\"] >= 0.25) & (rules[\"confidence\"] >= 0.8)]\nstrong.shape",
    "out": "(24, 5)\n",
    "err": "",
    "cell": 3
   },
   "pd.rules.strong_or": {
    "code": "rules[(rules[\"support\"] >= 0.25) | (rules[\"confidence\"] >= 0.8)].shape",
    "out": "(106, 5)\n",
    "err": "",
    "cell": 4
   },
   "pd.rules.strong_gt": {
    "code": "rules[(rules[\"support\"] > 0.25) & (rules[\"confidence\"] >= 0.8)].shape",
    "out": "(15, 5)\n",
    "err": "",
    "cell": 5
   },
   "pd.rules.ranked": {
    "code": "ranked = strong.sort_values([\"lift\", \"antecedent\"], ascending=[False, True])\nranked[[\"antecedent\", \"consequent\", \"lift\"]].head(4).round(3)",
    "out": "             antecedent          consequent   lift\n124           breakfast  30-minutes-or-less  2.667\n108           main-dish  60-minutes-or-less  2.667\n86   30-minutes-or-less                easy  2.000\n122           breakfast                easy  2.000\n",
    "err": "",
    "cell": 6
   },
   "pd.rules.ranked_lift_only": {
    "code": "strong.sort_values(\"lift\", ascending=False)[[\"antecedent\", \"consequent\", \"lift\"]].head(4).round(3)",
    "out": "             antecedent          consequent   lift\n108           main-dish  60-minutes-or-less  2.667\n124           breakfast  30-minutes-or-less  2.667\n122           breakfast                easy  2.000\n86   30-minutes-or-less                easy  2.000\n",
    "err": "",
    "cell": 7
   },
   "pd.rules.top_pairs": {
    "code": "list(zip(ranked[\"antecedent\"], ranked[\"consequent\"]))[:3]",
    "out": "[('breakfast', '30-minutes-or-less'), ('main-dish', '60-minutes-or-less'), ('30-minutes-or-less', 'easy')]\n",
    "err": "",
    "cell": 8
   },
   "pd.rules.assert_or": {
    "code": "loose = rules[(rules[\"support\"] >= 0.25) | (rules[\"confidence\"] >= 0.8)]\nassert_equal(len(loose), len(strong))",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 9>\", line 2, in <module>\n    assert_equal(len(loose), len(strong))\n  ...\nAssertionError: \nItems are not equal:\n ACTUAL: 106\n DESIRED: 24",
    "cell": 9
   }
  };
  const ENV = {"python":"3.12.12","pandas":"2.2.3"};

  // ------------------------------------------------------------------------------------------
  // The lesson data: food-mini (same files as pandas-read-data, assets there). Ratings and tags only.
  // ------------------------------------------------------------------------------------------
  // [user_id, recipe_id, rating] in file order
  const INTERACTIONS = [
    [1101, 1207, 5], [1388, 2318, 5], [1245, 1207, 4], [1101, 2318, 4], [1502, 1207, 5], [1245, 3542, 5],
    [1388, 1207, 5], [1101, 4415, 5], [1388, 3542, 0], [1502, 2318, 3], [1690, 1207, 4], [1502, 4415, 5],
    [1734, 2318, 4], [1245, 5021, 4], [1876, 1207, 5], [1690, 3542, 4], [1101, 7064, 3], [1734, 4415, 4],
    [1388, 6110, 4], [1690, 5021, 5], [1245, 7064, 4], [1923, 2318, 5], [1876, 3542, 5], [1502, 7064, 4],
    [1923, 4415, 0], [1734, 7064, 5], [1876, 5021, 3], [1923, 6110, 5], [1690, 8233, 5], [1876, 7064, 4],
  ];
  // [name, tags]
  const RECIPES = [
    ['chicken adobo', ['60-minutes-or-less', 'time-to-make', 'course', 'main-ingredient', 'main-dish', 'chicken', 'easy']],
    ['garlic fried rice', ['30-minutes-or-less', 'time-to-make', 'course', 'side-dishes', 'rice', 'easy', 'breakfast']],
    ['pancit canton', ['60-minutes-or-less', 'time-to-make', 'course', 'main-dish', 'pasta', 'dinner-party']],
    ['leche flan', ['4-hours-or-less', 'time-to-make', 'course', 'desserts', 'eggs-dairy', 'dinner-party']],
    ['sinigang na baboy', ['4-hours-or-less', 'time-to-make', 'course', 'main-ingredient', 'soups-stews', 'pork']],
    ['turon', ['30-minutes-or-less', 'time-to-make', 'course', 'desserts', 'fruit', 'easy']],
    ['tortang talong', ['30-minutes-or-less', 'time-to-make', 'course', 'main-ingredient', 'vegetables', 'easy', 'breakfast']],
    ['halo-halo', ['60-minutes-or-less', 'time-to-make', 'course', 'desserts', 'no-cook', 'dinner-party']],
  ];

  // ------------------------------------------------------------------------------------------
  // Real runs (record2.py): code, stdout + repr of the last expression, trimmed traceback.
  // ------------------------------------------------------------------------------------------
  const realEntry = (k) => {
    const e = REAL[k];
    if (!e) throw new Error('REAL has no entry ' + k);
    return e;
  };
  const fence = (s, lang) => '```' + (lang || 'text') + '\n' + String(s).replace(/\n+$/, '') + '\n```';
  const finalLine = (err) => { const ls = String(err).replace(/\n+$/, '').split('\n'); return ls[ls.length - 1]; };
  // an assert_equal failure: the ACTUAL and DESIRED lines
  const assertParts = (err) => ({ actual: (/ ACTUAL: (.*)/.exec(err) || [])[1] || null, desired: (/ DESIRED: (.*)/.exec(err) || [])[1] || null });

  function realCell({ key }) {
    const e = realEntry(key);
    const printed = e.out.replace(/\n+$/, '');
    const ap = e.err ? assertParts(e.err) : { actual: null, desired: null };
    const fl = e.err ? (ap.actual !== null ? 'AssertionError' : finalLine(e.err)) : null;
    return {
      key, code: e.code, cell: e.cell, ok: !e.err, printed,
      out: fence(e.err ? (e.out + e.err) : (printed || '(no output: the assert passed)')),
      final: fl, ename: fl ? fl.split(':')[0] : null, actual: ap.actual, desired: ap.desired,
      codeMd: fence(e.code, 'python'),
    };
  }

  // ------------------------------------------------------------------------------------------
  // Small pandas equivalents. examples.yaml checks each against REAL.
  // ------------------------------------------------------------------------------------------
  const uniqSorted = (a) => [...new Set(a)].sort((x, y) => x - y);
  const mdTable = (cols, rows) => '| ' + cols.join(' | ') + ' |\n|' + cols.map(() => '---').join('|') + '|\n' + rows.map((r) => '| ' + r.join(' | ') + ' |').join('\n');
  const fmtNum = (x) => (x === null ? 'NaN' : String(x));
  // interactions.pivot(index=user, columns=item, values=rating) over the given rows
  function pivotOf(rows) {
    const users = uniqSorted(rows.map((r) => r[0]));
    const items = uniqSorted(rows.map((r) => r[1]));
    const values = users.map((u) => items.map((i) => { const r = rows.find((x) => x[0] === u && x[1] === i); return r ? r[2] : null; }));
    return { users, items, values };
  }
  const UTIL = pivotOf(INTERACTIONS);
  const col = (p, item) => p.values.map((row) => row[p.items.indexOf(item)]);
  const rowOf = (p, user) => p.values[p.users.indexOf(user)];
  // (a.notna() & b.notna()).sum()
  const corated = (p, a, b) => col(p, a).filter((v, k) => v !== null && col(p, b)[k] !== null).length;
  // sort by value descending, id ascending (the spec's tie-break), or id descending (the slip)
  const rankIds = (pairs, idAsc = true) => pairs.slice().sort((x, y) => y[1] - x[1] || (idAsc ? x[0] - y[0] : y[0] - x[0])).map((p) => p[0]);
  const meansOf = (rows) => uniqSorted(rows.map((r) => r[1])).map((i) => { const rs = rows.filter((r) => r[1] === i).map((r) => r[2]); return [i, rs.reduce((a, b) => a + b, 0) / rs.length]; });
  // tag counts in value_counts order: count descending, then first appearance (pandas keeps encounter order for ties)
  function tagCounts(recipes) {
    const order = [], c = {};
    for (const [, tags] of recipes) for (const t of tags) { if (!(t in c)) { c[t] = 0; order.push(t); } c[t]++; }
    return order.map((t, k) => [t, c[t], k]).sort((a, b) => b[1] - a[1] || a[2] - b[2]).map(([t, n]) => [t, n]);
  }
  // pair rules A -> B over tags, in the recorder's order (permutations of the value_counts index)
  function pairRules(recipes) {
    const n = recipes.length;
    const counts = tagCounts(recipes);
    const cnt = Object.fromEntries(counts);
    const out = [];
    for (const [a] of counts) for (const [b] of counts) {
      if (a === b) continue;
      const both = recipes.filter(([, t]) => t.includes(a) && t.includes(b)).length;
      if (both) { const conf = both / cnt[a]; out.push({ a, b, support: both / n, confidence: conf, lift: conf / (cnt[b] / n) }); }
    }
    return out;
  }
  const lt = (x, y) => (x < y ? -1 : x > y ? 1 : 0);

  // ---- lesson views ------------------------------------------------------------------------
  // The full utility matrix (all 8 recipes) as Matrix props.
  function utilView() {
    return { rows: UTIL.users.map(String), cols: UTIL.items.map(String), values: UTIL.values, emptyLabel: 'NaN', shape: '(' + UTIL.users.length + ', ' + UTIL.items.length + ')' };
  }
  // One user's row: rated and unrated recipe ids.
  function userView({ user = 1245 }) {
    const r = rowOf(UTIL, user);
    return { user, rated: UTIL.items.filter((_, j) => r[j] !== null), unrated: UTIL.items.filter((_, j) => r[j] === null), nUnrated: r.filter((v) => v === null).length };
  }
  // Common raters of a target item with every other item, and the neighbours that pass k.
  function commonView({ target = 1207, k = 3, user = 1245 }) {
    const others = UTIL.items.filter((i) => i !== target);
    const common = others.map((j) => [j, corated(UTIL, target, j)]);
    const ge = common.filter((c) => c[1] >= k).map((c) => c[0]);
    const gt = common.filter((c) => c[1] > k).map((c) => c[0]);
    const r = rowOf(UTIL, user);
    const ratedNb = ge.filter((j) => r[UTIL.items.indexOf(j)] !== null);
    return {
      target, k, common, ge, gt, nGe: ge.length, nGt: gt.length, ratedNb,
      rows: common.map((c) => String(c[0])), cols: ['common'], values: common.map((c) => [c[1]]),
      both12: corated(UTIL, 1207, 2318),
      either12: col(UTIL, 1207).filter((v, x) => v !== null || col(UTIL, 2318)[x] !== null).length,
      one12: col(UTIL, 1207).filter((v) => v !== null).length,
    };
  }
  // Mean rating per recipe, ranked with and without the id tie-break; top k.
  function rankView({ k = 5, user = null }) {
    let means = meansOf(INTERACTIONS);
    if (user !== null) { const un = userView({ user }).unrated; means = means.filter((m) => un.includes(m[0])); }
    const ok = rankIds(means, true), slip = rankIds(means, false);
    return {
      means: means.map((m) => [m[0], m[1]]), ok: ok.slice(0, k), slip: slip.slice(0, k), kth: ok[k - 1], kthSlip: slip[k - 1],
      rows: means.map((m) => String(m[0])), cols: ['mean'], values: means.map((m) => [m[1]]),
    };
  }
  // Frequent tags at a fraction of the recipes; the largest baskets.
  function freqView({ frac = 0.25 }) {
    const counts = tagCounts(RECIPES);
    const minsup = RECIPES.length * frac;
    const sizes = RECIPES.map((r) => r[1].length);
    const max = Math.max(...sizes);
    return {
      n: RECIPES.length, frac, minsup, counts, ge: counts.filter((c) => c[1] >= minsup).map((c) => c[0]), gt: counts.filter((c) => c[1] > minsup).map((c) => c[0]),
      nGe: counts.filter((c) => c[1] >= minsup).length, nGt: counts.filter((c) => c[1] > minsup).length, nTags: counts.length,
      largest: RECIPES.filter((r) => r[1].length === max).map((r) => r[0]), max, sizes,
      md: mdTable(['tag', 'count'], counts.map((c) => ['`' + c[0] + '`', String(c[1])])),
    };
  }
  // Pair rules filtered by support and confidence, ranked by lift then antecedent.
  function rulesView({ minSup = 0.25, minConf = 0.8, top = 4 }) {
    const rules = pairRules(RECIPES);
    const strong = rules.filter((r) => r.support >= minSup && r.confidence >= minConf);
    const ranked = strong.slice().sort((x, y) => y.lift - x.lift || lt(x.a, y.a));
    return {
      total: rules.length, nStrong: strong.length,
      nOr: rules.filter((r) => r.support >= minSup || r.confidence >= minConf).length,
      nGt: rules.filter((r) => r.support > minSup && r.confidence >= minConf).length,
      top: ranked.slice(0, top).map((r) => [r.a, r.b]), topLift: ranked.slice(0, top).map((r) => r.lift),
      md: mdTable(['antecedent', 'consequent', 'support', 'confidence', 'lift'], ranked.slice(0, top).map((r) => [r.a, r.b, r.support.toFixed(3), r.confidence.toFixed(3), r.lift.toFixed(3)])),
    };
  }
  // Row masks on the interactions (scene masks).
  function maskView() {
    const ge4 = INTERACTIONS.filter((r) => r[2] >= 4);
    return {
      ge4: ge4.length, and1101: INTERACTIONS.filter((r) => r[2] >= 4 && r[0] === 1101).map((r) => r[1]),
      orZero: INTERACTIONS.filter((r) => r[2] === 0 || r[1] === 8233).map((r) => r[0]),
      notTwo: INTERACTIONS.filter((r) => ![1207, 2318].includes(r[1])).length,
      md: mdTable(['', 'user_id', 'recipe_id', 'rating'], INTERACTIONS.slice(0, 10).map((r, i) => [String(i), String(r[0]), String(r[1]), String(r[2])])),
    };
  }

  // ---- example checks: JS equivalents == the real runs ------------------------------------------
  const pyList = (out) => JSON.parse(out.trim().replace(/'/g, '"'));
  function checkMasks() {
    const m = maskView();
    return {
      sameAnd: JSON.stringify(m.and1101) === JSON.stringify(pyList(realEntry('pd.mask.and_ok').out)),
      sameOr: JSON.stringify(m.orZero) === JSON.stringify(pyList(realEntry('pd.mask.or_ok').out)),
      ge4: m.ge4, realGe4: realEntry('pd.mask.one_filter').out.trim(), notTwo: m.notTwo, realNot: realEntry('pd.mask.not_ok').out.trim(),
    };
  }
  function checkUnrated() {
    const u = userView({ user: 1245 });
    return { same: JSON.stringify(u.unrated) === JSON.stringify(pyList(realEntry('pd.unrated.unrated').out)), sameRated: JSON.stringify(u.rated) === JSON.stringify(pyList(realEntry('pd.unrated.dropna').out)) };
  }
  function checkCommon() {
    const c = commonView({ target: 1207, k: 3 });
    const real = Object.fromEntries([...realEntry('pd.corated.common_all').out.matchAll(/(\d+): np\.int64\((\d+)\)/g)].map((m) => [m[1], Number(m[2])]));
    return {
      same: c.common.every(([j, n]) => real[j] === n) && Object.keys(real).length === c.common.length,
      sameGe: JSON.stringify(c.ge) === JSON.stringify(pyList(realEntry('pd.corated.neighbors_ge').out)),
      sameGt: JSON.stringify(c.gt) === JSON.stringify(pyList(realEntry('pd.corated.neighbors_gt').out)),
      sameRatedNb: JSON.stringify(c.ratedNb) === JSON.stringify(pyList(realEntry('pd.corated.user_rated_nb').out)),
      both12: c.both12, either12: c.either12, one12: c.one12,
    };
  }
  function checkRank() {
    const r = rankView({ k: 5 });
    const ex = rankView({ k: 4, user: 1245 });
    return {
      sameOk: JSON.stringify(r.ok) === JSON.stringify(pyList(realEntry('pd.topk.sorted_ok').out)),
      sameSlip: JSON.stringify(r.slip) === JSON.stringify(pyList(realEntry('pd.topk.sorted_desc_id').out)),
      sameExclude: JSON.stringify(ex.ok) === JSON.stringify(pyList(realEntry('pd.topk.exclude_rated').out)),
      kth: r.kth, kthSlip: r.kthSlip,
    };
  }
  function checkFreq() {
    const f = freqView({ frac: 0.25 });
    // value_counts orders tied counts arbitrarily (an unstable sort), so compare the tag sets
    const asSet = (xs) => JSON.stringify(xs.slice().sort());
    return {
      sameGe: asSet(f.ge) === asSet(pyList(realEntry('pd.relative.freq_ge').out)),
      sameGt: asSet(f.gt) === asSet(pyList(realEntry('pd.relative.freq_gt').out)),
      sameLargest: JSON.stringify(f.largest) === JSON.stringify(pyList(realEntry('pd.relative.largest_ok').out)),
      minsup: f.minsup, nGe: f.nGe, nGt: f.nGt,
    };
  }
  function checkRules() {
    const r = rulesView({});
    const shape = (k) => Number(/\((\d+),/.exec(realEntry(k).out)[1]);
    const pairs = [...realEntry('pd.rules.top_pairs').out.matchAll(/\('([^']+)', '([^']+)'\)/g)].map((m) => [m[1], m[2]]);
    return {
      total: r.total, realTotal: shape('pd.rules.build'), nStrong: r.nStrong, realStrong: shape('pd.rules.strong_ok'),
      nOr: r.nOr, realOr: shape('pd.rules.strong_or'), nGt: r.nGt, realGt: shape('pd.rules.strong_gt'),
      sameTop: JSON.stringify(r.top.slice(0, 3)) === JSON.stringify(pairs),
    };
  }

  // ------------------------------------------------------------------------------------------
  // Traces (roles: code = the section's code pane; util / common / ranks = live Matrix widgets)
  // ------------------------------------------------------------------------------------------
  // Section unrated-and-corated: one user's NaN cells, then the co-rated count of two columns.
  function maskTrace({ user = 1245 }) {
    const u = userView({ user });
    const trace = [{ label: 'Take user ' + user + '\'s row of `util`.', code: 'row', math: 'row', vars: { user }, ops: [{ role: 'util', cmd: 'clear' }, { role: 'util', cmd: 'highlight', args: { sel: 'row:' + user, tone: 'accent' } }] }];
    for (const it of UTIL.items) {
      const un = u.unrated.includes(it);
      trace.push({ label: 'Recipe ' + it + (un ? ': NaN, `isna()` is True: a candidate.' : ': rated, `isna()` is False.'), code: 'isna', math: 'isna', vars: { recipe: it, isna: un },
        ops: [{ role: 'util', cmd: 'highlight', args: { sel: 'cell:' + user + ',' + it, tone: un ? 'good' : 'muted' } }] });
    }
    trace.push({ label: 'Keep the True ones: ' + u.unrated.join(', ') + '.', code: 'keep', math: 'keep', vars: { candidates: u.unrated.length } });
    return { trace, steps: trace.length, unrated: u.unrated };
  }

  // Section neighbours: common raters of the target with each other recipe, then the k cut.
  function commonTrace({ target = 1207, k = 3 }) {
    const c = commonView({ target, k });
    const trace = [{ label: 'For each other recipe, count users who rated both.', code: 'common', math: 'common', vars: { target }, ops: [{ role: 'common', cmd: 'clear' }] }];
    for (const [j, n] of c.common) {
      const pass = n >= k;
      trace.push({ label: target + ' & ' + j + ': ' + n + ' common raters, ' + (pass ? 'kept' : 'dropped') + ' at `>= ' + k + '`.', code: 'cut', math: 'cut', vars: { recipe: j, common: n, keep: pass },
        ops: [{ role: 'common', cmd: 'highlight', args: { sel: 'row:' + j, tone: pass ? 'good' : 'bad' } }, { role: 'common', cmd: 'annotate', args: { sel: 'cell:' + j + ',common', text: pass ? 'keep' : 'drop' } }] });
    }
    trace.push({ label: 'Neighbours: ' + c.ge.join(', ') + '.', code: 'cut', math: 'cut', vars: { neighbours: c.nGe } });
    return { trace, steps: trace.length, ge: c.ge };
  }

  // ------------------------------------------------------------------------------------------
  // Quiz generators
  // ------------------------------------------------------------------------------------------
  const USERS = [1101, 1245, 1388, 1502, 1690, 1734];
  const ITEMS = [1207, 2318, 3542, 4415, 5021, 7064];
  const distinct = (xs) => new Set(xs).size === xs.length;
  function drawRows(rng, n, users, items) {
    const pairs = [];
    for (const u of users) for (const i of items) pairs.push([u, i]);
    return rng.sample(pairs, n).map(([u, i]) => [u, i, rng.int(1, 5)]);
  }
  const rowsMd = (rows) => mdTable(['', 'user_id', 'recipe_id', 'rating'], rows.map((r, k) => [String(k), String(r[0]), String(r[1]), String(r[2])]));
  const matMd = (p) => mdTable(['user_id', ...p.items.map(String)], p.users.map((u, a) => [String(u), ...p.values[a].map(fmtNum)]));

  // and-count / or-count: rows passing two conditions joined with & or |
  function maskCountQ({ rng, difficulty }) {
    const n = [8, 10, 12][difficulty - 1] || 10;
    for (let tries = 0; tries < 300; tries++) {
      const rows = drawRows(rng, n, rng.sample(USERS, 4), rng.sample(ITEMS, 4));
      const t = rng.pick([3, 4]);
      const u = rng.pick(rows)[0];
      const a = rows.filter((r) => r[2] >= t), b = rows.filter((r) => r[0] === u);
      const and = rows.filter((r) => r[2] >= t && r[0] === u).length, or = rows.filter((r) => r[2] >= t || r[0] === u).length;
      const gtAnd = rows.filter((r) => r[2] > t && r[0] === u).length;
      if (and === 0 || !distinct([and, or, a.length, b.length]) || or === n) continue;
      return {
        vars: { table: rowsMd(rows), n, t, u, and, or, onlyRating: a.length, onlyUser: b.length, gtAnd, notUser: n - b.length },
        misconceptions: [
          { var: 'or', for: 'and', feedback: '`&` keeps rows where **both** are true. You counted rows where either is true (`|`).' },
          { var: 'onlyRating', for: 'and', feedback: 'That is the rating condition alone. The user condition must hold too.' },
          { var: 'and', for: 'or', feedback: '`|` keeps rows where **either** is true. You counted rows where both are true.' },
          { var: 'onlyUser', for: 'or', feedback: 'That is the user condition alone. A row also passes on the rating.' },
        ],
      };
    }
    throw new Error('maskCountQ: no draw');
  }

  // unrated-count: how many candidates (NaN cells) a user has
  function unratedQ({ rng, difficulty }) {
    for (let tries = 0; tries < 300; tries++) {
      const users = rng.sample(USERS, 4).sort((a, b) => a - b), items = rng.sample(ITEMS, [4, 5, 6][difficulty - 1] || 5).sort((a, b) => a - b);
      const p = pivotOf(drawRows(rng, Math.round(users.length * items.length * 0.55), users, items));
      if (p.users.length < 3 || p.items.length < 4) continue;
      const user = rng.pick(p.users);
      const r = rowOf(p, user);
      const unrated = r.filter((v) => v === null).length, rated = r.length - unrated;
      if (unrated === 0 || unrated === rated) continue;
      return { vars: { matrix: matMd(p), user, unrated, rated, nCols: r.length, ids: p.items.filter((_, j) => r[j] === null).join(', ') },
        misconceptions: [{ var: 'rated', feedback: 'Those are the recipes the user **has** rated (`notna`, or `dropna`). Candidates are the NaN cells: `isna`.' }, { var: 'nCols', feedback: 'That is every recipe. Already-rated recipes are not candidates.' }] };
    }
    throw new Error('unratedQ: no draw');
  }

  // corated-count / neighbours: common raters of two items, and how many items pass k
  function coratedQ({ rng, difficulty }) {
    for (let tries = 0; tries < 400; tries++) {
      const users = rng.sample(USERS, [5, 6, 6][difficulty - 1] || 6).sort((a, b) => a - b), items = rng.sample(ITEMS, 4).sort((a, b) => a - b);
      const p = pivotOf(drawRows(rng, Math.round(users.length * 4 * 0.6), users, items));
      if (p.items.length < 4 || p.users.length < 4) continue;
      const target = rng.pick(p.items);
      const others = p.items.filter((i) => i !== target);
      const common = others.map((j) => corated(p, target, j));
      const j = rng.pick(others);
      const both = corated(p, target, j);
      const either = col(p, target).filter((v, x) => v !== null || col(p, j)[x] !== null).length;
      const one = col(p, target).filter((v) => v !== null).length;
      const k = rng.pick([2, 3]);
      const ge = common.filter((c) => c >= k).length, gt = common.filter((c) => c > k).length;
      if (!distinct([both, either, one]) || both === 0 || ge === gt || ge === 0) continue;
      return {
        vars: { matrix: matMd(p), target, j, both, either, one, k, ge, gt, geSelf: ge + 1, commonMd: mdTable(['recipe', 'common raters with ' + target], others.map((o, x) => [String(o), String(common[x])])) },
        misconceptions: [
          { var: 'either', for: 'both', feedback: 'That counts users who rated **either** recipe (`|`). Co-rated means both: `&`.' },
          { var: 'one', for: 'both', feedback: 'That counts only the users who rated recipe {=target}. They must also have rated {=j}.' },
          { var: 'gt', for: 'ge', feedback: '"At least {=k}" includes recipes with exactly {=k} common raters: `>=`.' },
          { var: 'geSelf', for: 'ge', feedback: 'You counted recipe {=target} as its own neighbour. Leave the target out.' },
        ],
      };
    }
    throw new Error('coratedQ: no draw');
  }

  // topk-tie: the k-th id after sorting by score desc, id asc (a tie straddles the cut-off)
  function topkQ({ rng, difficulty }) {
    const n = [5, 6, 7][difficulty - 1] || 6;
    for (let tries = 0; tries < 400; tries++) {
      const ids = rng.sample([1207, 2318, 3542, 4415, 5021, 6110, 7064, 8233], n);
      const scores = ids.map(() => rng.pick([3.5, 4, 4.2, 4.5, 4.8]));
      const pairs = ids.map((id, x) => [id, scores[x]]);
      const k = rng.int(2, n - 2);
      const ok = rankIds(pairs, true), slip = rankIds(pairs, false);
      if (ok[k - 1] === slip[k - 1]) continue; // the tie must decide the k-th place
      const fileOrder = pairs.slice().sort((x, y) => y[1] - x[1]).map((p) => p[0]); // stable: file order within ties
      if (fileOrder[k - 1] === ok[k - 1]) continue; // table order must not happen to give the right tie order
      return {
        vars: { table: mdTable(['recipe_id', 'score'], pairs.map((p) => [String(p[0]), String(p[1])])), k, kth: ok[k - 1], kthSlip: slip[k - 1], kthFile: fileOrder[k - 1], ranked: ok.slice(0, k).join(', ') },
        misconceptions: [{ var: 'kthSlip', feedback: 'That breaks the tie by the larger id. The spec says increasing recipe id: smaller id first.' }, { var: 'kthFile', feedback: 'That keeps the tie in table order. The spec breaks ties by recipe id, so sort by both keys.' }],
      };
    }
    throw new Error('topkQ: no draw');
  }

  // relative-support: frequent tags at a fraction of the baskets
  const TAGS = ['easy', 'quick', 'pork', 'dessert', 'rice', 'soup', 'vegan'];
  function relSupportQ({ rng, difficulty }) {
    for (let tries = 0; tries < 400; tries++) {
      const n = rng.pick([8, 12, 20]);
      const frac = rng.pick([0.25, 0.5]);
      const minsup = n * frac;
      const k = [4, 5, 6][difficulty - 1] || 5;
      const tags = rng.sample(TAGS, k);
      const counts = tags.map(() => rng.int(1, n - 1));
      if (!Number.isInteger(minsup) || !counts.includes(minsup)) continue;
      const ge = counts.filter((c) => c >= minsup).length, gt = counts.filter((c) => c > minsup).length;
      if (ge === k || gt === 0) continue;
      return { vars: { n, frac, pct: frac * 100, minsup, k, ge, gt, table: mdTable(['tag', 'baskets containing it'], tags.map((t, x) => ['`' + t + '`', String(counts[x])])) },
        misconceptions: [
          { var: 'gt', feedback: '"At least {=pct}%" includes a tag in exactly {=minsup} baskets: `>=`.' },
          { var: 'k', feedback: 'Every tag passes only if you compare counts with the fraction {=frac}. Compare with {=frac} × {=n} = {=minsup}, or divide the counts by {=n} first.' },
        ] };
    }
    throw new Error('relSupportQ: no draw');
  }

  // largest-baskets: how many baskets have the maximum size (ties included)
  function largestQ({ rng }) {
    for (let tries = 0; tries < 200; tries++) {
      const sizes = Array.from({ length: rng.int(5, 8) }, () => rng.int(2, 5));
      const max = Math.max(...sizes), nMax = sizes.filter((s) => s === max).length;
      if (nMax < 2) continue;
      return { vars: { table: mdTable(['basket', 'size'], sizes.map((s, x) => [String(x), String(s)])), max, nMax },
        misconceptions: [{ value: 1, feedback: '`nlargest(1)` or `head(1)` keeps only one row. Every basket of the largest size counts: `size == size.max()`.' }] };
    }
    throw new Error('largestQ: no draw');
  }

  // rules-filter: rules passing support AND confidence
  function rulesQ({ rng, difficulty }) {
    for (let tries = 0; tries < 400; tries++) {
      const n = [5, 6, 7][difficulty - 1] || 6;
      const sups = Array.from({ length: n }, () => rng.pick([0.125, 0.25, 0.375, 0.5]));
      const confs = Array.from({ length: n }, () => rng.pick([0.5, 0.67, 0.8, 0.9, 1]));
      const and = sups.filter((s, x) => s >= 0.25 && confs[x] >= 0.8).length;
      const or = sups.filter((s, x) => s >= 0.25 || confs[x] >= 0.8).length;
      const gt = sups.filter((s, x) => s > 0.25 && confs[x] >= 0.8).length;
      if (!distinct([and, or, gt]) || and === 0) continue;
      return { vars: { n, and, or, gt, table: mdTable(['rule', 'support', 'confidence'], sups.map((s, x) => ['r' + (x + 1), String(s), String(confs[x])])) },
        misconceptions: [
          { var: 'or', feedback: 'A rule must pass **both** thresholds: `&`, not `|`.' },
          { var: 'gt', feedback: '"At least 25%" keeps support exactly 0.25: `>=`.' },
        ] };
    }
    throw new Error('rulesQ: no draw');
  }

  // assert-read: a real failed assert; which condition is off?
  function assertQ({ rng }) {
    const pool = [
      { key: 'pd.unrated.assert_bad', right: 'It kept the rated recipes; use `row[row.isna()]`' },
      { key: 'pd.topk.assert_tie', right: 'The tie at 4.0 is broken by the larger id; sort ids ascending' },
      { key: 'pd.rules.assert_or', right: 'The conditions are joined with `|`; use `&`' },
    ];
    const pick = rng.pick(pool);
    const c = realCell({ key: pick.key });
    const options = rng.shuffle(pool.map((p) => p.right).concat(['The DESIRED list in the test is wrong']));
    return { vars: { code: c.codeMd, out: c.out, actual: c.actual, desired: c.desired }, options, answer: options.indexOf(pick.right) };
  }

  return {
    fns: {
      realCell, utilView, userView, commonView, rankView, freqView, rulesView, maskView,
      checkMasks, checkUnrated, checkCommon, checkRank, checkFreq, checkRules, maskTrace, commonTrace,
    },
    generators: { maskCountQ, unratedQ, coratedQ, topkQ, relSupportQ, largestQ, rulesQ, assertQ },
  };
}
