import { createApp } from "./api/app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`Reins backend listening on port ${env.PORT}`);
});
