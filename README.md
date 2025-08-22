# 🤖 Crypto Bot

Automated cryptocurrency market analysis and alerts bot with AI-powered insights.

## 📁 Project Structure

```
crypto_bot/
├── config.js              # Configuration and environment variables
├── bot.js                 # Main bot application
├── server.js              # HTTP server for Railway healthcheck
├── services/
│   ├── ai.js              # AI services (OpenAI, Gemini, DeepSeek)
│   ├── market.js          # Market data (CoinGecko, Binance)
│   └── telegram.js        # Telegram messaging
├── utils/
│   ├── analysis.js        # Price change detection and alerts
│   └── helpers.js         # Helper functions and status checks
├── package.json
├── railway.json
└── .env                   # Environment variables
```

## 🚀 Features

- **📊 Real-time Market Data**: CoinGecko + Binance fallback
- **🤖 AI Analysis**: OpenAI, Gemini, DeepSeek with fallback
- **🚨 Price Alerts**: Automatic alerts for significant price changes
- **⏰ Scheduled Reports**: Full AI analysis at 8:00, 16:00, 22:00
- **📱 Telegram Integration**: Instant notifications and reports
- **🛡️ Robust Error Handling**: Always sends reports, even without AI
- **☁️ Railway Deployment**: 24/7 cloud hosting

## 🛠️ Setup

### Local Development

1. **Clone repository**

   ```bash
   git clone <repository-url>
   cd crypto_bot
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Create .env file**

   ```env
   # Required
   TG_BOT_TOKEN=your_telegram_bot_token
   TG_CHAT_ID=your_telegram_chat_id

   # AI Services (at least one required)
   OPENAI_API_KEY=your_openai_key
   GEMINI_API_KEY=your_gemini_key
   DEEPSEEK_API_KEY=your_deepseek_key

   # Optional Configuration
   CHECK_INTERVAL_MIN=15
   PRICE_ALERT_THRESHOLD=5
   MAIN_COINS=bitcoin,ethereum
   ```

4. **Test the bot**
   ```bash
   node bot.js test      # Test AI services
   node bot.js status    # Check all services
   node bot.js report    # Send test report
   ```

### Railway Deployment

1. **Connect to Railway**

   - Link your GitHub repository
   - Railway will auto-deploy

2. **Set Environment Variables**

   - Add all variables from `.env` to Railway dashboard

3. **Monitor**
   - Check Railway logs for status
   - Bot runs 24/7 with automatic restarts

## 📋 Commands

```bash
node bot.js              # Start bot (continuous monitoring)
node bot.js test         # Test AI services
node bot.js status       # Check all services status
node bot.js report       # Send immediate report
```

## 🔧 Configuration

| Variable                 | Default          | Description                    |
| ------------------------ | ---------------- | ------------------------------ |
| `CHECK_INTERVAL_MIN`     | 15               | Minutes between price checks   |
| `PRICE_ALERT_THRESHOLD`  | 5                | % change for price alerts      |
| `SCHEDULED_REPORT_HOURS` | 8,14,17,20,23    | Hours for scheduled reports    |
| `MAIN_COINS`             | bitcoin,ethereum | Main coins to monitor          |
| `FULL_REPORT_HOURS`      | 8,18,22          | Hours for full AI reports      |
| `BTC_DOMINANCE_FALLBACK` | 50.0             | Fallback BTC dominance %       |
| `MIN_VOLUME_USD`         | 1000000          | Minimum volume for altcoins    |
| `TOP_COINS_LIMIT`        | 100              | Number of top coins to monitor |
| `TOP_GAINERS_LIMIT`      | 5                | Number of top gainers to show  |
| `SCHEDULED_REPORT_MIN_CHANGE` | 2.0              | Min % change for scheduled reports |
| `AI_MAX_TOKENS`          | 2000             | Max tokens for AI responses    |
| `AI_TEST_TOKENS`         | 50               | Tokens for AI service tests    |

## 📱 Telegram Messages

### Scheduled Reports (8:00, 14:00, 17:00, 20:00, 23:00)

```
🚀 Crypto Report

BITCOIN: $112,642
24h: -1.53% (min: $110,123, max: $115,456)

ETHEREUM: $4,247
24h: -1.75% (min: $4,123, max: $4,345)

📈 BTC dominance: 57.50%

🤖 AI Analysis (GPT-3.5):
📉 Trend: BTC showing weakness, may test $110K support
📊 BTC Dominance: High dominance suggests altseason delayed
💰 Actions: BTC buy at $110K, sell at $118K. ETH buy at $4.1K, sell at $4.5K
🚀 Altcoins: SOL breaking out, consider entry at $180
```

### Price Alerts (every 15 min)

```
🚨 PRICE ALERT!

📉 BTC: $110,000 (-5.23%)
Previous: $116,000

📉 ETH: $4,100 (-3.45%)
Previous: $4,250
```

## 🛡️ Error Handling

- **AI Services Down**: Falls back to simple data report
- **Market APIs Down**: Uses Binance as fallback
- **Network Issues**: Retries automatically
- **Process Crashes**: Railway auto-restarts

## 🔄 Updates

The bot automatically:

- Monitors top 100 coins by volume
- Finds top 5 gainers for opportunities
- Sends alerts for significant price changes
- Provides AI analysis when available

## 📊 Monitoring

- **Railway Dashboard**: View logs and status
- **Telegram**: Receive all reports and alerts
- **Health Check**: `https://your-app.railway.app/`

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details
