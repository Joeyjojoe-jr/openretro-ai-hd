import matplotlib.pyplot as plt
from collections import Counter

def show_tag_heatmap(memory):
    tag_counter = Counter()
    for meta in memory.values():
        tag_counter.update(meta.get("tags", []))

    if tag_counter:
        st.sidebar.markdown("### Tag Frequency")
        fig, ax = plt.subplots()
        tags, counts = zip(*tag_counter.most_common(15))
        ax.barh(tags, counts)
        ax.invert_yaxis()
        ax.set_xlabel("Count")
        ax.set_title("Top Tags")
        st.sidebar.pyplot(fig)

import streamlit as st
import os
import json

from PIL import Image

def asset_memory_dashboard(memory_path="downloads/asset_memory.json"):
    st.title("Asset Memory Dashboard")

    if not os.path.exists(memory_path):
        st.warning("No asset memory found yet. Run a scrape first.")
        return

    with open(memory_path, "r") as f:
        memory = json.load(f)

    st.markdown(f"**Total Unique Assets:** {len(memory)}")
    show_tag_heatmap(memory)

    # Filters
    show_verified = st.checkbox("Show Verified", value=True)
    show_unverified = st.checkbox("Show Unverified", value=True)
    search_text = st.text_input("Search by filename or tags", "")

    for key, meta in memory.items():
        filename = meta.get("filename", "")
        tags = ", ".join(meta.get("tags", []))
        verified = meta.get("verified", None)

        # Filter logic
        if verified and not show_verified:
            continue
        if verified is False and not show_unverified:
            continue
        if search_text.lower() not in filename.lower() and search_text.lower() not in tags.lower():
            continue

        with st.expander(filename):
            st.markdown(f"**Source URL:** {meta.get('source_url')}")
            st.markdown(f"**Filetype:** {meta.get('filetype')}")
            st.markdown(f"**Downloaded At:** {meta.get('downloaded_at')}")
            st.markdown(f"**Tags:** {tags}")
            st.markdown(f"**Verified:** {verified}")
            st.markdown(f"**License Score:** {meta.get('license_score', 'N/A')}")
            st.markdown(f"**Enhanced At:** {meta.get('enhanced_at', 'Not yet')}")
            st.markdown(f"**Enhancement Method:** {meta.get('enhancement_method', '-')}")
            st.markdown(f"**Quality Score:** {meta.get('quality_score', '-')}")
            
            orig_path = os.path.join("downloads", filename)
            enhanced_path = os.path.join("downloads", "enhanced", filename)

            if os.path.exists(orig_path):
                st.image(orig_path, caption="Original", width=256)
            if os.path.exists(enhanced_path):
                st.image(enhanced_path, caption="Enhanced", width=256)
