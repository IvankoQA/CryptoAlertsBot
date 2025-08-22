const config = require("../config");

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
    if (Math.abs(btcChange) >= config.PRICE_ALERT_THRESHOLD) {
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
    if (Math.abs(ethChange) >= config.PRICE_ALERT_THRESHOLD) {
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

module.exports = {
  checkSignificantPriceChanges,
  createPriceAlert
};
