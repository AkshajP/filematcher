// pattern-matcher.js - Pattern Detection and Bulk Matching
class PatternMatcher {
    constructor() {
        this.patterns = {
            exhibit: {
                regex: /^Exhibit\s+([A-Z]+\d*)-(\d+)(?:\s*-\s*(.+))?$/i,
                extract: (match) => ({
                    type: 'exhibit',
                    series: match[1],
                    number: Number.parseInt(match[2]),
                    description: match[3] || ''
                })
            },
            appendix: {
                regex: /^Appendix\s+(\d+)(?:\s+to\s+(.+?))?(?:\s*[-–]\s*(.+))?$/i,
                extract: (match) => ({
                    type: 'appendix',
                    number: Number.parseInt(match[1]),
                    parent: match[2] || '',
                    description: match[3] || ''
                })
            },
            witness: {
                regex: /^([CR]W)-(\d+)\s*(?:-\s*)?(.+)?$/i,
                extract: (match) => ({
                    type: 'witness',
                    party: match[1],
                    number: Number.parseInt(match[2]),
                    description: match[3] || ''
                })
            },
            document: {
                regex: /^([A-Z]+)\s*(\d{4,})(?:\s*-\s*(.+))?$/,
                extract: (match) => ({
                    type: 'document',
                    code: match[1],
                    number: match[2],
                    description: match[3] || ''
                })
            }
        };
    }
    
    detectPatterns(references) {
        const detectedSeries = new Map();
        
        for (const ref of references) {
            for (const [patternName, pattern] of Object.entries(this.patterns)) {
                const match = ref.match(pattern.regex);
                if (match) {
                    const extracted = pattern.extract(match);
                    const seriesKey = `${extracted.type}:${extracted.series || extracted.party || extracted.code}`;
                    
                    if (!detectedSeries.has(seriesKey)) {
                        detectedSeries.set(seriesKey, {
                            type: extracted.type,
                            series: extracted.series || extracted.party || extracted.code,
                            items: []
                        });
                    }
                    
                    detectedSeries.get(seriesKey).items.push({
                        reference: ref,
                        ...extracted
                    });
                    break;
                }
            }
        }
        
        // Sort items within each series
        for (const series of detectedSeries.values()) {
            series.items.sort((a, b) => a.number - b.number);
        }
        
        return detectedSeries;
    }
    
    findPathPattern(series, filePaths) {
        // Find common path pattern for the series
        const firstItem = series.items[0];
        const potentialPaths = filePaths.filter(path => {
            const score = calculateFuzzyScore(path, firstItem.reference);
            return score > 0.7;
        });
        
        if (potentialPaths.length === 0) return null;
        
        // Extract pattern from best match
        const bestPath = potentialPaths[0];
        const pathPattern = this.extractPathPattern(bestPath, firstItem);
        
        return pathPattern;
    }
    
    extractPathPattern(path, referenceData) {
        // Create a pattern template from the path
        let pattern = path;
        
        // Replace the number with a placeholder
        if (referenceData.number) {
            const numStr = referenceData.number.toString();
            const paddedNum = numStr.padStart(2, '0');
            
            pattern = pattern.replace(numStr, '{number}');
            pattern = pattern.replace(paddedNum, '{number:02}');
        }
        
        // Replace series identifier
        if (referenceData.series) {
            pattern = pattern.replace(referenceData.series, '{series}');
        }
        
        return {
            template: pattern,
            hasNumberPadding: pattern.includes('{number:02}')
        };
    }
    
    generatePathsForSeries(series, pathPattern) {
        const generatedMappings = [];
        
        for (const item of series.items) {
            let path = pathPattern.template;
            
            // Replace placeholders
            path = path.replace('{series}', item.series || '');
            
            if (pathPattern.hasNumberPadding) {
                path = path.replace('{number:02}', item.number.toString().padStart(2, '0'));
            } else {
                path = path.replace('{number}', item.number.toString());
            }
            
            generatedMappings.push({
                reference: item.reference,
                suggestedPath: path,
                confidence: 0.30 // High confidence for pattern matches
            });
        }
        
        return generatedMappings;
    }
}

// bulk-operations.js - Bulk Operations Manager
class BulkOperationsManager {
    constructor() {
        this.patternMatcher = new PatternMatcher();
    }
    
    detectAndSuggestBulkMatches() {
        const detectedSeries = this.patternMatcher.detectPatterns(window.unmatchedReferences);
        const suggestions = [];
        
        for (const [seriesKey, series] of detectedSeries) {
            if (series.items.length < 2) continue; // Skip single items
            
            const pathPattern = this.patternMatcher.findPathPattern(series, window.filePaths);
            if (pathPattern) {
                const mappings = this.patternMatcher.generatePathsForSeries(series, pathPattern);
                
                suggestions.push({
                    seriesKey,
                    series,
                    mappings,
                    totalItems: series.items.length
                });
            }
        }
        
        return suggestions;
    }
    
    async confirmBulkSuggestions(suggestions) {
        const confirmed = [];
        
        for (const suggestion of suggestions) {
            const seriesInfo = `${suggestion.series.type} ${suggestion.series.series}`;
            const confirmMsg = `Apply pattern matching for ${seriesInfo} (${suggestion.totalItems} items)?`;
            
            if (confirm(confirmMsg)) {
                for (const mapping of suggestion.mappings) {
                    // Verify path exists
                    if (window.filePaths.includes(mapping.suggestedPath)) {
                        confirmed.push({
                            reference: mapping.reference,
                            path: mapping.suggestedPath,
                            score: mapping.confidence,
                            method: 'pattern',
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            }
        }
        
        return confirmed;
    }
    
    async applyBulkMatches(matches) {
        let successCount = 0;
        
        for (const match of matches) {
            if (!window.usedFilePaths.has(match.path)) {
                window.matchedPairs.push(match);
                window.usedFilePaths.add(match.path);
                
                // Remove from unmatched
                const index = window.unmatchedReferences.indexOf(match.reference);
                if (index > -1) {
                    window.unmatchedReferences.splice(index, 1);
                }
                
                successCount++;
            }
        }
        
        // Update UI
        updateUnmatchedList();
        updateMatchedList();
        updateStats();
        
        return successCount;
    }
}

// Initialize bulk operations manager
window.bulkOpsManager = new BulkOperationsManager();

// Add event listener for pattern detection button
function initializePatternDetection() {
    // Add button to UI if not exists
    const bulkActions = document.getElementById('bulkActions');
    if (bulkActions && !document.getElementById('detectPatternsBtn')) {
        const detectBtn = document.createElement('button');
        detectBtn.id = 'detectPatternsBtn';
        detectBtn.className = 'bulk-btn bulk-btn-primary';
        detectBtn.innerHTML = '🔍 Detect Patterns';
        detectBtn.onclick = detectPatterns;
        bulkActions.appendChild(detectBtn);
    }
}

async function detectPatterns() {
    const suggestions = window.bulkOpsManager.detectAndSuggestBulkMatches();
    
    if (suggestions.length === 0) {
        alert('No patterns detected in unmatched references');
        return;
    }
    
    // Show pattern summary
    let summary = 'Detected Patterns:\n\n';
    for (const suggestion of suggestions) {
        summary += `${suggestion.series.type.toUpperCase()} Series: ${suggestion.series.series}\n`;
        summary += `Items: ${suggestion.totalItems}\n\n`;
    }
    
    if (confirm(`${summary}\nProceed with pattern matching?`)) {
        const confirmed = await window.bulkOpsManager.confirmBulkSuggestions(suggestions);
        
        if (confirmed.length > 0) {
            const applied = await window.bulkOpsManager.applyBulkMatches(confirmed);
            alert(`Successfully matched ${applied} references using pattern detection`);
        }
    }
}

// Call initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePatternDetection);
} else {
    initializePatternDetection();
}