const http = require("http");
const config = require("./config");

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

function startServer() {
  server.listen(config.PORT, () => {
    console.log(`🌐 HTTP server running on port ${config.PORT}`);
  });
}

module.exports = {
  server,
  startServer
};
