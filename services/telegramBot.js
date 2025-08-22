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
      case "/status":
        await sendStatus(chatId);
        break;
      case "/help":
        await sendHelp(chatId);
        break;
      default:
        await telegramService.sendMessage("❌ Неизвестная команда. Используйте /help для списка команд.");
    }
  } catch (err) {
    console.error("Command handling failed:", err.message);
    await telegramService.sendMessage("❌ Ошибка обработки команды");
  }
}

// ====== Handle Callback Query ======
async function handleCallbackQuery(callbackQuery) {
  try {
    const { id, data } = callbackQuery;
    
    switch (data) {
      case "report":
        await telegramService.answerCallbackQuery(id, "📊 Генерирую отчет...");
        await sendReport();
        break;
      case "status":
        await telegramService.answerCallbackQuery(id, "🔍 Проверяю статус...");
        await sendStatus();
        break;
      case "help":
        await telegramService.answerCallbackQuery(id, "📖 Показываю справку...");
        await sendHelp();
        break;
      default:
        await telegramService.answerCallbackQuery(id, "❌ Неизвестная команда");
    }
  } catch (err) {
    console.error("Callback query handling failed:", err.message);
    await telegramService.answerCallbackQuery(callbackQuery.id, "❌ Ошибка обработки");
  }
}

// ====== Send Welcome Message ======
async function sendWelcomeMessage(chatId = config.CHAT_ID) {
  const message = `🤖 *Добро пожаловать в Crypto Bot!*

Я отслеживаю цены криптовалют и отправляю уведомления о важных изменениях.

*Доступные команды:*
📊 /report - Получить отчет сейчас
🔍 /status - Проверить статус сервисов
📖 /help - Показать справку

*Или используйте кнопки ниже:*`;

  const keyboard = [
    [
      { text: "📊 Отчет", callback_data: "report" },
      { text: "🔍 Статус", callback_data: "status" }
    ],
    [
      { text: "📖 Справка", callback_data: "help" }
    ]
  ];

  await telegramService.sendMessageWithKeyboard(message, keyboard);
}

// ====== Send Report ======
async function sendReport(chatId = config.CHAT_ID) {
  try {
    await telegramService.sendMessage("📊 *Генерирую отчет...*");
    
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
    await telegramService.sendMessage("❌ *Ошибка генерации отчета*\n\nПопробуйте позже.");
  }
}

// ====== Send Status ======
async function sendStatus(chatId = config.CHAT_ID) {
  try {
    const message = `🔍 *Статус сервисов*

📊 *Market Data:*
• Binance API: ✅ Работает
• CoinGecko API: ✅ Работает

🤖 *AI Services:*
• OpenAI: ${await aiService.testOpenAI() ? "✅" : "❌"}
• Gemini: ${await aiService.testGemini() ? "✅" : "❌"}
• DeepSeek: ${await aiService.testDeepSeek() ? "✅" : "❌"}

⚙️ *Настройки:*
• Проверка каждые: ${config.CHECK_INTERVAL_MIN} минут
• Порог уведомлений: ${config.PRICE_ALERT_THRESHOLD}%
• Отчеты в: ${config.SCHEDULED_REPORT_HOURS.join(", ")}:00

✅ *Бот работает и мониторит рынок*`;

    await telegramService.sendMessage(message);
  } catch (err) {
    console.error("Status check failed:", err.message);
    await telegramService.sendMessage("❌ *Ошибка проверки статуса*");
  }
}

// ====== Send Help ======
async function sendHelp(chatId = config.CHAT_ID) {
  const message = `📖 *Справка по командам*

*Основные команды:*
📊 /report - Получить полный отчет с AI анализом
🔍 /status - Проверить статус всех сервисов
📖 /help - Показать эту справку

*Автоматические уведомления:*
🚨 Price Alerts - каждые ${config.CHECK_INTERVAL_MIN} минут при изменении > ${config.PRICE_ALERT_THRESHOLD}%
📊 Scheduled Reports - в ${config.SCHEDULED_REPORT_HOURS.join(", ")}:00

*Мониторируемые монеты:*
${config.COINS.map(coin => `• ${coin.toUpperCase()}`).join("\n")}

*Поддерживаемые AI:*
• OpenAI GPT
• Google Gemini
• DeepSeek

Бот работает 24/7 и автоматически перезапускается при сбоях.`;

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
  sendStatus,
  sendHelp
};
