# Checking a coding mock exam in real pandas

The validator cannot run Python, so a coding exam (`exam.yaml` → `coding`) is checked here, outside the app. For each
seed, `export.mts` takes the data files and the exact cells shipped in `exam.yaml`: the setup cell, every walkthrough step
and test cell, and every twist's solution and tests. `check.py` runs them in a fresh namespace with real pandas. Every
seed must pass. Run it after any change to a coding exam's text or to its generator, with the course's runtime
(Python 3.12, pandas 2.2):

```bash
uv venv --python 3.12 .venv-exam && uv pip install --python .venv-exam "pandas==2.2.3"
npx tsx scripts/exam-check/export.mts modules/pandas-select-rows 40 > exam-cases.json
.venv-exam/Scripts/python -I scripts/exam-check/check.py exam-cases.json   # .venv-exam/bin/python on macOS/Linux
```

These scripts live outside `modules/`, so learners can't download them. The walkthrough steps and twist solutions they
run are the ones learners see after submitting.
