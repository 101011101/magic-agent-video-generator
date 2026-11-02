#!/bin/sh
# Drives one bench film brief through the pipeline on the free tier for the benchmark: the brief from the item file,
# the gates' stops handled the way the user did by hand (first stop: --retry the flagged ids; a stop after that:
# --accept them), at most twelve passes (a stills stage on the free model can stop several times). The log keeps every pass. Usage: sh V2/bench/mcp/film/drive.sh I46a bench-I46a ["--clips direct --model ltx-2.5"] ["--clips direct --model ltx-2.5"]
ID="$1"; LABEL="$2"; FLAGS="$3"; cd "$(cd "$(dirname "$0")" && pwd)/../../../.." || exit 1   # the repo root, four levels up from film/
ITEM="V2/bench/mcp/film/items/$ID.json"; [ -f "$ITEM" ] || ITEM="V2/bench/v1/items/$ID.json"
BRIEF="$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).turns[0].text' "$ITEM")"
SECS="$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).spec.seconds || ""' "$ITEM")"; TOTAL=""; [ -n "$SECS" ] && TOTAL="--total $SECS"   # the brief's length; the pipeline defaults to 30 s
LOG="V2/bench/mcp/film/$LABEL.log"; EXTRA=""; RETRIED=""   # FLAGS: extra pipeline flags, e.g. "--clips direct --model ltx-2.5"
pass=0; while [ "$pass" -lt 12 ]; do pass=$((pass + 1))
  echo "== pass $pass $EXTRA" >> "$LOG"
  CLEANED_CAP=100000 node V2/backend/composer/pipeline.mjs --brief "$BRIEF" --label "$LABEL" --tier free --until film $TOTAL $FLAGS $EXTRA >> "$LOG" 2>&1; CODE=$?
  echo "exit $CODE" >> "$LOG"
  [ "$CODE" = 0 ] && { echo "$LABEL: film done after $pass pass(es)"; exit 0; }
  STOP="$(grep -E -- "--accept" "$LOG" | tail -1)"; IDS="$(printf "%s" "$STOP" | grep -o -- "--accept [A-Za-z0-9,_-]*" | sed "s/--accept //")"; [ -z "$IDS" ] && IDS="$(printf "%s" "$STOP" | grep -o "([A-Za-z0-9,_ -]*)$" | tr -d "() ")"   # sheets say "--accept root-a,root-b"; stills say "--accept <ids> (s1-1, s1-2)"
  [ -z "$IDS" ] && { echo "$LABEL: stopped (exit $CODE) with nothing to accept; see $LOG"; exit "$CODE"; }
  case " $RETRIED " in *" $IDS "*) EXTRA="--accept $IDS";; *) EXTRA="--retry $IDS"; RETRIED="$RETRIED $IDS";; esac
done
echo "$LABEL: still stopping after 12 passes; see $LOG"; exit 1
