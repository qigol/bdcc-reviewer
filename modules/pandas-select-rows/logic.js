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

  // ==========================================================================================
  // MOCK EXAM (exam.yaml). One seed → one dataset: examQ draws everything with examData(rng) first.
  // Item-based CF follows nb-cf exactly: the helpers below are copied VERBATIM from modules/nb-cf/logic.js
  // (means, centered, vector, sim without its trace, predict without its trace); examples ib-* check them against
  // nb-cf's slide numbers on its hp4x7 dataset.
  // ==========================================================================================
  const EPS = 1e-12;
  function means(M) {
    return M.values.map((row) => {
      const o = row.filter((x) => x !== null && x !== undefined);
      return o.length ? o.reduce((a, b) => a + b, 0) / o.length : null;
    });
  }
  function centered(M) {
    const mu = means(M);
    return M.values.map((row, i) => row.map((x) => (x === null || x === undefined ? null : x - mu[i])));
  }
  function vector(C, M, mode, label) {
    if (mode === 'item') {
      const j = M.cols.indexOf(label);
      if (j < 0) throw new Error(`unknown item ${label}`);
      return C.map((row) => row[j]);
    }
    const i = M.rows.indexOf(label);
    if (i < 0) throw new Error(`unknown user ${label}`);
    return C[i];
  }
  // nb-cf sim: cosine of user-mean-centered vectors over co-rated entries (0 for no overlap or a zero norm)
  function sim({ matrix, a, b, mode = 'user' }) {
    const C = centered(matrix);
    const va = vector(C, matrix, mode, a);
    const vb = vector(C, matrix, mode, b);
    const idx = [];
    for (let k = 0; k < va.length; k++) if (va[k] !== null && vb[k] !== null) idx.push(k);
    const xa = idx.map((k) => va[k]);
    const xb = idx.map((k) => vb[k]);
    const dot = xa.reduce((s, x, k) => s + x * xb[k], 0);
    const na = Math.sqrt(xa.reduce((s, x) => s + x * x, 0));
    const nb = Math.sqrt(xb.reduce((s, x) => s + x * x, 0));
    const value = na < EPS || nb < EPS ? 0 : dot / (na * nb);
    return { sim: value, overlap: idx.length };
  }
  // nb-cf predict (top-k by similarity, then only sim > 0; centered prediction + the user's mean).
  // minCommon (exam only, default 0 = nb-cf): a neighbour also needs at least minCommon common raters.
  function predict({ matrix, user, item, k, mode = 'user', minCommon = 0 }) {
    const C = centered(matrix);
    const mu = means(matrix);
    const ui = matrix.rows.indexOf(user);
    const ij = matrix.cols.indexOf(item);
    if (ui < 0 || ij < 0) throw new Error('unknown user or item');
    const cands = [];
    if (mode === 'user') {
      matrix.rows.forEach((peer, p) => {
        if (p === ui || C[p][ij] === null) return;
        const s = sim({ matrix, a: user, b: peer, mode: 'user' });
        if (s.overlap >= minCommon) cands.push({ label: peer, sim: s.sim, dev: C[p][ij], order: p });
      });
    } else {
      matrix.cols.forEach((other, q) => {
        if (q === ij || C[ui][q] === null) return;
        const s = sim({ matrix, a: item, b: other, mode: 'item' });
        if (s.overlap >= minCommon) cands.push({ label: other, sim: s.sim, dev: C[ui][q], order: q });
      });
    }
    cands.sort((x, y) => y.sim - x.sim || x.order - y.order);
    const top = cands.slice(0, k);
    const used = top.filter((c) => c.sim > EPS);
    const num = used.reduce((s, c) => s + c.sim * c.dev, 0);
    const den = used.reduce((s, c) => s + c.sim, 0);
    const blank = used.length === 0;
    const value = blank ? null : num / den;
    const rating = blank ? null : value + mu[ui];
    // cutGap (exam only): how far the k-th similarity is from the next; near 0, float noise could swap neighbours
    const cutGap = cands.length > k ? cands[k - 1].sim - cands[k].sim : Infinity;
    return { centered: value, mean: mu[ui], rating, blank, used: used.map((c) => c.label), top: top.map((c) => c.label), nCands: cands.length, cutGap };
  }

  const EX_USERS = [2101, 2214, 2378, 2490, 2533, 2647, 2712];
  const EX_RECIPES = [310, 452, 587, 603, 741, 896];
  const EX_TAGS = ['dinner', 'easy', 'quick', 'spicy', 'vegetarian'];
  const EX_NAMES = { 310: 'adobong pusit', 452: 'arroz caldo', 587: 'bistek tagalog', 603: 'ginataang gulay', 741: 'kare-kare', 896: 'lumpiang shanghai' };
  // coding exam: the files as the midterm folder would hold them (copied helpers: csv.writer quoting, Python repr)
  const EX_DIR = '/mnt/data/public/food-mock';
  const exCsvLine = (vals) => vals.map((v) => { const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',');
  const pyStrRepr = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  const pyIntList = (xs) => '[' + xs.join(', ') + ']';
  const pyStrList = (xs) => '[' + xs.map(pyStrRepr).join(', ') + ']';
  const exDate = (i) => { const d = new Date(Date.UTC(2021, 0, 1 + i * 17)); return d.toISOString().slice(0, 10); };
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); };
  const subsets = (xs) => { const out = []; for (let m = 1; m < 1 << xs.length; m++) out.push(xs.filter((_, i) => m & (1 << i))); return out; };
  const r2 = (x) => Math.round(x * 100) / 100;
  // one recipe ranking: estimate descending, then recipe id ascending
  const rankEst = (est) => est.slice().sort((a, b) => b.est - a.est || a.id - b.id).map((e) => e.id);

  // The whole exam's data from one rng. Redraws until every problem is well posed.
  function examData(rng) {
    for (let tries = 0; tries < 8000; tries++) {
      const users = rng.sample(EX_USERS, 6).sort((a, b) => a - b);
      const items = EX_RECIPES.slice();
      const rows = drawRows(rng, 18, users, items);
      const nMin = rng.pick([3, 4]);
      const counts = countsOf(rows);
      const keep = counts.filter((c) => c[1] >= nMin).map((c) => c[0]);
      const keepGt = counts.filter((c) => c[1] > nMin).map((c) => c[0]);
      if (keep.length < 3 || keep.length > 5 || keepGt.length === keep.length) continue;
      const kept = rows.filter((r) => keep.includes(r[1]));
      const p = pivotOf(kept);
      const allUsers = uniqSorted(rows.map((r) => r[0])).length;
      const M = { rows: p.users, cols: p.items, values: p.values };
      const k = 2, m = rng.pick([2, 3]);
      // a user with 2+ candidates and 2+ rated kept recipes, whose candidates get distinct non-blank estimates
      let pick = null;
      for (const u of rng.shuffle(p.users)) {
        const row = rowOf(p, u);
        const cand = p.items.filter((_, j) => row[j] === null), rated = p.items.filter((_, j) => row[j] !== null);
        if (cand.length < 2 || rated.length < 2) continue;
        const est = [];
        for (const it of cand) { const pr = predict({ matrix: M, user: u, item: it, k, mode: 'item', minCommon: m }); if (!pr.blank) est.push({ id: it, est: pr.rating, used: pr.used, nCands: pr.nCands }); }
        if (est.length < 2 || new Set(est.map((e) => r2(e.est))).size !== est.length) continue;
        // a candidate where the common-rater rule removes at least one of the user's rated recipes
        const target = est.find((e) => { const ok = rated.filter((o) => sim({ matrix: M, a: e.id, b: o, mode: 'item' }).overlap >= m).length; return ok >= 1 && ok < rated.length; });
        if (!target) continue;
        // the assert question shows a version that forgot to drop rated recipes: it must change the first item
        const bestRated = Math.max(...rated.map((o) => row[p.items.indexOf(o)]));
        if (!(bestRated > Math.max(...est.map((e) => e.est)) + 1e-9)) continue;
        pick = { u, cand, rated, est, target };
        break;
      }
      if (!pick) continue;
      // tags per recipe for problems 2a / 2b
      const tags = EX_RECIPES.map(() => rng.sample(EX_TAGS, rng.int(2, 4)).sort());
      const n = tags.length, minsup = n * 0.5;
      const supOf = (S) => tags.filter((t) => S.every((x) => t.includes(x))).length;
      const freq = subsets(EX_TAGS).map((S) => ({ S, sup: supOf(S) })).filter((f) => f.sup >= minsup);
      const freqGt = subsets(EX_TAGS).filter((S) => supOf(S) > minsup).length;
      if (!freq.length) continue;
      const maxSize = Math.max(...freq.map((f) => f.S.length));
      const largest = freq.filter((f) => f.S.length === maxSize).sort((a, b) => b.sup - a.sup || lt(a.S.join(','), b.S.join(',')));
      if (maxSize < 2) continue;
      const rules = [];
      for (const f of freq) if (f.S.length >= 2) for (const b of f.S) {
        const A = f.S.filter((x) => x !== b);
        const conf = f.sup / supOf(A);
        rules.push({ A, b, sup: f.sup / n, conf, lift: conf / (supOf([b]) / n) });
      }
      const strong = rules.filter((r) => r.conf >= 0.8).sort((x, y) => y.lift - x.lift || lt(x.A.join(','), y.A.join(',')));
      const nOr = rules.length; // every candidate rule already passes support (built from frequent itemsets)
      if (strong.length < 1 || strong.length === rules.length) continue;
      return { rows, users, items, nMin, counts, keep, keepGt, allUsers, p, M, k, m, ...pick, tags, n, minsup, freq, freqGt, maxSize, largest, rules, strong, nOr };
    }
    throw new Error('examData: no draw');
  }
  function countsOf(rows) {
    const c = {};
    for (const r of rows) c[r[1]] = (c[r[1]] || 0) + 1;
    return uniqSorted(rows.map((r) => r[1])).map((id) => [id, c[id]]);
  }

  // One generator for the whole exam (story vars + every problem's answers). storyKey identifies the dataset.
  function examQ({ rng }) {
    const d = examData(rng);
    const rank = rankEst(d.est);
    const rankAsc = d.est.slice().sort((a, b) => a.est - b.est || a.id - b.id).map((e) => e.id);
    const withRated = rankEst(d.est.concat(d.rated.map((id) => ({ id, est: rowOf(d.p, d.u)[d.p.items.indexOf(id)] }))));
    const target = d.target;
    const nbAll = d.rated.length; // neighbours before the common-rater rule
    const nbOk = d.rated.filter((o) => sim({ matrix: d.M, a: target.id, b: o, mode: 'item' }).overlap >= d.m).length;
    const top = d.strong[0];
    const ruleTxt = (r) => '{' + r.A.join(', ') + '} → ' + r.b;
    const fmtList = (xs) => '[' + xs.join(', ') + ']';
    const top2 = rank.slice(0, 2);
    const largestTxt = d.largest.map((f) => '[' + f.S.map((x) => "'" + x + "'").join(', ') + ']').join(', ');
    return {
      vars: {
        storyKey: fnv(JSON.stringify(d.rows) + JSON.stringify(d.tags)),
        interactionsMd: mdTable(['', 'user_id', 'recipe_id', 'rating'], d.rows.map((r, i) => [String(i), String(r[0]), String(r[1]), String(r[2])])),
        tagsMd: mdTable(['recipe_id', 'tags'], EX_RECIPES.map((id, i) => [String(id), '`' + JSON.stringify(d.tags[i]).replace(/"/g, "'") + '`'])),
        countsMd: mdTable(['recipe_id', 'ratings'], d.counts.map((c) => [String(c[0]), String(c[1])])),
        utilMd: matMd(d.p),
        nRows: d.rows.length, nMin: d.nMin, nKeep: d.keep.length, nKeepGt: d.keepGt.length, keep: d.keep.join(', '),
        nUsers: d.p.users.length, allUsers: d.allUsers, cells: d.p.users.length * d.p.items.length, nan: d.p.users.length * d.p.items.length - d.rows.filter((r) => d.keep.includes(r[1])).length,
        user: d.u, k: d.k, m: d.m, nCand: d.cand.length, nRated: d.rated.length, cand: d.cand.join(', '), rated: d.rated.join(', '),
        target: target.id, nbAll, nbOk, estMd: mdTable(['recipe_id', 'estimate'], d.est.map((e) => [String(e.id), e.est.toFixed(3)])),
        top2: fmtList(top2), first: rank[0], firstAsc: rankAsc[0], firstRated: withRated[0],
        n: d.n, minsup: d.minsup, nFreq: d.freq.length, nFreqGt: d.freqGt, maxSize: d.maxSize, nLargest: d.largest.length, largestTxt,
        nRules: d.rules.length, nStrong: d.strong.length, topRule: ruleTxt(top), topLift: r2(top.lift), topConf: r2(top.conf),
        assertActual: withRated[0], assertDesired: rank[0],
        filled: d.rows.filter((r) => d.keep.includes(r[1])).length,
        // coding exam: the files, and the test cells' expected values as Python literals
        dataDir: EX_DIR,
        interactionsCsv: [exCsvLine(['user_id', 'recipe_id', 'date', 'rating']), ...d.rows.map((r, i) => exCsvLine([r[0], r[1], exDate(i), r[2]]))].join('\n') + '\n',
        recipesCsv: [exCsvLine(['name', 'id', 'tags']), ...EX_RECIPES.map((id, i) => exCsvLine([EX_NAMES[id], id, pyStrList(d.tags[i])]))].join('\n') + '\n',
        shapePy: '(' + d.p.users.length + ', ' + d.keep.length + ')',
        keepPy: pyIntList(d.keep), usersPy: pyIntList(d.p.users),
        recsPy: pyIntList(rank),
        largestPy: '[' + d.largest.map((f) => pyStrList(f.S)).join(', ') + ']',
        rules3Py: '[' + d.strong.slice(0, 3).map((r) => '(' + pyStrList(r.A) + ', ' + pyStrRepr(r.b) + ')').join(', ') + ']',
      },
      misconceptions: [
        { var: 'nKeepGt', for: 'nKeep', feedback: '"At least {=nMin}" keeps recipes with exactly {=nMin} ratings: `>=`.' },
        { var: 'cells', for: 'nan', feedback: 'That is every cell. Subtract the cells that hold a rating.' },
        { var: 'filled', for: 'nan', feedback: 'Those are the filled cells. NaN cells are the empty ones.' },
        { var: 'nRated', for: 'nCand', feedback: 'Those are the recipes the user rated. Candidates are the NaN cells.' },
        { var: 'nbAll', for: 'nbOk', feedback: 'That counts every recipe the user rated. A neighbour also needs at least {=m} common raters with {=target}.' },
        { var: 'nFreqGt', for: 'nFreq', feedback: '"At least 50%" keeps itemsets in exactly {=minsup} recipes: `>=`.' },
        { var: 'nRules', for: 'nStrong', feedback: 'That is every candidate rule. Keep only confidence ≥ 0.8.' },
        { var: 'firstAsc', for: 'first', feedback: 'That is the lowest estimate. The spec sorts by decreasing estimated rating.' },
        { var: 'firstRated', for: 'first', feedback: 'User {=user} already rated that recipe. Only candidates (NaN cells) are recommended.' },
        { var: 'topConf', for: 'topLift', feedback: "That is the rule's confidence. Lift divides it by the share of recipes that have the consequent." },
      ],
    };
  }

  // ==========================================================================================
  // CODING MOCK EXAM (exam.yaml `coding`): the midterm's five problems, word for word in shape, on a smaller
  // Food.com-like dataset drawn from the seed. The learner's Python runs in the browser; these are the test values.
  // ==========================================================================================
  // Coordinate descent as in lf-cf (cgdUpdate / cgdRun): U and V start as all ones; a sweep updates every u_is
  // (user by user, factor by factor), then every v_sj (factor by factor, item by item), each solved exactly:
  // value = Σ factor·(r − rest) / Σ factor² over the observed cells (0 if the denominator is 0). Lean copy without
  // the per-update SSE and traces; examples cd-* check it against lf-cf's numbers on its r5x5.
  function cgdFit({ R, d = 2, sweeps = null, stopFrac = 0.1, maxSweeps = 200 }) {
    const V0 = R.values, m = V0.length, n = V0[0].length;
    const U = Array.from({ length: m }, () => Array(d).fill(1));
    const V = Array.from({ length: d }, () => Array(n).fill(1));
    const sseNow = () => { let t = 0; for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) { const r = V0[i][j]; if (r === null) continue; let p = 0; for (let s = 0; s < d; s++) p += U[i][s] * V[s][j]; t += (r - p) * (r - p); } return t; };
    const history = [sseNow()];
    const fracs = [];
    let first = null;
    for (let sw = 0; sw < (sweeps ?? maxSweeps); sw++) {
      for (let i = 0; i < m; i++) for (let s = 0; s < d; s++) {
        let num = 0, den = 0;
        for (let j = 0; j < n; j++) { const r = V0[i][j]; if (r === null) continue; let rest = 0; for (let t = 0; t < d; t++) if (t !== s) rest += U[i][t] * V[t][j]; num += V[s][j] * (r - rest); den += V[s][j] * V[s][j]; }
        U[i][s] = den === 0 ? 0 : num / den;
        if (first === null) first = { x: U[i][s] };
      }
      for (let s = 0; s < d; s++) for (let j = 0; j < n; j++) {
        let num = 0, den = 0;
        for (let i = 0; i < m; i++) { const r = V0[i][j]; if (r === null) continue; let rest = 0; for (let t = 0; t < d; t++) if (t !== s) rest += U[i][t] * V[t][j]; num += U[i][s] * (r - rest); den += U[i][s] * U[i][s]; }
        V[s][j] = den === 0 ? 0 : num / den;
      }
      const cur = sseNow();
      const prev = history[history.length - 1];
      history.push(cur);
      fracs.push((prev - cur) / prev);
      if (sweeps === null && (prev - cur) / prev < stopFrac) break;
    }
    const P = U.map((row) => Array.from({ length: n }, (_, j) => row.reduce((a, u, s) => a + u * V[s][j], 0)));
    return { U, V, P, history, fracs, sweepsRun: fracs.length, sse: history[history.length - 1] };
  }
  // lf-cf's first two single-entry updates (u11 then v11 from all ones), for the parity examples
  function cgdFirstTwo({ R }) {
    const V0 = R.values, n = V0[0].length, m = V0.length, d = 2;
    const U = Array.from({ length: m }, () => Array(d).fill(1)), V = Array.from({ length: d }, () => Array(n).fill(1));
    let num = 0, den = 0;
    for (let j = 0; j < n; j++) { const r = V0[0][j]; if (r === null) continue; const rest = U[0][1] * V[1][j]; num += V[0][j] * (r - rest); den += V[0][j] ** 2; }
    U[0][0] = num / den;
    num = 0; den = 0;
    for (let i = 0; i < m; i++) { const r = V0[i][0]; if (r === null) continue; const rest = U[i][1] * V[1][0]; num += U[i][0] * (r - rest); den += U[i][0] ** 2; }
    return { x: U[0][0], y: num / den };
  }

  const CX_DIR = '/mnt/data/public/food-com-mini';
  const CX_NAMES = ['adobong manok', 'arroz caldo', 'bibingka', 'bicol express', 'bistek tagalog', 'buko pie', 'champorado', 'chicken inasal',
    'dinuguan', 'ensaymada', 'ginataang gulay', 'kaldereta', 'kare-kare', 'laing', 'leche flan', 'lechon kawali', 'lumpiang shanghai',
    'mechado', 'menudo', 'pancit bihon', 'pinakbet', 'puto', 'sinigang na hipon', 'tinola'];
  // Food.com-style tags with how often a recipe carries them (a few near-universal tags make larger frequent sets)
  const CX_TAGS = [['time-to-make', 0.95], ['course', 0.9], ['preparation', 0.85], ['main-ingredient', 0.6], ['dietary', 0.45],
    ['easy', 0.5], ['occasion', 0.3], ['60-minutes-or-less', 0.4], ['low-in-something', 0.3], ['vegetables', 0.25]];
  const CX_REVIEWS = ['Great recipe!', 'Too salty for me.', 'Made it twice, family loved it.', 'Easy, quick, and tasty.', 'Not bad.',
    'I added more garlic.', 'Perfect for a rainy day.', 'Needed more time to cook, but good.', 'Will make again.', 'Just okay.'];
  const pick = (rng, xs) => xs[rng.int(0, xs.length - 1)];
  const gapsOk = (xs, eps = 1e-6) => xs.every((x, i) => i === 0 || Math.abs(xs[i - 1] - x) > eps);

  function codeData(rng) {
    for (let tries = 0; tries < 300; tries++) {
      const recipeIds = rng.sample(Array.from({ length: 900 }, (_, i) => 1000 + i * 37), 24).sort((a, b) => a - b);
      const userIds = rng.sample(Array.from({ length: 900 }, (_, i) => 20000 + i * 113), 30).sort((a, b) => a - b);
      const quality = recipeIds.map(() => rng.float() * 1.6 - 0.8);
      const weight = recipeIds.map(() => 0.3 + rng.float() * 2);
      const rows = [];
      for (const u of userIds) {
        const bias = rng.float() * 1.2 - 0.6;
        const count = rng.int(4, 13);
        const chosen = new Set();
        while (chosen.size < count) {
          let x = rng.float() * weight.reduce((a, b) => a + b, 0), j = 0;
          while (x > weight[j]) { x -= weight[j]; j++; }
          chosen.add(Math.min(j, recipeIds.length - 1));
        }
        for (const j of chosen) rows.push([u, recipeIds[j], Math.max(1, Math.min(5, Math.round(3.6 + quality[j] + bias + (rng.float() - 0.5) * 1.6)))]);
      }
      // file order: shuffled, like a real export
      const fileRows = rng.shuffle(rows);
      const counts = countsOf(fileRows);
      const nMin = [10, 9, 8, 7, 6].find((t) => { const kk = counts.filter((c) => c[1] >= t).length; return kk >= 10 && kk <= 15 && counts.some((c) => c[1] === t); });
      if (!nMin) continue;
      const keep = counts.filter((c) => c[1] >= nMin).map((c) => c[0]);
      const p = pivotOf(fileRows.filter((r) => keep.includes(r[1])));
      const M = { rows: p.users, cols: p.items, values: p.values };
      const k = 3, m = 3, topN = 5, d = 3;
      const fit = cgdFit({ R: M, d });
      if (fit.fracs.some((f) => Math.abs(f - 0.1) < 1e-6)) continue;
      // a user whose item-based and CGD top lists are both well separated
      let pickUser = null;
      for (const u of rng.shuffle(p.users)) {
        const ui = p.users.indexOf(u), row = p.values[ui];
        const cand = p.items.filter((_, j) => row[j] === null);
        if (cand.length < topN + 1) continue;
        const est = [];
        let unsafe = false;
        for (const it of cand) {
          const pr = predict({ matrix: M, user: u, item: it, k, mode: 'item', minCommon: m });
          if (pr.cutGap < 1e-6) unsafe = true;
          if (!pr.blank) est.push({ id: it, est: pr.rating });
        }
        if (unsafe || est.length < topN + 1) continue;
        const ib = est.slice().sort((a, b) => b.est - a.est || a.id - b.id);
        if (!gapsOk(ib.slice(0, topN + 1).map((e) => e.est))) continue;
        const cd = cand.map((it) => ({ id: it, est: fit.P[ui][p.items.indexOf(it)] })).sort((a, b) => b.est - a.est || a.id - b.id);
        if (!gapsOk(cd.slice(0, topN + 1).map((e) => e.est))) continue;
        pickUser = { u, ib: ib.slice(0, topN).map((e) => e.id), cd: cd.slice(0, topN).map((e) => e.id) };
        break;
      }
      if (!pickUser) continue;
      // tags for problem 2
      const tags = recipeIds.map(() => {
        const t = CX_TAGS.filter(([, pr]) => rng.float() < pr).map(([name]) => name);
        return t.length >= 2 ? t : ['time-to-make', 'course'];
      });
      const tagNames = CX_TAGS.map(([name]) => name).slice().sort();
      const n = tags.length, minsup = n * 0.25;
      const supOf = (S) => tags.filter((t) => S.every((x) => t.includes(x))).length;
      const freq = subsets(tagNames).map((S) => ({ S, sup: supOf(S) })).filter((f) => f.sup >= minsup);
      const maxSize = Math.max(...freq.map((f) => f.S.length));
      if (maxSize < 3) continue;
      const largest = freq.filter((f) => f.S.length === maxSize).sort((a, b) => b.sup - a.sup || lt(a.S.join('\u0000'), b.S.join('\u0000')));
      const cnt = new Map(freq.map((f) => [f.S.join('\u0000'), f.sup]));
      const rules = [];
      for (const f of freq) if (f.S.length >= 2) for (const b of f.S) {
        const A = f.S.filter((x) => x !== b);
        const conf = f.sup / cnt.get(A.join('\u0000'));
        if (conf >= 0.8) rules.push({ A, b, conf, lift: conf / (cnt.get(b) / n) });
      }
      const byA = (x, y) => lt(x.A.join('\u0000'), y.A.join('\u0000'));
      rules.sort((x, y) => y.lift - x.lift || byA(x, y));
      // exact lift ties are fine (the spec's formula gives identical floats, and the antecedent breaks the tie);
      // a near-tie that is not exact could flip with another formula's rounding, so redraw it
      const nearTie = (xs) => xs.some((x, i) => i > 0 && x !== xs[i - 1] && Math.abs(x - xs[i - 1]) < 1e-9);
      if (rules.length < 10 || nearTie(rules.slice(0, 6).map((r) => r.lift))) continue;
      // the midterm's wording breaks lift ties by antecedent only: two tested rules with the same lift AND antecedent
      // (different consequents) have no defined order, so redraw
      const ambiguous = (rs, t, key) => rs.slice(0, t + 1).some((r, i) => i > 0 && key(r) === key(rs[i - 1]) && byA(r, rs[i - 1]) === 0);
      if (ambiguous(rules, 6, (r) => r.lift)) continue;

      // ---- twists (the walkthrough's variations): the same files, answers that must differ from the originals ----
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      // 1a: "more than", and users with at least uMin ratings in the matrix
      const keepGt = counts.filter((c) => c[1] > nMin).map((c) => c[0]);
      const pGt = pivotOf(fileRows.filter((r) => keepGt.includes(r[1])));
      const perUser = p.users.map((u, i) => [u, p.values[i].filter((v) => v !== null).length]);
      const uMin = [5, 4, 6, 3].find((t) => { const dropped = perUser.filter(([, c]) => c < t).length; return dropped >= 2 && dropped <= 12; });
      if (!uMin) continue;
      const active = perUser.filter(([, c]) => c >= uMin).map(([u]) => u);
      // 1b: user-based, same k and m (m now counts common recipes)
      const ui = p.users.indexOf(pickUser.u), urow = p.values[ui];
      const ucand = p.items.filter((_, j) => urow[j] === null);
      const ub = [];
      let ubUnsafe = false;
      for (const it of ucand) {
        const pr = predict({ matrix: M, user: pickUser.u, item: it, k, mode: 'user', minCommon: m });
        if (pr.cutGap < 1e-6) ubUnsafe = true;
        if (!pr.blank) ub.push({ id: it, est: pr.rating });
      }
      if (ubUnsafe || ub.length < topN + 1) continue;
      ub.sort((a, b) => b.est - a.est || a.id - b.id);
      if (!gapsOk(ub.slice(0, topN + 1).map((e) => e.est))) continue;
      const userRec = ub.slice(0, topN).map((e) => e.id);
      if (same(userRec, pickUser.ib)) continue;
      // 1c: four fixed sweeps; two factors with a 0.05 stop
      const cdOf = (f) => ucand.map((it) => ({ id: it, est: f.P[ui][p.items.indexOf(it)] })).sort((a, b) => b.est - a.est || a.id - b.id);
      const fit4 = cgdFit({ R: M, d, sweeps: 4 }), cd4 = cdOf(fit4);
      const fit2 = cgdFit({ R: M, d: 2, stopFrac: 0.05 }), cd2 = cdOf(fit2);
      if (fit2.fracs.some((f) => Math.abs(f - 0.05) < 1e-6)) continue;
      // these twists return numbers rounded to 3 decimals: redraw a value within reach of a rounding boundary
      const nearHalf = (x) => Math.abs(((x * 1000) % 1 + 1) % 1 - 0.5) < 1e-3;
      const sse4 = fit4.history;
      if (sse4.some(nearHalf) || !gapsOk(cd2.slice(0, 2).map((e) => e.est))) continue;
      const top2Est = cd2[0].est, topOrig = cdOf(fit)[0].est;
      if (nearHalf(top2Est) || top2Est.toFixed(3) === topOrig.toFixed(3)) continue;
      const cdTwo = { id: cd2[0].id, est: top2Est };
      // 2a: at least 40%; every frequent pair
      const freq40 = subsets(tagNames).map((S) => ({ S, sup: supOf(S) })).filter((f) => f.sup >= n * 0.4);
      const max40 = Math.max(...freq40.map((f) => f.S.length));
      const largest40 = freq40.filter((f) => f.S.length === max40).sort((a, b) => b.sup - a.sup || lt(a.S.join('\u0000'), b.S.join('\u0000')));
      const pairs = freq.filter((f) => f.S.length === 2).sort((a, b) => b.sup - a.sup || lt(a.S.join('\u0000'), b.S.join('\u0000')));
      if (same(largest40.slice(0, 2).map((f) => f.S), largest.slice(0, 2).map((f) => f.S)) || pairs.length < 3) continue;
      // 2b: by confidence; single-tag antecedents only
      // this twist's own spec adds the consequent as a last tie-break
      const byConf = rules.slice().sort((x, y) => y.conf - x.conf || byA(x, y) || lt(x.b, y.b));
      const single = rules.filter((r) => r.A.length === 1);
      if (ambiguous(single, 4, (r) => r.lift)) continue;
      if (nearTie(byConf.slice(0, 6).map((r) => r.conf)) || single.length < 3) continue;
      const key5 = (rs, t) => rs.slice(0, t).map((r) => [r.A, r.b]);
      if (same(key5(byConf, 5), key5(rules, 5)) || same(key5(single, 3), key5(rules, 3))) continue;
      const tw = { keepGt, pGt, uMin, active, userRec, sse4, cdTwo, largest40, pairs, byConf, single };
      return { fileRows, recipeIds, userIds, tags, nMin, keep, p, k, m, topN, d, fit, ...pickUser, largest, rules, n, tw };
    }
    throw new Error('codeData: no draw');
  }

  // Generator for the coding exam: the files and every test cell's expected value as Python literals.
  function codeExamQ({ rng }) {
    const D = codeData(rng);
    const pyTuple = (r) => '(' + pyStrList(r.A) + ', ' + pyStrRepr(r.b) + ')';
    const first = D.p.values[0];
    const firstRated = D.p.items.map((it, j) => [it, first[j]]).filter(([, v]) => v !== null);
    const interactionsCsv = [exCsvLine(['user_id', 'recipe_id', 'date', 'rating', 'review']),
      ...D.fileRows.map((r, i) => exCsvLine([r[0], r[1], exDate(i), r[2], CX_REVIEWS[(r[0] + r[1]) % CX_REVIEWS.length]]))].join('\n') + '\n';
    const recipesCsv = [exCsvLine(['name', 'id', 'minutes', 'tags', 'n_steps']),
      ...D.recipeIds.map((id, i) => exCsvLine([CX_NAMES[i], id, 15 + ((id * 7) % 90), pyStrList(D.tags[i]), 3 + (id % 9)]))].join('\n') + '\n';
    return {
      vars: {
        storyKey: fnv(interactionsCsv + recipesCsv),
        dataDir: CX_DIR, interactionsCsv, recipesCsv,
        nRatings: D.fileRows.length, nRecipes: D.recipeIds.length, nUsers: D.userIds.length,
        nMin: D.nMin, k: D.k, m: D.m, topN: D.topN, d: D.d, user: D.u,
        shapePy: '(' + D.p.users.length + ', ' + D.keep.length + ')',
        colsPy: pyIntList(D.keep.slice(0, 10)), indexPy: pyIntList(D.p.users.slice(0, 10)),
        firstRatingsPy: '[' + firstRated.map(([, v]) => v.toFixed(1)).join(', ') + ']', firstItemsPy: pyIntList(firstRated.map(([it]) => it)),
        itemRecPy: pyIntList(D.ib), cdRecPy: pyIntList(D.cd), sweeps: D.fit.sweepsRun,
        largestPy: '[' + D.largest.slice(0, 2).map((f) => pyStrList(f.S)).join(', ') + ']', nLargest: D.largest.length,
        liftsPy: '[' + D.rules.slice(0, 5).map(pyTuple).join(', ') + ']',
        // twists
        gtShapePy: '(' + D.tw.pGt.users.length + ', ' + D.tw.keepGt.length + ')', gtColsPy: pyIntList(D.tw.keepGt.slice(0, 10)),
        uMin: D.tw.uMin, activeShapePy: '(' + D.tw.active.length + ', ' + D.keep.length + ')', activeIndexPy: pyIntList(D.tw.active.slice(0, 10)),
        userRecPy: pyIntList(D.tw.userRec), sse4Py: '[' + D.tw.sse4.map((x) => x.toFixed(3)).join(', ') + ']',
        cdTwoId: D.tw.cdTwo.id, cdTwoEst: D.tw.cdTwo.est.toFixed(3),
        largest40Py: '[' + D.tw.largest40.slice(0, 2).map((f) => pyStrList(f.S)).join(', ') + ']',
        pairsPy: '[' + D.tw.pairs.slice(0, 3).map((f) => pyStrList(f.S)).join(', ') + ']',
        byConfPy: '[' + D.tw.byConf.slice(0, 5).map(pyTuple).join(', ') + ']',
        singlePy: '[' + D.tw.single.slice(0, 3).map(pyTuple).join(', ') + ']',
      },
    };
  }

  return {
    fns: {
      realCell, utilView, userView, commonView, rankView, freqView, rulesView, maskView,
      checkMasks, checkUnrated, checkCommon, checkRank, checkFreq, checkRules, maskTrace, commonTrace,
      sim, predict, cgdFit, cgdFirstTwo,
    },
    generators: { maskCountQ, unratedQ, coratedQ, topkQ, relSupportQ, largestQ, rulesQ, assertQ, examQ, codeExamQ },
  };
}
