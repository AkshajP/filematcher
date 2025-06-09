// Initialize UI button when DOM is ready
function initializeLearningUI() {
    // Ensure the function is globally available
    window.showLearningStats = showLearningStats;
    window.exportLearningData = exportLearningData;
    window.importLearningData = importLearningData;
    window.resetLearning = resetLearning;

    // Add learning stats button to the header if it doesn't exist
    const statsDiv = document.querySelector('.header .stats');
    if (statsDiv && !document.getElementById('learningStatsBtn')) {
        const learningBtn = document.createElement('button');
        learningBtn.id = 'learningStatsBtn';
        learningBtn.className = 'session-btn';
        learningBtn.innerHTML = '🧠 Learning Stats';
        learningBtn.onclick = showLearningStats;

        // Insert after the stats div
        statsDiv.parentNode.insertBefore(learningBtn, statsDiv.nextSibling);
    }
}

// Call initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLearningUI);
} else {
    initializeLearningUI();
}


class LearningEngine {
    constructor() {
        this.patterns = new Map();
        this.termMappings = new Map();
        this.scoringWeights = {
            word: 0.7,
            character: 0.3,
            learned: 0.2
        };
        this.matchHistory = [];
        this.statistics = {
            totalMatches: 0,
            successfulMatches: 0,
            failedMatches: 0,
            averageConfidence: 0
        };
    }

    recordMatch(reference, path, score, confirmed = true) {
        this.statistics.totalMatches++;
        if (confirmed) {
            this.statistics.successfulMatches++;
        } else {
            this.statistics.failedMatches++;
        }

        this.statistics.averageConfidence =
            (this.statistics.averageConfidence * (this.statistics.totalMatches - 1) + score) / this.statistics.totalMatches;

        const referencePattern = this.extractPattern(reference);
        const pathPattern = this.extractPattern(path);

        if (!this.patterns.has(referencePattern)) {
            this.patterns.set(referencePattern, new Map());
        }

        const pathPatterns = this.patterns.get(referencePattern);
        const currentCount = pathPatterns.get(pathPattern) || 0;
        pathPatterns.set(pathPattern, currentCount + (confirmed ? 1 : -1));

        this.recordTermMappings(reference, path, confirmed);

        this.matchHistory.push({
            reference,
            path,
            score,
            confirmed,
            timestamp: new Date().toISOString(),
            patterns: { referencePattern, pathPattern }
        });

        if (this.matchHistory.length > 1000) {
            this.matchHistory.shift();
        }

        this.updateWeights();

        if (window.cacheManager) {
            cacheManager.savePattern(referencePattern, Array.from(pathPatterns.entries()));
        }
    }

    extractPattern(text) {
        return text.toLowerCase()
            .replace(/\d+/g, '#')
            .replace(/\.[^/.]+$/, '')
            .replace(/[_-]+/g, ' ')
            .replace(/\b(v|ver|version)\s*#/g, 'v#')
            .replace(/\s+/g, ' ')
            .trim();
    }

    recordTermMappings(reference, path, confirmed) {
        const refTerms = this.extractTerms(reference);
        const pathTerms = this.extractTerms(path);

        for (const refTerm of refTerms) {
            if (!this.termMappings.has(refTerm)) {
                this.termMappings.set(refTerm, new Map());
            }

            const mappings = this.termMappings.get(refTerm);

            for (const pathTerm of pathTerms) {
                const currentScore = mappings.get(pathTerm) || 0;
                mappings.set(pathTerm, currentScore + (confirmed ? 0.1 : -0.05));
            }
        }
    }

    extractTerms(text) {
        return text.toLowerCase()
            .split(/[\s\/\-_\.]+/)
            .filter(term => term.length > 2)
            .filter(term => !this.isStopWord(term));
    }

    isStopWord(term) {
        const stopWords = ['the', 'and', 'for', 'with', 'from', 'pdf', 'doc', 'docx', 'txt', 'file'];
        return stopWords.includes(term);
    }

    enhanceScore(reference, path, baseScore) {
        const refPattern = this.extractPattern(reference);
        const pathPattern = this.extractPattern(path);

        let patternBonus = 0;
        if (this.patterns.has(refPattern)) {
            const pathPatterns = this.patterns.get(refPattern);
            const patternCount = pathPatterns.get(pathPattern) || 0;
            patternBonus = Math.min(0.15, Math.log(patternCount + 1) * 0.03);
        }

        let termBonus = 0;
        const refTerms = this.extractTerms(reference);
        const pathTerms = this.extractTerms(path);
        let termMatchCount = 0;

        for (const refTerm of refTerms) {
            if (this.termMappings.has(refTerm)) {
                const mappings = this.termMappings.get(refTerm);
                for (const pathTerm of pathTerms) {
                    const termScore = mappings.get(pathTerm) || 0;
                    if (termScore > 0) {
                        termBonus += termScore;
                        termMatchCount++;
                    }
                }
            }
        }

        if (termMatchCount > 0) {
            termBonus = Math.min(0.15, termBonus / Math.sqrt(termMatchCount));
        }

        const learnedBonus = (patternBonus + termBonus) * this.scoringWeights.learned;
        const enhancedScore = baseScore * (1 - this.scoringWeights.learned) + learnedBonus;

        return {
            score: Math.min(1, enhancedScore),
            breakdown: {
                base: baseScore,
                pattern: patternBonus,
                term: termBonus,
                learned: learnedBonus,
                final: Math.min(1, enhancedScore)
            }
        };
    }

    getSuggestions(reference) {
        const refPattern = this.extractPattern(reference);
        const suggestions = [];

        if (this.patterns.has(refPattern)) {
            const pathPatterns = this.patterns.get(refPattern);

            const sortedPatterns = Array.from(pathPatterns.entries())
                .filter(([_, count]) => count > 0)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            for (const [pattern, count] of sortedPatterns) {
                suggestions.push({
                    pattern,
                    confidence: Math.min(0.9, count * 0.1),
                    usage: count
                });
            }
        }
        return suggestions;
    }

    getTermSuggestions(reference) {
        const suggestions = [];
        const refTerms = this.extractTerms(reference);
        const pathSuggestions = new Map();

        for (const term of refTerms) {
            if (this.termMappings.has(term)) {
                const mappings = this.termMappings.get(term);
                for (const [pathTerm, score] of mappings) {
                    if (score > 0.1) {
                        const currentScore = pathSuggestions.get(pathTerm) || 0;
                        pathSuggestions.set(pathTerm, currentScore + score);
                    }
                }
            }
        }

        // Convert to suggestions
        const sortedSuggestions = Array.from(pathSuggestions.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        for (const [term, score] of sortedSuggestions) {
            suggestions.push({
                type: 'term',
                term,
                confidence: Math.min(0.8, score),
                reason: "Common mapping for similar references"
            });
        }

        return suggestions;
    }

    getPatternRecency(pattern) {
        const recent = this.matchHistory
            .filter(m => this.extractPattern(m.path) === pattern)
            .map(m => new Date(m.timestamp).getTime());

        return recent.length > 0 ? Math.max(...recent) : 0;
    }

    getPatternLastUsed(pattern) {
        const recency = this.getPatternRecency(pattern);
        return recency > 0 ? new Date(recency).toISOString() : null;
    }

    getPatternExamples(pattern) {
        return this.matchHistory
            .filter(m => this.extractPattern(m.path) === pattern && m.confirmed)
            .map(m => ({
                reference: m.reference,
                path: m.path,
                score: m.score
            }))
            .slice(-3);
    }

    updateWeights() {
        const successRate = this.statistics.successfulMatches / (this.statistics.totalMatches || 1);

        // Gradually increase learning weight as more data is collected
        // and success rate is high
        if (this.statistics.totalMatches > 50 && successRate > 0.8) {
            const dataFactor = Math.min(1, this.statistics.totalMatches / 500);
            const successFactor = Math.max(0, (successRate - 0.8) * 5); // 0 at 80%, 1 at 100%

            this.scoringWeights.learned = 0.2 + (0.2 * dataFactor * successFactor);

            // Rebalance other weights
            const remaining = 1 - this.scoringWeights.learned;
            this.scoringWeights.word = remaining * 0.7;
            this.scoringWeights.character = remaining * 0.3;
        }
    }

    getStatistics() {
        return {
            patternsLearned: this.patterns.size,
            termMappings: this.termMappings.size,
            totalObservations: Array.from(this.patterns.values()).reduce((sum, map) => {
                return sum + Array.from(map.values()).reduce((s, count) => s + Math.abs(count), 0);
            }, 0),
            matchHistory: this.matchHistory.length,
            statistics: { ...this.statistics },
            currentWeights: { ...this.scoringWeights },
            topPatterns: this.getTopPatterns(5),
            recentMatches: this.matchHistory.slice(-10).reverse()
        };
    }

    getTopPatterns(limit = 10) {
        const allPatterns = [];

        for (const [refPattern, pathPatterns] of this.patterns) {
            for (const [pathPattern, count] of pathPatterns) {
                if (count > 0) {
                    allPatterns.push({
                        reference: refPattern,
                        path: pathPattern,
                        count,
                        examples: this.getPatternExamples(pathPattern).slice(0, 2)
                    });
                }
            }
        }

        return allPatterns.sort((a, b) => b.count - a.count).slice(0, limit);
    }

    async loadFromCache() {
        if (!window.cacheManager) return;

        try {
            const patterns = await cacheManager.getAllPatterns();

            for (const { pattern, matches } of patterns) {
                this.patterns.set(pattern, new Map(matches));
            }

            console.log(`Loaded ${patterns.length} patterns from cache`);
        } catch (error) {
            console.error('Failed to load patterns from cache:', error);
        }
    }

    exportLearningData() {
        return {
            version: '1.0',
            exportDate: new Date().toISOString(),
            patterns: Array.from(this.patterns.entries()).map(([ref, paths]) => ({
                reference: ref,
                mappings: Array.from(paths.entries())
            })),
            termMappings: Array.from(this.termMappings.entries()).map(([term, mappings]) => ({
                term,
                mappings: Array.from(mappings.entries())
            })),
            statistics: this.statistics,
            weights: this.scoringWeights
        };
    }

    importLearningData(data) {
        if (data.patterns) {
            for (const { reference, mappings } of data.patterns) {
                this.patterns.set(reference, new Map(mappings));
            }
        }

        if (data.termMappings) {
            for (const { term, mappings } of data.termMappings) {
                this.termMappings.set(term, new Map(mappings));
            }
        }

        if (data.statistics) {
            Object.assign(this.statistics, data.statistics);
        }

        if (data.weights) {
            Object.assign(this.scoringWeights, data.weights);
        }

        console.log('Learning data imported successfully');
    }

    reset() {
        this.patterns.clear();
        this.termMappings.clear();
        this.matchHistory = [];
        this.statistics = {
            totalMatches: 0,
            successfulMatches: 0,
            failedMatches: 0,
            averageConfidence: 0
        };
        this.scoringWeights = {
            word: 0.7,
            character: 0.3,
            learned: 0.2
        };
    }
}

// Initialize learning engine
window.learningEngine = new LearningEngine();
window.lastSearchResults = []; // To store results for negative training

/**
 * This is now the main, authoritative search function for the entire application.
 * It takes the base search results and enhances them with the learning engine.
 * @param {string} searchTerm - The term to search for.
 * @returns {Object} A standardized search data object: { results, suggestions }.
 */
function searchMatches(searchTerm) {
    const baseResults = baseSearchMatches(searchTerm);
    
    const enhancedResults = baseResults.map(result => {
        const enhanced = window.learningEngine.enhanceScore(
            window.currentReference || searchTerm,
            result.path,
            result.score
        );
        
        return {
            ...result,
            baseScore: result.score,
            score: enhanced.score,
            scoreBreakdown: enhanced.breakdown,
            isLearned: enhanced.breakdown.learned > 0
        };
    });
    
    enhancedResults.sort((a, b) => b.score - a.score);
    
    window.lastSearchResults = enhancedResults;

    const suggestions = window.learningEngine.getSuggestions(window.currentReference || searchTerm);
    
    return {
        results: enhancedResults,
        suggestions,
    };
}

// Override search function to use learning
if (typeof searchMatches !== 'undefined' && !window.originalSearchMatches) {
    window.originalSearchMatches = searchMatches;
}
window.searchMatches = searchWithLearning; // This is the key override


// Update confirm match to record learning data
const originalConfirmMatch = window.confirmMatch;
window.confirmMatch = () => {
    if (!window.currentReference || !window.selectedResult) return;

    // Record in learning engine
    window.learningEngine.recordMatch(
        window.currentReference,
        window.selectedResult.path,
        window.selectedResult.score,
        true // confirmed
    );

    // Collect negative samples from other high-scoring results
    if (window.lastSearchResults) {
        const otherResults = window.lastSearchResults.filter(
            r => r.path !== window.selectedResult.path && r.score > 0.5
        );

        for (const result of otherResults.slice(0, 3)) {
            window.learningEngine.recordMatch(
                window.currentReference,
                result.path,
                result.score,
                false // not confirmed
            );
        }
    }

    // Call original function
    originalConfirmMatch();
};

// Add skip recording
const originalSkipReference = window.skipReference;
window.skipReference = () => {
    if (window.currentReference && window.selectedResult) {
        // Record as negative match
        window.learningEngine.recordMatch(
            window.currentReference,
            window.selectedResult.path,
            window.selectedResult.score,
            false // not confirmed
        );
    }

    originalSkipReference();
};


// Initialize learning stats UI
function showLearningStats() {
    const stats = window.learningEngine.getStatistics();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="learning-stats-modal">
            <div class="modal-header">
                <h3>Learning Engine Statistics</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${stats.patternsLearned}</div>
                    <div class="stat-label">Patterns Learned</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.termMappings}</div>
                    <div class="stat-label">Term Mappings</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.statistics.totalMatches}</div>
                    <div class="stat-label">Total Matches</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${(stats.statistics.averageConfidence * 100).toFixed(1)}%</div>
                    <div class="stat-label">Avg Confidence</div>
                </div>
            </div>
            
            <div class="weight-display">
                <h4>Current Scoring Weights</h4>
                <div class="weight-bars">
                    <div class="weight-bar">
                        <span>Word Matching</span>
                        <div class="bar" style="width: ${stats.currentWeights.word * 100}%">
                            ${(stats.currentWeights.word * 100).toFixed(0)}%
                        </div>
                    </div>
                    <div class="weight-bar">
                        <span>Character Matching</span>
                        <div class="bar" style="width: ${stats.currentWeights.character * 100}%">
                            ${(stats.currentWeights.character * 100).toFixed(0)}%
                        </div>
                    </div>
                    <div class="weight-bar">
                        <span>Learned Patterns</span>
                        <div class="bar learned" style="width: ${stats.currentWeights.learned * 100}%">
                            ${(stats.currentWeights.learned * 100).toFixed(0)}%
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="top-patterns">
                <h4>Top Learned Patterns</h4>
                ${stats.topPatterns.length > 0 ? `
                    <div class="pattern-list">
                        ${stats.topPatterns.map(p => `
                            <div class="pattern-item">
                                <div class="pattern-header">
                                    <span class="pattern-ref">${p.reference}</span>
                                    <span class="pattern-arrow">→</span>
                                    <span class="pattern-path">${p.path}</span>
                                    <span class="pattern-count">${p.count} uses</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : '<div class="no-patterns">No patterns learned yet. Start matching to build patterns!</div>'}
            </div>
            
            <div class="actions">
                <button class="btn btn-primary" onclick="window.exportLearningData()">Export Learning Data</button>
                <button class="btn btn-secondary" onclick="window.importLearningData()">Import Learning Data</button>
                <button class="btn btn-danger" onclick="window.resetLearning()">Reset Learning</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// Initialize when the DOM is ready.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLearningUI);
} else {
    initializeLearningUI();
}
