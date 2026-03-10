#!/usr/bin/env bash
set -Eeuo pipefail

REMOTE="origin"
BASE="main"
SKIP_GOVERNANCE_CHECKS="false"

usage() {
    cat <<'EOF'
Usage:
  bash ./bin/git-branch-publish.sh start <branch-name> [--remote origin] [--base main]
  bash ./bin/git-branch-publish.sh publish [branch-name] [--remote origin] [--base main] [--skip-governance-checks]

Commands:
  start     Create a dedicated branch from the latest remote base branch.
  publish   Verify the branch is ready, run governance guardrails when needed,
            push the branch to the configured remote, and print the remote diff.

Notes:
  - This workflow never pushes directly to main.
  - Deploy remains a separate, explicit operation.
EOF
}

fail() {
    echo "Error: $*" >&2
    exit 1
}

info() {
    echo "$*"
}

require_cmd() {
    local command_name="$1"
    command -v "$command_name" >/dev/null 2>&1 || fail "Missing required command: $command_name"
}

ensure_clean_worktree() {
    local status_output
    status_output="$(git status --short)"
    if [ -n "$status_output" ]; then
        echo "$status_output" >&2
        fail "Worktree must be clean before starting or publishing a branch."
    fi
}

ensure_git_repo() {
    git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "Run this command inside a git repository."
}

ensure_remote() {
    git remote get-url "$REMOTE" >/dev/null 2>&1 || fail "Remote '$REMOTE' is not configured."
}

fetch_remote() {
    git fetch "$REMOTE" --prune
    git rev-parse --verify "$REMOTE/$BASE" >/dev/null 2>&1 || fail "Base ref '$REMOTE/$BASE' does not exist."
}

local_branch_exists() {
    git show-ref --verify --quiet "refs/heads/$1"
}

remote_branch_exists() {
    git ls-remote --exit-code --heads "$REMOTE" "$1" >/dev/null 2>&1
}

print_changed_files() {
    local file_list="$1"
    printf '%s\n' "$file_list" | sed '/^$/d' | while IFS= read -r file_path; do
        printf ' - %s\n' "$file_path"
    done
}

requires_governance_checks() {
    local changed_files="$1"
    local file_path
    while IFS= read -r file_path; do
        case "$file_path" in
            AGENTS.md|AGENT_BOARD.yaml|AGENT_HANDOFFS.yaml|governance-policy.json|agent-orchestrator.js)
                return 0
                ;;
            .github/workflows/agent-*.yml|bin/agent-*.js|bin/board-legacy-drift-guard.js|bin/resolve-board-revision-conflict.js|bin/validate-agent-governance.php)
                return 0
                ;;
            tests-node/agent-*|tests-node/orchestrator/*)
                return 0
                ;;
        esac
    done <<EOF
$changed_files
EOF
    return 1
}

run_governance_checks() {
    require_cmd node
    require_cmd npm

    info "Governance/orchestration files detected. Running required guardrails..."
    npm run agent:conflicts
    npm run agent:handoffs:lint
    npm run agent:codex-check
}

start_branch() {
    local branch_name="$1"

    [ -n "$branch_name" ] || fail "Branch name is required for 'start'."
    [ "$branch_name" != "$BASE" ] || fail "Refusing to create a dedicated branch named '$BASE'."

    ensure_git_repo
    ensure_remote
    ensure_clean_worktree
    fetch_remote

    local_branch_exists "$branch_name" && fail "Local branch '$branch_name' already exists."
    remote_branch_exists "$branch_name" && fail "Remote branch '$branch_name' already exists on '$REMOTE'."

    git checkout -b "$branch_name" "$REMOTE/$BASE"
    info "Created branch '$branch_name' from '$REMOTE/$BASE'."
    info "Next step: make your changes, commit them, then run:"
    info "  bash ./bin/git-branch-publish.sh publish"
}

publish_branch() {
    local branch_name="$1"
    local current_branch
    local merge_base
    local changed_files

    ensure_git_repo
    ensure_remote
    ensure_clean_worktree
    fetch_remote

    current_branch="$(git rev-parse --abbrev-ref HEAD)"
    if [ -z "$branch_name" ]; then
        branch_name="$current_branch"
    fi

    [ "$branch_name" != "$BASE" ] || fail "Refusing to push directly to '$BASE'. Create or switch to a dedicated branch."

    if [ "$current_branch" != "$branch_name" ]; then
        if local_branch_exists "$branch_name"; then
            git checkout "$branch_name"
        elif remote_branch_exists "$branch_name"; then
            git checkout -b "$branch_name" --track "$REMOTE/$branch_name"
        else
            fail "Branch '$branch_name' does not exist locally or on '$REMOTE'. Start it first with the 'start' command."
        fi
    fi

    current_branch="$(git rev-parse --abbrev-ref HEAD)"
    [ "$current_branch" != "$BASE" ] || fail "Current branch is '$BASE'. Refusing to push without a dedicated branch."

    merge_base="$(git merge-base HEAD "$REMOTE/$BASE")"
    changed_files="$(git diff --name-only "$merge_base" HEAD)"
    [ -n "$changed_files" ] || fail "No committed changes found ahead of '$REMOTE/$BASE'."

    info "Files queued for publication relative to '$REMOTE/$BASE':"
    print_changed_files "$changed_files"

    if requires_governance_checks "$changed_files"; then
        if [ "$SKIP_GOVERNANCE_CHECKS" = "true" ]; then
            info "Skipping governance checks because --skip-governance-checks was provided."
        else
            run_governance_checks
        fi
    fi

    git push -u "$REMOTE" "$current_branch"
    git fetch "$REMOTE" "$current_branch" --quiet

    info "Remote diff confirmed for '$REMOTE/$current_branch' vs '$REMOTE/$BASE':"
    git diff --name-only "$REMOTE/$BASE...$REMOTE/$current_branch"
}

ACTION="${1:-}"
case "$ACTION" in
    start|publish)
        shift
        ;;
    -h|--help|help|"")
        usage
        exit 0
        ;;
    *)
        fail "Unknown command: $ACTION"
        ;;
esac

BRANCH_NAME=""
if [ $# -gt 0 ] && [ "${1#-}" = "$1" ]; then
    BRANCH_NAME="$1"
    shift
fi

while [ $# -gt 0 ]; do
    case "$1" in
        --remote)
            [ $# -ge 2 ] || fail "Missing value for --remote"
            REMOTE="$2"
            shift 2
            ;;
        --base)
            [ $# -ge 2 ] || fail "Missing value for --base"
            BASE="$2"
            shift 2
            ;;
        --skip-governance-checks)
            SKIP_GOVERNANCE_CHECKS="true"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            fail "Unknown option: $1"
            ;;
    esac
done

require_cmd git

case "$ACTION" in
    start)
        start_branch "$BRANCH_NAME"
        ;;
    publish)
        publish_branch "$BRANCH_NAME"
        ;;
esac
