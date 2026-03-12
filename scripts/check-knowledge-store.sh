#!/usr/bin/env bash
# GreenClaw — Knowledge-store-first pre-commit hook
#
# Uses the Claude CLI to verify that commits touching packages/*/src/ include
# the correct knowledge store updates (docs/, AGENTS.md, QUALITY.md, etc.).
#
# Bypass: SKIP_KNOWLEDGE_CHECK=1 git commit -m "..."

set -euo pipefail

# ── Escape hatch ────────────────────────────────────────────────────
if [ "${SKIP_KNOWLEDGE_CHECK:-0}" = "1" ]; then
  echo "[knowledge-store] Skipped (SKIP_KNOWLEDGE_CHECK=1)"
  exit 0
fi

# ── Gather staged files ────────────────────────────────────────────
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

# ── Check if any packages/*/src/ files are staged ─────────────────
SRC_FILES=$(echo "$STAGED_FILES" | grep '^packages/.*/src/' || true)

if [ -z "$SRC_FILES" ]; then
  # No source code changes — docs/tests/config commits pass freely.
  exit 0
fi

# ── Verify claude CLI is available ─────────────────────────────────
if ! command -v claude &>/dev/null; then
  echo ""
  echo "[knowledge-store] ERROR: claude CLI not found."
  echo "  The knowledge-store-first hook requires the Claude CLI."
  echo "  Install it or bypass with: SKIP_KNOWLEDGE_CHECK=1 git commit ..."
  echo ""
  exit 1
fi

# ── Get the staged diff ───────────────────────────────────────────
STAGED_DIFF=$(git diff --cached)

# ── Build the prompt ──────────────────────────────────────────────
PROMPT=$(cat <<'PROMPT_END'
You are a pre-commit reviewer for the GreenClaw project. Your job is to
verify that commits follow the "knowledge store first" rule.

## Rules (from CLAUDE.md)

Every code change in packages/*/src/ MUST have a corresponding knowledge store update.
The knowledge store includes:
- docs/** (design docs, convention docs, exec plans, QUALITY.md, PRODUCT_SENSE.md)
- packages/*/AGENTS.md (package ownership docs, max 80 lines each)
- AGENTS.md (root)
- CLAUDE.md
- ARCHITECTURE.md
- CONTRIBUTING.md

### What counts as a knowledge store update

| Change type | Required update |
|-------------|----------------|
| New feature | Execution plan + module AGENTS.md |
| Bug fix | Update QUALITY.md (defect log) + test description if new pattern |
| Refactor | ADR if architectural, else update affected AGENTS.md |
| New module | AGENTS.md + QUALITY.md row + CLAUDE.md module map row |
| Config/infra | Update relevant convention doc |

### Exceptions that do NOT require doc updates
- Pure whitespace/formatting changes in packages/*/src/
- Import reordering with no logic change
- Adding/updating type-only exports with no behavior change
- Single-line trivial fixes (typo in a string literal, off-by-one, etc.)

## Your task

Analyze the staged diff below. Determine whether the required knowledge
store files have been updated for the code changes.

Reply with EXACTLY one line starting with either:
- PASS: <short reason> — if the knowledge store is properly updated, or
  if the change is trivial enough to not require a doc update.
- FAIL: <short reason explaining what doc should be updated> — if the
  change requires a knowledge store update that is missing.

Be concise. One line only.

## Staged files
PROMPT_END
)

PROMPT="$PROMPT
$STAGED_FILES

## Staged diff
\`\`\`
$STAGED_DIFF
\`\`\`"

# ── Call Claude CLI ───────────────────────────────────────────────
echo "[knowledge-store] Verifying knowledge store updates with Claude..."

RESPONSE=$(echo "$PROMPT" | claude -p --model haiku 2>&1) || {
  echo ""
  echo "[knowledge-store] ERROR: Claude CLI call failed."
  echo "  Output: $RESPONSE"
  echo "  Fix the issue or bypass with: SKIP_KNOWLEDGE_CHECK=1 git commit ..."
  echo ""
  exit 1
}

# ── Parse response ────────────────────────────────────────────────
# Extract the first line that starts with PASS: or FAIL:
VERDICT=$(echo "$RESPONSE" | grep -E '^(PASS|FAIL):' | head -1)

if echo "$VERDICT" | grep -q '^PASS:'; then
  echo "[knowledge-store] $VERDICT"
  exit 0
elif echo "$VERDICT" | grep -q '^FAIL:'; then
  echo ""
  echo "[knowledge-store] $VERDICT"
  echo ""
  echo "  Update the relevant knowledge store files and stage them,"
  echo "  or bypass with: SKIP_KNOWLEDGE_CHECK=1 git commit ..."
  echo ""
  exit 1
else
  # LLM didn't return a clear verdict — block to be safe.
  echo ""
  echo "[knowledge-store] ERROR: Could not parse LLM verdict."
  echo "  Response: $RESPONSE"
  echo "  Bypass with: SKIP_KNOWLEDGE_CHECK=1 git commit ..."
  echo ""
  exit 1
fi
