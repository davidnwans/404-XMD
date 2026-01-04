const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const url = text.split(' ').slice(1).join(' ').trim();
        
        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a Facebook video URL.\nExample: .fb https://www.facebook.com/..."
            }, { quoted: message });
        }

        // Validate Facebook URL - expanded domains
        const facebookDomains = [
            'facebook.com', 
            'fb.watch', 
            'fb.com', 
            'm.facebook.com',
            'web.facebook.com'
        ];
        
        const isFacebookUrl = facebookDomains.some(domain => url.includes(domain));
        if (!isFacebookUrl) {
            return await sock.sendMessage(chatId, { 
                text: "That doesn't look like a Facebook video link.\nSupported domains: facebook.com, fb.watch, fb.com"
            }, { quoted: message });
        }

        // Send loading reaction
        await sock.sendMessage(chatId, {
            react: { text: '🔄', key: message.key }
        });

        // Resolve share/short URLs
        let resolvedUrl = url;
        try {
            const res = await axios.head(url, { 
                timeout: 10000, 
                maxRedirects: 5, 
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });
            if (res.request?.res?.responseUrl) {
                resolvedUrl = res.request.res.responseUrl;
            }
        } catch (e) {
            // Use original URL if resolution fails
            console.log('URL resolution failed:', e.message);
        }

        // Try multiple APIs (fallback approach)
        const videoInfo = await tryMultipleApis(resolvedUrl);
        
        if (!videoInfo || !videoInfo.url) {
            return await sock.sendMessage(chatId, { 
                text: '❌ Failed to download video.\n\nPossible reasons:\n• Video is private/restricted\n• Link is invalid\n• Video may be a reel/short\n• APIs are temporarily down\n\nTry using: .fb2 [alternative method]'
            }, { quoted: message });
        }

        // Send the video
        const caption = videoInfo.title ? 
            `📱 *Facebook Video*\n\n📝 *Title:* ${videoInfo.title}\n\n⬇️ *Downloaded by 404-XMD*` : 
            '⬇️ *Downloaded by 404-XMD*';

        try {
            await sock.sendMessage(chatId, {
                video: { url: videoInfo.url },
                mimetype: "video/mp4",
                caption: caption
            }, { quoted: message });
        } catch (sendError) {
            console.error('Send error:', sendError.message);
            
            // Alternative: Send as document if video send fails
            await sock.sendMessage(chatId, {
                document: { url: videoInfo.url },
                mimetype: "video/mp4",
                fileName: `facebook_video_${Date.now()}.mp4`,
                caption: caption
            }, { quoted: message });
        }

    } catch (error) {
        console.error('Facebook command error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Error: ${error.message}\n\nTry:\n• Using a direct Facebook video link\n• Checking if video is public\n• Using the command: .fb2 [url] (alternative method)`
        }, { quoted: message });
    }
}

async function tryMultipleApis(url) {
    const apis = [
        {
            name: 'Hanggts API',
            url: `https://api.hanggts.xyz/download/facebook?url=${encodeURIComponent(url)}`,
            parser: (data) => {
                // Try different response formats
                if (data?.result?.media?.video_hd) return data.result.media.video_hd;
                if (data?.result?.media?.video_sd) return data.result.media.video_sd;
                if (data?.result?.url) return data.result.url;
                if (data?.data?.url) return data.data.url;
                if (data?.url) return data.url;
                if (typeof data === 'string' && data.startsWith('http')) return data;
                return null;
            }
        },
        {
            name: 'API 2 (alternative)',
            url: `https://api.siputzx.my.id/api/downloader/fbdl?url=${encodeURIComponent(url)}`,
            parser: (data) => data?.result?.hd || data?.result?.sd
        },
        {
            name: 'API 3 (fallback)',
            url: `https://api.fabdl.com/facebook/video?url=${encodeURIComponent(url)}`,
            parser: (data) => data?.video
        }
    ];

    for (const api of apis) {
        try {
            console.log(`Trying ${api.name}...`);
            const response = await axios.get(api.url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                }
            });

            if (response.data) {
                const videoUrl = api.parser(response.data);
                if (videoUrl && isValidUrl(videoUrl)) {
                    console.log(`Success with ${api.name}`);
                    return {
                        url: videoUrl,
                        title: response.data?.title || 'Facebook Video'
                    };
                }
            }
        } catch (error) {
            console.log(`${api.name} failed:`, error.message);
            continue;
        }
    }
    
    return null;
}

function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

module.exports = facebookCommand;