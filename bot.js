const config = require("./config");
const marketService = require("./services/market");
const aiService = require("./services/ai");
const telegramService = require("./services/telegram");
const analysisUtils = require("./utils/analysis");
const helpers = require("./utils/helpers");
const { startServer } = require("./server");

// Store last prices for comparison
let lastPrices = null;

// ====== Create Report ======
async function createReport(isScheduled = false) {
  try {
    const { prices, btcDominance, btcDominanceChange } = await marketService.getMarketData();

    let message = "🚀 *Crypto Report*\n\n";

    // Main coins info - safely
    config.COINS.forEach((coin) => {
      const p = prices[coin];
      if (p && p.usd) {
        const change24h = p.change_24h?.toFixed(2) || "0.00";
        const low24h = p.usd_24h_low?.toLocaleString() || "N/A";
        const high24h = p.usd_24h_high?.toLocaleString() || "N/A";

        message += `*${coin.toUpperCase()}*\n`;
        message += `💰 Current: $${p.usd.toLocaleString()}\n`;
        message += `📊 24h: ${change24h}%\n`;
        message += `📉 Min: $${low24h}\n`;
        message += `📈 Max: $${high24h}\n\n`;
      } else {
        message += `*${coin.toUpperCase()}*: Data unavailable\n\n`;
      }
    });

    const dominance = btcDominance?.toFixed(2) || "0.00";
    const dominanceChange = btcDominanceChange ? (btcDominanceChange > 0 ? '+' : '') + btcDominanceChange.toFixed(2) : "0.00";
    message += `📈 BTC Dominance: ${dominance}% (${dominanceChange}% 24h)\n\n`;

    // Add AI analysis only for scheduled reports
    if (isScheduled) {
              try {
          const advice = await aiService.getAIAdvice(prices, btcDominance, btcDominanceChange);
          message += advice;
        } catch (aiError) {
        console.log("⚠️ AI analysis failed, using simple summary");
        const simpleAnalysis = aiService.generateSimpleAnalysis(
          prices,
          btcDominance
        );
        message += simpleAnalysis;
      }
    } else {
      // For price alerts, add simple analysis
      const simpleAnalysis = aiService.generateSimpleAnalysis(
        prices,
        btcDominance
      );
      message += simpleAnalysis;
    }

    await telegramService.sendMessage(message);
  } catch (error) {
    console.error("❌ Report creation failed:", error);
    const errorMessage = `❌ *Error*\n\n${error.message}\n\nTry again later.`;
    await telegramService.sendMessage(errorMessage);
  }
}

// ====== Test AI ======
async function testAI() {
  console.log("🧪 Testing AI services...");

  const openaiStatus = (await aiService.testOpenAI())
    ? "✅ Available"
    : "❌ Unavailable";
  const geminiStatus = (await aiService.testGemini())
    ? "✅ Available"
    : "❌ Unavailable";
  const deepSeekStatus = (await aiService.testDeepSeek())
    ? "✅ Available"
    : "❌ Unavailable";

  console.log(`OpenAI: ${openaiStatus}`);
  console.log(`Gemini: ${geminiStatus}`);
  console.log(`DeepSeek: ${deepSeekStatus}`);

      try {
      const data = await marketService.getMarketData();
      const analysis = await aiService.getAIAdvice(
        data.prices,
        data.btcDominance,
        data.btcDominanceChange
      );
      console.log("✅ Analysis result:", analysis);
    } catch (error) {
    console.log("⚠️ AI services unavailable, using simple analysis");
    const data = await marketService.getMarketData();
    const simpleAnalysis = aiService.generateSimpleAnalysis(
      data.prices,
      data.btcDominance
    );
    console.log("✅ Simple analysis result:", simpleAnalysis);
  }
}

// ====== Main Function ======
async function main() {
  console.log("🤖 Crypto Bot Started");
  console.log(`⏰ Checking every ${config.CHECK_INTERVAL_MIN} minutes`);
  console.log(
    `📊 Full reports at ${config.SCHEDULED_REPORT_HOURS.join(", ")}:00`
  );
  console.log(`🚨 Price alerts threshold: ${config.PRICE_ALERT_THRESHOLD}%`);

  const command = process.argv[2];

  if (command === "report") {
    await createReport(true); // Full report with AI
    return;
  }

  if (command === "test") {
    await testAI();
    return;
  }

  if (command === "status") {
    await helpers.checkStatus();
    return;
  }

  // Start HTTP server for Railway healthcheck
  startServer();

  // First run
  if (helpers.shouldSendFullReport()) {
    try {
      await createReport(true); // Full report with AI
    } catch (error) {
      console.log("⚠️ First report failed, trying simple report...");
      try {
        await createReport(false); // Simple report without AI
      } catch (err) {
        console.error("❌ Simple report also failed:", err.message);
      }
    }
  }

  // Automatic check every 15 minutes
  setInterval(async () => {
    try {
      const currentPrices = await marketService.getMarketData();

      // Check for significant price changes
      const priceAlerts = analysisUtils.checkSignificantPriceChanges(
        currentPrices.prices,
        lastPrices
      );

      if (priceAlerts) {
        console.log("🚨 Significant price changes detected!");
        const alertMessage = analysisUtils.createPriceAlert(priceAlerts);
        await telegramService.sendMessage(alertMessage);
      }

      // Send scheduled full reports
      if (helpers.shouldSendFullReport()) {
        console.log("📊 Sending scheduled full report...");
        try {
          await createReport(true); // Full report with AI
        } catch (error) {
          console.log("⚠️ AI report failed, sending simple report...");
          await createReport(false); // Simple report without AI
        }
      }

      // Update last prices for next comparison
      lastPrices = currentPrices.prices;
    } catch (error) {
      console.error("❌ Price check failed:", error.message);
    }
  }, config.CHECK_INTERVAL_MIN * 60 * 1000);

  // Keep the process alive
  console.log("✅ Bot is running and monitoring...");
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("🛑 Bot shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("🛑 Bot shutting down gracefully...");
  process.exit(0);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  // Don't exit, let the bot continue running
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  // Don't exit, let the bot continue running
});

main();
