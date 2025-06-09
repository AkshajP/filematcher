// workflow-manager.js - Workflow Management Functions

// Multi-select functionality
function toggleReferenceSelection(reference, event) {
    event.stopPropagation();
    
    if (window.selectedReferences.has(reference)) {
        window.selectedReferences.delete(reference);
    } else {
        window.selectedReferences.add(reference);
    }
    
    updateSelectionUI();
}

function selectAllReferences() {
    const selectAll = document.getElementById('selectAllCheckbox').checked;
    
    if (selectAll) {
        for (const ref of window.unmatchedReferences) {
            window.selectedReferences.add(ref);
        }
    } else {
        window.selectedReferences.clear();
    }
    
    updateAllUI();
}

function bulkSkipReferences() {
    const selected = Array.from(window.selectedReferences);
    
    // Move selected references to end of list
    for (const ref of selected) {
        const index = window.unmatchedReferences.indexOf(ref);
        if (index > -1) {
            window.unmatchedReferences.splice(index, 1);
            window.unmatchedReferences.push(ref);
        }
    }
    
    window.selectedReferences.clear();
    
    // Select next available reference
    if (window.unmatchedReferences.length > 0) {
        selectReference(window.unmatchedReferences[0]);
    } else {
        updateAllUI();
    }
}

function bulkDeselectAll() {
    window.selectedReferences.clear();
    updateSelectionUI();
}

// Extract file names from remaining file paths and create new references

function detectRemainingFiles() {
    const availableFilePaths = filePaths.filter(path => !window.usedFilePaths.has(path));
    
    if (availableFilePaths.length === 0) {
        showNotification('No remaining files to process!', 'warning');
        return;
    }
    
    const newReferences = availableFilePaths.map(filePath => {
        const parts = filePath.split('/');
        const fileName = parts.pop();
        let referenceName = fileName.replace(/\.[^/.]+$/, '');
        
        referenceName = referenceName
            .replace(/^\w+-/, '')
            .replace(/^RDCC-APPENDIX-\d+-\d+\s*-\s*/, '')
            .replace(/^(ELM-WAH-LTR-\d+|C0+\d+|D0+\d+|B0+\d+)\s*-?\s*/i, '')
            .replace(/dated\s+\d+\s+\w+\s+\d+/i, '')
            .replace(/\s+/g, ' ')
            .trim();
            
        const parentFolder = parts[parts.length - 1];
        if (parts.length > 2 && parentFolder && !referenceName.toLowerCase().includes(parentFolder.toLowerCase())) {
            referenceName = `${parentFolder} - ${referenceName}`;
        }
        
        return referenceName || fileName;
    });
    
    const uniqueNew = newReferences.filter(ref => !window.unmatchedReferences.includes(ref));
    window.unmatchedReferences.push(...uniqueNew);
    
    showNotification(`Added ${uniqueNew.length} new references from file paths.`, 'success');
    updateAllUI();
}

// Check if a reference was auto-generated from remaining files
function isGeneratedReference(reference) {
    const index = window.unmatchedReferences.indexOf(reference);
    return window.originalReferencesCount && index >= window.originalReferencesCount;
}

// Select reference for mapping
function selectReference(reference) {
    window.currentReference = reference;
    window.selectedResult = null;
    
    document.getElementById('currentReference').style.display = 'block';
    document.getElementById('currentReferenceText').textContent = reference;
    document.getElementById('searchInput').value = '';
    document.getElementById('confirmMatchBtn').disabled = true;
    document.getElementById('skipBtn').disabled = false;
    
    updateAllUI();
}

// Confirm match
async function confirmMatch() {
    if (!window.currentReference || !window.selectedResult) return;
    
    // Add to matched pairs with timestamp
    window.matchedPairs.push({
        reference: window.currentReference,
        path: window.selectedResult.path,
        score: window.selectedResult.score,
        timestamp: new Date().toISOString(), // Add ISO timestamp
        method: 'manual', // Track match method
        sessionId: window.sessionId || 'default' // Track session
    });
    
    // Mark file path as used
    window.usedFilePaths.add(window.selectedResult.path);
    
    // Remove from unmatched - create new array instead of reassigning
    const index = window.unmatchedReferences.indexOf(window.currentReference);
    if (index > -1) {
        window.unmatchedReferences.splice(index, 1);
    }
    
    if (window.cacheManager) {
        try {
            await window.cacheManager.saveSession();
        } catch (error) {
            console.error('Failed to save session to cache:', error);
        }
    }
    
    // Clear current selection
    window.currentReference = null;
    window.selectedResult = null;
    
    if (window.unmatchedReferences.length > 0) {
        selectReference(window.unmatchedReferences[0]);
    } else {
        document.getElementById('currentReference').style.display = 'none';
        document.getElementById('searchInput').value = '';
        document.getElementById('searchResults').innerHTML = '<div class="no-results">🎉 All references have been matched!</div>';
        document.getElementById('confirmMatchBtn').disabled = true;
        document.getElementById('skipBtn').disabled = true;
        updateAllUI();
    }
}

// Skip current reference
function skipReference() {
    if (!window.currentReference) return;
    
    // Move current reference to end of list
    const index = window.unmatchedReferences.indexOf(window.currentReference);
    if (index > -1) {
        window.unmatchedReferences.splice(index, 1);
        window.unmatchedReferences.push(window.currentReference);
    }
    
    // Select next reference
    if (window.unmatchedReferences.length > 0) {
        selectReference(window.unmatchedReferences[0]);
    } else {
        updateAllUI();
    }
}

// Remove matched pair
function removeMatch(index) {
    const pair = window.matchedPairs[index];
    if (pair) {
        window.unmatchedReferences.unshift(pair.reference);
        window.usedFilePaths.delete(pair.path);
        window.matchedPairs.splice(index, 1);
        updateAllUI();
    }
}

/**
 * NEW: Handles the bulk matching of selected references and file paths.
 */
async function confirmBulkMatch() {
    const refsToMatch = Array.from(window.selectedReferences);
    const pathsToMatch = Array.from(window.selectedFilePaths);

    if (refsToMatch.length === 0 || refsToMatch.length !== pathsToMatch.length) {
        showNotification("Selection count for references and files must match.", "error");
        return;
    }

    if (!confirm(`Are you sure you want to match ${refsToMatch.length} selected items?`)) {
        return;
    }

    // Show loading state
    showNotification(`Matching ${refsToMatch.length} pairs...`, 'info');

    // We need to match based on the visual order.
    // Get the ordered lists from the DOM.
    const orderedRefs = Array.from(document.querySelectorAll('#unmatchedList .reference-item'))
        .map(el => el.querySelector('.reference-text').textContent)
        .filter(ref => window.selectedReferences.has(ref));
    
    const orderedPaths = Array.from(document.querySelectorAll('#searchResults .result-item'))
        .map(el => el.dataset.path)
        .filter(path => window.selectedFilePaths.has(path));

    for (let i = 0; i < orderedRefs.length; i++) {
        const ref = orderedRefs[i];
        const path = orderedPaths[i];

        // Add to matched pairs
        window.matchedPairs.push({
            reference: ref,
            path: path,
            score: 1.0, // Manual match is considered 100%
            timestamp: new Date().toISOString(),
            method: 'manual-bulk',
            sessionId: window.sessionId || 'default'
        });

        // Mark as used
        window.usedFilePaths.add(path);

        // Remove from unmatched
        const index = window.unmatchedReferences.indexOf(ref);
        if (index > -1) {
            window.unmatchedReferences.splice(index, 1);
        }
    }

    // Clear selections BEFORE updating UI
    window.selectedReferences.clear();
    window.selectedFilePaths.clear();

    // Save session
    if (window.cacheManager) {
        try {
            await window.cacheManager.saveSession();
        } catch (error) {
            console.error('Failed to save session:', error);
        }
    }

    // Show success notification
    showNotification(`Successfully matched ${orderedRefs.length} pairs!`, 'success');
    
    // Update ALL UI components properly
    if (window.unmatchedReferences.length > 0) {
        // Select the first unmatched reference
        selectReference(window.unmatchedReferences[0]);
    } else {
        // No more references - clear the search panel
        window.currentReference = null;
        window.selectedResult = null;
        document.getElementById('currentReference').style.display = 'none';
        document.getElementById('searchInput').value = '';
        document.getElementById('searchResults').innerHTML = '🎉 All references have been matched!';
        document.getElementById('confirmMatchBtn').disabled = true;
        document.getElementById('skipBtn').disabled = true;
    }
    
    // Force complete UI update
    updateAllUI();
}

// Add visual feedback during bulk operations
function showBulkProcessing(show = true) {
    const unmatchedList = document.getElementById('unmatchedList');
    const searchResults = document.getElementById('searchResults');
    const bulkBtn = document.getElementById('confirmBulkMatchBtn');
    
    if (show) {
        unmatchedList.classList.add('bulk-processing');
        searchResults.classList.add('bulk-processing');
        bulkBtn.disabled = true;
        bulkBtn.textContent = 'Processing...';
    } else {
        unmatchedList.classList.remove('bulk-processing');
        searchResults.classList.remove('bulk-processing');
        bulkBtn.disabled = false;
        bulkBtn.innerHTML = `✓ Confirm Bulk Match (${window.selectedReferences.size})`;
    }
}