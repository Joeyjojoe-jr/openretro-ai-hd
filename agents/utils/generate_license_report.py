import json
import csv
import os

def generate_license_report(memory_path="downloads/asset_memory.json", output_dir="reports"):
    os.makedirs(output_dir, exist_ok=True)
    report_md = os.path.join(output_dir, "license_report.md")
    report_csv = os.path.join(output_dir, "license_report.csv")

    if not os.path.exists(memory_path):
        print("No asset memory found.")
        return

    with open(memory_path, "r") as f:
        memory = json.load(f)

    # Generate Markdown Report
    with open(report_md, "w") as f_md:
        f_md.write("# License Verification Report\n\n")
        for entry in memory.values():
            f_md.write(f"## {entry.get('filename', 'Unknown')}\n")
            f_md.write(f"- **Source:** {entry.get('source_url')}\n")
            f_md.write(f"- **Verified:** {entry.get('verified', 'N/A')}\n")
            f_md.write(f"- **License Score:** {entry.get('license_score', 'N/A')}\n")
            f_md.write(f"- **Tags:** {', '.join(entry.get('tags', []))}\n\n")

    # Generate CSV Report
    with open(report_csv, "w", newline='') as f_csv:
        writer = csv.DictWriter(f_csv, fieldnames=[
            "filename", "source_url", "verified", "license_score", "filetype", "tags"
        ])
        writer.writeheader()
        for entry in memory.values():
            writer.writerow({
                "filename": entry.get("filename", ""),
                "source_url": entry.get("source_url", ""),
                "verified": entry.get("verified", ""),
                "license_score": entry.get("license_score", ""),
                "filetype": entry.get("filetype", ""),
                "tags": ",".join(entry.get("tags", []))
            })
    print("Reports saved in:", output_dir)
