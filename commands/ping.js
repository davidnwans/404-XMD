const os = require('os');
const settings = require('../settings.js');

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
}

async function pingCommand(sock, chatId, message) {
    try {
        const start = Date.now();
        await sock.sendMessage(chatId, { text: '🏓 Pinging...' }, { quoted: message });
        const end = Date.now();
        const ping = end - start;

        const uptime = formatTime(process.uptime());
        const totalMem = (os.totalmem() / (1024 ** 3)).toFixed(1);
        const usedMem = ((os.totalmem() - os.freemem()) / (1024 ** 3)).toFixed(1);

        const status = `
┌── *404-XMD STATUS* ──
│
│ ⚡ *Speed:* ${ping}ms
│ ⏱️ *Uptime:* ${uptime}
│ 🟢 *Status:* Online
│ 🧠 *RAM:* ${usedMem}GB/${totalMem}GB
│ 🏷️ *Version:* v${settings.version}
│
└── ${new Date().toLocaleTimeString()} ──
        `.trim();

        await sock.sendMessage(chatId, { text: status }, { quoted: message });

    } catch (error) {
        console.error('Ping error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Error: ${error.message}` 
        }, { quoted: message });
    }
}

module.exports = pingCommand;