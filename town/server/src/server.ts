/** 启动入口：npm run server（开发）/ npm run server:start（生产） */
import { buildApp } from './app.js';
import { config, weatherFetch } from './config.js';
import { scheduleWeather } from './lib/weather.js';

const app = buildApp();
if (weatherFetch) scheduleWeather(app.db, (m) => app.log.info(m));
app.listen({ port: config.port, host: config.host }).then(() => {
  console.log(`三邻邦后端已启动：${config.publicUrl}（短信：${config.sms.provider}，微信登录：${config.wechat.mode}，文档提炼：${config.anthropicKey ? 'Claude' : '规则（免费）'}）`);
});
