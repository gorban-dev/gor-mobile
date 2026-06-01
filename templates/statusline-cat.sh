#!/usr/bin/env bash
# Claude Code status line — cat follows context bar with emotions
# Uses Braille Blank (U+2800) for padding — survives JS .trim()

input=$(cat)

# ---- ANSI colors (real ESC bytes) ----
RST=$'\033[0m'
YEL=$'\033[1;33m'
CYN=$'\033[1;36m'
GRN=$'\033[1;32m'
RED=$'\033[1;31m'
WHT=$'\033[1;37m'
GRY=$'\033[38;5;245m'
DRK=$'\033[38;5;240m'

# Braille Blank U+2800 — looks like space but not trimmed by JS .trim()
BB=$'\xe2\xa0\x80'

# ---- helpers ----
make_bar() {
  local pct=$1 width=$2
  local filled=$(( (pct * width + 50) / 100 ))
  [ "$filled" -gt "$width" ] && filled=$width
  [ "$filled" -lt 0 ] && filled=0
  # ensure at least 1 filled when pct > 0
  [ "$pct" -gt 0 ] && [ "$filled" -eq 0 ] && filled=1
  local empty=$(( width - filled ))
  local bar_filled="" bar_empty="" i
  for (( i=0; i<filled; i++ )); do bar_filled="${bar_filled}▬"; done
  for (( i=0; i<empty;  i++ )); do bar_empty="${bar_empty}▬"; done
  printf '%s' "${CYN}${bar_filled}${DRK}${bar_empty}${RST}"
}

color_for_pct() {
  local pct=$1
  if   [ "$pct" -ge 75 ]; then printf '%s' "${RED}"
  elif [ "$pct" -ge 50 ]; then printf '%s' "${YEL}"
  else                          printf '%s' "${GRN}"
  fi
}

# Peak hours: Mon-Fri 13:00-19:00 UTC
is_peak() {
  local dow=$(date -u '+%u')
  local hour=$(date -u '+%H')
  hour=${hour#0}
  if [ "$dow" -le 5 ] && [ "$hour" -ge 13 ] && [ "$hour" -lt 19 ]; then
    return 0
  fi
  return 1
}

# Padding with Braille Blank instead of spaces
make_pad() {
  local n=$1 pad=""
  [ "$n" -lt 0 ] && n=0
  for (( i=0; i<n; i++ )); do pad="${pad}${BB}"; done
  printf '%s' "$pad"
}

# ---- extract fields ----
used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // 0')
ctx_size=$(echo "$input" | jq -r '.context_window.context_window_size // 0')
five_pct=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // 0')
five_reset=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
week_pct=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // 0')
week_reset=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')
model_name=$(echo "$input" | jq -r '.model.display_name // empty')
model_raw=$(echo "$input" | jq -r '.model.id // empty')

# ---- integers ----
used_int=$(printf '%.0f' "$used_pct" 2>/dev/null || echo 0)
five_int=$(printf '%.0f' "$five_pct" 2>/dev/null || echo 0)
week_int=$(printf '%.0f' "$week_pct" 2>/dev/null || echo 0)

# ---- model display name ----
if [ -z "$model_name" ] && [ -n "$model_raw" ]; then
  model_name=$(echo "$model_raw" | sed 's/claude-//;s/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2); print}')
fi
[ -z "$model_name" ] && model_name="Claude"

# ---- context window size label ----
ctx_label=""
if [ "$ctx_size" -ge 900000 ] 2>/dev/null; then
  ctx_label="1M"
elif [ "$ctx_size" -gt 0 ] 2>/dev/null; then
  ctx_label="$(( ctx_size / 1000 ))k"
fi

# ---- cat emotion ----
if   [ "$used_int" -lt 15 ]; then
  cat_face='( ^.^ )'
  cat_extra=''
elif [ "$used_int" -lt 35 ]; then
  cat_face='( -.- )'
  cat_extra="${GRY}zZz${RST}"
elif [ "$used_int" -lt 55 ]; then
  cat_face='( o.o )'
  cat_extra=''
elif [ "$used_int" -lt 75 ]; then
  cat_face='( >.< )'
  cat_extra="${RED}!${RST}"
elif [ "$used_int" -lt 90 ]; then
  cat_face='( @.@ )'
  cat_extra="${RED}!!${RST}"
else
  cat_face='( x_x )'
  cat_extra="${RED}!!!${RST}"
fi

# ---- cat position (follows context bar fill) ----
bar_width=25
prefix_text="${model_name}"
[ -n "$ctx_label" ] && prefix_text="${prefix_text} (${ctx_label})"
prefix_text="${prefix_text} "
prefix_len=${#prefix_text}

filled=$(( (used_int * bar_width + 50) / 100 ))
[ "$filled" -gt "$bar_width" ] && filled=$bar_width
[ "$filled" -lt 0 ] && filled=0
[ "$used_int" -gt 0 ] && [ "$filled" -eq 0 ] && filled=1

# ears 5 chars, face 7 chars — center ears over face (+1)
face_offset=$(( prefix_len + filled ))
ears_offset=$(( face_offset + 1 ))

ears_pad=$(make_pad "$ears_offset")
face_pad=$(make_pad "$face_offset")

# ---- context bar ----
ctx_col=$(color_for_pct "$used_int")
ctx_bar=$(make_bar "$used_int" "$bar_width")

# ---- rate limit reset times ----
five_reset_str=""
if [ -n "$five_reset" ] && [ "$five_reset" != "null" ]; then
  five_reset_str="${GRY}$(date -r "$five_reset" '+%H:%M' 2>/dev/null)${RST}"
fi
week_reset_str=""
if [ -n "$week_reset" ] && [ "$week_reset" != "null" ]; then
  week_reset_str="${GRY}$(date -r "$week_reset" '+%b %d' 2>/dev/null)${RST}"
fi

# ---- peak / off-peak tag ----
if is_peak; then
  peak_tag="${RED}▲ peak${RST}"
else
  peak_tag="${GRN}▽ off-peak${RST}"
fi

# ---- 5h and 7d bars (width 7) ----
five_bar=$(make_bar "$five_int" 7)
five_col=$(color_for_pct "$five_int")
week_bar=$(make_bar "$week_int" 7)
week_col=$(color_for_pct "$week_int")

# ---- session duration ----
session_duration=""
transcript=$(echo "$input" | jq -r '.transcript_path // empty')
if [ -n "$transcript" ] && [ -f "$transcript" ]; then
  start_epoch=$(stat -f '%B' "$transcript" 2>/dev/null || stat -c '%W' "$transcript" 2>/dev/null)
  if [ -n "$start_epoch" ] && [ "$start_epoch" -gt 0 ] 2>/dev/null; then
    elapsed=$(( $(date +%s) - start_epoch ))
    h=$(( elapsed / 3600 ))
    m=$(( (elapsed % 3600) / 60 ))
    [ $h -gt 0 ] && session_duration="${h}h${m}m" || session_duration="${m}m"
  fi
fi

# ============================================================
# OUTPUT
# ============================================================

# Line 1: cat ears (Braille Blank padding survives .trim())
printf '%s%s/\\_/\\%s\n' "$ears_pad" "$YEL" "$RST"

# Line 2: cat face
printf '%s%s%s%s%s\n' "$face_pad" "$YEL" "$cat_face" "$RST" "$cat_extra"

# Line 3: model (ctx) + bar + pct%
ctx_label_str=""
[ -n "$ctx_label" ] && ctx_label_str=" ${GRY}(${ctx_label})${RST}"
printf '%s%s%s%s %s %s%s%%%s\n' "$WHT" "$model_name" "$RST" "$ctx_label_str" "$ctx_bar" "$ctx_col" "$used_int" "$RST"

# Line 4: 5h | 7d | session
line4="${GRY}5h${RST} ${five_bar} ${five_col}${five_int}%${RST}"
[ -n "$five_reset_str" ] && line4="${line4} ${five_reset_str}"
line4="${line4} ${peak_tag}"
line4="${line4}  ${GRY}|${RST}  ${GRY}7d${RST} ${week_bar} ${week_col}${week_int}%${RST}"
[ -n "$week_reset_str" ] && line4="${line4} ${week_reset_str}"
[ -n "$session_duration" ] && line4="${line4}  ${GRY}|${RST}  ${GRY}⏱ session ${session_duration}${RST}"
printf '%s\n' "$line4"