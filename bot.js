require("dotenv").config();
const axios = require("axios");
const { OpenAI } = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { HfInference } = require("@huggingface/inference");

// ====== Environment Variables Check ======
const requiredEnvVars = ["TG_BOT_TOKEN", "TG_CHAT_ID"];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(
    "❌ Missing required environment variables:",
    missingVars.join(", ")
  );
  console.error("Create .env file with these variables");
  process.exit(1);
}

// Check for at least one AI API
const hasOpenAI = !!process.env.OPENAI_API_KEY;
const hasGemini = !!process.env.GEMINI_API_KEY;
const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;
const hasHuggingFace = !!process.env.HUGGINGFACE_API_KEY;

if (!hasOpenAI && !hasGemini && !hasDeepSeek && !hasHuggingFace) {
  console.error("❌ Missing AI API keys");
  console.error(
    "Add OPENAI_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_KEY, or HUGGINGFACE_API_KEY to .env file"
  );
  process.exit(1);
}

// ====== Configuration ======
const BOT_TOKEN = process.env.TG_BOT_TOKEN; // Telegram Bot Token
const CHAT_ID = process.env.TG_CHAT_ID; // Your chat_id
const CHECK_INTERVAL_MIN = parseInt(process.env.CHECK_INTERVAL_MIN) || 15; // Market check interval in minutes
const FULL_REPORT_HOURS = process.env.FULL_REPORT_HOURS
  ? process.env.FULL_REPORT_HOURS.split(",").map((h) => parseInt(h))
  : [8, 18, 22]; // Hours for full reports
const COINS = process.env.MAIN_COINS
  ? process.env.MAIN_COINS.split(",")
  : ["bitcoin", "ethereum"]; // Main coins
const ALTCOINS = process.env.ALTCOINS ? process.env.ALTCOINS.split(",") : []; // Will be populated dynamically from Binance top 100
const BTC_DOMINANCE_FALLBACK =
  parseFloat(process.env.BTC_DOMINANCE_FALLBACK) || 52.5; // Fallback BTC dominance value

// Price alert thresholds
const PRICE_ALERT_THRESHOLD =
  parseFloat(process.env.PRICE_ALERT_THRESHOLD) || 5; // % change for alerts
const SCHEDULED_REPORT_HOURS = [8, 16, 22]; // Hours for full reports with AI

// Store last prices for comparison
let lastPrices = null;

// ====== AI Services ======
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// ====== Message Sending Function ======
async function sendMessage(text) {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text,
        parse_mode: "Markdown",
      }
    );
    return response.data;
  } catch (err) {
    console.error("Message send failed:", err.message);
    return null;
  }
}

// ====== Get Top Coins from Binance ======
async function getTopCoinsFromBinance() {
  try {
    // Get 24hr ticker for all symbols
    const response = await axios.get(
      "https://api.binance.com/api/v3/ticker/24hr"
    );
    const allTickers = response.data;

    // Filter USDT pairs and sort by volume
    const usdtPairs = allTickers
      .filter((ticker) => ticker.symbol.endsWith("USDT"))
      .filter((ticker) => parseFloat(ticker.quoteVolume) > 1000000) // Min $1M volume
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 100); // Top 100 by volume

    // Get top gainers (positive 24h change)
    const topGainers = usdtPairs
      .filter((ticker) => parseFloat(ticker.priceChangePercent) > 0)
      .sort(
        (a, b) =>
          parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent)
      )
      .slice(0, 10); // Top 10 gainers

    return {
      allPairs: usdtPairs,
      topGainers: topGainers,
    };
  } catch (err) {
    console.error("Error getting top coins:", err.message);
    return { allPairs: [], topGainers: [] };
  }
}

// ====== Get Data from Binance ======
async function getMarketDataFromBinance() {
  try {
    // Get top coins and gainers
    const { allPairs, topGainers } = await getTopCoinsFromBinance();

    // Get BTC and ETH data
    const [btcResponse, ethResponse] = await Promise.all([
      axios.get("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT"),
      axios.get("https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT"),
    ]);

    const btcData = btcResponse.data;
    const ethData = ethResponse.data;

    // Calculate BTC dominance from 24hr ticker
    const btcDominance =
      parseFloat(btcData.priceChangePercent) || BTC_DOMINANCE_FALLBACK;

    // Process top gainers for altcoins
    const altcoinData = {};
    topGainers.forEach((ticker) => {
      const coinName = ticker.symbol.replace("USDT", "");
      altcoinData[coinName] = {
        usd: parseFloat(ticker.lastPrice),
        change_24h: parseFloat(ticker.priceChangePercent),
        volume: parseFloat(ticker.quoteVolume),
      };
    });

    const prices = {
      bitcoin: {
        usd: parseFloat(btcData.lastPrice),
        usd_24h_low: parseFloat(btcData.lowPrice),
        usd_24h_high: parseFloat(btcData.highPrice),
        change_24h: parseFloat(btcData.priceChangePercent),
      },
      ethereum: {
        usd: parseFloat(ethData.lastPrice),
        usd_24h_low: parseFloat(ethData.lowPrice),
        usd_24h_high: parseFloat(ethData.highPrice),
        change_24h: parseFloat(ethData.priceChangePercent),
      },
      altcoins: altcoinData,
    };

    return { prices, btcDominance, topGainers };
  } catch (err) {
    throw new Error(`Binance API error: ${err.message}`);
  }
}

// ====== Get Data from CoinGecko ======
async function getMarketDataFromCoinGecko() {
  try {
    // Get base prices and detailed data
    const [priceResponse, detailedResponse, globalResponse] = await Promise.all(
      [
        axios.get(
          `https://api.coingecko.com/api/v3/simple/price?ids=${COINS.join(
            ","
          )}&vs_currencies=usd&include_24hr_change=true`
        ),
        axios.get(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COINS.join(
            ","
          )}&order=market_cap_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h`
        ),
        axios.get("https://api.coingecko.com/api/v3/global"),
      ]
    );

    const prices = priceResponse.data;
    const detailed = detailedResponse.data;

    // Merge data
    detailed.forEach((coin) => {
      if (prices[coin.id]) {
        prices[coin.id].usd_24h_low = coin.low_24h;
        prices[coin.id].usd_24h_high = coin.high_24h;
        prices[coin.id].change_24h = coin.price_change_percentage_24h;
      }
    });

    const btcDominance = globalResponse.data.data.market_cap_percentage.btc;
    return { prices, btcDominance };
  } catch (err) {
    throw new Error(`CoinGecko API error: ${err.message}`);
  }
}

// ====== Price Change Detection ======
function checkSignificantPriceChanges(currentPrices, lastPrices) {
  if (!lastPrices) return null;

  const alerts = [];

  // Check BTC
  if (currentPrices.bitcoin && lastPrices.bitcoin) {
    const btcChange =
      ((currentPrices.bitcoin.usd - lastPrices.bitcoin.usd) /
        lastPrices.bitcoin.usd) *
      100;
    if (Math.abs(btcChange) >= PRICE_ALERT_THRESHOLD) {
      alerts.push({
        coin: "BTC",
        change: btcChange,
        price: currentPrices.bitcoin.usd,
        oldPrice: lastPrices.bitcoin.usd,
      });
    }
  }

  // Check ETH
  if (currentPrices.ethereum && lastPrices.ethereum) {
    const ethChange =
      ((currentPrices.ethereum.usd - lastPrices.ethereum.usd) /
        lastPrices.ethereum.usd) *
      100;
    if (Math.abs(ethChange) >= PRICE_ALERT_THRESHOLD) {
      alerts.push({
        coin: "ETH",
        change: ethChange,
        price: currentPrices.ethereum.usd,
        oldPrice: lastPrices.ethereum.usd,
      });
    }
  }

  return alerts.length > 0 ? alerts : null;
}

function createPriceAlert(alerts) {
  let message = "🚨 PRICE ALERT!\n\n";

  alerts.forEach((alert) => {
    const direction = alert.change > 0 ? "📈" : "📉";
    const changeStr =
      alert.change > 0
        ? `+${alert.change.toFixed(2)}%`
        : `${alert.change.toFixed(2)}%`;

    message += `${direction} ${
      alert.coin
    }: $${alert.price.toLocaleString()} (${changeStr})\n`;
    message += `Previous: $${alert.oldPrice.toLocaleString()}\n\n`;
  });

  return message.trim();
}

// ====== Get Market Data (with fallback) ======
async function getMarketData() {
  try {
    return await getMarketDataFromCoinGecko();
  } catch (err) {
    // Fallback to Binance
    try {
      return await getMarketDataFromBinance();
    } catch (err2) {
      throw new Error(`All APIs unavailable: ${err.message} | ${err2.message}`);
    }
  }
}

// ====== AI API Check ======
async function testOpenAI() {
  if (!hasOpenAI) return false;
  try {
    await openai.chat.completions.create({
      model: "gpt-3.5-turbo-0125", // Cheaper model
      messages: [{ role: "user", content: "Test" }],
      max_tokens: 5,
    });
    return true;
  } catch (err) {
    console.log("OpenAI test error:", err.message);
    return false;
  }
}

async function testGemini() {
  if (!hasGemini) return false;
  try {
    const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
    await model.generateContent("Test");
    return true;
  } catch (err) {
    console.log("Gemini test error:", err.message);
    return false;
  }
}

async function testDeepSeek() {
  if (!hasDeepSeek) return false;
  try {
    await axios.post(
      "https://api.deepseek.com/v1/chat/completions",
      {
        model: "deepseek-chat",
        messages: [{ role: "user", content: "Test" }],
        max_tokens: 5,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return true;
  } catch (err) {
    console.log("DeepSeek test error:", err.message);
    return false;
  }
}

async function testHuggingFace() {
  if (!hasHuggingFace) return false;
  try {
    await hf.textGeneration({
      model: "distilgpt2",
      inputs: "Hello",
      parameters: { max_new_tokens: 3 },
    });
    return true;
  } catch (err) {
    console.log("HuggingFace test error:", err.message);
    return false;
  }
}

// ====== AI Analysis ======
async function getGPTAdvice(prices, btcDominance) {
  // Form altcoin data
  let altcoinInfo = "";
  if (prices.altcoins) {
    const topGainers = Object.entries(prices.altcoins)
      .filter(([_, data]) => data.change > 0)
      .sort(([_, a], [__, b]) => b.change - a.change)
      .slice(0, 3);

    if (topGainers.length > 0) {
      altcoinInfo =
        "\nAltcoins (gaining):\n" +
        topGainers
          .map(
            ([coin, data]) =>
              `- ${coin.replace("USDT", "")}: +${data.change.toFixed(2)}%`
          )
          .join("\n");
    }
  }

  const prompt = `Crypto trader analysis. Data: BTC $${prices.bitcoin.usd} (${
    prices.bitcoin.change_24h?.toFixed(2) || "N/A"
  }%), ETH $${prices.ethereum.usd} (${
    prices.ethereum.change_24h?.toFixed(2) || "N/A"
  }%), BTC dominance ${btcDominance.toFixed(2)}%${altcoinInfo}

        Brief analysis:
        📉 Trend: Key levels
        📊 BTC Dominance: Altseason timing
        💰 Actions: BTC buy at $X, sell at $Y. ETH buy at $X, sell at $Y
        🚀 Altcoins: Top opportunities

        Give specific price levels for entry/exit. Be concise, trader style.`;

  // Try OpenAI
  if (hasOpenAI) {
    try {
      const isOpenAIAvailable = await testOpenAI();
      if (isOpenAIAvailable) {
        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo-0125", // Cheaper model
          messages: [
            {
              role: "system",
              content:
                "You are an experienced cryptocurrency trader with 10+ years of trading experience. Provide short, concise, fact-based advice as a professional. Only facts, numbers, and specific actions. No fluff.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 150,
        });

        if (response.choices?.[0]?.message?.content) {
          return `🤖 AI Analysis (GPT-3.5):\n${response.choices[0].message.content}`;
        }
      }
    } catch (err) {
      // Continue to next AI
    }
  }

  // Try Gemini
  if (hasGemini) {
    try {
      const isGeminiAvailable = await testGemini();
      if (isGeminiAvailable) {
        const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        return `🤖 AI Analysis (Gemini):\n${result.response.text()}`;
      }
    } catch (err) {
      // Continue
    }
  }

  // Try DeepSeek
  if (hasDeepSeek) {
    try {
      const isDeepSeekAvailable = await testDeepSeek();
      if (isDeepSeekAvailable) {
        const response = await axios.post(
          "https://api.deepseek.com/v1/chat/completions",
          {
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 200,
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );
        return `🤖 AI Analysis (DeepSeek):\n${response.data.choices[0].message.content}`;
      }
    } catch (err) {
      // Continue
    }
  }

  // Fallback: Simple analysis without AI
  return generateSimpleAnalysis(prices, btcDominance);
}

function generateSimpleAnalysis(prices, btcDominance) {
  const btcChange = prices.bitcoin.change_24h || 0;
  const ethChange = prices.ethereum.change_24h || 0;
  
  let trend = "";
  if (btcChange > 2) trend = "📈 Strong uptrend";
  else if (btcChange > 0) trend = "📊 Slight uptrend";
  else if (btcChange > -2) trend = "📉 Slight downtrend";
  else trend = "📉 Strong downtrend";
  
  let dominance = "";
  if (btcDominance > 55) dominance = "High BTC dominance - altseason unlikely";
  else if (btcDominance > 50) dominance = "Moderate BTC dominance";
  else dominance = "Low BTC dominance - potential altseason";
  
  let recommendation = "";
  if (btcChange < -5) {
    recommendation = "Consider buying the dip";
  } else if (btcChange > 5) {
    recommendation = "Consider taking profits";
  } else {
    recommendation = "Hold current positions";
  }
  
  // Add top gainers info
  let altcoinInfo = "";
  if (prices.altcoins && Object.keys(prices.altcoins).length > 0) {
    const topGainers = Object.entries(prices.altcoins)
      .sort(([_, a], [__, b]) => b.change_24h - a.change_24h)
      .slice(0, 5);
    
    altcoinInfo =
      "\n🚀 Top Gainers:\n" +
      topGainers
        .map(
          ([coin, data]) =>
            `${coin}: +${data.change_24h.toFixed(
              2
            )}% ($${data.usd.toLocaleString()})`
        )
        .join("\n");
  }
  
  return `🤖 Market Analysis (Simple):
📉 Trend: ${trend} (BTC: ${btcChange.toFixed(2)}%, ETH: ${ethChange.toFixed(2)}%)
📊 BTC Dominance: ${dominance} (${btcDominance.toFixed(2)}%)
💰 Recommendation: ${recommendation}${altcoinInfo}`;
}

// ====== Create Report ======
async function createReport(isScheduled = false) {
  try {
    const { prices, btcDominance } = await getMarketData();

    let message = "🚀 *Crypto Report*\n\n";

    // Main coins info
    COINS.forEach((coin) => {
      const p = prices[coin];
      message += `*${coin.toUpperCase()}*: $${p.usd.toLocaleString()}\n24h: ${p.change_24h.toFixed(
        2
      )}% (min: $${p.usd_24h_low.toLocaleString()}, max: $${p.usd_24h_high.toLocaleString()})\n\n`;
    });

    message += `📈 BTC dominance: ${btcDominance.toFixed(2)}%\n\n`;

    // Add AI analysis only for scheduled reports
    if (isScheduled) {
      const advice = await getGPTAdvice(prices, btcDominance);
      message += advice;
    } else {
      // For price alerts, add simple analysis
      const simpleAnalysis = generateSimpleAnalysis(prices, btcDominance);
      message += simpleAnalysis;
    }

    await sendMessage(message);
  } catch (error) {
    const errorMessage = `❌ *Error*\n\n${error.message}\n\nTry again later.`;
    await sendMessage(errorMessage);
  }
}

// ====== Time Check Functions ======
function shouldSendFullReport() {
  const hour = new Date().getHours();
  return SCHEDULED_REPORT_HOURS.includes(hour);
}

function shouldCheckPrices() {
  const now = new Date();
  const minutes = now.getMinutes();
  return minutes % CHECK_INTERVAL_MIN === 0;
}

// ====== Проверка статуса ======
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
  console.log(
    `  HUGGINGFACE_API_KEY: ${
      process.env.HUGGINGFACE_API_KEY ? "✅ Set" : "❌ Missing"
    }`
  );

  // AI Services check
  console.log("\n🤖 AI Services:");
  const isOpenAIAvailable = await testOpenAI();
  const isGeminiAvailable = await testGemini();
  const isDeepSeekAvailable = await testDeepSeek();
  const isHuggingFaceAvailable = await testHuggingFace();
  console.log(
    `  OpenAI: ${isOpenAIAvailable ? "✅ Available" : "❌ Unavailable"}`
  );
  console.log(
    `  Gemini: ${isGeminiAvailable ? "✅ Available" : "❌ Unavailable"}`
  );
  console.log(
    `  DeepSeek: ${isDeepSeekAvailable ? "✅ Available" : "❌ Unavailable"}`
  );
  console.log(
    `  HuggingFace: ${
      isHuggingFaceAvailable ? "✅ Available" : "❌ Unavailable"
    }`
  );

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
  console.log("\n📱 Telegram Bot:");
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${BOT_TOKEN}/getMe`
    );
    console.log(`  Status: ✅ Available (@${response.data.result.username})`);
  } catch (err) {
    console.log("  Status: ❌ Unavailable");
  }
}

// ====== Тестирование AI ======
async function testAI() {
  console.log("🧪 Testing AI services...");

  const openaiStatus = (await testOpenAI()) ? "✅ Available" : "❌ Unavailable";
  const geminiStatus = (await testGemini()) ? "✅ Available" : "❌ Unavailable";
  const deepSeekStatus = (await testDeepSeek())
    ? "✅ Available"
    : "❌ Unavailable";

  console.log(`OpenAI: ${openaiStatus}`);
  console.log(`Gemini: ${geminiStatus}`);
  console.log(`DeepSeek: ${deepSeekStatus}`);

  try {
    const data = await getMarketData();
    const analysis = await getGPTAdvice(data.prices, data.btcDominance);
    console.log("✅ Analysis result:", analysis);
  } catch (error) {
    console.log("⚠️ AI services unavailable, using simple analysis");
    const data = await getMarketData();
    const simpleAnalysis = generateSimpleAnalysis(
      data.prices,
      data.btcDominance
    );
    console.log("✅ Simple analysis result:", simpleAnalysis);
  }
}

// ====== HTTP Server for Railway Healthcheck ======
const http = require("http");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      status: "ok",
      message: "Crypto Bot is running",
      timestamp: new Date().toISOString(),
    })
  );
});

// ====== Main Function ======
async function main() {
  console.log("🤖 Crypto Bot Started");
  console.log(`⏰ Checking every ${CHECK_INTERVAL_MIN} minutes`);
  console.log(`📊 Full reports at ${SCHEDULED_REPORT_HOURS.join(", ")}:00`);
  console.log(`🚨 Price alerts threshold: ${PRICE_ALERT_THRESHOLD}%`);

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
    await checkStatus();
    return;
  }

  // Start HTTP server for Railway healthcheck
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`🌐 HTTP server running on port ${port}`);
  });

  // First run
  if (shouldSendFullReport()) {
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
      const currentPrices = await getMarketData();

      // Check for significant price changes
      const priceAlerts = checkSignificantPriceChanges(
        currentPrices.prices,
        lastPrices
      );

      if (priceAlerts) {
        console.log("🚨 Significant price changes detected!");
        const alertMessage = createPriceAlert(priceAlerts);
        await sendMessage(alertMessage);
      }

      // Send scheduled full reports
      if (shouldSendFullReport()) {
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
  }, CHECK_INTERVAL_MIN * 60 * 1000);

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
