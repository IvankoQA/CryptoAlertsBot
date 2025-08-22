const axios = require("axios");
const config = require("../config");
const aiService = require("../services/ai");

// ====== Time Check Functions ======
function shouldSendFullReport() {
  const hour = new Date().getHours();
  return config.SCHEDULED_REPORT_HOURS.includes(hour);
}

// ====== Status Check ======
async function checkStatus() {
  console.log("🔍 Checking services status...\n");

  // Environment variables
  console.log("📋 Environment:");
  console.log(
    `  TG_BOT_TOKEN: ${process.env.TG_BOT_TOKEN ? "✅ Set" : "❌ Missing"}`
  );
  console.log(
    `  TG_CHAT_ID: ${process.env.TG_CHAT_ID ? "✅ Set" : "❌ Missing"}`
  );
  console.log(
    `  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? "✅ Set" : "❌ Missing"}`
  );
  console.log(
    `  GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? "✅ Set" : "❌ Missing"}`
  );
  console.log(
    `  DEEPSEEK_API_KEY: ${
      process.env.DEEPSEEK_API_KEY ? "✅ Set" : "❌ Missing"
    }`
  );

  // AI Services check
  console.log("\n🤖 AI Services:");
  await aiService.testOpenAI();
  await aiService.testGemini();
  await aiService.testDeepSeek();

  // Data APIs check
  console.log("\n📊 Data APIs:");

  // Check CoinGecko
  try {
    await axios.get("https://api.coingecko.com/api/v3/ping");
    console.log("  CoinGecko: ✅ Available");
  } catch (err) {
    console.log("  CoinGecko: ❌ Unavailable");
  }

  // Check Binance
  try {
    await axios.get(
      "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT"
    );
    console.log("  Binance: ✅ Available");
  } catch (err) {
    console.log("  Binance: ❌ Unavailable");
  }

  // Check Telegram
  try {
    await axios.get(`https://api.telegram.org/bot${config.BOT_TOKEN}/getMe`);
    console.log("  Telegram: ✅ Available");
  } catch (err) {
    console.log("  Telegram: ❌ Unavailable");
  }
}

module.exports = {
  shouldSendFullReport,
  checkStatus,
};
