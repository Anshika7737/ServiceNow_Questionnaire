import json
import subprocess
import sys

pdf = "/Users/shivambhardwaj/Downloads/CIS - cmdb data foundation 2_174ea43c-d6ba-4942-841f-315016937668 1.pdf"
py = "python-extractor/.venv/bin/python"
script = "python-extractor/extract_pdf.py"

proc = subprocess.run([py, script, pdf], capture_output=True, text=True, timeout=600)
stdout = proc.stdout.strip().split("\n")[-1]
data = json.loads(stdout)
print(f"Questions: {len(data['questions'])}")
for i, q in enumerate(data["questions"]):
    if "attribute" in q["text"].lower() or i in (43, 44, 45):
        print(f"\n--- Q{i+1} ---")
        print("Text:", q["text"][:200])
        print("Options:", q["options"])
        print("Answer:", q["correctAnswer"])
