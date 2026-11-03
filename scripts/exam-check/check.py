"""Run a coding mock exam's shipped cells in real pandas, seed by seed (see README.md next to this file).

Every case from export.mts runs in a fresh namespace: the setup cell, each problem's walkthrough steps and test cells,
then every twist's solution and tests. The data files go to a temporary folder, and the exam's data path in the code is
pointed at it. Any cell that raises fails the seed. Use the course's runtime (Python 3.12, pandas 2.2).

    python scripts/exam-check/check.py cases.json
"""
import json, os, sys, tempfile, traceback

import pandas as pd


def run_case(case):
    with tempfile.TemporaryDirectory() as tmp:
        tmp = tmp.replace("\\", "/")
        local = lambda s: s.replace(case["dataDir"], tmp) if case["dataDir"] else s
        for p, text in case["files"].items():
            target = local(p)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with open(target, "w", encoding="utf-8", newline="") as f:
                f.write(text)
        ns = {"__name__": "__main__"}
        for cell in case["cells"]:
            try:
                exec(compile(local(cell["code"]), f"<{cell['label']}>", "exec"), ns)
            except BaseException as e:  # noqa: BLE001 - every failure is reported
                return f"{cell['label']}: {''.join(traceback.format_exception_only(type(e), e)).strip()}"
    return None


def main():
    data = json.load(open(sys.argv[1], encoding="utf-8"))
    failed = 0
    for case in data["cases"]:
        err = run_case(case)
        if err:
            failed += 1
            print(f"seed {case['seed']}: FAIL {err}")
    n = len(data["cases"])
    cells = sum(len(c["cells"]) for c in data["cases"])
    print(f"{data['module']}@{data['version']}: python {sys.version.split()[0]}, pandas {pd.__version__}: "
          f"{n - failed}/{n} seeds pass ({cells} cells run)")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
