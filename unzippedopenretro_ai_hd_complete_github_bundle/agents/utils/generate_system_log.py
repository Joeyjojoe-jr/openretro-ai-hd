import json
from datetime import datetime
import os

def generate_system_log(memory_path="downloads/asset_memory.json", log_path="system_log.md"):
    if not os.path.exists(memory_path):
        print("No asset memory found.")
        return

    with open(memory_path, "r") as f:
        memory = json.load(f)

    verified = sum(1 for m in memory.values() if m.get("verified") is True)
    unverified = sum(1 for m in memory.values() if m.get("verified") is False)
    enhanced = sum(1 for m in memory.values() if "enhanced_at" in m)
    tagged = sum(1 for m in memory.values() if m.get("tags"))

    with open(log_path, "w") as f:
        f.write("# OpenRetro AI-HD System Log\n")
        f.write(f"Generated: {datetime.utcnow().isoformat()} UTC\n\n")
        f.write(f"**Total Assets**: {len(memory)}\n")
        f.write(f"**Verified**: {verified}\n")
        f.write(f"**Unverified**: {unverified}\n")
        f.write(f"**Enhanced**: {enhanced}\n")
        f.write(f"**Tagged**: {tagged}\n\n")
        f.write("## Sample Entries:\n\n")

        for m in list(memory.values())[:10]:
            f.write(f"- {m.get('filename')}\n")
            f.write(f"  - Verified: {m.get('verified')}\n")
            f.write(f"  - Enhanced At: {m.get('enhanced_at', 'N/A')}\n")
            f.write(f"  - Tags: {', '.join(m.get('tags', []))}\n\n")
