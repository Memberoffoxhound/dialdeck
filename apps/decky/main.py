import decky_plugin

class Plugin:
    async def get_default_url(self) -> str:
        return "https://localhost"

    async def _main(self):
        decky_plugin.logger.info("Dialdeck plugin loaded")

    async def _unload(self):
        decky_plugin.logger.info("Dialdeck plugin unloaded")
