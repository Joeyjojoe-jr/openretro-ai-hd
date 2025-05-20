import os
import json
from hashlib import sha256

class AssetMemory:
    def __init__(self, memory_path="downloads/asset_memory.json"):
        self.memory_path = memory_path
        os.makedirs(os.path.dirname(self.memory_path), exist_ok=True)
        self.memory = self._load_memory()

    def _load_memory(self):
        if os.path.exists(self.memory_path):
            try:
                with open(self.memory_path, "r") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    def save_memory(self):
        with open(self.memory_path, "w") as f:
            json.dump(self.memory, f, indent=2)

    def has_seen(self, asset_url):
        key = sha256(asset_url.encode()).hexdigest()
        return key in self.memory

    def mark_seen(self, asset_url, meta):
        key = sha256(asset_url.encode()).hexdigest()
        self.memory[key] = meta
        self.save_memory()

    def get_all_metadata(self):
        return list(self.memory.values())
