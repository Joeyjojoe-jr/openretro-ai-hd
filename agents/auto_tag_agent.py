from agents.base_agent import BaseAgent
from agents.agent_registry import register_agent
from agents.utils.asset_memory import AssetMemory

@register_agent("Auto-Tag Agent")
class AutoTagAgent(BaseAgent):
    def run(self):
        memory = AssetMemory("downloads/asset_memory.json")
        for entry in memory.memory.values():
            tags = set(entry.get("tags", []))
            filename = entry.get("filename", "").lower()
            filetype = entry.get("filetype", "").lower()

            # Simulated tag logic
            if "sprite" in filename:
                tags.add("sprite")
            if "goblin" in filename:
                tags.add("goblin")
            if filetype == ".png":
                tags.add("png")
            if filetype == ".jpg":
                tags.add("jpeg")

            entry["tags"] = sorted(tags)

        memory._save_memory()
        return [("Auto-tagging complete for", len(memory.memory), "assets")]
