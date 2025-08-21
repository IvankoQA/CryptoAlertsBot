# 🤖 Crypto Bot

AI-powered cryptocurrency analysis bot with real-time market data and Telegram notifications.

## 🚀 Features

- Real-time BTC and ETH price monitoring
- AI market analysis (OpenAI + Gemini)
- BTC dominance tracking
- Altcoin monitoring
- Automated Telegram reports
- Fallback API system (CoinGecko → Binance)

## 📋 Requirements

- Node.js 18+
- Telegram Bot Token
- Chat ID
- AI API Key (OpenAI or Gemini)

## 🔧 Setup

### Local Development

1. Clone repository
2. Install dependencies: `npm install`
3. Create `.env` file with your API keys
4. Run: `npm start`

### Environment Variables

```env
# Required
TG_BOT_TOKEN=your_telegram_bot_token
TG_CHAT_ID=your_chat_id

# AI API (at least one required)
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key

# Optional (with defaults)
CHECK_INTERVAL_MIN=15
FULL_REPORT_HOURS=8,18,22
MAIN_COINS=bitcoin,ethereum
ALTCOINS=ADAUSDT,SOLUSDT,DOTUSDT,AVAXUSDT,MATICUSDT
BTC_DOMINANCE_FALLBACK=52.5
```

## 🎯 Commands

- `npm start` - Start bot
- `node bot.js report` - Send report now
- `node bot.js test` - Test AI services
- `node bot.js status` - Check services status

## 🌐 Deployment

### Railway (Recommended)

1. Create private GitHub repository
2. Push your code to GitHub
3. Connect Railway to GitHub
4. Add environment variables in Railway dashboard
5. Deploy!

### Other Platforms

- Heroku
- DigitalOcean App Platform
- Vercel (with limitations)

## 📊 How It Works

1. **Data Collection**: Fetches real-time prices from CoinGecko/Binance
2. **AI Analysis**: Uses OpenAI or Gemini for market insights
3. **BTC Dominance**: Calculates real-time dominance
4. **Altcoin Monitoring**: Tracks top performing altcoins
5. **Automated Reports**: Sends analysis to Telegram at scheduled times

## 🔒 Security

- All API keys stored in environment variables
- Private repository recommended
- No sensitive data in code

## 📈 Monitoring

Bot automatically sends reports at:

- 8:00 AM
- 6:00 PM
- 10:00 PM

Checks market every 15 minutes for scheduled reports.
