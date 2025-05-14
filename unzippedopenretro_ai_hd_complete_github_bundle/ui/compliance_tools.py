
import streamlit as st
from pathlib import Path
import json
from datetime import datetime

LICENSES_DIR = Path(__file__).parent.parent.parent / "assets-free" / "licenses"
REPORTS_DIR = Path(__file__).parent.parent.parent / "compliance-reports"
REPORTS_DIR.mkdir(exist_ok=True)

def generate_compliance_report():
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    report_path = REPORTS_DIR / f"report_{timestamp}.md"
    summary = []
    red, yellow, green = 0, 0, 0

    for file in LICENSES_DIR.glob("*.json"):
        with open(file) as f:
            data = json.load(f)
            flag = data.get("flag", "unreviewed")
            summary.append((file.name, data.get("title", "Unknown"), flag))
            if flag == "red":
                red += 1
            elif flag == "yellow":
                yellow += 1
            elif flag == "green":
                green += 1

    with open(report_path, "w") as f:
        f.write("# Weekly Compliance Report\n")
        f.write(f"Generated: {timestamp}\n\n")
        f.write(f"**Red Flags:** {red}\n")
        f.write(f"**Yellow Flags:** {yellow}\n")
        f.write(f"**Green Flags:** {green}\n")
        f.write(f"**Total Reviewed:** {red + yellow + green}\n\n")

        f.write("## Asset Breakdown\n")
        for name, title, flag in summary:
            f.write(f"- **{title}** ({name}) — `{flag}`\n")

    return report_path

def compliance_tools():
    st.subheader("Compliance Tools")

    if st.button("Generate Weekly Compliance Report"):
        report_path = generate_compliance_report()
        st.success(f"Report saved to {report_path.name}")
        with open(report_path, "r") as f:
            st.code(f.read(), language="markdown")
