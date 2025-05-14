import streamlit as st
import os
import json

def tag_editor(memory_path="downloads/asset_memory.json"):
    st.title("Manual Tag Editor")

    if not os.path.exists(memory_path):
        st.warning("No asset memory found.")
        return

    with open(memory_path, "r") as f:
        memory = json.load(f)

    filenames = [meta["filename"] for meta in memory.values()]
    selected_file = st.selectbox("Select Asset", filenames)

    for key, meta in memory.items():
        if meta.get("filename") == selected_file:
            current_tags = meta.get("tags", [])
            new_tags = st.text_input("Enter tags (comma-separated)", ", ".join(current_tags))

            if st.button("Save Tags"):
                meta["tags"] = [tag.strip() for tag in new_tags.split(",") if tag.strip()]
                with open(memory_path, "w") as f:
                    json.dump(memory, f, indent=2)
                st.success("Tags updated.")
            break
