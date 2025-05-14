"""
Asset License Verifier - Memory-Synced Edition
"""
import os
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from agents.utils.logger import setup_logger
from agents.utils.asset_memory import AssetMemory

logger = setup_logger("AssetVerifier")

class AssetVerifier:
    LICENSE_KEYWORDS = ["cc0", "public domain", "creative commons", "attribution", "cc-by", "license"]

    def __init__(self, download_dir="downloads", max_workers=4):
        self.download_dir = download_dir
        self.max_workers = max_workers
        self.memory = AssetMemory(os.path.join(download_dir, "asset_memory.json"))

    def verify_license_text(self, text):
        text = text.lower()
        matches = [kw for kw in self.LICENSE_KEYWORDS if kw in text]
        return len(matches), matches

    def _verify_folder(self, root):
        cache_path = os.path.join(root, ".verification.json")
        if os.path.exists(cache_path):
            try:
                with open(cache_path, "r") as f:
                    cached = json.load(f)
                    return root, cached["verified"], cached["score"]
            except Exception:
                pass

        license_score, keywords_found = 0, []
        for dirpath, _, files in os.walk(root):
            for file in files:
                if "license" in file.lower():
                    try:
                        with open(os.path.join(dirpath, file), "r", encoding="utf-8") as f:
                            content = f.read()
                            license_score, keywords_found = self.verify_license_text(content)
                    except Exception as e:
                        logger.warning(f"Failed to read {file} in {dirpath}: {e}")

        verified = license_score >= 1
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump({
                "verified": verified,
                "score": license_score,
                "keywords_found": keywords_found
            }, f, indent=2)

        # Update asset memory entry if match found
        for entry in self.memory.memory.values():
            if root.endswith(entry.get("filename", "")):
                entry["verified"] = verified
                entry["license_score"] = license_score
        self.memory._save_memory()

        return root, verified, license_score

    def verify_assets(self):
        folders = [os.path.join(self.download_dir, f) for f in os.listdir(self.download_dir)
                   if os.path.isdir(os.path.join(self.download_dir, f))]

        logger.info(f"Scanning {len(folders)} folders for license verification...")
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            results = executor.map(self._verify_folder, folders)

        for root, verified, score in results:
            status = "✅ Verified" if verified else "❌ Unverified"
            logger.info(f"{status} | Score: {score} | Folder: {root}")
