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
function renderSearchResults(matches, searchTerm) {
    const searchResults = document.getElementById('searchResults');
    const isShowingAllFiles = !searchTerm.trim();

    // Use virtual scrolling for large result sets
    if (searchResultsScroller && matches.length > 100) {
        searchResultsScroller.setSearchMode(isShowingAllFiles);
        searchResultsScroller.setItems(matches);
        return;
    }

    // Get ordered arrays for numbered selection
    const selectedFilePaths = Array.from(window.selectedFilePaths);

    // Regular rendering for smaller result sets
    searchResults.innerHTML = matches.map((match) => {
        const parts = match.path.split('/');
        const fileName = parts.pop();
        const pathParts = parts.join('/');
        
        // Check if this file path is selected for bulk matching
        const isSelected = window.selectedFilePaths.has(match.path);
        const selectionIndex = selectedFilePaths.indexOf(match.path);
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
            selectionIndicator = `<input type="checkbox" class="result-checkbox" data-path="${match.path}" ${isSelected ? 'checked' : ''}>`;
        }
        
        return `
            <div class="result-item ${isSelected ? 'selected' : ''} ${learnedClass}" data-path="${match.path}" data-score="${match.score}" title="${scoreTitle}">
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

            // Clear any bulk selections (both references and paths)
            window.selectedReferences.clear();
            window.selectedFilePaths.clear();
            
            // Update the unmatched list to remove 'selected' styles
            updateUnmatchedList(); 

            // Handle single item selection
            for (const resultItem of resultItems) {
                resultItem.classList.remove('selected');
            }
            item.classList.add('selected');
            
            window.selectedResult = {
                path: item.getAttribute('data-path'),
                score: parseFloat(item.getAttribute('data-score'))
            };
            
            // Update the entire UI, which handles button states
            updateBulkActionUI();
        });
    }

    // Add event listeners for the result checkboxes for bulk selection
    const resultCheckboxes = document.querySelectorAll('.result-checkbox');
    for (const checkbox of resultCheckboxes) {
        checkbox.addEventListener('change', (e) => {
            const path = e.target.dataset.path;
            if (e.target.checked) {
                window.selectedFilePaths.add(path);
            } else {
                window.selectedFilePaths.delete(path);
            }
            
            // Clear single selection when a checkbox is used
            window.selectedResult = null; 
            document.querySelectorAll('.result-item.selected').forEach(el => {
                 if (!window.selectedFilePaths.has(el.dataset.path)) {
                    el.classList.remove('selected');
                 }
            });

            // Re-render to update numbers
            renderSearchResults(matches, searchTerm);
            updateBulkActionUI();
        });
    }

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
    
    // Get ordered arrays for numbered selection
    const selectedReferences = Array.from(window.selectedReferences);
    
    // Regular rendering for small lists
    unmatchedList.innerHTML = window.unmatchedReferences.map(reference => {
        const isSelected = window.selectedReferences.has(reference);
        const isActive = reference === window.currentReference;
        const isGenerated = isGeneratedReference(reference);
        
        const selectionIndex = selectedReferences.indexOf(reference);
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
        
        return `
            <div class="reference-item ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}" 
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

    // Condition for showing the bulk match button
    if (refCount > 0 && pathCount > 0 && refCount === pathCount) {
        bulkConfirmBtn.style.display = 'inline-flex';
        confirmBtn.style.display = 'none';
        skipBtn.style.display = 'none';
        bulkMatchCount.textContent = refCount;
    } else {
        bulkConfirmBtn.style.display = 'none';
        confirmBtn.style.display = 'inline-flex';
        skipBtn.style.display = 'inline-flex';

        // Re-evaluate single confirm button state
        confirmBtn.disabled = !window.selectedResult || window.selectedReferences.size > 0;
    }

    // Highlight selected results
    document.querySelectorAll('.result-item').forEach(item => {
        const path = item.dataset.path;
        item.classList.toggle('selected', window.selectedFilePaths.has(path));
    });
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