"""
Config-Driven Orchestrator with Agent Registry Integration
"""
import yaml
import os
import traceback
from agents.agent_registry import AGENT_REGISTRY
from agents.utils.logger import setup_logger

logger = setup_logger("Orchestrator")

class Orchestrator:
    def __init__(self, config_path="config.yaml"):
        self.config_path = config_path
        self.agents = []
        self.load_config()

    def load_config(self):
        if not os.path.exists(self.config_path):
            raise FileNotFoundError("Missing config.yaml for orchestrator")

        with open(self.config_path, "r") as f:
            config = yaml.safe_load(f)

        self.search_query = config.get("default_search", "pixel art")
        self.pages = config.get("pages", 1)
        self.download_dir = config.get("download_dir", "downloads")
        self.active_agents = config.get("active_agents", [])

        for agent_key in self.active_agents:
            for name, agent_class in AGENT_REGISTRY.items():
                if agent_key.replace("_", " ").lower() in name.lower():
                    self.agents.append(agent_class())
                    break

    def run_pipeline(self):
        logger.info("▶️ Orchestrator starting with config-driven pipeline...")
        logger.info(f"Search: {self.search_query}, Pages: {self.pages}, Download Dir: {self.download_dir}")
        try:
            for agent in self.agents:
                logger.info(f"Running agent: {agent.__class__.__name__}")
                result = agent.run()
                logger.info(f"Completed: {agent.__class__.__name__}")
        except Exception as e:
            logger.error("❌ Pipeline failed:")
            logger.error(traceback.format_exc())
