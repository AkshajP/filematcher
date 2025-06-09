// app.js - Application State and Initialization

// Application state
// biome-ignore lint/style/useConst: <explanation>
let unmatchedReferences = [];
// biome-ignore lint/style/useConst: <explanation>
let matchedPairs = [];
const usedFilePaths = new Set();
const selectedReferences = new Set(); // For multi-select
let originalReferencesCount = 0; // Track original vs auto-generated references
const selectedFilePaths = new Set(); // NEW: For bulk file path selection


// Initialize global state on window for cross-module access
window.currentReference = null;
window.selectedResult = null;
window.usedFilePaths = usedFilePaths;
window.selectedReferences = selectedReferences;
window.selectedFilePaths = selectedFilePaths; // NEW
window.unmatchedReferences = unmatchedReferences;
window.matchedPairs = matchedPairs;

/**
 * Debounce utility function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Create debounced search function
let debouncedSearch;
let cacheManager;

// Initialize application
async function initializeApp() {
    console.log('Starting app initialization...');
    try {
        // Initialize cache manager
        try {
            cacheManager = new CacheManager();
            await cacheManager.init();
            window.cacheManager = cacheManager;
            console.log('Cache manager initialized');

            // Check for previous session
            const lastSessionId = localStorage.getItem('lastSessionId');
            if (lastSessionId) {
                const session = await cacheManager.loadSession(lastSessionId);
                if (session && confirm('Restore previous session?')) {
                    await restoreSession(session);
                    return;
                }
            }
        } catch (error) {
            console.warn('Cache manager initialization failed:', error);
            // Continue without cache
        }

        // Generate session ID
        window.sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('lastSessionId', window.sessionId);

        // Load data sources FIRST
        const dataLoaded = await loadDataSources();
        console.log('Data loaded:', dataLoaded);
        console.log('fileReferences available:', !!window.fileReferences, 'length:', window.fileReferences?.length);
        console.log('filePaths available:', !!window.filePaths, 'length:', window.filePaths?.length);

        // Initialize Web Worker Manager AFTER data is loaded
        if (!window.matcherManager && window.filePaths && window.filePaths.length > 0) {
            window.matcherManager = new FuzzyMatcherManager();
            console.log('Web Worker Manager initialized');
        }

        // Initialize state
        originalReferencesCount = window.fileReferences.length;
        window.originalReferencesCount = originalReferencesCount;

        unmatchedReferences.length = 0; // Clear array
        unmatchedReferences.push(...window.fileReferences); // Add all references

        // Create debounced search function after checking if updateSearchResults exists
        if (typeof updateSearchResults === 'function') {
            debouncedSearch = debounce(updateSearchResults, 300);
        } else {
            // Placeholder function until UI manager is loaded
            debouncedSearch = debounce(() => {
                console.log('updateSearchResults not yet defined');
            }, 300);
        }

        // Set up event listeners
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                if (typeof showSearchPending === 'function') {
                    showSearchPending(); // Show visual feedback immediately
                }
                debouncedSearch(); // Execute debounced search
            });
        }

        const confirmBtn = document.getElementById('confirmMatchBtn');
        if (confirmBtn) confirmBtn.addEventListener('click', () => {
            if (typeof confirmMatch === 'function') confirmMatch();
        });

        const skipBtn = document.getElementById('skipBtn');
        if (skipBtn) skipBtn.addEventListener('click', () => {
            if (typeof skipReference === 'function') skipReference();
        });

        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) exportBtn.addEventListener('click', () => {
            if (typeof exportMappings === 'function') exportMappings();
        });

        // Multi-select event listeners
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox) selectAllCheckbox.addEventListener('change', () => {
            if (typeof selectAllReferences === 'function') selectAllReferences();
        });

        const bulkSkipBtn = document.getElementById('bulkSkipBtn');
        if (bulkSkipBtn) bulkSkipBtn.addEventListener('click', () => {
            if (typeof bulkSkipReferences === 'function') bulkSkipReferences();
        });

        const bulkDeselectBtn = document.getElementById('bulkDeselectBtn');
        if (bulkDeselectBtn) bulkDeselectBtn.addEventListener('click', () => {
            if (typeof bulkDeselectAll === 'function') bulkDeselectAll();
        });

        const detectRemainingBtn = document.getElementById('detectRemainingBtn');
        if (detectRemainingBtn) detectRemainingBtn.addEventListener('click', () => {
            if (typeof detectRemainingFiles === 'function') detectRemainingFiles();
        });

        // NEW: Add event listener for the new bulk confirm button
        const bulkConfirmBtn = document.getElementById('confirmBulkMatchBtn');
        if (bulkConfirmBtn) bulkConfirmBtn.addEventListener('click', () => {
            if (typeof confirmBulkMatch === 'function') confirmBulkMatch();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !document.getElementById('confirmMatchBtn').disabled) {
                if (typeof confirmMatch === 'function') confirmMatch();
            } else if (e.key === 'Escape') {
                if (typeof skipReference === 'function') skipReference();
            } else if (e.ctrlKey && e.key === 'a') {
                e.preventDefault();
                const checkbox = document.getElementById('selectAllCheckbox');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    if (typeof selectAllReferences === 'function') selectAllReferences();
                }
            }
        });


        // Initialize UI
        if (typeof initializeVirtualScrollers === 'function') {
            initializeVirtualScrollers(); // Initialize virtual scrolling if needed
        }
        if (typeof updateUnmatchedList === 'function') {
            updateUnmatchedList();
        }
        if (typeof updateMatchedList === 'function') {
            updateMatchedList();
        }
        if (typeof updateStats === 'function') {
            updateStats();
        }
        if (typeof updateSelectionUI === 'function') {
            updateSelectionUI();
        }

        // Auto-select first reference
        if (unmatchedReferences.length > 0 && typeof selectReference === 'function') {
            selectReference(unmatchedReferences[0]);
        }

        // Set up auto-save
        if (cacheManager) {
            setInterval(async () => {
                await saveSession();
            }, 30000); // Save every 30 seconds

            // Save on page unload
            window.addEventListener('beforeunload', () => {
                saveSession();
            });
        }

        // Initialize new features
        if (typeof initializePatternDetection === 'function') {
            initializePatternDetection();
        }
        if (typeof initializeAutoMatch === 'function') {
            initializeAutoMatch();
        }
        if (typeof initializeImportExport === 'function') {
            initializeImportExport();
        }

        // Initialize learning engine
        if (window.learningEngine) {
            await window.learningEngine.loadFromCache();
        }

        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Failed to initialize application:', error);
        alert('Failed to load data sources. Using fallback data.');
    }
}

// Session management functions
async function saveSession() {
    if (!cacheManager) return;

    try {
        await cacheManager.saveSession({
            id: window.sessionId,
            unmatchedReferences: window.unmatchedReferences,
            matchedPairs: window.matchedPairs,
            usedFilePaths: Array.from(window.usedFilePaths),
            selectedReferences: Array.from(window.selectedReferences)
        });

        await cacheManager.saveMappings(window.matchedPairs);
        console.log('Session saved to cache');
    } catch (error) {
        console.error('Session save failed:', error);
    }
}

async function restoreSession(session) {
    try {
        window.sessionId = session.id;

        // Restore data sources
        if (session.data.fileReferences) {
            window.fileReferences = session.data.fileReferences;
        }
        if (session.data.filePaths) {
            window.filePaths = session.data.filePaths;
        }

        // Restore state
        window.unmatchedReferences = session.data.unmatchedReferences || [];
        window.matchedPairs = session.data.matchedPairs || [];
        window.usedFilePaths = new Set(session.data.usedFilePaths || []);
        window.selectedReferences = new Set(session.data.selectedReferences || []);

        // Initialize components
        if (!window.matcherManager && window.filePaths && window.filePaths.length > 0) {
            window.matcherManager = new FuzzyMatcherManager();
            console.log('Web Worker Manager initialized');
        }

        // Set up debounced search
        if (typeof updateSearchResults === 'function') {
            debouncedSearch = debounce(updateSearchResults, 300);
        } else {
            debouncedSearch = debounce(() => {
                console.log('updateSearchResults not yet defined');
            }, 300);
        }

        // Set up event listeners
        setupEventListeners();

        // Update UI
        if (typeof updateUnmatchedList === 'function') {
            updateUnmatchedList();
        }
        if (typeof updateMatchedList === 'function') {
            updateMatchedList();
        }
        if (typeof updateStats === 'function') {
            updateStats();
        }
        if (typeof updateSelectionUI === 'function') {
            updateSelectionUI();
        }

        showNotification('Session restored successfully');
        console.log('Session restored from cache');
    } catch (error) {
        console.error('Failed to restore session:', error);
        // Continue with normal initialization
        initializeApp();
    }
}

function setupEventListeners() {
    // Set up event listeners
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            if (typeof showSearchPending === 'function') {
                showSearchPending(); // Show visual feedback immediately
            }
            debouncedSearch(); // Execute debounced search
        });
    }

    const confirmBtn = document.getElementById('confirmMatchBtn');
    if (confirmBtn) confirmBtn.addEventListener('click', () => {
        if (typeof confirmMatch === 'function') confirmMatch();
    });

    const skipBtn = document.getElementById('skipBtn');
    if (skipBtn) skipBtn.addEventListener('click', () => {
        if (typeof skipReference === 'function') skipReference();
    });

    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', () => {
        if (typeof exportMappings === 'function') exportMappings();
    });

    // Multi-select event listeners
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) selectAllCheckbox.addEventListener('change', () => {
        if (typeof selectAllReferences === 'function') selectAllReferences();
    });

    const bulkSkipBtn = document.getElementById('bulkSkipBtn');
    if (bulkSkipBtn) bulkSkipBtn.addEventListener('click', () => {
        if (typeof bulkSkipReferences === 'function') bulkSkipReferences();
    });

    const bulkDeselectBtn = document.getElementById('bulkDeselectBtn');
    if (bulkDeselectBtn) bulkDeselectBtn.addEventListener('click', () => {
        if (typeof bulkDeselectAll === 'function') bulkDeselectAll();
    });

    const detectRemainingBtn = document.getElementById('detectRemainingBtn');
    if (detectRemainingBtn) detectRemainingBtn.addEventListener('click', () => {
        if (typeof detectRemainingFiles === 'function') detectRemainingFiles();
    });

    // New bulkConfirmBtn listener.
    const bulkConfirmBtn = document.getElementById('confirmBulkMatchBtn');
    if (bulkConfirmBtn) bulkConfirmBtn.addEventListener('click', () => {
        if (typeof confirmBulkMatch === 'function') confirmBulkMatch();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !document.getElementById('confirmMatchBtn').disabled) {
            if (typeof confirmMatch === 'function') confirmMatch();
        } else if (e.key === 'Escape') {
            if (typeof skipReference === 'function') skipReference();
        } else if (e.ctrlKey && e.key === 'a') {
            e.preventDefault();
            const checkbox = document.getElementById('selectAllCheckbox');
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                if (typeof selectAllReferences === 'function') selectAllReferences();
            }
        }
    });
}

// Start the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    initializeApp();
});