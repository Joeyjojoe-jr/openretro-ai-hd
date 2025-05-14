AGENT_REGISTRY = {}

def register_agent(name):
    def wrapper(cls):
        AGENT_REGISTRY[name] = cls
        return cls
    return wrapper
