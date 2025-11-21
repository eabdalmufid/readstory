# ReadStory - WhatsApp Auto Read Story Bot

🤖 An automated WhatsApp bot that automatically reads all status/stories from your contacts using the Baileys library.

## 📋 Features

- ✅ Automatic WhatsApp status/story reading
- 🔐 Secure pairing code authentication (no QR code required)
- 📱 Multi-device support
- 💬 Built-in ping command to test response time
- 🔄 Auto-reconnection on connection loss
- 📝 Notification when a story is read

## 🔧 Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (version 16 or higher)
- npm (comes with Node.js)
- A WhatsApp account

## 📦 Installation

1. Clone this repository:
```bash
git clone https://github.com/eabdalmufid/readstory.git
cd readstory
```

2. Install dependencies:
```bash
npm install
```

## 🚀 Usage

1. Start the bot:
```bash
npm start
```

2. On first run, you'll be prompted to enter your WhatsApp number:
```
- Silakan masukkan nomor WhatsApp Anda, misalnya 628xxxx
- Nomor Anda:
```

3. Enter your phone number with country code (e.g., `628123456789` for Indonesia)

4. You'll receive a pairing code:
```
- Kode Tautan: XXXX-XXXX
```

5. Open WhatsApp on your phone:
   - Go to **Settings** → **Linked Devices**
   - Tap **Link a Device**
   - Select **Link with phone number instead**
   - Enter the pairing code shown in the terminal

6. Once connected, the bot will automatically:
   - Read all new status/stories from your contacts
   - Send you a notification message for each story read
   - Stay connected and continue monitoring for new stories

## 📝 Available Commands

Send these commands to the bot in any chat:

| Command | Description |
|---------|-------------|
| `.ping`, `#ping`, `!ping`, `/ping` | Check bot response time and connection status |

## 🔐 Session Management

- Authentication session is stored in the `./sessions` folder
- The session persists between restarts
- If you want to log out or change accounts, delete the `sessions` folder:
```bash
rm -rf sessions
```

## 🛠️ Configuration

The bot uses the following default settings:

- **Browser**: Ubuntu Chrome
- **Connection**: Automatic reconnection enabled
- **Presence**: Appears unavailable after reading stories
- **Notifications**: Ephemeral messages (24 hours)

## ⚠️ Troubleshooting

### Connection Issues

If you experience connection problems:

1. **Bad Session**: Delete the `sessions` folder and reconnect
2. **Connection Lost**: The bot will automatically attempt to reconnect
3. **Multi-device Mismatch**: Ensure you're using a compatible WhatsApp version

### Common Errors

- **"Start with your country's WhatsApp code"**: Make sure to include your country code (e.g., 62 for Indonesia)
- **Connection Closed**: Check your internet connection and firewall settings
- **Device Logged Out**: Delete the `sessions` folder and authenticate again

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

**Affidev**

## ⭐ Support

If you find this project helpful, please give it a star! ⭐

## 📚 Built With

- [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API
