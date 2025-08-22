require("dotenv").config();

// Telegram configuration
const BOT_TOKEN = process.env.TG_BOT_TOKEN;
const CHAT_ID = process.env.TG_CHAT_ID;

// Check required environment variables
if (!BOT_TOKEN || !CHAT_ID) {
  console.error("❌ Missing required environment variables:");
  console.error("  TG_BOT_TOKEN");
  console.error("  TG_CHAT_ID");
  console.error("Create .env file with these variables");
  process.exit(1);
}

// AI API keys
const hasOpenAI = !!process.env.OPENAI_API_KEY;
const hasGemini = !!process.env.GEMINI_API_KEY;
const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;

// AI configuration
const AI_TEST_TOKENS = parseInt(process.env.AI_TEST_TOKENS) || 50;

// Timing configuration
const CHECK_INTERVAL_MIN = parseInt(process.env.CHECK_INTERVAL_MIN) || 15;

// Market configuration
const COINS = process.env.MAIN_COINS
  ? process.env.MAIN_COINS.split(",")
  : ["bitcoin", "ethereum"];
const BTC_DOMINANCE_FALLBACK =
  parseFloat(process.env.BTC_DOMINANCE_FALLBACK) || 50.0;

// Price alert thresholds
const PRICE_ALERT_THRESHOLD =
  parseFloat(process.env.PRICE_ALERT_THRESHOLD) || 2;
const SCHEDULED_REPORT_MIN_CHANGE =
  parseFloat(process.env.SCHEDULED_REPORT_MIN_CHANGE) || 2.0;
const SCHEDULED_REPORT_HOURS = process.env.SCHEDULED_REPORT_HOURS
  ? process.env.SCHEDULED_REPORT_HOURS.split(",").map((h) => parseInt(h))
  : [8, 14, 17, 20, 23];

// Market data limits
const MIN_VOLUME_USD = parseFloat(process.env.MIN_VOLUME_USD) || 1000000;
const TOP_COINS_LIMIT = parseInt(process.env.TOP_COINS_LIMIT) || 100;
const TOP_GAINERS_LIMIT = parseInt(process.env.TOP_GAINERS_LIMIT) || 5;

// Server configuration
const PORT = process.env.PORT || 3000;

module.exports = {
  BOT_TOKEN,
  CHAT_ID,
  hasOpenAI,
  hasGemini,
  hasDeepSeek,
  AI_TEST_TOKENS,
  CHECK_INTERVAL_MIN,
  COINS,
  BTC_DOMINANCE_FALLBACK,
  PRICE_ALERT_THRESHOLD,
  SCHEDULED_REPORT_MIN_CHANGE,
  SCHEDULED_REPORT_HOURS,
  MIN_VOLUME_USD,
  TOP_COINS_LIMIT,
  TOP_GAINERS_LIMIT,
  PORT,
};
