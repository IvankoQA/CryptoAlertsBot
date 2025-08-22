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

// ====== Send Message with Keyboard ======
async function sendMessageWithKeyboard(text, keyboard) {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${config.BOT_TOKEN}/sendMessage`,
      {
        chat_id: config.CHAT_ID,
        text: text,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: keyboard
        }
      }
    );
    return response.data;
  } catch (err) {
    console.error("Message with keyboard send failed:", err.message);
    return null;
  }
}

// ====== Handle Callback Query ======
async function answerCallbackQuery(callbackQueryId, text) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${config.BOT_TOKEN}/answerCallbackQuery`,
      {
        callback_query_id: callbackQueryId,
        text: text
      }
    );
  } catch (err) {
    console.error("Callback query answer failed:", err.message);
  }
}

module.exports = {
  sendMessage,
  sendMessageWithKeyboard,
  answerCallbackQuery
};
