const os = require('os');
const axios = require('axios');
const settings = require('../settings.js');

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
}

// Function to get user's location from IP
async function getUserLocation() {
    try {
        // Using free IP geolocation API
        const response = await axios.get('https://ipapi.co/json/', {
            timeout: 5000
        });
        
        const data = response.data;
        if (data.city && data.country_name) {
            return {
                city: data.city,
                country: data.country_name,
                countryCode: data.country_code,
                region: data.region,
                timezone: data.timezone,
                ip: data.ip
            };
        }
    } catch (error) {
        console.log('IP geolocation failed:', error.message);
    }
    
    // Fallback to a simpler API
    try {
        const response = await axios.get('https://ipinfo.io/json', {
            timeout: 5000
        });
        
        const data = response.data;
        if (data.city && data.country) {
            return {
                city: data.city,
                country: data.country,
                countryCode: data.country,
                region: data.region,
                timezone: data.timezone,
                ip: data.ip
            };
        }
    } catch (error) {
        console.log('Fallback geolocation failed:', error.message);
    }
    
    return null;
}

// Get time based on user's detected timezone
function getUserLocalTime(location) {
    try {
        if (location && location.timezone) {
            const now = new Date();
            return now.toLocaleTimeString('en-US', {
                timeZone: location.timezone,
                hour12: true,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
    } catch (error) {
        console.log('Timezone conversion failed:', error.message);
    }
    
    // Fallback to Nairobi time
    const now = new Date();
    const nairobiHours = (now.getUTCHours() + 3) % 24;
    const hours = nairobiHours % 12 || 12;
    const minutes = now.getUTCMinutes().toString().padStart(2, '0');
    const seconds = now.getUTCSeconds().toString().padStart(2, '0');
    const ampm = nairobiHours >= 12 ? 'PM' : 'AM';
    
    return `${hours}:${minutes}:${seconds} ${ampm}`;
}

async function pingCommand(sock, chatId, message) {
    try {
        const start = Date.now();
        
        // Get user's location in background
        const locationPromise = getUserLocation();
        
        await sock.sendMessage(chatId, { text: '🏓 Pinging...' }, { quoted: message });
        const end = Date.now();
        const ping = end - start;

        const uptime = formatTime(process.uptime());
        const totalMem = (os.totalmem() / (1024 ** 3)).toFixed(1);
        const usedMem = ((os.totalmem() - os.freemem()) / (1024 ** 3)).toFixed(1);
        
        // Get location data
        const location = await locationPromise;
        const userTime = getUserLocalTime(location);
        
        // Build status message
        let status = `
┌── *404-XMD STATUS* ──
│
│ ⚡ *Speed:* ${ping}ms
│ ⏱️ *Uptime:* ${uptime}
│ 🟢 *Status:* Online
│ 🧠 *RAM:* ${usedMem}GB/${totalMem}GB
│ 🏷️ *Version:* v${settings.version}
│
│ 🕒 *Your Time:* ${userTime}
        `;
        
        // Add location info if available
        if (location) {
            status += `
│ 📍 *Your Location:* ${location.city}, ${location.country}
│ 🌐 *Timezone:* ${location.timezone || 'EAT (UTC+3)'}
│ 🔢 *IP:* ${location.ip.substring(0, 8)}...`;
        } else {
            status += `
│ 📍 *Default Location:* Nairobi, Kenya
│ 🌐 *Timezone:* EAT (UTC+3)`;
        }
        
        status += `
│
└─────────────────────`;
        
        await sock.sendMessage(chatId, { text: status.trim() }, { quoted: message });

    } catch (error) {
        console.error('Ping error:', error);
        
        // Even if location fails, show basic ping info
        const errorStatus = `
┌── *404-XMD STATUS* ──
│
│ ⚡ *Speed:* ${Date.now() - start || 'N/A'}ms
│ ⏱️ *Uptime:* ${formatTime(process.uptime())}
│ 🟢 *Status:* Online
│ 🧠 *RAM:* ${((os.totalmem() - os.freemem()) / (1024 ** 3)).toFixed(1)}GB/${(os.totalmem() / (1024 ** 3)).toFixed(1)}GB
│ 🏷️ *Version:* v${settings.version}
│
│ 📍 *Location:* Could not detect
│ ⚠️ *Note:* Location service unavailable
│
└─────────────────────`.trim();
        
        await sock.sendMessage(chatId, { 
            text: errorStatus 
        }, { quoted: message });
    }
}

module.exports = pingCommand;