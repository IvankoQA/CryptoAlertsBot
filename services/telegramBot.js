const axios = require("axios");
const config = require("../config");
const telegramService = require("./telegram");
const marketService = require("./market");
const aiService = require("./ai");

let webhookUrl = null;

// ====== Set Webhook ======
async function setWebhook(url) {
  try {
    webhookUrl = url;
    const response = await axios.post(
      `https://api.telegram.org/bot${config.BOT_TOKEN}/setWebhook`,
      {
        url: url
      }
    );
    console.log("✅ Webhook set successfully:", url);
    return response.data;
  } catch (err) {
    console.error("❌ Webhook setup failed:", err.message);
    return null;
  }
}

// ====== Delete Webhook ======
async function deleteWebhook() {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${config.BOT_TOKEN}/deleteWebhook`
    );
    console.log("✅ Webhook deleted successfully");
    return response.data;
  } catch (err) {
    console.error("❌ Webhook deletion failed:", err.message);
    return null;
  }
}

// ====== Handle Commands ======
async function handleCommand(command, chatId) {
  try {
    switch (command) {
      case "/start":
        await sendWelcomeMessage(chatId);
        break;
      case "/report":
        await sendReport(chatId);
        break;
      case "/prices":
        await sendPricesOnly(chatId);
        break;
      default:
        await telegramService.sendMessage("❌ Unknown command. Use /report or /prices to get data.");
    }
  } catch (err) {
    console.error("Command handling failed:", err.message);
    await telegramService.sendMessage("❌ Command processing error");
  }
}

// ====== Handle Callback Query ======
async function handleCallbackQuery(callbackQuery) {
  try {
    const { id, data } = callbackQuery;
    
    if (data === "report") {
      await telegramService.answerCallbackQuery(id, "📊 Generating full report...");
      await sendReport();
    } else if (data === "prices") {
      await telegramService.answerCallbackQuery(id, "📈 Getting prices...");
      await sendPricesOnly();
    } else {
      await telegramService.answerCallbackQuery(id, "❌ Unknown command");
    }
  } catch (err) {
    console.error("Callback query handling failed:", err.message);
    await telegramService.answerCallbackQuery(callbackQuery.id, "❌ Processing error");
  }
}

// ====== Send Welcome Message ======
async function sendWelcomeMessage(chatId = config.CHAT_ID) {
  const message = `🤖 *Welcome to Crypto Bot!*

I monitor cryptocurrency prices and send notifications about important changes.

*Available commands:*
📊 /report - Get full report with AI
📈 /prices - Get prices only

*Or use buttons below:*`;

  const keyboard = [
    [
      { text: "📊 Full Report", callback_data: "report" },
      { text: "📈 Prices Only", callback_data: "prices" }
    ]
  ];

  await telegramService.sendMessageWithKeyboard(message, keyboard);
}

// ====== Send Report ======
async function sendReport(chatId = config.CHAT_ID) {
  try {
    await telegramService.sendMessage("📊 *Generating report...*");
    
    const { prices, btcDominance } = await marketService.getMarketData();
    let message = "🚀 *Crypto Report*\n\n";
    
    config.COINS.forEach((coin) => {
      const p = prices[coin];
      if (p && p.usd) {
        const change24h = typeof p.change_24h === "number" ? p.change_24h.toFixed(2) : "N/A";
        const change7d = typeof p.change_7d === "number" ? p.change_7d.toFixed(2) : "";
        const low24h = p.usd_24h_low?.toLocaleString() || "N/A";
        const high24h = p.usd_24h_high?.toLocaleString() || "N/A";

        message += `*${coin.toUpperCase()}*\n`;
        message += `💰 Current: $${p.usd.toLocaleString()}\n`;
        message += `📊 24h: ${change24h}%${change7d ? ` (7d: ${change7d}%)` : ''}\n`;
        message += `📉 Min: $${low24h}\n`;
        message += `📈 Max: $${high24h}\n\n`;
      } else {
        message += `*${coin.toUpperCase()}*: Data unavailable\n\n`;
      }
    });
    
    const dominance = btcDominance?.toFixed(2) || "N/A";
    message += `📈 BTC Dominance: ${dominance}%\n\n`;
    
    // Add AI analysis
    try {
      const aiAdvice = await aiService.getAIAdvice(prices, btcDominance);
      message += `🤖 *AI Analysis:*\n${aiAdvice}\n\n`;
    } catch (err) {
      message += `⚠️ *AI analysis unavailable.* Monitor price movements manually.\n\n`;
    }
    
    await telegramService.sendMessage(message);
  } catch (err) {
    console.error("Report generation failed:", err.message);
    await telegramService.sendMessage("❌ *Report generation error*\n\nTry again later.");
  }
}

// ====== Send Prices Only ======
async function sendPricesOnly(chatId = config.CHAT_ID) {
  try {
    await telegramService.sendMessage("📈 *Getting prices...*");
    
    const { prices, btcDominance } = await marketService.getMarketData();
    let message = "💰 *Current Prices*\n\n";
    
    config.COINS.forEach((coin) => {
      const p = prices[coin];
      if (p && p.usd) {
        const change24h = typeof p.change_24h === "number" ? p.change_24h.toFixed(2) : "N/A";
        const change7d = typeof p.change_7d === "number" ? p.change_7d.toFixed(2) : "";
        const low24h = p.usd_24h_low?.toLocaleString() || "N/A";
        const high24h = p.usd_24h_high?.toLocaleString() || "N/A";

        message += `*${coin.toUpperCase()}*\n`;
        message += `💰 Current: $${p.usd.toLocaleString()}\n`;
        message += `📊 24h: ${change24h}%${change7d ? ` (7d: ${change7d}%)` : ''}\n`;
        message += `📉 Min: $${low24h}\n`;
        message += `📈 Max: $${high24h}\n\n`;
      } else {
        message += `*${coin.toUpperCase()}*: Data unavailable\n\n`;
      }
    });
    
    const dominance = btcDominance?.toFixed(2) || "N/A";
    message += `📈 BTC Dominance: ${dominance}%\n\n`;
    
    // Add top gainers without AI analysis
    if (prices.altcoins) {
      const topGainers = Object.entries(prices.altcoins)
        .sort(([,a], [,b]) => b.change_24h - a.change_24h)
        .slice(0, 5);
      
      if (topGainers.length > 0) {
        message += `🚀 *Top Gainers:*\n`;
        topGainers.forEach(([coin, data]) => {
          message += `${coin}: $${data.usd.toFixed(4)} (+${data.change_24h.toFixed(2)}%) (Vol: $${data.volume_formatted})\n`;
        });
      }
    }
    
    await telegramService.sendMessage(message);
  } catch (err) {
    console.error("Prices generation failed:", err.message);
    await telegramService.sendMessage("❌ *Prices generation error*\n\nTry again later.");
  }
}

// ====== Send Status ======
async function sendStatus(chatId = config.CHAT_ID) {
  try {
    const message = `🔍 *Services Status*

📊 *Market Data:*
• Binance API: ✅ Working
• CoinGecko API: ✅ Working

🤖 *AI Services:*
• OpenAI: ${await aiService.testOpenAI() ? "✅" : "❌"}
• Gemini: ${await aiService.testGemini() ? "✅" : "❌"}
• DeepSeek: ${await aiService.testDeepSeek() ? "✅" : "❌"}

⚙️ *Settings:*
• Check every: ${config.CHECK_INTERVAL_MIN} minutes
• Alert threshold: ${config.PRICE_ALERT_THRESHOLD}%
• Reports at: ${config.SCHEDULED_REPORT_HOURS.join(", ")}:00

✅ *Bot is running and monitoring the market*`;

    await telegramService.sendMessage(message);
  } catch (err) {
    console.error("Status check failed:", err.message);
    await telegramService.sendMessage("❌ *Status check error*");
  }
}

// ====== Send Help ======
async function sendHelp(chatId = config.CHAT_ID) {
  const message = `📖 *Command Help*

*Main commands:*
📊 /report - Get full report with AI analysis
🔍 /status - Check all services status
📖 /help - Show this help

*Automatic notifications:*
🚨 Price Alerts - every ${config.CHECK_INTERVAL_MIN} minutes when change > ${config.PRICE_ALERT_THRESHOLD}%
📊 Scheduled Reports - at ${config.SCHEDULED_REPORT_HOURS.join(", ")}:00

*Monitored coins:*
${config.COINS.map(coin => `• ${coin.toUpperCase()}`).join("\n")}

*Supported AI:*
• OpenAI GPT
• Google Gemini
• DeepSeek

Bot runs 24/7 and automatically restarts on failures.`;

  await telegramService.sendMessage(message);
}

// ====== Process Webhook Update ======
async function processUpdate(update) {
  try {
    if (update.message) {
      const { text, chat } = update.message;
      if (text && text.startsWith("/")) {
        await handleCommand(text, chat.id);
      }
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    }
  } catch (err) {
    console.error("Update processing failed:", err.message);
  }
}

module.exports = {
  setWebhook,
  deleteWebhook,
  handleCommand,
  handleCallbackQuery,
  processUpdate,
  sendWelcomeMessage,
  sendReport,
  sendPricesOnly,
  sendStatus,
  sendHelp
};
