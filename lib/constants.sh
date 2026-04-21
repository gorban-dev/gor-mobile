#!/usr/bin/env bash
# Shared constants for gor-mobile CLI.

GOR_MOBILE_VERSION="0.1.0"
GOR_MOBILE_NAME="gor-mobile"

# Install layout (on user's machine).
GOR_MOBILE_HOME="${GOR_MOBILE_HOME:-$HOME/.gor-mobile}"
GOR_MOBILE_RULES_DIR="$GOR_MOBILE_HOME/rules"
GOR_MOBILE_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/gor-mobile"
GOR_MOBILE_CONFIG="$GOR_MOBILE_CONFIG_DIR/config.json"
GOR_MOBILE_SECRETS="$GOR_MOBILE_CONFIG_DIR/secrets.env"

# Claude Code integration targets.
CLAUDE_DIR="$HOME/.claude"
CLAUDE_SETTINGS="$CLAUDE_DIR/settings.json"
CLAUDE_CLAUDE_MD="$CLAUDE_DIR/CLAUDE.md"
CLAUDE_MCP="$CLAUDE_DIR/mcp.json"
CLAUDE_COMMANDS_DIR="$CLAUDE_DIR/commands"
CLAUDE_AGENTS_DIR="$CLAUDE_DIR/agents"
CLAUDE_SKILLS_DIR="$CLAUDE_DIR/skills"

# Managed-file marker. When present, the file is owned by gor-mobile and can be overwritten.
GOR_MOBILE_MANAGED_MARKER="<!-- gor-mobile: managed — do not edit, run 'gor-mobile repair' -->"
GOR_MOBILE_SECTION_BEGIN="<!-- BEGIN gor-mobile managed section -->"
GOR_MOBILE_SECTION_END="<!-- END gor-mobile managed section -->"

# LM Studio defaults.
LLM_URL="${LLM_URL:-http://127.0.0.1:1234}"
LLM_CONTEXT_LENGTH="${LLM_CONTEXT_LENGTH:-131072}"
LLM_TEMPERATURE="${LLM_TEMPERATURE:-0.1}"
LLM_MAX_TOKENS="${LLM_MAX_TOKENS:-4096}"

# Rules pack defaults.
DEFAULT_RULES_URL="https://github.com/gorban-dev/gor-mobile-rules-default.git"
DEFAULT_RULES_REF="main"

# Default model per role (LM Studio tags).
# Users can override per role in ~/.config/gor-mobile/config.json → .models.<role>
# without touching this file.
MODEL_DEFAULT_IMPL="qwen/qwen3-coder-30b"
MODEL_DEFAULT_REVIEW="gemma-4-26b-a4b-it"
MODEL_DEFAULT_DEEP="gemma-4-31b-it"

# Colors.
if [[ -t 1 ]] && [[ -z "${NO_COLOR:-}" ]]; then
    C_RESET="\033[0m"
    C_BOLD="\033[1m"
    C_DIM="\033[2m"
    C_RED="\033[31m"
    C_GREEN="\033[32m"
    C_YELLOW="\033[33m"
    C_BLUE="\033[34m"
    C_CYAN="\033[36m"
else
    C_RESET="" C_BOLD="" C_DIM="" C_RED="" C_GREEN="" C_YELLOW="" C_BLUE="" C_CYAN=""
fi

log_info()  { printf "${C_CYAN}[info]${C_RESET} %s\n" "$*" >&2; }
log_ok()    { printf "${C_GREEN}[ok]${C_RESET}   %s\n" "$*" >&2; }
log_warn()  { printf "${C_YELLOW}[warn]${C_RESET} %s\n" "$*" >&2; }
log_err()   { printf "${C_RED}[err]${C_RESET}  %s\n" "$*" >&2; }
log_step()  { printf "\n${C_BOLD}${C_BLUE}▸ %s${C_RESET}\n" "$*" >&2; }
