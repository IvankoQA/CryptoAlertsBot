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
const hasHuggingFace = !!process.env.HUGGINGFACE_API_KEY;

// Timing configuration
const CHECK_INTERVAL_MIN = parseInt(process.env.CHECK_INTERVAL_MIN) || 15;
const FULL_REPORT_HOURS = process.env.FULL_REPORT_HOURS
  ? process.env.FULL_REPORT_HOURS.split(",").map(h => parseInt(h))
  : [8, 18, 22];

// Market configuration
const COINS = process.env.MAIN_COINS
  ? process.env.MAIN_COINS.split(",")
  : ["bitcoin", "ethereum"];
const ALTCOINS = process.env.ALTCOINS ? process.env.ALTCOINS.split(",") : [];
const BTC_DOMINANCE_FALLBACK = parseFloat(process.env.BTC_DOMINANCE_FALLBACK) || 52.5;

// Price alert thresholds
const PRICE_ALERT_THRESHOLD = parseFloat(process.env.PRICE_ALERT_THRESHOLD) || 5;
const SCHEDULED_REPORT_HOURS = [8, 16, 22];

// Server configuration
const PORT = process.env.PORT || 3000;

module.exports = {
  BOT_TOKEN,
  CHAT_ID,
  hasOpenAI,
  hasGemini,
  hasDeepSeek,
  hasHuggingFace,
  CHECK_INTERVAL_MIN,
  FULL_REPORT_HOURS,
  COINS,
  ALTCOINS,
  BTC_DOMINANCE_FALLBACK,
  PRICE_ALERT_THRESHOLD,
  SCHEDULED_REPORT_HOURS,
  PORT
};
