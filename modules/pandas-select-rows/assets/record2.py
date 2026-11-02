"""Record the pandas-select-rows lesson cells for real (same recorder as record.py) into real2.json."""
import json, os, sys

import pandas as pd

import record  # run_kernel, path swapping, display options

R = "/mnt/data/public/food-mini"
LOAD = (f'import pandas as pd\nfrom numpy.testing import assert_equal\n\n'
        f'interactions = pd.read_csv("{R}/RAW_interactions.csv")\n'
        'util = interactions.pivot(index="user_id", columns="recipe_id", values="rating")\nutil.shape')
TAGS = (f'import ast\nimport pandas as pd\nfrom numpy.testing import assert_equal\n\n'
        f'recipes = pd.read_csv("{R}/RAW_recipes.csv", converters={{"tags": ast.literal_eval}})\n'
        'tag_counts = recipes["tags"].explode().value_counts()\nlen(recipes)')
RULES = (
    'from itertools import permutations\n\n'
    'n = len(recipes)\n'
    'count = recipes["tags"].explode().value_counts()\n'
    'rows = []\n'
    'for a, b in permutations(count.index, 2):\n'
    '    both = recipes["tags"].apply(lambda t: a in t and b in t).sum()\n'
    '    if both:\n'
    '        conf = both / count[a]\n'
    '        rows.append((a, b, both / n, conf, conf / (count[b] / n)))\n'
    'rules = pd.DataFrame(rows, columns=["antecedent", "consequent", "support", "confidence", "lift"])\n'
    'rules.shape')

KERNELS = {
    "mask": [
        ("load", f'import pandas as pd\n\ninteractions = pd.read_csv("{R}/RAW_interactions.csv")\ninteractions.shape'),
        ("one_mask", '(interactions["rating"] >= 4).head()'),
        ("one_filter", 'interactions[interactions["rating"] >= 4].shape'),
        ("mask_sum", '(interactions["rating"] >= 4).sum()'),
        ("and_ok", 'interactions[(interactions["rating"] >= 4) & (interactions["user_id"] == 1101)]["recipe_id"].tolist()'),
        ("and_word", 'interactions[(interactions["rating"] >= 4) and (interactions["user_id"] == 1101)]'),
        ("no_parens", 'interactions[interactions["rating"] >= 4 & interactions["user_id"] == 1101]'),
        ("or_ok", 'interactions[(interactions["rating"] == 0) | (interactions["recipe_id"] == 8233)]["user_id"].tolist()'),
        ("not_ok", 'interactions[~interactions["recipe_id"].isin([1207, 2318])].shape'),
        ("not_wrong", 'interactions[-interactions["recipe_id"].isin([1207, 2318])].shape'),
    ],
    "unrated": [
        ("load", LOAD),
        ("row", 'util.loc[1245]'),
        ("isna", 'util.loc[1245].isna()'),
        ("unrated", 'row = util.loc[1245]\nrow[row.isna()].index.tolist()'),
        ("rated", 'row[row.notna()].index.tolist()'),
        ("dropna", 'row.dropna().index.tolist()'),
        ("eq_nan", 'row[row == float("nan")].index.tolist()'),
        ("assert_ok", 'assert_equal(row[row.isna()].index.tolist(), [2318, 4415, 6110, 8233])'),
        ("assert_bad", 'assert_equal(row.dropna().index.tolist(), [2318, 4415, 6110, 8233])'),
    ],
    "corated": [
        ("load", LOAD),
        ("both", 'both = util[1207].notna() & util[2318].notna()\nboth.sum()'),
        ("either", '(util[1207].notna() | util[2318].notna()).sum()'),
        ("one_col", 'util[1207].notna().sum()'),
        ("common_all", 'common = {j: (util[1207].notna() & util[j].notna()).sum() for j in util.columns if j != 1207}\ncommon'),
        ("neighbors_ge", '[j for j, c in common.items() if c >= 3]'),
        ("neighbors_gt", '[j for j, c in common.items() if c > 3]'),
        ("with_self", '[j for j in util.columns if (util[1207].notna() & util[j].notna()).sum() >= 3]'),
        ("user_rated_nb", 'rated = util.loc[1245].notna()\n[j for j in [j for j, c in common.items() if c >= 3] if rated[j]]'),
    ],
    "topk": [
        ("load", LOAD),
        ("means", 'means = interactions.groupby("recipe_id")["rating"].mean()\nmeans.round(3)'),
        ("sorted_ok", 'top = means.reset_index().sort_values(["rating", "recipe_id"], ascending=[False, True])\ntop["recipe_id"].head(5).tolist()'),
        ("sorted_desc_id", 'means.reset_index().sort_values(["rating", "recipe_id"], ascending=[False, False])["recipe_id"].head(5).tolist()'),
        ("sorted_one_key", 'means.sort_values(ascending=False).head(5).index.tolist()'),
        ("sorted_asc", 'means.sort_values().head(5).index.tolist()'),
        ("assert_ok", 'assert_equal(top["recipe_id"].head(5).tolist(), [8233, 1207, 6110, 2318, 5021])'),
        ("assert_tie", 'wrong = means.reset_index().sort_values(["rating", "recipe_id"], ascending=[False, False])\nassert_equal(wrong["recipe_id"].head(5).tolist(), [8233, 1207, 6110, 2318, 5021])'),
        ("exclude_rated", 'row = util.loc[1245]\ncand = means[row[row.isna()].index]\ncand.reset_index().sort_values(["rating", "recipe_id"], ascending=[False, True])["recipe_id"].tolist()'),
    ],
    "relative": [
        ("load", TAGS),
        ("counts", 'tag_counts'),
        ("minsup", 'minsup = len(recipes) * 0.25\nminsup'),
        ("freq_ge", 'tag_counts[tag_counts >= minsup].index.tolist()'),
        ("freq_gt", 'tag_counts[tag_counts > minsup].index.tolist()'),
        ("freq_frac", 'tag_counts[tag_counts >= 0.25].index.tolist() == tag_counts.index.tolist()'),
        ("rel", '(tag_counts / len(recipes)).head(4)'),
        ("n_tags", 'recipes["n_tags"] = recipes["tags"].str.len()\nrecipes[["name", "n_tags"]]'),
        ("largest_ok", 'recipes[recipes["n_tags"] == recipes["n_tags"].max()]["name"].tolist()'),
        ("largest_nl", 'recipes.nlargest(1, "n_tags")["name"].tolist()'),
        ("largest_head", 'recipes.sort_values("n_tags", ascending=False).head(1)["name"].tolist()'),
    ],
    "rules": [
        ("load", TAGS),
        ("build", RULES),
        ("strong_ok", 'strong = rules[(rules["support"] >= 0.25) & (rules["confidence"] >= 0.8)]\nstrong.shape'),
        ("strong_or", 'rules[(rules["support"] >= 0.25) | (rules["confidence"] >= 0.8)].shape'),
        ("strong_gt", 'rules[(rules["support"] > 0.25) & (rules["confidence"] >= 0.8)].shape'),
        ("ranked", 'ranked = strong.sort_values(["lift", "antecedent"], ascending=[False, True])\nranked[["antecedent", "consequent", "lift"]].head(4).round(3)'),
        ("ranked_lift_only", 'strong.sort_values("lift", ascending=False)[["antecedent", "consequent", "lift"]].head(4).round(3)'),
        ("top_pairs", 'list(zip(ranked["antecedent"], ranked["consequent"]))[:3]'),
        ("assert_or", 'loose = rules[(rules["support"] >= 0.25) | (rules["confidence"] >= 0.8)]\nassert_equal(len(loose), len(strong))'),
    ],
}

if __name__ == "__main__":
    os.chdir(record.HERE)
    res = {}
    for name, cells in KERNELS.items():
        res.update(record.run_kernel(name, cells))
    res["_env"] = {"python": sys.version.split()[0], "pandas": pd.__version__}
    with open(os.path.join(record.HERE, "real2.json"), "w", encoding="utf-8") as f:
        json.dump(res, f, indent=1, ensure_ascii=False)
    for k, v in res.items():
        if k == "_env":
            continue
        print(f"=== {k} [cell {v['cell']}]")
        print(v["out"] + (v["err"] and ("ERR:\n" + v["err"])))
