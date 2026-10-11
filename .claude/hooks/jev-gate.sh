#!/usr/bin/env bash
# PreToolUse hook: Jev decides every tool call, in the main session and in
# every subagent, in two steps.
#
# 1. Tool selection: Jev picks which tool should carry out this step, from
#    the tools the calling agent actually has. If Jev picks a different tool,
#    the call is blocked and Claude is told which tool to use instead.
# 2. Gate: for the tool Jev kept, Jev answers
#      allow -> runs without prompting
#      ask   -> the developer approves or rejects it
#      deny  -> blocked; Claude is told to find another way
#
# If Jev is missing, slow or errors at either step, the hook lets the call
# through to Claude Code's normal permission rules. It never blocks on its own.
# Set JEV_TOOL_SELECTION=off (in settings.json "env") to skip step 1.
# Written for macOS bash 3.2.

input="$(cat)"

tool_name="$(printf '%s' "$input" | jq -r '.tool_name // empty')"

# Calls that are never gated: Jev's own tools (no point asking Jev about
# asking Jev), and tools that only talk to the developer or the task list.
case "$tool_name" in
  ""|mcp__jev__*|AskUserQuestion|TodoWrite|TaskCreate|TaskUpdate|TaskGet|TaskList)
    exit 0
    ;;
esac

command -v jev >/dev/null 2>&1 || exit 0

cwd="$(printf '%s' "$input" | jq -r '.cwd // empty')"
proj="${CLAUDE_PROJECT_DIR:-$cwd}"
caller="$(printf '%s' "$input" | jq -r '.agent_type // "worker"')"
state_dir="$proj/.claude/jev-state"

# Long strings (file contents in Write/Edit) are cut so requests stay small.
tool_input="$(printf '%s' "$input" | jq -c '(.tool_input // {})
  | walk(if type == "string" and length > 1500 then .[0:1500] + " …[truncated]" else . end)')"

scope="."
if [ -f "$state_dir/route.json" ]; then
  scope="$(jq -r '.scope // "."' "$state_dir/route.json" 2>/dev/null)"
  [ -z "$scope" ] && scope="."
fi
if [ "$scope" = "." ]; then
  scope_desc="the whole project_dir"
else
  scope_desc="$proj/$scope"
fi

if [ "$caller" = "worker" ]; then
  caller_desc="worker (main session)"
else
  caller_desc="$caller subagent"
fi

state="$(jq -n \
  --arg tool "$tool_name" \
  --argjson args "$tool_input" \
  --arg project_dir "$proj" \
  --arg active_scope "$scope_desc" \
  --arg caller "$caller_desc" \
  '{tool: $tool, arguments: $args, project_dir: $project_dir, active_scope: $active_scope, caller: $caller}')"

# ===========================================================================
# Step 1: tool selection
# ===========================================================================

# The id Jev sees for the proposed call. Agent calls are told apart by type.
current_id="$tool_name"
if [ "$tool_name" = "Agent" ] || [ "$tool_name" = "Task" ]; then
  sub="$(printf '%s' "$input" | jq -r '.tool_input.subagent_type // empty')"
  case "$sub" in
    researcher|gpt-explorer) current_id="agent-$sub" ;;
    *) current_id="agent-other" ;;
  esac
fi

describe() {
  case "$1" in
    Read)               echo "Read a specific file whose path is already known, or a range of lines in it" ;;
    Grep)               echo "Search file contents for a pattern, symbol or string across the project" ;;
    Glob)               echo "Find files by name or path pattern" ;;
    Edit)               echo "Change part of an existing file" ;;
    Write)              echo "Create a new file, or replace a file's entire contents" ;;
    Bash)               echo "Run a command: tests, builds, linters, git, package managers or a script. Not for reading, searching, creating or editing files" ;;
    WebSearch)          echo "Search the web when the right page is not known yet" ;;
    WebFetch)           echo "Read one specific web page whose URL is already known" ;;
    agent-researcher)   echo "Delegate to the researcher (Haiku 5.5): a question about docs, APIs, error messages or versions outside the repo that needs several lookups" ;;
    agent-gpt-explorer) echo "Delegate to the explorer (GPT-6 Sol): understanding unfamiliar code across many files, tracing a call path or data flow, surveying a folder" ;;
  esac
}

# Tools each agent actually has. Jev only chooses among these.
# (The Opus advisor is a server-side tool, not a subagent, so Jev never sees it.)
case "$caller" in
  worker)       catalog="Read Grep Glob Edit Write Bash WebSearch WebFetch agent-researcher agent-gpt-explorer" ;;
  researcher)   catalog="WebSearch WebFetch Read Grep Glob" ;;
  *)            catalog="" ;;   # gpt-explorer has only Bash; unknown agents: skip selection
esac

# Loop guard: if Jev just redirected this caller to this tool, don't ask again.
skip_selection=""
redirect_file="$state_dir/redirect.json"
if [ -f "$redirect_file" ]; then
  r_to="$(jq -r '.to // empty' "$redirect_file" 2>/dev/null)"
  r_caller="$(jq -r '.caller // empty' "$redirect_file" 2>/dev/null)"
  r_at="$(jq -r '.at // 0' "$redirect_file" 2>/dev/null)"
  now="$(date +%s)"
  if [ "$r_to" = "$current_id" ] && [ "$r_caller" = "$caller" ] && [ $((now - r_at)) -lt 300 ]; then
    skip_selection=1
    rm -f "$redirect_file"
  fi
fi

if [ -n "$catalog" ] && [ -z "$skip_selection" ] && [ "${JEV_TOOL_SELECTION:-on}" != "off" ]; then
  opts=()
  in_catalog=""
  for t in $catalog; do
    opts+=(-o "$t=$(describe "$t")")
    [ "$t" = "$current_id" ] && in_catalog=1
  done
  # A tool outside the catalog (an MCP tool, another agent type) stays
  # available as "current" so Jev can keep it.
  if [ -z "$in_catalog" ]; then
    opts+=(-o "current=Keep the proposed tool ($tool_name) exactly as called")
  fi

  pick="$(printf '%s' "$state" | jev choice \
    --json-state \
    --question 'A coding agent (`caller`) proposes `tool` with `arguments` for its next step. Ignoring safety for now, which tool is the best fit to carry out what this call is trying to do?' \
    "${opts[@]}" \
    --value 2>/dev/null)" || pick=""

  if [ -n "$pick" ] && [ "$pick" != "current" ] && [ "$pick" != "$current_id" ]; then
    valid=""
    for t in $catalog; do [ "$t" = "$pick" ] && valid=1; done
    if [ -n "$valid" ]; then
      case "$pick" in
        agent-*) how="the Agent tool with subagent_type \"${pick#agent-}\" and a standalone brief" ;;
        *)       how="the $pick tool" ;;
      esac
      mkdir -p "$state_dir" 2>/dev/null
      jq -n --arg to "$pick" --arg from "$current_id" --arg caller "$caller" --argjson at "$(date +%s)" \
        '{to: $to, from: $from, caller: $caller, at: $at}' > "$redirect_file" 2>/dev/null
      jq -n --arg msg "Jev selected a different tool for this step: use $how instead of $tool_name. Same goal; adapt the arguments to that tool. Do not retry this $tool_name call." \
        '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $msg}}'
      exit 0
    fi
  fi
fi

# ===========================================================================
# Step 2: allow / ask / deny
# ===========================================================================

decision="$(printf '%s' "$state" | jev choice \
  --json-state \
  --question 'A coding agent (`caller`) working on a task confined to `active_scope` wants to run `tool` with `arguments`. What should happen to this call?' \
  -o 'allow=Routine work that fits the task: reading, listing or searching inside project_dir; creating or editing files inside active_scope; running tests, linters, formatters or builds; git status, diff or log; web searches and fetching documentation pages; spawning the researcher or gpt-explorer agents; running codex exec in read-only mode' \
  -o 'ask=Plausible but the developer should confirm: editing files inside project_dir but outside active_scope; reading files outside project_dir that are not secrets; installing or upgrading dependencies; git commit or creating branches; network requests to unfamiliar hosts; spawning any other kind of agent; anything that does not clearly fit allow or deny' \
  -o 'deny=Harmful, irreversible or clearly out of bounds: deleting or mass-overwriting files beyond what the task needs; writing anywhere outside project_dir; sudo; changing system, shell or global tool configuration; git push --force, rewriting history or deleting branches; publishing, releasing or deploying; reading, printing or sending secrets, keys, tokens or credentials' \
  --value 2>/dev/null)" || exit 0

case "$decision" in
  allow)
    jq -n '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: "Jev: allow"}}'
    ;;
  ask)
    jq -n '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: "Jev wants the developer to confirm this call"}}'
    ;;
  deny)
    jq -n --arg t "$tool_name" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: ("Jev denied this " + $t + " call. Do not retry it or a reworded version. Ask Jev for a different approach, or tell the developer what you were trying to do.")}}'
    ;;
  *)
    exit 0
    ;;
esac
