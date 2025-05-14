import streamlit as st
from ui.agent_control_console import agent_control_console

st.set_page_config(page_title="OpenRetro AI-HD Orchestrated", layout="wide")

st.title("OpenRetro AI-HD: Orchestrated Agent Suite")
st.markdown("""
This application uses modular agents to:
- Scrape legal game assets
- Verify licenses
- Enhance textures
- Train and validate asset packs

Built for experimentation, automation, and explainability.
""")

agent_control_console()
