class BaseAgent:
    def run(self, *args, **kwargs):
        raise NotImplementedError("Each agent must implement a run method.")
