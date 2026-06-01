#!/usr/bin/env bash
# Claude Code status line — multi-line with colored progress bars
# Shows: context window, 5-hour limit, 7-day limit with visual bars
# Colors: cyan (<50%), yellow (50-79%), red (>=80%)
# Includes peak hours indicator (weekdays 13:00-19:00 UTC)

input=$(cat)

# --- helpers ---
make_bar() {
  local pct=$1 col=$2
  local width=15
  local filled=$(( (pct * width + 50) / 100 ))
  [ $filled -gt $width ] && filled=$width
  local empty=$(( width - filled ))
  local bar=""
  local i=0
  # filled portion: bright colored ━
  while [ $i -lt $filled ]; do bar="${bar}━"; i=$(( i + 1 )); done
  # switch to dark gray for empty portion
  bar="${bar}\033[38;5;240m"
  while [ $i -lt $width ]; do bar="${bar}─"; i=$(( i + 1 )); done
  printf "%s" "${col}${bar}"
}

color_for_pct() {
  local pct=$1
  if   [ "$pct" -ge 80 ]; then printf "\033[1;31m"       # bold red
  elif [ "$pct" -ge 50 ]; then printf "\033[1;33m"       # bold yellow
  else                         printf "\033[1;36m"       # bold cyan
  fi
}

RESET="\033[0m"
DIM="\033[2m"
BOLD="\033[1m"
WHITE="\033[1;37m"
GRAY="\033[38;5;245m"
RED="\033[1;31m"
GREEN="\033[1;32m"

# --- peak hours check (weekdays 13:00-19:00 UTC) ---
is_peak() {
  local dow=$(date -u '+%u')  # 1=Mon .. 7=Sun
  local hour=$(date -u '+%H')
  hour=${hour#0}  # strip leading zero
  if [ "$dow" -le 5 ] && [ "$hour" -ge 13 ] && [ "$hour" -lt 19 ]; then
    return 0
  fi
  return 1
}

# --- extract fields ---
used_pct=$(   echo "$input" | jq -r '.context_window.used_percentage        // empty')
ctx_size=$(   echo "$input" | jq -r '.context_window.context_window_size    // empty')
five_pct=$(   echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
five_reset=$( echo "$input" | jq -r '.rate_limits.five_hour.resets_at       // empty')
week_pct=$(   echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
week_reset=$( echo "$input" | jq -r '.rate_limits.seven_day.resets_at       // empty')

lines=()

# --- context window line ---
if [ -n "$used_pct" ] && [ -n "$ctx_size" ]; then
  pct_int=$(printf "%.0f" "$used_pct")
  ctx_k=$(( ctx_size / 1000 ))
  col=$(color_for_pct "$pct_int")
  bar=$(make_bar "$pct_int" "$col")
  lines+=("$(printf "${GRAY}Context  ${RESET}${bar}${RESET}  ${WHITE}%d%%${RESET} ${GRAY}of %sk${RESET}" "$pct_int" "$ctx_k")")
fi

# --- 5-hour limit line ---
if [ -n "$five_pct" ]; then
  pct_int=$(printf "%.0f" "$five_pct")
  col=$(color_for_pct "$pct_int")
  bar=$(make_bar "$pct_int" "$col")
  reset_str=""
  if [ -n "$five_reset" ]; then
    reset_str="$(printf " ${GRAY}resets${RESET} ${WHITE}%s${RESET}" "$(date -r "$five_reset" '+%H:%M')")"
  fi
  peak_tag=""
  if is_peak; then
    peak_tag="$(printf " ${RED}▲ peak${RESET}")"
  else
    peak_tag="$(printf " ${GREEN}▽ off-peak${RESET}")"
  fi
  lines+=("$(printf "${GRAY}5h limit ${RESET}${bar}${RESET}  ${WHITE}%d%%${RESET}%b%b" "$pct_int" "$reset_str" "$peak_tag")")
fi

# --- 7-day limit line ---
if [ -n "$week_pct" ]; then
  pct_int=$(printf "%.0f" "$week_pct")
  col=$(color_for_pct "$pct_int")
  bar=$(make_bar "$pct_int" "$col")
  reset_str=""
  if [ -n "$week_reset" ]; then
    reset_str="$(printf " ${GRAY}resets${RESET} ${WHITE}%s${RESET}" "$(date -r "$week_reset" '+%b %d %H:%M')")"
  fi
  lines+=("$(printf "${GRAY}7d limit ${RESET}${bar}${RESET}  ${WHITE}%d%%${RESET}%b" "$pct_int" "$reset_str")")
fi

# --- output ---
for line in "${lines[@]}"; do
  printf "%b\n" "$line"
done
