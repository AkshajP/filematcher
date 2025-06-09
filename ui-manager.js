// ui-manager.js - UI Management Functions (Updated with numbered selection)

// Virtual scrollers
let unmatchedScroller = null;
let searchResultsScroller = null;
let matchedScroller = null;

/**
 * Central function to update all UI components based on the current state.
 * This should be called after any action that changes the application state.
 */
function updateAllUI() {
    updateUnmatchedList();
    updateMatchedList();
    updateStats();
    updateSelectionUI();
    
    if (window.currentReference) {
        updateSearchResults();
    }
    
    // Ensure visual states are synchronized
    syncVisualStates();
}

function updateVisualSelection() {
    syncVisualStates();
    updateBulkActionUI();
    updateSelectionFeedback();
}

// Initialize virtual scrollers
function initializeVirtualScrollers() {
    const unmatchedList = document.getElementById('unmatchedList');
    const searchResults = document.getElementById('searchResults');
    const matchedList = document.getElementById('matchedList');
    
    // Only use virtual scrolling for large lists
    const useVirtualScrolling = window.unmatchedReferences.length > 100 || 
                              window.filePaths?.length > 100;
    
    if (useVirtualScrolling) {
        unmatchedScroller = new UnmatchedListScroller(unmatchedList);
        searchResultsScroller = new SearchResultsScroller(searchResults);
        matchedScroller = new MatchedListScroller(matchedList);
        
        console.log('Virtual scrolling enabled for performance');
    }
}

function updateSearchResults() {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    const confirmBtn = document.getElementById('confirmMatchBtn');
    
    const searchTerm = searchInput.value.trim();
    
    // Validate selections before proceeding
    validateSelections();
    
    // Use Web Worker for search if available
    if (window.matcherManager) {
        // Show loading state
        searchResults.innerHTML = '<div class="loading">Searching...</div>';
        
        window.matcherManager.search(searchTerm, (searchData) => {
            searchInput.classList.remove('searching');
            
            if (!searchData || !searchData.results || searchData.results.length === 0) {
                if (!searchTerm && window.currentReference) {
                    searchResults.innerHTML = `<div class="no-results">No file paths found.</div>`;
                } else if (searchTerm) {
                    searchResults.innerHTML = `<div class="no-results">No results found for "<strong>${searchTerm}</strong>"</div>`;
                } else {
                     searchResults.innerHTML = '<div class="no-results">🎉 All file paths have been matched!</div>';
                }
                confirmBtn.disabled = true;
                window.selectedResult = null;
                renderSuggestions(null);
                updateSelectionFeedback(); // Add feedback even when no results
                return;
            }
            
            // Render the results and the new suggestions
            renderSearchResults(searchData.results, searchTerm);
            renderSuggestions(searchData.suggestions);
        });
    } else {
        console.log('Using fallback search (no worker manager)');
        const searchData = searchMatches(searchTerm);
        searchInput.classList.remove('searching');
        
        if (!searchData || !searchData.results || searchData.results.length === 0) {
            if (!searchTerm && window.currentReference) {
                searchResults.innerHTML = `<div class="no-results">No file paths found.</div>`;
            } else if (searchTerm) {
                searchResults.innerHTML = `<div class="no-results">No results found for "<strong>${searchTerm}</strong>"</div>`;
            } else {
                 searchResults.innerHTML = '<div class="no-results">🎉 All file paths have been matched!</div>';
            }
            confirmBtn.disabled = true;
            window.selectedResult = null;
            renderSuggestions(null);
            updateSelectionFeedback(); // Add feedback even when no results
            return;
        }
        
        renderSearchResults(searchData.results, searchTerm);
        renderSuggestions(searchData.suggestions);
    }
}

/**
 * Renders the search result items in the center panel.
 * This function handles both single and bulk selection logic.
 * @param {Array<Object>} matches - The array of search result objects.
 * @param {string} searchTerm - The term that was searched for.
 */
// ui-manager.js - Fixed renderSearchResults with proper visual feedback

function renderSearchResults(matches, searchTerm) {
    const searchResults = document.getElementById('searchResults');
    const isShowingAllFiles = !searchTerm.trim();

    // Use virtual scrolling for large result sets
    if (searchResultsScroller && matches.length > 100) {
        searchResultsScroller.setSearchMode(isShowingAllFiles);
        searchResultsScroller.setItems(matches);
        return;
    }

    // Get VISUAL order of selected paths from current DOM (important for numbering)
    let visualPathOrder = [];
    const existingResults = document.querySelectorAll('#searchResults .result-item');
    existingResults.forEach(item => {
        const path = item.dataset.path;
        if (window.selectedFilePaths.has(path)) {
            visualPathOrder.push(path);
        }
    });

    // Add any new selections that aren't in visual order yet
    Array.from(window.selectedFilePaths).forEach(path => {
        if (!visualPathOrder.includes(path)) {
            visualPathOrder.push(path);
        }
    });

    // Regular rendering for smaller result sets
    searchResults.innerHTML = matches.map((match) => {
        const parts = match.path.split('/');
        const fileName = parts.pop();
        const pathParts = parts.join('/');
        
        // Check if this file path is selected for bulk matching
        const isSelected = window.selectedFilePaths.has(match.path);
        const selectionIndex = visualPathOrder.indexOf(match.path);
        const selectionNumber = selectionIndex >= 0 ? selectionIndex + 1 : null;

        // Learning engine UI integration
        const isLearned = match.isLearned || (match.scoreBreakdown && match.scoreBreakdown.learned > 0);
        const learnedClass = isLearned ? 'learned-match' : '';
        const learnedIcon = isLearned ? '<div class="learned-icon" title="Score enhanced by Learning Engine">🧠</div>' : '';

        let scoreTitle = `Final Score: ${(match.score * 100).toFixed(1)}%`;
        if (match.scoreBreakdown) {
            scoreTitle = `Base: ${(match.scoreBreakdown.base * 100).toFixed(0)}% + Learned: ${(match.scoreBreakdown.learned * 100).toFixed(0)}% = Final: ${(match.scoreBreakdown.final * 100).toFixed(0)}%`;
        }
        
        let scoreBadge = '';
        if (!isShowingAllFiles) {
            const scoreBadgeClass = match.score > 0.7 ? '' : 
                             match.score > 0.4 ? 'medium' : 'low';
            scoreBadge = `<div class="score-badge ${scoreBadgeClass}" title="${scoreTitle}">${(match.score * 100).toFixed(1)}%</div>`;
        }
        
        // Selection indicator - show number if selected, checkbox if not
        let selectionIndicator = '';
        if (isSelected && selectionNumber) {
            selectionIndicator = `<div class="selection-number">${selectionNumber}</div>`;
        } else {
            // Checkbox is enabled when:
            // 1. No references selected (single mode) - always allow
            // 2. In bulk mode but haven't exceeded reference count
            // 3. This item is already selected
            const canSelect = window.selectedReferences.size === 0 || 
                            window.selectedFilePaths.size < window.selectedReferences.size || 
                            isSelected;
            const checkboxDisabled = !canSelect ? 'disabled' : '';
            selectionIndicator = `<input type="checkbox" class="result-checkbox" data-path="${match.path}" ${isSelected ? 'checked' : ''} ${checkboxDisabled}>`;
        }

        // Apply proper CSS classes for visual feedback
        const selectedClass = isSelected ? 'selected' : '';
        const singleSelectedClass = window.selectedResult && window.selectedResult.path === match.path ? 'single-selected' : '';
        
        return `
            <div class="result-item ${selectedClass} ${singleSelectedClass} ${learnedClass}" 
                 data-path="${match.path}" 
                 data-score="${match.score}" 
                 title="${scoreTitle}">
                ${selectionIndicator}
                ${learnedIcon}
                <div class="file-item">
                    <div class="file-path">${pathParts}/</div>
                    <div class="file-name">${fileName}</div>
                </div>
                ${scoreBadge}
            </div>
        `;
    }).join('');

    // Add event listeners to result items for single selection
    const resultItems = document.querySelectorAll('.result-item');
    for (const item of resultItems) {
        item.addEventListener('click', (e) => {
            // Do nothing if the click was on the checkbox itself
            if (e.target.type === 'checkbox') return;

            // Only clear bulk selections if we're not in bulk mode (no references selected)
            if (window.selectedReferences.size === 0) {
                window.selectedFilePaths.clear();
                
                // Clear previous single selection styling
                resultItems.forEach(el => el.classList.remove('single-selected'));
                
                // Apply single selection styling
                item.classList.add('single-selected');
                
                window.selectedResult = {
                    path: item.getAttribute('data-path'),
                    score: parseFloat(item.getAttribute('data-score'))
                };
                
                // Update the unmatched list to remove bulk selection styles
                updateUnmatchedList(); 
            }
            // If in bulk mode, clicking items should not affect selections
            
            // Update the entire UI, which handles button states
            updateBulkActionUI();
        });
    }

    // Add event listeners for the result checkboxes for bulk selection
    const resultCheckboxes = document.querySelectorAll('.result-checkbox:not([disabled])');
    for (const checkbox of resultCheckboxes) {
        checkbox.addEventListener('change', (e) => {
            const path = e.target.dataset.path;
            
            if (e.target.checked) {
                // Only allow selection if we haven't exceeded reference count
                if (window.selectedFilePaths.size < window.selectedReferences.size) {
                    window.selectedFilePaths.add(path);
                } else {
                    e.target.checked = false;
                    showNotification('Cannot select more files than selected references', 'warning');
                    return;
                }
            } else {
                window.selectedFilePaths.delete(path);
            }
            
            // Clear single selection when using checkboxes
            window.selectedResult = null; 
            resultItems.forEach(el => el.classList.remove('single-selected'));

            // Re-render to update numbers and visual states
            renderSearchResults(matches, searchTerm);
            updateBulkActionUI();
        });
    }

    // Update selection feedback
    updateSelectionFeedback();
    
    // After rendering, ensure the button states are correct.
    updateBulkActionUI();
}
    

// Function to render learning suggestions
function renderSuggestions(suggestions) {
    const suggestionsContainer = document.getElementById('learningSuggestions');

    if (!suggestions || suggestions.length === 0) {
        suggestionsContainer.style.display = 'none';
        return;
    }

    suggestionsContainer.style.display = 'block';
    suggestionsContainer.innerHTML = `
        <h4>💡 Suggestions</h4>
        <div class="suggestions-list">
            ${suggestions.map(sug => `
                <div class="suggestion-item" title="Based on a common pattern with ${sug.usage} previous uses.">
                    <span class="suggestion-pattern">${sug.pattern}</span>
                    <span class="suggestion-confidence">${(sug.confidence * 100).toFixed(0)}%</span>
                </div>
            `).join('')}
        </div>
    `;
}

// Update unmatched list with numbered selection
function updateUnmatchedList() {
    const unmatchedList = document.getElementById('unmatchedList');
    
    if (window.unmatchedReferences.length === 0) {
        unmatchedList.innerHTML = '<div class="no-results">🎉 All references matched!</div>';
        return;
    }
    
    // Use virtual scrolling for large lists
    if (unmatchedScroller && window.unmatchedReferences.length > 100) {
        unmatchedScroller.setItems(window.unmatchedReferences);
        return;
    }
    
    // Get VISUAL order of selected references from current DOM (important for numbering)
    let visualRefOrder = [];
    const existingRefs = document.querySelectorAll('#unmatchedList .reference-item');
    existingRefs.forEach(item => {
        const ref = item.querySelector('.reference-text')?.textContent;
        if (ref && window.selectedReferences.has(ref)) {
            visualRefOrder.push(ref);
        }
    });

    // Add any new selections that aren't in visual order yet
    Array.from(window.selectedReferences).forEach(ref => {
        if (!visualRefOrder.includes(ref)) {
            visualRefOrder.push(ref);
        }
    });
    
    // Regular rendering for small lists
    unmatchedList.innerHTML = window.unmatchedReferences.map(reference => {
        const isSelected = window.selectedReferences.has(reference);
        const isActive = reference === window.currentReference;
        const isGenerated = isGeneratedReference(reference);
        
        const selectionIndex = visualRefOrder.indexOf(reference);
        const selectionNumber = selectionIndex >= 0 ? selectionIndex + 1 : null;
        
        // Selection indicator - show number if selected, checkbox if not
        let selectionIndicator = '';
        if (isSelected && selectionNumber) {
            selectionIndicator = `<div class="selection-number">${selectionNumber}</div>`;
        } else {
            selectionIndicator = `<input type="checkbox" class="reference-checkbox" 
                       ${isSelected ? 'checked' : ''}
                       onclick="toggleReferenceSelection('${reference.replace(/'/g, "\\'")}', event)">`;
        }

        // Apply proper CSS classes for visual feedback
        const selectedClass = isSelected ? 'selected' : '';
        const activeClass = isActive ? 'active' : '';
        
        return `
            <div class="reference-item ${activeClass} ${selectedClass}" 
                 onclick="selectReference('${reference.replace(/'/g, "\\'")}')">
                ${selectionIndicator}
                <div class="reference-text">${reference}</div>
                ${isGenerated ? '<div class="reference-type-badge generated">AUTO</div>' : '<div class="reference-type-badge original">ORIG</div>'}
            </div>
        `;
    }).join('');
}

// Update matched list
function updateMatchedList() {
    const matchedList = document.getElementById('matchedList');
    
    if (window.matchedPairs.length === 0) {
        matchedList.innerHTML = '<div class="no-results">No matches confirmed yet</div>';
        return;
    }
    
    // Use virtual scrolling for large lists
    if (matchedScroller && window.matchedPairs.length > 100) {
        matchedScroller.setItems(window.matchedPairs);
        return;
    }
    
    // Regular rendering for small lists
    matchedList.innerHTML = window.matchedPairs.map((pair, index) => {
        const parts = pair.path.split('/');
        const fileName = parts.pop();
        const pathParts = parts.join('/');
        
        return `
            <div class="matched-item">
                <div class="mapping-description">${pair.reference}</div>
                <div class="mapping-file">${pathParts}/${fileName}</div>
                <button class="remove-match" onclick="removeMatch(${index})" title="Remove match">×</button>
            </div>
        `;
    }).join('');
}

// Update statistics with proper footer progress bar
function updateStats() {
    const total = window.fileReferences.length;
    const matched = window.matchedPairs.length;
    const unmatched = window.unmatchedReferences.length;
    const progress = total > 0 ? Math.round((matched / total) * 100) : 0;
    
    // Update footer stats
    document.getElementById('unmatchedCount').textContent = unmatched;
    document.getElementById('matchedCount').textContent = matched;
    document.getElementById('progressPercent').textContent = `${progress}%`;
    
    // Update progress bar
    const progressFill = document.getElementById('progressFill');
    if (progressFill) {
        progressFill.style.width = `${progress}%`;
    }
    
    // Update right panel count
    const mappingsCount = document.getElementById('mappingsCount');
    if (mappingsCount) {
        mappingsCount.textContent = matched;
    }
}

// Update selection UI for multi-select
function updateSelectionUI() {
    const count = window.selectedReferences.size;
    const total = window.unmatchedReferences.length;
    
    document.getElementById('selectedCount').textContent = `${count} selected`;
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    selectAllCheckbox.checked = count === total && total > 0;
    selectAllCheckbox.indeterminate = count > 0 && count < total;
    
    const bulkActions = document.getElementById('bulkActions');
    if (count > 0) {
        bulkActions.classList.remove('hidden');
    } else {
        bulkActions.classList.add('hidden');
    }
    
    updateUnmatchedList();
    updateBulkActionUI();
    updateSelectionFeedback(); // Add this line
}
/**
 * Central function to manage the visibility and state of action buttons.
 */
function updateBulkActionUI() {
    const confirmBtn = document.getElementById('confirmMatchBtn');
    const bulkConfirmBtn = document.getElementById('confirmBulkMatchBtn');
    const bulkMatchCount = document.getElementById('bulkMatchCount');
    const skipBtn = document.getElementById('skipBtn');

    const refCount = window.selectedReferences.size;
    const pathCount = window.selectedFilePaths.size;

    // Condition for showing the bulk match button: 2+ references AND equal path count
    if (refCount >= 2 && pathCount > 0 && refCount === pathCount) {
        bulkConfirmBtn.style.display = 'inline-flex';
        confirmBtn.style.display = 'none';
        skipBtn.style.display = 'none';
        bulkMatchCount.textContent = refCount;
    } else {
        bulkConfirmBtn.style.display = 'none';
        confirmBtn.style.display = 'inline-flex';
        skipBtn.style.display = 'inline-flex';

        // Re-evaluate single confirm button state
        // Disable if we have any bulk selections OR no single selection
        confirmBtn.disabled = !window.selectedResult || window.selectedReferences.size > 0 || window.selectedFilePaths.size > 0;
    }

    // Highlight selected results
    document.querySelectorAll('.result-item').forEach(item => {
        const path = item.dataset.path;
        item.classList.toggle('selected', window.selectedFilePaths.has(path));
    });

    // Update skip button state
    skipBtn.disabled = !window.currentReference;
}

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.getElementById('copyNotification');
    if (notification) {
        // Clear previous classes
        notification.className = 'copy-notification';
        
        // Add type-specific class
        if (type !== 'success') {
            notification.classList.add(type);
        }
        
        // Set icon based on type
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        notification.innerHTML = `${icons[type] || icons.success} ${message}`;
        notification.classList.add('show');
        
        // Update styling based on type
        notification.style.background = type === 'error' ? '#f44336' : 
                                       type === 'warning' ? '#FF9800' : 
                                       type === 'info' ? '#2196F3' : 'rgb(18, 102, 79)';
        
        // Longer display time for errors
        const displayTime = type === 'error' ? 5000 : 3000;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, displayTime);
    }
}

// Make showNotification globally available
window.showNotification = showNotification;

// Add function to show search is pending (called before debounce)
function showSearchPending() {
    document.getElementById('searchInput').classList.add('searching');
}

function updateSelectionFeedback() {
    const searchResults = document.getElementById('searchResults');
    const refCount = window.selectedReferences.size;
    const pathCount = window.selectedFilePaths.size;
    
    // Remove existing feedback
    const existingFeedback = searchResults.querySelector('.selection-feedback');
    if (existingFeedback) {
        existingFeedback.remove();
    }
    
    // Add feedback if in bulk mode
    if (refCount > 0) {
        const feedback = document.createElement('div');
        feedback.className = 'selection-feedback';
        
        if (refCount >= 2) {
            feedback.innerHTML = `
                <div class="bulk-mode-indicator">
                    📋 Bulk Matching Mode: ${refCount} references selected
                    ${pathCount < refCount ? `<br>Select ${refCount - pathCount} more file path(s)` : ''}
                    ${pathCount === refCount ? '<br>✓ Ready to confirm bulk match' : ''}
                </div>
            `;
        } else {
            feedback.innerHTML = `
                <div class="selection-limit-warning">
                    ⚠️ Select at least 2 references to enable bulk matching
                </div>
            `;
        }
        
        searchResults.insertBefore(feedback, searchResults.firstChild);
    }
}

function validateSelections() {
    const refCount = window.selectedReferences.size;
    const pathCount = window.selectedFilePaths.size;
    
    // Remove excess file path selections if references were reduced
    if (pathCount > refCount) {
        const pathsArray = Array.from(window.selectedFilePaths);
        const excessPaths = pathsArray.slice(refCount);
        excessPaths.forEach(path => window.selectedFilePaths.delete(path));
        
        if (excessPaths.length > 0) {
            showNotification(`Removed ${excessPaths.length} excess file selection(s)`, 'info');
        }
    }
    
    return {
        isValid: pathCount <= refCount,
        canBulkMatch: refCount >= 2 && pathCount === refCount,
        canSingleMatch: refCount === 0 && window.selectedResult
    };
}

function syncVisualStates() {
    // Sync reference item visual states
    const referenceItems = document.querySelectorAll('.reference-item');
    referenceItems.forEach(item => {
        const refText = item.querySelector('.reference-text')?.textContent;
        if (refText) {
            const isSelected = window.selectedReferences.has(refText);
            const isActive = refText === window.currentReference;
            
            item.classList.toggle('selected', isSelected);
            item.classList.toggle('active', isActive);
        }
    });
    
    // Sync result item visual states
    const resultItems = document.querySelectorAll('.result-item');
    resultItems.forEach(item => {
        const path = item.dataset.path;
        if (path) {
            const isSelected = window.selectedFilePaths.has(path);
            const isSingleSelected = window.selectedResult && window.selectedResult.path === path;
            
            item.classList.toggle('selected', isSelected);
            item.classList.toggle('single-selected', isSingleSelected && window.selectedReferences.size === 0);
        }
    });
}