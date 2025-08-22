require("dotenv").config();
const axios = require("axios");
const { OpenAI } = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ====== Проверка переменных окружения ======
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

// Проверяем наличие хотя бы одного AI API
const hasOpenAI = !!process.env.OPENAI_API_KEY;
const hasGemini = !!process.env.GEMINI_API_KEY;
const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;

if (!hasOpenAI && !hasGemini && !hasDeepSeek) {
  console.error("❌ Missing AI API keys");
  console.error("Add OPENAI_API_KEY, GEMINI_API_KEY, or DEEPSEEK_API_KEY to .env file");
  process.exit(1);
}

// ====== Настройки ======
const BOT_TOKEN = process.env.TG_BOT_TOKEN; // Telegram Bot Token
const CHAT_ID = process.env.TG_CHAT_ID; // Ваш chat_id
const CHECK_INTERVAL_MIN = parseInt(process.env.CHECK_INTERVAL_MIN) || 15; // Проверка рынка каждые N минут
const FULL_REPORT_HOURS = process.env.FULL_REPORT_HOURS
  ? process.env.FULL_REPORT_HOURS.split(",").map((h) => parseInt(h))
  : [8, 18, 22]; // Часы для полного отчета
const COINS = process.env.MAIN_COINS
  ? process.env.MAIN_COINS.split(",")
  : ["bitcoin", "ethereum"]; // Основные монеты
const ALTCOINS = process.env.ALTCOINS
  ? process.env.ALTCOINS.split(",")
  : ["ADAUSDT", "SOLUSDT", "DOTUSDT", "AVAXUSDT", "MATICUSDT"]; // Альткоины для мониторинга
const BTC_DOMINANCE_FALLBACK =
  parseFloat(process.env.BTC_DOMINANCE_FALLBACK) || 52.5; // Fallback значение BTC dominance

// ====== AI сервисы ======
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ====== Функция отправки сообщений ======
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

// ====== Получение данных с Binance ======
async function getMarketDataFromBinance() {
  try {
    const altcoins = ALTCOINS;

    // Get all data in parallel
    const requests = [
      axios.get("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT"),
      axios.get("https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT"),
      ...altcoins.map(
        (coin) =>
          axios
            .get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${coin}`)
            .catch(() => null) // Ignore errors for altcoins
      ),
    ];

    const responses = await Promise.all(requests);
    const [btcData, ethData, ...altcoinResponses] = responses;

    // Process altcoin data
    const altcoinData = {};
    altcoinResponses.forEach((response, index) => {
      if (response) {
        const coin = altcoins[index];
        altcoinData[coin] = {
          price: parseFloat(response.data.lastPrice),
          change: parseFloat(response.data.priceChangePercent),
        };
      }
    });

    const prices = {
      bitcoin: {
        usd: parseFloat(btcData.data.lastPrice),
        usd_24h_low: parseFloat(btcData.data.lowPrice),
        usd_24h_high: parseFloat(btcData.data.highPrice),
        change_24h: parseFloat(btcData.data.priceChangePercent),
      },
      ethereum: {
        usd: parseFloat(ethData.data.lastPrice),
        usd_24h_low: parseFloat(ethData.data.lowPrice),
        usd_24h_high: parseFloat(ethData.data.highPrice),
        change_24h: parseFloat(ethData.data.priceChangePercent),
      },
      altcoins: altcoinData,
    };

    // Get BTC dominance from Binance via 24hr ticker statistics
    let btcDominance = BTC_DOMINANCE_FALLBACK; // fallback value

    try {
      // Get data for all top coins to calculate dominance
      const topCoins = await axios.get(
        "https://api.binance.com/api/v3/ticker/24hr"
      );
      const btcData = topCoins.data.find(
        (ticker) => ticker.symbol === "BTCUSDT"
      );
      const ethData = topCoins.data.find(
        (ticker) => ticker.symbol === "ETHUSDT"
      );

      if (btcData && ethData) {
        const btcMarketCap =
          parseFloat(btcData.quoteVolume) * parseFloat(btcData.lastPrice);
        const ethMarketCap =
          parseFloat(ethData.quoteVolume) * parseFloat(ethData.lastPrice);
        const totalMarketCap = btcMarketCap + ethMarketCap;

        if (totalMarketCap > 0) {
          btcDominance = (btcMarketCap / totalMarketCap) * 100;
        }
      }
    } catch (err) {
      // Use fallback value if calculation failed
    }

    return { prices, btcDominance };
  } catch (err) {
    throw new Error(`Binance API error: ${err.message}`);
  }
}

// ====== Получение данных с CoinGecko ======
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

// ====== Получение данных рынка (с fallback) ======
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

// ====== Проверка AI API ======
async function testOpenAI() {
  if (!hasOpenAI) return false;
  try {
    await openai.chat.completions.create({
      model: "gpt-3.5-turbo-0125", // Более дешевая модель
      messages: [{ role: "user", content: "Test" }],
      max_tokens: 5,
    });
    return true;
  } catch (err) {
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
          "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return true;
  } catch (err) {
    return false;
  }
}

// ====== AI анализ ======
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

  const prompt = `You are an experienced cryptocurrency trader with 10+ years of trading experience. Provide a short, concise, fact-based analysis based on the data below.

DATA:
- BTC: $${prices.bitcoin.usd} (${
    prices.bitcoin.change_24h
      ? prices.bitcoin.change_24h.toFixed(2) + "%"
      : "N/A"
  })
- ETH: $${prices.ethereum.usd} (${
    prices.ethereum.change_24h
      ? prices.ethereum.change_24h.toFixed(2) + "%"
      : "N/A"
  })
- BTC dominance: ${btcDominance.toFixed(2)}%${altcoinInfo}

TASK:
Answer as an expert trader:

📉 Trend: Indicate key levels: "BTC may drop to $X, ETH to $Y, then rebound."

📊 BTC Dominance: Give insights: "If dominance drops to 50%, altseason likely in X days" or "High dominance = altseason not imminent."

💰 Recommendations: Give clear actions for BTC and ETH: "BTC: buy/wait/sell at $X, ETH: buy/wait/sell at $Y."

🚀 Altcoins: Comment only on interesting movements: "X coin is rising due to Y news" or "No significant opportunities at the moment."

RULES:
- Analyze BTC and ETH separately.
- Give specific levels for both coins.
- Only facts, no fluff.
- Be concise and direct, like a professional trader.`;

  // Try OpenAI
  if (hasOpenAI) {
    try {
      const isOpenAIAvailable = await testOpenAI();
      if (isOpenAIAvailable) {
        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo-0125", // Более дешевая модель
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
              "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
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

  throw new Error("AI services unavailable. Check API keys and limits.");
}

// ====== Формируем отчет ======
async function createReport() {
  try {
    const { prices, btcDominance } = await getMarketData();

    let message = "🚀 *Crypto Report*\n\n";

    COINS.forEach((coin) => {
      const p = prices[coin];
      message += `*${coin.toUpperCase()}*: $${p.usd}\n24h min: $${
        p.usd_24h_low
      }, max: $${p.usd_24h_high}\n\n`;
    });

    message += `📈 BTC dominance: ${btcDominance.toFixed(2)}%\n\n`;

    const advice = await getGPTAdvice(prices, btcDominance);
    message += advice;

    await sendMessage(message);
  } catch (error) {
    const errorMessage = `❌ *Error*\n\n${error.message}\n\nTry again later.`;
    await sendMessage(errorMessage);
  }
}

// ====== Проверка времени и запуск отчета ======
function shouldSendFullReport() {
  const hour = new Date().getHours();
  return FULL_REPORT_HOURS.includes(hour);
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
    `  DEEPSEEK_API_KEY: ${process.env.DEEPSEEK_API_KEY ? "✅ Set" : "❌ Missing"}`
  );

  // AI Services check
  console.log("\n🤖 AI Services:");
  const isOpenAIAvailable = await testOpenAI();
  const isGeminiAvailable = await testGemini();
  const isDeepSeekAvailable = await testDeepSeek();
  console.log(
    `  OpenAI: ${isOpenAIAvailable ? "✅ Available" : "❌ Unavailable"}`
  );
  console.log(
    `  Gemini: ${isGeminiAvailable ? "✅ Available" : "❌ Unavailable"}`
  );
  console.log(
    `  DeepSeek: ${isDeepSeekAvailable ? "✅ Available" : "❌ Unavailable"}`
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
  const deepSeekStatus = (await testDeepSeek()) ? "✅ Available" : "❌ Unavailable";

  console.log(`OpenAI: ${openaiStatus}`);
  console.log(`Gemini: ${geminiStatus}`);
  console.log(`DeepSeek: ${deepSeekStatus}`);

  try {
    const data = await getMarketData();
    const analysis = await getGPTAdvice(data.prices, data.btcDominance);
    console.log("✅ Analysis result:", analysis);
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

// ====== Запуск ======
async function main() {
  console.log("🤖 Crypto Bot Started");
  console.log(`⏰ Checking every ${CHECK_INTERVAL_MIN} minutes`);
  console.log(`📊 Full reports at ${FULL_REPORT_HOURS.join(", ")}:00`);

  const command = process.argv[2];

  if (command === "report") {
    await createReport();
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

  // First run
  if (shouldSendFullReport()) {
    try {
      await createReport();
    } catch (error) {
      console.error("❌ First report failed:", error.message);
    }
  }

  // Automatic check
  setInterval(async () => {
    if (shouldSendFullReport()) {
      try {
        await createReport();
      } catch (error) {
        console.error("❌ Scheduled report failed:", error.message);
      }
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
