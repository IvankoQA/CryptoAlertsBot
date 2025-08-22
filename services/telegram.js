const axios = require("axios");
const config = require("../config");

// ====== Message Sending Function ======
async function sendMessage(text) {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${config.BOT_TOKEN}/sendMessage`,
      {
        chat_id: config.CHAT_ID,
        text: text,
        parse_mode: "Markdown",
      }
    );
    return response.data;
  } catch (err) {
    console.error("Message send failed:", err.message);
    return null;
  }
}

module.exports = {
  sendMessage
};
