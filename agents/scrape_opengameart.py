"""
Enhanced OpenGameArtScraper with Asset Memory Integration
"""

from bs4 import BeautifulSoup
import requests
import os
import time
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor
from requests.adapters import HTTPAdapter, Retry
from agents.utils.logger import setup_logger
from agents.utils.asset_memory import AssetMemory
from urllib.parse import urlparse
from datetime import datetime

logger = setup_logger("OpenGameArtScraper")

class OpenGameArtScraper:
    def __init__(self, base_url="https://opengameart.org", download_dir="downloads", max_workers=5):
        self.base_url = base_url
        self.download_dir = download_dir
        self.max_workers = max_workers
        self.memory = AssetMemory(os.path.join(download_dir, "asset_memory.json"))
        os.makedirs(download_dir, exist_ok=True)

        # Setup retry-capable session
        self.session = requests.Session()
        retries = Retry(total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504])
        self.session.mount("https://", HTTPAdapter(max_retries=retries))

    def fetch_asset_links(self, search_query="pixel art", pages=1):
        links = []
        logger.info(f"Searching OpenGameArt for: '{search_query}'")
        for page in range(1, pages + 1):
            url = f"{self.base_url}/art-search-advanced?keys={search_query}&page={page - 1}"
            try:
                res = self.session.get(url)
                soup = BeautifulSoup(res.content, "html.parser")
                for link in soup.select("a[href*='/content/']"):
                    href = link.get("href")
                    if href and href.startswith("/content/"):
                        full_url = f"{self.base_url}{href}"
                        links.append(full_url)
            except Exception as e:
                logger.warning(f"Failed to parse page {page}: {e}")
        return list(set(links))

    def download_assets(self, links):
        def download_link(link):
            if self.memory.has_seen(link):
                logger.info(f"Already processed: {link}")
                return

            try:
                res = self.session.get(link)
                soup = BeautifulSoup(res.content, "html.parser")
                for asset in soup.select("a[href$='.zip'], a[href$='.png'], a[href$='.jpg']"):
                    asset_url = asset.get("href")
                    if asset_url:
                        if not asset_url.startswith("http"):
                            asset_url = f"{self.base_url}{asset_url}"

                        filename = os.path.basename(urlparse(asset_url).path)
                        filepath = os.path.join(self.download_dir, filename)

                        if not os.path.exists(filepath):
                            r = self.session.get(asset_url)
                            with open(filepath, "wb") as f:
                                f.write(r.content)
                            logger.info(f"Downloaded: {filename}")

                            meta = {
                                "filename": filename,
                                "source_url": link,
                                "downloaded_at": datetime.utcnow().isoformat(),
                                "filetype": os.path.splitext(filename)[1].lower(),
                                "tags": ["pixel", "art", "auto"]
                            }
                            self.memory.mark_seen(link, meta)
            except Exception as e:
                logger.warning(f"Failed to download from {link}: {e}")

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            list(tqdm(executor.map(download_link, links), total=len(links)))
