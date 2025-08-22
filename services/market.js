const axios = require("axios");
const config = require("../config");

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
      .filter(
        (ticker) => parseFloat(ticker.quoteVolume) > config.MIN_VOLUME_USD
      ) // Min volume from config
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, config.TOP_COINS_LIMIT); // Top coins limit from config

    // Get top gainers (positive 24h change)
    const topGainers = usdtPairs
      .filter((ticker) => parseFloat(ticker.priceChangePercent) > 0)
      .sort(
        (a, b) =>
          parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent)
      )
      .slice(0, config.TOP_GAINERS_LIMIT); // Top gainers limit from config

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

    // Get BTC and ETH data (24h and 7d)
    const [btcResponse, ethResponse, btc7dResponse, eth7dResponse] =
      await Promise.all([
        axios.get("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT"),
        axios.get("https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT"),
        axios.get(
          "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=7"
        ),
        axios.get(
          "https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=1d&limit=7"
        ),
      ]);

    const btcData = btcResponse.data;
    const ethData = ethResponse.data;

    // Calculate 7-day changes
    const btc7dData = btc7dResponse.data;
    const eth7dData = eth7dResponse.data;

    const btc7dChange =
      btc7dData.length >= 7
        ? ((parseFloat(btcData.lastPrice) - parseFloat(btc7dData[0][4])) /
            parseFloat(btc7dData[0][4])) *
          100
        : null;
    const eth7dChange =
      eth7dData.length >= 7
        ? ((parseFloat(ethData.lastPrice) - parseFloat(eth7dData[0][4])) /
            parseFloat(eth7dData[0][4])) *
          100
        : null;

    // Get BTC dominance from CoinGecko
    let btcDominance = config.BTC_DOMINANCE_FALLBACK;
    try {
      const dominanceResponse = await axios.get(
        "https://api.coingecko.com/api/v3/global"
      );
      btcDominance =
        dominanceResponse.data.data.market_cap_percentage.btc ||
        config.BTC_DOMINANCE_FALLBACK;
    } catch (err) {
      console.log(
        "CoinGecko global data unavailable, using fallback BTC dominance value"
      );
      btcDominance = 55.0; // Conservative estimate
    }

    // Process top gainers for altcoins
    const altcoinData = {};
    topGainers.forEach((ticker) => {
      const coinName = ticker.symbol.replace("USDT", "");
      const change24h = parseFloat(ticker.priceChangePercent);
      const volume = parseFloat(ticker.quoteVolume);

      altcoinData[coinName] = {
        usd: parseFloat(ticker.lastPrice),
        change_24h: change24h,
        volume: volume,
        volume_formatted: (volume / 1000000).toFixed(1) + "M", // Volume in millions (hardcoded for display format)
      };
    });

    const prices = {
      bitcoin: {
        usd: parseFloat(btcData.lastPrice),
        usd_24h_low: parseFloat(btcData.lowPrice),
        usd_24h_high: parseFloat(btcData.highPrice),
        change_24h: parseFloat(btcData.priceChangePercent),
        change_7d: btc7dChange,
      },
      ethereum: {
        usd: parseFloat(ethData.lastPrice),
        usd_24h_low: parseFloat(ethData.lowPrice),
        usd_24h_high: parseFloat(ethData.highPrice),
        change_24h: parseFloat(ethData.priceChangePercent),
        change_7d: eth7dChange,
      },
      altcoins: altcoinData,
    };

    return { prices, btcDominance, topGainers };
  } catch (err) {
    throw new Error(`Binance API error: ${err.message}`);
  }
}

// ====== Get Market Data ======
async function getMarketData() {
  return await getMarketDataFromBinance();
}

module.exports = {
  getTopCoinsFromBinance,
  getMarketDataFromBinance,
  getMarketData,
};
