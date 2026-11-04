"""Classify abandoned process instances by the step they are stuck at; rewrites the CSV with a category column."""
import collections
import csv
import json
import re
import unicodedata
from pathlib import Path

HERE = Path(__file__).parent
CSV_PATH = HERE / "abandoned-instances.csv"

DRAFT = re.compile(r"^(create|tạo|pic tạo|qa issuer create)", re.I)
FINAL = re.compile(r"(confirm status|requester confirm|xác nhận kết quả|input return|input .*result|review .*result|phê duyệt kết quả|receive .*result)", re.I)
NAMES = {
    "A": "Nháp chưa gửi (dừng ở bước tạo)",
    "B": "Chờ xác nhận / nhập kết quả cuối",
    "C": "Không còn task mở (trạng thái lỗi)",
    "D": "Dừng giữa quy trình (chờ phê duyệt/xử lý)",
}


def classify(steps: str) -> str:
    if not steps:
        return "C"
    first = unicodedata.normalize("NFC", steps.split(" | ")[0])
    if DRAFT.search(first):
        return "A"
    if FINAL.search(first):
        return "B"
    return "D"


rows = list(csv.DictReader(CSV_PATH.open(encoding="utf-8-sig")))
for r in rows:
    r["category"] = "(sub-process của hồ sơ gốc)" if r["parent_inst_id"] else f"{classify(r['current_steps'])}. {NAMES[classify(r['current_steps'])]}"
with CSV_PATH.open("w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)

top = [r for r in rows if not r["parent_inst_id"]]
per = collections.defaultdict(collections.Counter)
for r in top:
    per[r["process_key"]][classify(r["current_steps"])] += 1
result = {
    "total": collections.Counter(classify(r["current_steps"]) for r in top),
    "per_process": {k: dict(v) for k, v in sorted(per.items(), key=lambda kv: -sum(kv[1].values()))},
}
(HERE / "abandoned-categories.json").write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
print(json.dumps(result, ensure_ascii=False))
