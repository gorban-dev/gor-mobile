# evals

Measures gor-mobile templates on Claude and Codex: which skill a prompt routes to, and whether the gates (examples-first `Conforms to:`, docs-first, ast-index guard, compose-internals) hold.

    bash evals/probe-isolation.sh                     # once per machine / after setup changes
    node evals/run.mjs --variant base=HEAD --variant cand=. --split train --runs 3
    node evals/report.mjs evals/results/<stamp>/scores.jsonl --base base --cand cand --noise 0.05
    npm run test:evals                                # unit tests for adapters, graders, stats

Protocol (spec: docs/specs/2026-09-29-eval-harness-design.md): run A/A first to size the noise; one template surface per round; keep only when train and test both rise; read train transcripts only.

Runs cost real money: Claude reports `total_cost_usd`, pass `--max-cost-usd` to cap it. Codex usage is logged as tokens.

The gor-mobile CLI calls (setup, init, uninstall) run under a fake HOME (plus JAVA_TOOL_OPTIONS=-Duser.home, since the `android` binary ignores $HOME) inside the variant dir so that `android init` cannot touch the real `~/.claude/skills`; `claude -p` and `codex exec` keep the real HOME for auth. As a result the Developer Knowledge MCP registration and the android-cli stock skill may be absent in eval sessions (same for both variants).