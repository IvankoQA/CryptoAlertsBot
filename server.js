const http = require("http");
const config = require("./config");
const telegramBot = require("./services/telegramBot");

let server;

function startServer() {
  server = http.createServer(async (req, res) => {
    try {
      // Health check endpoint
      if (req.url === "/" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "ok",
            message: "Crypto Bot is running",
            timestamp: new Date().toISOString(),
          })
        );
        return;
      }

      // Telegram webhook endpoint
      if (req.url === "/webhook" && req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", async () => {
          try {
            const update = JSON.parse(body);
            await telegramBot.processUpdate(update);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "ok" }));
          } catch (err) {
            console.error("Webhook processing error:", err.message);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        });
        return;
      }

      // Default response
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    } catch (err) {
      console.error("Server error:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  });

  server.listen(config.PORT, () => {
    console.log(`🌐 HTTP server running on port ${config.PORT}`);
  });
}

async function setupWebhook() {
  try {
    // Get the public URL from Railway
    const publicUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/webhook`
      : null;
    
    if (publicUrl) {
      await telegramBot.setWebhook(publicUrl);
      console.log("✅ Telegram webhook configured");
    } else {
      console.log("⚠️ No public URL available, webhook not configured");
    }
  } catch (err) {
    console.error("❌ Webhook setup failed:", err.message);
  }
}

module.exports = {
  server,
  startServer,
  setupWebhook
};
