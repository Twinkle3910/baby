#!/usr/bin/env bash
# Simulate one week of nanny paper logs → parent digitization → export.
set -euo pipefail
BASE="${BASE_URL:-http://localhost:8787}"

BOOT=$(curl -s "$BASE/api/bootstrap")
BABY=$(python3 -c "import json,sys; print(json.load(sys.stdin)['babies'][0]['id'])" <<<"$BOOT")
NANNY=$(python3 -c "import json,sys; d=json.load(sys.stdin); print(next(c['id'] for c in d['carers'] if c['role']=='nanny'))" <<<"$BOOT")

echo "Field trial baby=$BABY"
PASS=0
FAIL=0

for i in 0 1 2 3 4 5 6; do
  DAY=$(python3 -c "from datetime import date,timedelta; print((date.today()-timedelta(days=6-$i)).isoformat())")
  TEXT=$(cat <<EOF
06:30 左12 右10 尿
09:20 90ml
12:10 左8 右8 便
14:00-15:15 小睡
18:40 110ml 尿
21:10 左10 右12
EOF
)
  SCAN=$(curl -s -X POST "$BASE/api/paper/scan" \
    -F "babyId=$BABY" \
    -F "sheetDate=$DAY" \
    -F "pastedText=$TEXT")
  SCAN_ID=$(python3 -c "import json,sys; print(json.load(sys.stdin)['scan']['id'])" <<<"$SCAN")
  DRAFT_N=$(python3 -c "import json,sys; print(len(json.load(sys.stdin)['scan']['drafts']))" <<<"$SCAN")
  CONF=$(curl -s -X POST "$BASE/api/paper/scans/$SCAN_ID/confirm" \
    -H 'Content-Type: application/json' \
    -d "{\"carerId\":\"$NANNY\"}")
  CREATED=$(python3 -c "import json,sys; print(json.load(sys.stdin).get('createdCount',0))" <<<"$CONF")
  if [[ "$DRAFT_N" -ge 5 && "$CREATED" -ge 5 ]]; then
    echo "OK $DAY drafts=$DRAFT_N created=$CREATED"
    PASS=$((PASS+1))
  else
    echo "FAIL $DAY drafts=$DRAFT_N created=$CREATED"
    FAIL=$((FAIL+1))
  fi
done

curl -s -o /tmp/field-week.pdf "$BASE/api/export/pdf?babyId=$BABY&mode=week&date=$(date +%F)"
SIZE=$(wc -c </tmp/field-week.pdf)
echo "Week PDF bytes=$SIZE"
echo "PASS=$PASS FAIL=$FAIL"
[[ "$FAIL" -eq 0 ]]
