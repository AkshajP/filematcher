// auto-matcher.js - Confidence-Based Auto-Matching

class AutoMatcher {
    constructor(options = {}) {
        this.batchSize = options.batchSize || 100;
        this.matchHistory = [];
        this.onProgress = null;
    }

    /**
     * Finds matches for the given references that meet or exceed the specified confidence threshold.
     * @param {number} threshold - The minimum confidence score (0.0 to 1.0) for a match.
     * @param {string[]} [references=window.unmatchedReferences] - An array of reference strings to match.
     * @returns {Promise<Array<Object>>} A promise that resolves to an array of matched pairs.
     */
    async findHighConfidenceMatches(threshold, references = window.unmatchedReferences) {
        const matches = [];
        const processedRefs = references || window.unmatchedReferences;

        // Process in batches to avoid blocking the UI.
        for (let i = 0; i < processedRefs.length; i += this.batchSize) {
            const batch = processedRefs.slice(i, i + this.batchSize);
            const batchMatches = await this.processBatch(batch, threshold);
            matches.push(...batchMatches);

            // Update progress if a callback is registered.
            if (this.onProgress) {
                this.onProgress({
                    processed: Math.min(i + batch.length, processedRefs.length),
                    total: processedRefs.length,
                    found: matches.length
                });
            }
        }
        return matches;
    }

    /**
     * Processes a single batch of references, offloading the work to a Web Worker if available.
     * @param {string[]} references - The batch of references.
     * @param {number} threshold - The confidence threshold.
     * @returns {Promise<Array<Object>>} A promise that resolves with the found matches for the batch.
     */
    async processBatch(references, threshold) {
        return new Promise((resolve) => {
            if (window.Worker && window.matcherManager) {
                const workerCallback = (workerResults) => {
                    if (!workerResults) {
                        resolve([]);
                        return;
                    }
                    // Transform the worker's output into the expected format.
                    const transformedMatches = workerResults.map(result => ({
                        reference: result.reference,
                        path: result.bestMatch.path,
                        score: result.bestMatch.score,
                        method: 'auto-high-confidence'
                    }));
                    resolve(transformedMatches);
                };
                window.matcherManager.bulkMatch(references, threshold, workerCallback);
            } else {
                // Fallback to main thread if workers are not available.
                const matches = [];
                for (const reference of references) {
                    const searchResults = searchMatches(reference);
                    if (searchResults.length > 0 && searchResults[0].score >= threshold) {
                        if (!window.usedFilePaths.has(searchResults[0].path)) {
                            matches.push({
                                reference,
                                path: searchResults[0].path,
                                score: searchResults[0].score,
                                method: 'auto-high-confidence'
                            });
                        }
                    }
                }
                resolve(matches);
            }
        });
    }

    /**
     * Shows a confirmation modal for the user to review and approve the auto-matches.
     * @param {Array<Object>} matches - The array of proposed matches.
     * @param {number} threshold - The threshold used to find the matches, for display purposes.
     * @returns {Promise<Array<Object>>} A promise that resolves with the array of confirmed matches.
     */
    async confirmMatches(matches, threshold) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="auto-match-confirmation">
                <h3>Confirm Auto-Matches</h3>
                <p>Found ${matches.length} matches with confidence ≥${(threshold * 100).toFixed(0)}%</p>
                <div class="match-preview-list">
                    ${matches.slice(0, 10).map(m => `
                        <div class="match-preview">
                            <div class="reference">${m.reference}</div>
                            <div class="arrow">→</div>
                            <div class="path">${m.path.split('/').pop()}</div>
                            <div class="confidence">${(m.score * 100).toFixed(1)}%</div>
                        </div>
                    `).join('')}
                    ${matches.length > 10 ? `<div class="more">... and ${matches.length - 10} more</div>` : ''}
                </div>
                <div class="actions">
                    <button id="confirmAutoMatch" class="btn btn-primary">Confirm All</button>
                    <button id="reviewAutoMatch" class="btn btn-secondary">Review Each</button>
                    <button id="cancelAutoMatch" class="btn btn-secondary">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        return new Promise((resolve) => {
            document.getElementById('confirmAutoMatch').onclick = () => {
                modal.remove();
                resolve(matches);
            };
            document.getElementById('reviewAutoMatch').onclick = () => {
                modal.remove();
                this.reviewEachMatch(matches).then(resolve);
            };
            document.getElementById('cancelAutoMatch').onclick = () => {
                modal.remove();
                resolve([]);
            };
        });
    }

    /**
     * Allows the user to review and confirm each match individually.
     * @param {Array<Object>} matches - The array of proposed matches.
     * @returns {Promise<Array<Object>>} A promise that resolves with the user-confirmed matches.
     */
    async reviewEachMatch(matches) {
        const reviewed = [];
        for (const match of matches) {
            const confirmed = await this.reviewSingleMatch(match);
            if (confirmed) {
                reviewed.push(match);
            }
        }
        return reviewed;
    }

    /**
     * Shows a modal for a single match review.
     * @param {Object} match - The match object to review.
     * @returns {Promise<boolean>} A promise that resolves to true if accepted, false otherwise.
     */
    async reviewSingleMatch(match) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="review-match-modal">
                    <h3>Review Match</h3>
                    <div class="match-details">
                        <div class="detail-row"><strong>Reference:</strong> ${match.reference}</div>
                        <div class="detail-row"><strong>Matched Path:</strong> ${match.path}</div>
                        <div class="detail-row"><strong>Confidence:</strong> ${(match.score * 100).toFixed(1)}%</div>
                    </div>
                    <div class="actions">
                        <button class="btn btn-primary" id="acceptSingle">Accept</button>
                        <button class="btn btn-secondary" id="skipSingle">Skip</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('#acceptSingle').onclick = () => {
                modal.remove();
                resolve(true);
            };
            modal.querySelector('#skipSingle').onclick = () => {
                modal.remove();
                resolve(false);
            };
        });
    }

    /**
     * Applies the confirmed matches to the application state.
     * @param {Array<Object>} matches - An array of confirmed match objects.
     * @returns {Promise<number>} The number of matches successfully applied.
     */
    async applyAutoMatches(matches) {
        let applied = 0;
        for (const match of matches) {
            if (!window.usedFilePaths.has(match.path)) {
                window.matchedPairs.push({
                    reference: match.reference,
                    path: match.path,
                    score: match.score,
                    timestamp: new Date().toISOString(),
                    method: match.method
                });
                window.usedFilePaths.add(match.path);
                const index = window.unmatchedReferences.indexOf(match.reference);
                if (index > -1) {
                    window.unmatchedReferences.splice(index, 1);
                }
                this.matchHistory.push(match);
                applied++;
            }
        }

        // Update UI
        updateUnmatchedList();
        updateMatchedList();
        updateStats();

        // Save to cache if available
        if (window.cacheManager) {
            await window.cacheManager.saveMappings(window.matchedPairs);
        }
        return applied;
    }

    /**
     * Returns statistics about the auto-matching session.
     * @returns {Object} An object with statistics.
     */
    getStatistics() {
        const stats = {
            totalProcessed: this.matchHistory.length,
            averageConfidence: 0,
            byMethod: {},
        };
        if (this.matchHistory.length > 0) {
            const totalScore = this.matchHistory.reduce((sum, m) => sum + m.score, 0);
            stats.averageConfidence = totalScore / this.matchHistory.length;
            // biome-ignore lint/complexity/noForEach: <explanation>
            this.matchHistory.forEach(m => {
                stats.byMethod[m.method] = (stats.byMethod[m.method] || 0) + 1;
            });
        }
        return stats;
    }
}

// Initialize the auto matcher instance.
window.autoMatcher = new AutoMatcher({
    batchSize: 100
});

/**
 * The main entry point for the auto-matching process, triggered by the UI button.
 * It handles the entire workflow from configuration to applying matches.
 */
async function runAutoMatch() {
    try {
        const threshold = await showAutoMatchConfigModal();
        if (threshold === null) return; // User cancelled

        const progressDiv = createProgressIndicator();
        window.autoMatcher.onProgress = (progress) => {
            progressDiv.innerHTML = `Processing: ${progress.processed}/${progress.total} (Found: ${progress.found})`;
        };

        const matches = await window.autoMatcher.findHighConfidenceMatches(threshold, window.unmatchedReferences);
        progressDiv.remove();

        if (matches.length === 0) {
            showNotification(`No matches found above ${Math.round(threshold * 100)}% confidence`, 'warning');
            return;
        }

        const confirmed = await window.autoMatcher.confirmMatches(matches, threshold);

        if (confirmed.length > 0) {
            const applied = await window.autoMatcher.applyAutoMatches(confirmed);
            showNotification(`Successfully auto-matched ${applied} references`, 'success');
        }
    } catch (error) {
        console.error('Auto-matching failed:', error);
        showNotification('Auto-matching failed. Please try again.', 'error');
    } finally {
        const progressDiv = document.querySelector('.progress-indicator');
        if (progressDiv) {
            progressDiv.remove();
        }
        window.autoMatcher.onProgress = null; // Clean up progress handler
    }
}

/**
 * Creates and shows a modal to let the user configure the auto-match threshold.
 * @returns {Promise<number|null>} A promise that resolves with the threshold or null if cancelled.
 */
function showAutoMatchConfigModal() {
    return new Promise(resolve => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="auto-match-config-modal">
                <h3>Configure Auto-Matcher</h3>
                <p>Set the minimum confidence score required for a match.</p>
                <div class="config-item">
                    <label for="threshold-slider">Confidence Threshold: <span id="threshold-value">80%</span></label>
                    <input type="range" id="threshold-slider" min="30" max="100" value="80">
                </div>
                <div class="actions">
                    <button id="runAutoMatchBtn" class="btn btn-primary">Run Auto-Matcher</button>
                    <button id="cancelAutoMatchBtn" class="btn btn-secondary">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const slider = modal.querySelector('#threshold-slider');
        const valueLabel = modal.querySelector('#threshold-value');

        slider.oninput = () => {
            valueLabel.textContent = `${slider.value}%`;
        };

        modal.querySelector('#runAutoMatchBtn').onclick = () => {
            const thresholdValue = Number.parseInt(slider.value, 10) / 100.0;
            modal.remove();
            resolve(thresholdValue);
        };

        modal.querySelector('#cancelAutoMatchBtn').onclick = () => {
            modal.remove();
            resolve(null);
        };
    });
}

/**
 * Creates and displays a progress indicator on the screen.
 * @returns {HTMLElement} The created progress indicator element.
 */
function createProgressIndicator() {
    let progressDiv = document.querySelector('.progress-indicator');
    if (progressDiv) progressDiv.remove(); // Remove any old one

    progressDiv = document.createElement('div');
    progressDiv.className = 'progress-indicator';
    progressDiv.innerHTML = 'Initializing...';
    progressDiv.style.cssText = `
        position: fixed; top: 20px; right: 20px; background: var(--primary-color, #2979ff);
        color: white; padding: 12px 20px; border-radius: var(--border-radius, 8px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 1001;
        font-weight: 500;
    `;
    document.body.appendChild(progressDiv);
    return progressDiv;
}

/**
 * Adds the "Auto-Match" button to the UI if it doesn't already exist.
 */
function initializeAutoMatch() {
    const bulkActions = document.getElementById('bulkActions');
    if (bulkActions && !document.getElementById('autoMatchBtn')) {
        const autoMatchBtn = document.createElement('button');
        autoMatchBtn.id = 'autoMatchBtn';
        autoMatchBtn.className = 'btn btn-primary';
        autoMatchBtn.innerHTML = '🎯 Auto-Match';
        autoMatchBtn.title = 'Automatically find and suggest matches for the selected items.';
        autoMatchBtn.onclick = runAutoMatch;
        bulkActions.prepend(autoMatchBtn);
    }
}

// Add CSS for the UI elements dynamically.
const autoMatchStyles = document.createElement('style');
autoMatchStyles.textContent = `
    .auto-match-confirmation, .review-match-modal {
        background: var(--bg-panel, #282c30);
        color: var(--text-primary, #e8eaed);
        border: 1px solid var(--border-color, rgba(255,255,255,0.15));
        border-radius: var(--border-radius, 8px);
        padding: var(--spacing-lg, 24px);
        width: 90%;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
    }
    .auto-match-confirmation h3, .review-match-modal h3 {
        margin: 0 0 var(--spacing-md, 16px) 0;
        text-align: center;
    }
    .match-preview-list {
        margin: 16px 0;
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid var(--border-color, rgba(255,255,255,0.15));
        border-radius: 6px;
    }
    .match-preview {
        display: grid;
        grid-template-columns: 1fr auto 1fr auto;
        gap: 8px;
        align-items: center;
        padding: 8px;
        border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.15));
        font-size: 14px;
    }
    .match-preview:last-child {
        border-bottom: none;
    }
    .match-preview .reference { color: var(--text-secondary, #bdc1c6); text-align: right; }
    .match-preview .arrow { color: var(--text-accent, #4CAF50); }
    .match-preview .path { font-family: monospace; color: var(--text-primary, #e8eaed); }
    .match-preview .confidence { color: var(--accent-color, #4CAF50); font-weight: bold; }
    .more { text-align: center; color: #666; font-style: italic; margin-top: 8px; }
    .review-match-modal .match-details { margin: 16px 0; line-height: 1.6; }
    .detail-row { margin: 8px 0; word-break: break-word; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
`;
document.head.appendChild(autoMatchStyles);

// Initialize when DOM is ready.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAutoMatch);
} else {
    initializeAutoMatch();
}