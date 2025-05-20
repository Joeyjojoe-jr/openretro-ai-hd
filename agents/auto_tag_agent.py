from agents.base_agent import BaseAgent
from agents.agent_registry import register_agent
from agents.utils.asset_memory import AssetMemory
import logging

@register_agent("Auto-Tag Agent")
class AutoTagAgent(BaseAgent):
    def run(self):
        memory = AssetMemory("downloads/asset_memory.json")

        if not memory.memory:
            logging.warning("No memory entries found to tag.")
            return ["No assets available for auto-tagging."]

        for entry in memory.memory.values():
            tags = set(tag.lower() for tag in entry.get("tags", []))  # Normalize existing tags
            filename = entry.get("filename", "").lower()
            filetype = entry.get("filetype", "").lower().lstrip(".")

            # Rule-based tag logic
            if "sprite" in filename:
                tags.add("sprite")
            if "goblin" in filename:
                tags.add("goblin")
            if filetype == "png":
                tags.add("png")
            if filetype in {"jpg", "jpeg"}:
                tags.add("jpeg")

            entry["tags"] = sorted(tags)

        memory.save_memory()  # Use public method, assuming you implement or expose it
        return [f"Auto-tagging complete: {len(memory.memory)} assets updated."]
