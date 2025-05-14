import streamlit as st
from agents.agent_registry import AGENT_REGISTRY

def agent_control_console():
    st.subheader("Agent Control Console")
    st.markdown("Use this interface to run any registered agent.")

    agent_names = list(AGENT_REGISTRY.keys())
    agent_choice = st.selectbox("Select an Agent", agent_names)

    if st.button("Run Selected Agent"):
        agent_class = AGENT_REGISTRY[agent_choice]
        agent_instance = agent_class()
        result = agent_instance.run()

        st.success(f"Agent '{agent_choice}' executed.")
        if isinstance(result, list):
            for entry in result:
                with st.expander(str(entry[0])):
                    if len(entry) > 1 and entry[1] is True:
                        st.success("Success")
                    elif len(entry) > 2:
                        st.error(f"Failed: {entry[2]}")
                    else:
                        st.write(entry)
        elif isinstance(result, dict) or isinstance(result, str):
            st.json(result)
        else:
            st.write(result)
