#!/bin/sh
# The persona sweep: every item (groups A to J) under each persona, on one side.
#   sh V2/bench/mcp/personas.sh old|new dry|real [tag] [extra run.mjs flags...]
# old = the hosted MCP at mcp.magichour.ai; new = a local build (start it first, in the MCP repo:
#   .venv/bin/uvicorn mcp_magichour.server:app --port 8770; PORT=8770 below). dry = nothing is made (0 credits).
# real = paid: pass --item-cap and --cap explicitly as extra flags; the run.mjs defaults (400 per item, 3000 per run) apply otherwise.
# Environment: PERSONAS (default "happy stupid dumper", see SWEEP in personas.mjs), PORT (default 8765), CONC (default 4),
# ONLY (item ids, comma separated, for a pilot), THOUGHTS (default on: reasoning summaries kept in the trace; 0 to switch off).
# Results: V2/bench/v1/results/<tag>-<mode>-<side>-<persona>/ ; sessions: V2/sessions/mcp-<tag>-<mode>-<o|n>-<persona>-<id>/
# Each result folder holds <id>.json (the record), <id>.trace.json (every hop, call and prompt), tools.json, run.json.
cd "$(dirname "$0")/../../.." || exit 1
SIDE=$1; MODE=$2; TAG=${3:-p2}; if [ $# -ge 3 ]; then shift 3; else shift $#; fi
PERSONAS=${PERSONAS:-"happy stupid dumper"}; PORT=${PORT:-8765}; CONC=${CONC:-4}
[ "$MODE" = dry ] && DRYFLAG="--dry" || DRYFLAG=""
[ "$SIDE" = new ] && SIDEFLAGS="--local --mcp-url http://127.0.0.1:$PORT/" || SIDEFLAGS=""
[ "${THOUGHTS:-1}" = 0 ] && TFLAG="" || TFLAG="--thoughts"
[ -n "$ONLY" ] && ONLYFLAG="--only $ONLY" || ONLYFLAG=""
for P in $PERSONAS; do
  OUT=V2/bench/v1/results/$TAG-$MODE-$SIDE-$P
  echo "=== $SIDE $MODE $P $(date +%H:%M:%S) -> $OUT"
  node V2/bench/mcp/run.mjs $DRYFLAG $TFLAG $ONLYFLAG --persona $P --groups A,B,C,D,E,F,G,H,I,J $SIDEFLAGS --out $OUT --prefix $TAG-$MODE-$(printf %.1s $SIDE)-$P --concurrency $CONC "$@"
done
echo "SWEEP-$SIDE-$MODE-DONE $(date +%H:%M:%S)"
