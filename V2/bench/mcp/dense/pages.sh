#!/bin/sh
# Rebuild every dense-benchmark page and the index from the run records. Usage: sh V2/bench/mcp/dense/pages.sh [out dir]
# Default out dir: the Benchmark folder of the MCP repo.
set -e
cd "$(dirname "$0")/../../../.."
B="${1:-/Users/ray/Coding/magic-hour-mcp/Benchmark}"
R=V2/bench/v1/results
P=V2/bench/mcp/dense/page.mjs
NAV=A1,A2,A3,A4,B1,B2
M="current Magic Hour MCP"
node $P --out "$B/A1" --nav $NAV --title "A1 product spot, 15 s · free accounts" $R/mcp-dense-2-A1/A1.json $R/comp-c1-comfy/A1.json $R/comp-c4-replicate/A1.json
# A2: the same brief on our MCP and on the five services that give a new free account video (conditions: Benchmark/README.md)
node $P --out "$B/A2" --nav $NAV --title "A2 invented character · free accounts" $R/mcp-dense-2-A2/A2.json $R/comp-c1-comfy/A2.json $R/comp-c2-replicate/A2.json $R/comp-c1-replicate/A2.json $R/comp-c1-krea/A2.json $R/comp-c1-huggingface/A2.json $R/comp-c1-imagineart/A2.json
node $P --out "$B/A3" --nav $NAV --title "A3 continue this clip · free accounts" $R/mcp-dense-2-A3/A3.json $R/comp-c1-comfy/A3.json $R/comp-c3-replicate/A3.json
node $P --out "$B/A4" --nav $NAV --title "A4 branded explainer · free accounts" $R/mcp-dense-2-A4/A4.json $R/comp-c1-comfy/A4.json $R/comp-c4-replicate/A4.json
# B1: two runs of the same brief; the follow-up message of the second run made nothing new, so only the first message counts
node $P --out "$B/B1" --nav $NAV --title "B1 product spot · $M" --turns 1 $R/mcp-dense-1/B1.json $R/mcp-dense-1b/B1b.json
node $P --out "$B/B2" --nav $NAV --title "B2 fiction short · free accounts" $R/mcp-dense-2-B2/B2.json $R/comp-c1-comfy/B2.json $R/comp-c5-replicate/B2.json
node $P --index "$B" --title "Dense benchmark"
