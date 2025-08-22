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

    // Get BTC dominance from external API
    let btcDominance = config.BTC_DOMINANCE_FALLBACK;
    let btcDominanceChange = 0;
    try {
      // Try to get BTC dominance from CoinGecko global data
      const globalResponse = await axios.get("https://api.coingecko.com/api/v3/global");
      btcDominance = globalResponse.data.data.market_cap_percentage.btc || config.BTC_DOMINANCE_FALLBACK;
      btcDominanceChange = globalResponse.data.data.market_cap_change_percentage_24h_usd?.btc || 0;
    } catch (err) {
      console.log("Using fallback BTC dominance value");
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
        volume_formatted: (volume / 1000000).toFixed(1) + "M" // Volume in millions
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

    return { prices, btcDominance, btcDominanceChange, topGainers };
  } catch (err) {
    throw new Error(`Binance API error: ${err.message}`);
  }
}

// ====== Get Data from CoinGecko ======
async function getMarketDataFromCoinGecko() {
  try {
    // Get base prices and detailed data
    const [priceResponse, detailedResponse, globalResponse] = await Promise.all([
      axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${config.COINS.join(
          ","
        )}&vs_currencies=usd&include_24hr_change=true`
      ),
      axios.get(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${config.COINS.join(
          ","
        )}&order=market_cap_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h`
      ),
      axios.get("https://api.coingecko.com/api/v3/global"),
    ]);

    const prices = priceResponse.data;
    const detailed = detailedResponse.data;

    // Merge data
    detailed.forEach((coin) => {
      if (prices[coin.id]) {
        prices[coin.id] = {
          ...prices[coin.id],
          usd_24h_low: coin.low_24h,
          usd_24h_high: coin.high_24h,
        };
      }
    });

    // Get BTC dominance from global data
    const btcDominance = globalResponse.data.data.market_cap_percentage.btc || config.BTC_DOMINANCE_FALLBACK;
    
    // Get BTC dominance change from global data
    const btcDominanceChange = globalResponse.data.data.market_cap_change_percentage_24h_usd?.btc || 0;

    return { prices, btcDominance, btcDominanceChange };
  } catch (err) {
    throw new Error(`CoinGecko API error: ${err.message}`);
  }
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

module.exports = {
  getTopCoinsFromBinance,
  getMarketDataFromBinance,
  getMarketDataFromCoinGecko,
  getMarketData
};
