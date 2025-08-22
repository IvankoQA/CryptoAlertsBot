const OpenAI = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { HfInference } = require("@huggingface/inference");
const axios = require("axios");
const config = require("../config");

// Initialize AI services
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// ====== AI API Check ======
async function testOpenAI() {
  if (!config.hasOpenAI) return false;
  try {
    await openai.chat.completions.create({
      model: "gpt-3.5-turbo-0125", // Cheaper model
      messages: [{ role: "user", content: "Test" }],
      max_tokens: config.AI_TEST_TOKENS,
    });
    return true;
  } catch (err) {
    console.log("OpenAI test error:", err.message);
    return false;
  }
}

async function testGemini() {
  if (!config.hasGemini) return false;
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
  if (!config.hasDeepSeek) return false;
  try {
          await axios.post(
        "https://api.deepseek.com/v1/chat/completions",
        {
          model: "deepseek-chat",
          messages: [{ role: "user", content: "Test" }],
          max_tokens: config.AI_TEST_TOKENS,
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
  if (!config.hasHuggingFace) return false;
  try {
    await hf.textGeneration({
      model: "gpt2",
      inputs: "Test",
      parameters: { max_new_tokens: config.AI_TEST_TOKENS },
    });
    return true;
  } catch (err) {
    console.log("HuggingFace test error:", err.message);
    return false;
  }
}

// ====== AI Analysis ======
async function getAIAdvice(prices, btcDominance, btcDominanceChange = 0) {
  // Form altcoin data
  let altcoinInfo = "";
  if (prices.altcoins) {
    const topGainers = Object.entries(prices.altcoins)
      .filter(([_, data]) => data.change_24h > 0)
      .sort(([_, a], [__, b]) => b.change_24h - a.change_24h)
      .slice(0, 3);

    if (topGainers.length > 0) {
      altcoinInfo =
        "\nAltcoins (gaining):\n" +
        topGainers
          .map(
            ([coin, data]) =>
              `- ${coin.replace("USDT", "")}: +${data.change_24h.toFixed(2)}%`
          )
          .join("\n");
    }
  }

  const prompt = `You are a professional crypto trader with 10+ years of experience. Analyze this market data:

BTC: $${prices.bitcoin.usd} (${prices.bitcoin.change_24h?.toFixed(2) || "N/A"}% 24h)
ETH: $${prices.ethereum.usd} (${prices.ethereum.change_24h?.toFixed(2) || "N/A"}% 24h)
BTC Dominance: ${btcDominance.toFixed(2)}% (${btcDominanceChange > 0 ? '+' : ''}${btcDominanceChange.toFixed(2)}% 24h)${altcoinInfo}

Provide professional analysis:
📉 Market Trend: Key support/resistance levels
📊 BTC Dominance Analysis: Current ${btcDominance.toFixed(2)}% (${btcDominanceChange > 0 ? '+' : ''}${btcDominanceChange.toFixed(2)}% 24h) - when altseason likely?
💰 Entry/Exit Strategy: BTC buy at $X, sell at $Y. ETH buy at $X, sell at $Y
🚀 Altcoin Opportunities: Best short-term plays

For BTC Dominance: Show current %, 24h change, and altseason timing (e.g., "57.52% (-2.1% 24h) - altseason in ~30 days if drops to 45%")
Be concise, professional, give specific price levels.`;

  // Try OpenAI
  if (config.hasOpenAI) {
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
          // No token limit
        });

        if (response.choices?.[0]?.message?.content) {
          const usage = response.usage;
          console.log(`📊 OpenAI tokens used: ${usage?.prompt_tokens || 'N/A'} prompt, ${usage?.completion_tokens || 'N/A'} completion, ${usage?.total_tokens || 'N/A'} total`);
          return `🤖 AI Analysis (GPT-3.5):\n${response.choices[0].message.content}`;
        }
      }
    } catch (err) {
      // Continue to next AI
    }
  }

  // Try Gemini
  if (config.hasGemini) {
    try {
      const isGeminiAvailable = await testGemini();
      if (isGeminiAvailable) {
        const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        console.log(`📊 Gemini tokens used: ${result.response.usageMetadata?.promptTokenCount || 'N/A'} prompt, ${result.response.usageMetadata?.candidatesTokenCount || 'N/A'} completion`);
        return `🤖 AI Analysis (Gemini):\n${result.response.text()}`;
      }
    } catch (err) {
      // Continue
    }
  }

  // Try DeepSeek
  if (config.hasDeepSeek) {
    try {
      const isDeepSeekAvailable = await testDeepSeek();
      if (isDeepSeekAvailable) {
        const response = await axios.post(
          "https://api.deepseek.com/v1/chat/completions",
          {
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            // No token limit
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );
        const usage = response.data.usage;
        console.log(`📊 DeepSeek tokens used: ${usage?.prompt_tokens || 'N/A'} prompt, ${usage?.completion_tokens || 'N/A'} completion, ${usage?.total_tokens || 'N/A'} total`);
        return `🤖 AI Analysis (DeepSeek):\n${response.data.choices[0].message.content}`;
      }
    } catch (err) {
      // Continue
    }
  }

  // If all AI services fail, return simple analysis
  console.log("⚠️ All AI services unavailable, using simple analysis");
  return generateSimpleAnalysis(prices, btcDominance);
}

function generateSimpleAnalysis(prices, btcDominance) {
  try {
    // Get top gainers data safely with trend analysis
    let altcoinInfo = "";
    if (prices?.altcoins && Object.keys(prices.altcoins).length > 0) {
      const topGainers = Object.entries(prices.altcoins)
        .filter(([_, data]) => data && typeof data.change_24h === 'number')
        .sort(([_, a], [__, b]) => b.change_24h - a.change_24h)
        .slice(0, config.TOP_GAINERS_LIMIT);
      
      if (topGainers.length > 0) {
        altcoinInfo =
          "\n🚀 Top Gainers:\n" +
          topGainers
            .map(([coin, data]) => {
              const volume = data.volume_formatted || "N/A";
              
              return `${coin}: $${data.usd?.toLocaleString() || 0} (+${data.change_24h.toFixed(2)}%) (Vol: $${volume})`;
            })
            .join("\n");
      }
    }
    
    return `📊 Market Summary:${altcoinInfo}

⚠️ AI analysis unavailable. Monitor price movements manually.`;
  } catch (error) {
    console.error("Error in generateSimpleAnalysis:", error);
    return `📊 Market Summary:
⚠️ AI analysis unavailable. Basic data collection working.
Check logs for detailed error information.`;
  }
}

module.exports = {
  testOpenAI,
  testGemini,
  testDeepSeek,
  testHuggingFace,
  getAIAdvice,
  generateSimpleAnalysis
};
