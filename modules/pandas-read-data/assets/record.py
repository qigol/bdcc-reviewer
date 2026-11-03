"""Run the lesson cells for real (Python 3.12, pandas 2.2.3) and save {key: {code, out, err, cell}} to real.json.

Each KERNEL is a fresh namespace, like a freshly started notebook kernel; its cells run in order and are numbered
from 1 like Jupyter's execution counter. Output = stdout plus the repr of a final bare expression (what Jupyter prints
as text). Tracebacks keep the learner's own frames; library frames collapse into one '  ...' line. The local data
folder is swapped for the course-style path /mnt/data/public in code and outputs.
"""
import ast, contextlib, io, json, os, sys, traceback
import pandas as pd

pd.set_option("display.width", 200)  # Jupyter shows a full HTML table; text recordings must not hide columns
pd.set_option("display.max_columns", 20)  # the notebook default; a script sees "terminal" mode (0) and hides columns

HERE = os.path.dirname(os.path.abspath(__file__))
LOCAL = os.path.join(HERE, "mnt", "data", "public").replace("\\", "/")
SHOWN = "/mnt/data/public"

R = "/mnt/data/public/food-mini"
KERNELS = {
    "explore": [
        ("ls", 'import os\n\nDATA = "/mnt/data/public/food-mini"\nsorted(os.listdir(DATA))'),
        ("peek", 'with open(DATA + "/RAW_interactions.csv") as f:\n    for _ in range(3):\n        print(f.readline(), end="")'),
        ("read", 'import pandas as pd\n\ninteractions = pd.read_csv(DATA + "/RAW_interactions.csv")\ninteractions.shape'),
        ("read_wrong", 'pd.read_csv(DATA + "/interactions.csv")'),
        ("read_noprefix", 'pd.read_csv("RAW_interactions.csv")'),
        ("head", 'interactions.head()'),
        ("dtypes", 'interactions.dtypes'),
        ("columns", 'interactions.columns.tolist()'),
        ("col_typo", 'interactions["ratings"]'),
        ("ratings_vc", 'interactions["rating"].value_counts().sort_index()'),
        ("train_cols", 'pd.read_csv(DATA + "/interactions_train.csv").columns.tolist()'),
        ("train_shape", 'pd.read_csv(DATA + "/interactions_train.csv").shape'),
        ("nunique", 'interactions["user_id"].nunique(), interactions["recipe_id"].nunique()'),
    ],
    "tags": [
        ("read", f'import pandas as pd\n\nrecipes = pd.read_csv("{R}/RAW_recipes.csv")\nrecipes[["name", "id", "tags"]].head(3)'),
        ("first_tags", 'recipes.loc[0, "tags"]'),
        ("type_str", 'type(recipes.loc[0, "tags"])'),
        ("len_str", 'recipes["tags"].str.len().head(3)'),
        ("in_str", '"dinner" in recipes.loc[2, "tags"]'),
        ("naive_split", 'recipes.loc[0, "tags"][1:-1].split(", ")'),
        ("literal", 'import ast\n\nast.literal_eval(recipes.loc[0, "tags"])'),
        ("converters", f'recipes = pd.read_csv("{R}/RAW_recipes.csv", converters={{"tags": ast.literal_eval}})\ntype(recipes.loc[0, "tags"]), len(recipes.loc[0, "tags"])'),
        ("in_list", '"dinner" in recipes.loc[2, "tags"]'),
        ("n_tags", 'recipes["tags"].str.len().tolist()'),
        ("explode", 'recipes["tags"].explode().value_counts().head(6)'),
        ("easy", 'recipes[recipes["tags"].apply(lambda t: "easy" in t)]["name"].tolist()'),
    ],
    "matrix": [
        ("setup", f'import pandas as pd\n\ninteractions = pd.read_csv("{R}/RAW_interactions.csv")\ncounts = interactions.groupby("recipe_id")["rating"].count()\ncounts'),
        ("keep_ge", 'counts[counts >= 4].index.tolist()'),
        ("keep_gt", 'counts[counts > 4].index.tolist()'),
        ("filtered", 'keep = counts[counts >= 4].index\nrated = interactions[interactions["recipe_id"].isin(keep)]\nrated.shape'),
        ("pivot", 'util = rated.pivot(index="user_id", columns="recipe_id", values="rating")\nutil.shape'),
        ("util_show", 'util'),
        ("util_axes", 'util.index.tolist(), util.columns.tolist()'),
        ("loc_user", 'util.loc[1101].dropna()'),
        ("iloc_zero", 'util.iloc[0].dropna()'),
        ("iloc_user", 'util.iloc[1101]'),
        ("loc_zero", 'util.loc[0]'),
        ("dup_pivot", 'twice = pd.concat([rated, rated.head(1)])\ntwice.pivot(index="user_id", columns="recipe_id", values="rating")'),
    ],
    "funcs": [
        ("define", f'import pandas as pd\n\ndef create_utility_matrix():\n    df = pd.read_csv("{R}/RAW_interactions.csv")\n    counts = df.groupby("recipe_id")["rating"].count()\n    keep = counts[counts >= 4].index\n    rated = df[df["recipe_id"].isin(keep)]\n    return rated.pivot(index="user_id", columns="recipe_id", values="rating")\n\ndf_utility = create_utility_matrix()\ndf_utility.shape'),
        ("uses_global", 'def rated_by(user):\n    return df_utility.loc[user].dropna().index.tolist()\n\nrated_by(1502)'),
        ("no_return", 'def create_utility_matrix_v2():\n    df = pd.read_csv("' + R + '/RAW_interactions.csv")\n    util = df.pivot_table(index="user_id", columns="recipe_id", values="rating")\n\ncreate_utility_matrix_v2().shape'),
    ],
    # a fresh kernel: only the function cell is run (what a grader or "Restart & Run" on a section does)
    "fresh": [
        ("uses_global", 'def rated_by(user):\n    return df_utility.loc[user].dropna().index.tolist()\n\nrated_by(1502)'),
    ],
    "fresh_fixed": [
        ("self_contained", f'import pandas as pd\n\ndef create_utility_matrix():\n    df = pd.read_csv("{R}/RAW_interactions.csv")\n    counts = df.groupby("recipe_id")["rating"].count()\n    keep = counts[counts >= 4].index\n    rated = df[df["recipe_id"].isin(keep)]\n    return rated.pivot(index="user_id", columns="recipe_id", values="rating")\n\ndef rated_by(user):\n    df_utility = create_utility_matrix()\n    return df_utility.loc[user].dropna().index.tolist()\n\nrated_by(1502)'),
    ],
}


def local(s):
    return s.replace(SHOWN, LOCAL)


def shown(s):
    return s.replace(LOCAL, SHOWN).replace(LOCAL.replace("/", "\\"), SHOWN)


def fmt_tb(e, codes):
    lines = ["Traceback (most recent call last):"]
    collapsed = False
    for fr in traceback.extract_tb(e.__traceback__)[1:]:  # [0] is this runner's exec
        if fr.filename.startswith("<cell "):
            src = codes[fr.filename].split("\n")[fr.lineno - 1].strip()
            lines += [f'  File "{fr.filename}", line {fr.lineno}, in {fr.name}', f"    {src}"]
            collapsed = False
        elif not collapsed:
            lines.append("  ...")
            collapsed = True
    lines += [l.rstrip("\n") for l in traceback.format_exception_only(type(e), e)]
    return shown("\n".join(lines))


def run_kernel(name, cells):
    ns, codes, out = {"__name__": "__main__"}, {}, {}
    for n, (key, code) in enumerate(cells, start=1):
        fname = f"<cell {n}>"
        codes[fname] = code
        tree = ast.parse(local(code), fname)
        last = tree.body.pop() if tree.body and isinstance(tree.body[-1], ast.Expr) else None
        buf, err = io.StringIO(), ""
        try:
            with contextlib.redirect_stdout(buf):
                exec(compile(tree, fname, "exec"), ns)
                if last is not None:
                    v = eval(compile(ast.Expression(last.value), fname, "eval"), ns)
                    if v is not None:
                        print(repr(v))
        except Exception as e:  # noqa: BLE001 - every error is a lesson output
            err = fmt_tb(e, codes)
        out[f"pd.{name}.{key}"] = {"code": code, "out": shown(buf.getvalue()), "err": err, "cell": n}
    return out


if __name__ == "__main__":
    os.chdir(HERE)
    res = {}
    for name, cells in KERNELS.items():
        res.update(run_kernel(name, cells))
    res["_env"] = {"python": sys.version.split()[0], "pandas": pd.__version__}
    with open(os.path.join(HERE, "real.json"), "w", encoding="utf-8") as f:
        json.dump(res, f, indent=1, ensure_ascii=False)
    for k, v in res.items():
        if k == "_env":
            continue
        print(f"=== {k} [cell {v['cell']}]")
        print(v["out"] + (v["err"] and ("ERR:\n" + v["err"])))
