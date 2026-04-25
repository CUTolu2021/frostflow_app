const { app } = require('./src/app');
const { env } = require('./src/config/env');

app.listen(env.apiPort, () => {
  console.log(`FrostFlow API listening on port ${env.apiPort}`);
});
