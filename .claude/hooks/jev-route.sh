#!/usr/bin/env bash
# UserPromptSubmit hook: Jev makes the opening decisions for every prompt.
#   1. Which role leads the task (worker / researcher / explorer / advisor)
#   2. Which top-level folder the task is confined to (its "scope")
# The decisions are injected into Claude's context and saved to
# .claude/jev-state/route.json so jev-gate.sh can enforce the scope.
#
# If Jev is missing or errors, the hook tells Claude to fall back to the
# advisor and never blocks the prompt. Written for macOS bash 3.2.

input="$(cat)"

prompt="$(printf '%s' "$input" | jq -r '(.prompt // "") | .[0:4000]')"
cwd="$(printf '%s' "$input" | jq -r '.cwd // empty')"
proj="${CLAUDE_PROJECT_DIR:-$cwd}"

[ -z "$prompt" ] && exit 0
[ -z "$proj" ] && exit 0

state_dir="$proj/.claude/jev-state"
mkdir -p "$state_dir" 2>/dev/null

emit() {
  jq -n --arg ctx "$1" \
    '{hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: $ctx}}'
}

if ! command -v jev >/dev/null 2>&1; then
  emit "[Jev] unavailable (jev command not found). Consult the advisor for decisions this turn."
  exit 0
fi

# --- Candidate folders (top level of the project, max 25) ------------------
dirs=()
while IFS= read -r d; do
  [ -n "$d" ] && dirs+=("$d")
done < <(cd "$proj" 2>/dev/null && find . -mindepth 1 -maxdepth 1 -type d \
  ! -name '.*' ! -name node_modules ! -name venv ! -name __pycache__ \
  ! -name dist ! -name build ! -name target 2>/dev/null \
  | sed 's|^\./||' | LC_ALL=C sort | head -n 25)

folders_json="$(printf '%s\n' "${dirs[@]:-}" | jq -R . | jq -sc 'map(select(length > 0))')"

state="$(jq -n --arg task "$prompt" --arg project_dir "$proj" --argjson folders "$folders_json" \
  '{task: $task, project_dir: $project_dir, top_level_folders: $folders}')"

# --- Decision 1: who leads --------------------------------------------------
lead="$(printf '%s' "$state" | jev choice \
  --json-state \
  --question 'In a multi-agent coding team, which role should take this task first?' \
  -o 'worker=The task is clear and mostly about writing or changing code the request already points at; the worker can start editing directly' \
  -o 'researcher=The task depends first on facts outside the repository: library or API documentation, an error message, versions, compatibility, or how a third-party tool behaves' \
  -o 'explorer=The task depends first on understanding unfamiliar parts of this codebase: where something is implemented, how pieces connect, or what a folder contains' \
  -o 'advisor=The task is ambiguous, high-risk, architectural, spans many files, or asks for a judgment call; the worker should consult the Opus advisor on a plan before any work starts' \
  --value 2>/dev/null)" || lead=""

case "$lead" in
  worker|researcher|explorer|advisor) ;;
  *) lead="" ;;
esac

# --- Decision 2: which folder -----------------------------------------------
scope="."
scope_note="whole project (only one top-level folder or none)"
if [ "${#dirs[@]}" -ge 2 ]; then
  opts=(-o 'root=The project as a whole: the task spans several folders, touches root-level files, or does not point at any particular folder')
  i=0
  for d in "${dirs[@]}"; do
    i=$((i + 1))
    opts+=(-o "f$i=Only the $d/ folder")
  done

  pick="$(printf '%s' "$state" | jev choice \
    --json-state \
    --question 'Which folder of project_dir should this task be confined to?' \
    "${opts[@]}" \
    --value 2>/dev/null)" || pick=""

  case "$pick" in
    f[0-9]*)
      n="${pick#f}"
      case "$n" in
        ''|*[!0-9]*) n=0 ;;
      esac
      if [ "$n" -ge 1 ] && [ "$n" -le "${#dirs[@]}" ]; then
        scope="${dirs[$((n - 1))]}"
        scope_note="$scope/"
      else
        scope_note="whole project (Jev returned an unknown folder)"
      fi
      ;;
    root)
      scope_note="whole project"
      ;;
    *)
      scope_note="whole project (Jev did not pick a folder)"
      ;;
  esac
fi

# --- Save and report --------------------------------------------------------
jq -n --arg lead "$lead" --arg scope "$scope" --arg project_dir "$proj" \
  '{lead: $lead, scope: $scope, project_dir: $project_dir}' \
  > "$state_dir/route.json" 2>/dev/null

if [ -z "$lead" ]; then
  emit "[Jev] lead: undecided (Jev did not answer; ask the advisor which role should start) · scope: $scope_note"
else
  emit "[Jev] lead: $lead · scope: $scope_note"
fi
