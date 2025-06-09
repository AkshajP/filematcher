// session-manager.js - Session Management UI
async function showSessionManager() {
    if (!window.cacheManager) {
        alert('Cache manager not available');
        return;
    }

    try {
        // Get recent sessions
        const sessions = await cacheManager.getRecentSessions(20);
        const storageInfo = await cacheManager.getStorageInfo();

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="session-manager-modal">
                <div class="modal-header">
                    <h2>Session Manager</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                
                <div class="modal-content">
                    <div class="storage-info">
                        <h3>Storage Usage</h3>
                        <div class="storage-bar">
                            <div class="storage-used" style="width: ${storageInfo.usagePercent || 0}%"></div>
                        </div>
                        <div class="storage-text">
                            ${formatBytes(storageInfo.usage)} / ${formatBytes(storageInfo.quota)} 
                            (${(storageInfo.usagePercent || 0).toFixed(1)}%)
                        </div>
                    </div>
                    
                    <div class="current-session">
                        <h3>Current Session</h3>
                        <div class="session-details">
                            <p><strong>ID:</strong> ${window.sessionId}</p>
                            <p><strong>Matched:</strong> ${window.matchedPairs.length} pairs</p>
                            <p><strong>Remaining:</strong> ${window.unmatchedReferences.length} references</p>
                            <button class="btn btn-primary" onclick="saveCurrentSession()">
                                💾 Save Current Session
                            </button>
                        </div>
                    </div>
                    
                    <div class="recent-sessions">
                        <h3>Recent Sessions</h3>
                        ${sessions.length === 0 ?
                '<p class="no-sessions">No saved sessions found</p>' :
                `<div class="sessions-list">
                                ${sessions.map(session => `
                                    <div class="session-item" data-session-id="${session.id}">
                                        <div class="session-info">
                                            <div class="session-id">${session.id}</div>
                                            <div class="session-date">${formatDate(session.timestamp)}</div>
                                            <div class="session-stats">
                                                ${session.data.matchedPairs?.length || 0} matched, 
                                                ${session.data.unmatchedReferences?.length || 0} remaining
                                            </div>
                                        </div>
                                        <div class="session-actions">
                                            <button class="btn btn-sm" onclick="loadSession('${session.id}')">
                                                Load
                                            </button>
                                            <button class="btn btn-sm btn-danger" onclick="deleteSession('${session.id}')">
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>`
            }
                    </div>

                    <div class="additional-actions">
                        <button class="btn btn-primary" id="detectPatternsBtn" onclick="detectPatternsFromModal()">
                            🔍 Detect Patterns
                        </button>
                        <button class="btn btn-primary" id="autoMatchBtn" onclick="runAutoMatchFromModal()">
                            🎯 Auto-Match
                        </button>
                    </div>
                    
                    <div class="cache-actions">
                        <button class="btn btn-secondary" onclick="cleanupCache()">
                            🧹 Clean Old Data (30+ days)
                        </button>
                        <button class="btn btn-danger" onclick="clearAllCache()">
                            🗑️ Clear All Cache
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

    } catch (error) {
        console.error('Failed to show session manager:', error);
        alert('Error loading session manager');
    }
}

async function saveCurrentSession() {
    if (!window.cacheManager) return;

    try {
        await saveSession();
        showNotification('Session saved successfully');

        // Refresh the session manager
        document.querySelector('.modal-overlay')?.remove();
        showSessionManager();
    } catch (error) {
        console.error('Failed to save session:', error);
        alert('Failed to save session');
    }
}

async function loadSession(sessionId) {
    if (!window.cacheManager) return;

    if (!confirm('Loading a session will replace your current work. Continue?')) {
        return;
    }

    try {
        const session = await cacheManager.loadSession(sessionId);
        if (session) {
            // Close modal
            document.querySelector('.modal-overlay')?.remove();

            // Restore session
            await restoreSession(session);
        }
    } catch (error) {
        console.error('Failed to load session:', error);
        alert('Failed to load session');
    }
}

async function deleteSession(sessionId) {
    if (!window.cacheManager) return;

    if (!confirm('Delete this session? This cannot be undone.')) {
        return;
    }

    try {
        // Delete from IndexedDB
        const tx = cacheManager.db.transaction(['sessions'], 'readwrite');
        const store = tx.objectStore('sessions');
        await store.delete(sessionId);

        showNotification('Session deleted');

        // Refresh the session manager
        document.querySelector('.modal-overlay')?.remove();
        showSessionManager();
    } catch (error) {
        console.error('Failed to delete session:', error);
        alert('Failed to delete session');
    }
}

async function cleanupCache() {
    if (!window.cacheManager) return;

    if (!confirm('Remove all data older than 30 days?')) {
        return;
    }

    try {
        const deletedCount = await cacheManager.cleanup(30);
        showNotification(`Cleaned up ${deletedCount} old records`);

        // Refresh the session manager
        document.querySelector('.modal-overlay')?.remove();
        showSessionManager();
    } catch (error) {
        console.error('Failed to cleanup cache:', error);
        alert('Failed to cleanup cache');
    }
}

async function clearAllCache() {
    if (!window.cacheManager) return;

    if (!confirm('Clear ALL cached data? This cannot be undone!')) {
        return;
    }

    try {
        await cacheManager.clearAll();
        showNotification('All cache data cleared');

        // Close modal
        document.querySelector('.modal-overlay')?.remove();
    } catch (error) {
        console.error('Failed to clear cache:', error);
        alert('Failed to clear cache');
    }
}

// Utility functions
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // Less than a minute
    if (diff < 60000) {
        return 'Just now';
    }
    // Less than an hour
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
    // Less than a day
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    // Less than a week
    if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    }

    // Format as date
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

// Make showNotification available globally if it isn't already
if (typeof showNotification === 'undefined') {
    window.showNotification = (message, type = 'success') => {
        const notification = document.getElementById('copyNotification');
        if (notification) {
            notification.textContent = message;
            notification.classList.add('show');
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }
    };
}