// fuzzy-matcher-worker.js - Web Worker for Background Fuzzy Matching

// Copy of fuzzy matching functions (since we can't access window objects in workers)
function calculateSimilarity(string1, string2) {
    if (!string1 || !string2) return 0;
    
    const str1 = string1.toLowerCase();
    const str2 = string2.toLowerCase();
    
    if (str1 === str2) return 1.0;
    if (str1.includes(str2)) return 0.9;
    if (str2.includes(str1)) return 0.85;
    
    const words1 = str1.split(/[\s\/\-_\.]+/);
    const words2 = str2.split(/[\s\/\-_\.]+/);
    
    let wordMatches = 0;
    for (const word2 of words2) {
        for (const word1 of words1) {
            if (word1.includes(word2) || word2.includes(word1)) {
                wordMatches++;
                break;
            }
        }
    }
    
    const wordScore = wordMatches / Math.max(words1.length, words2.length);
    
    const chars1 = [...str1];
    const chars2 = [...str2];
    let charMatches = 0;
    
    for (const char of chars2) {
        const index = chars1.indexOf(char);
        if (index !== -1) {
            charMatches++;
            chars1.splice(index, 1);
        }
    }
    
    const charScore = charMatches / Math.max(str1.length, str2.length);
    return (wordScore * 0.7) + (charScore * 0.3);
}

function calculateFuzzyScore(filePath, searchTerm) {
    if (!searchTerm.trim()) return 0;
    
    const parts = filePath.split('/');
    const fileName = parts.pop() || '';
    const pathParts = parts.join('/');
    const folderNames = parts.slice(0, -1);
    
    if (searchTerm.endsWith('/')) {
        const folderSearchTerm = searchTerm.slice(0, -1);
        return calculateSimilarity(pathParts, folderSearchTerm);
    }
    
    if (searchTerm.includes('/')) {
        const searchParts = searchTerm.split('/');
        const searchPath = searchParts.slice(0, -1).join('/');
        const searchFile = searchParts[searchParts.length - 1];
        
        const pathScore = calculateSimilarity(pathParts, searchPath);
        const fileScore = calculateSimilarity(fileName, searchFile);
        
        return (fileScore * 0.7) + (pathScore * 0.3);
    }
    
    const fileNameScore = calculateSimilarity(fileName, searchTerm);
    
    let bestFolderScore = 0;
    for (const folderName of folderNames) {
        const folderScore = calculateSimilarity(folderName, searchTerm);
        bestFolderScore = Math.max(bestFolderScore, folderScore);
    }
    
    return Math.max(fileNameScore * 0.7 + bestFolderScore * 0.3, bestFolderScore * 0.8);
}

function cleanFileName(fileName) {
    if (!fileName) return "";
    
    return fileName
        .replace(/\.[^/.]+$/, '')
        .replace(/^\w+-/, '')
        .replace(/\d{4}-\d{2}-\d{2}/, '')
        .replace(/_v\d+/, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/**
 * Extracts key identifying terms (like codes, numbers) from a string.
 * This helps the auto-matcher focus on the most important parts of a reference.
 * @param {string} text - The reference string.
 * @returns {string} - A string containing only the key terms.
 */
function extractKeyTerms(text) {
    if (!text) return "";

    // Regex to find codes like A5-01, CW-1, RDCC-APPENDIX-2-001, etc., and standalone numbers.
    const keyTermRegex = /([A-Z]+-?\d+-\d+)|([A-Z]+-?\d+)|(\d{3,})/g;
    const matches = text.match(keyTermRegex);

    if (matches) {
        // Join found key terms into a single search string.
        return matches.join(' ');
    }

    // Fallback if no specific key terms are found, return the cleaned file name.
    return cleanFileName(text);
}


// Message handler
self.onmessage = (e) => {
    const { type, data } = e.data;
    
    switch (type) {
        case 'search': {
            const results = performSearch(data.searchTerm, data.filePaths, data.usedPaths);
            self.postMessage({ type: 'searchResults', results });
            break;
        }
            
        case 'bulkMatch': {
            const matches = performBulkMatch(data.references, data.filePaths, data.threshold, data.usedPaths);
            self.postMessage({ 
                type: 'bulkMatchResults', 
                results: matches,
                requestId: data.requestId 
            });
            break;
        }
    }
};

function performSearch(searchTerm, filePaths, usedPaths) {
    const usedPathsSet = new Set(usedPaths);
    const availablePaths = filePaths.filter(path => !usedPathsSet.has(path));
    
    if (!searchTerm.trim()) {
        // Return all remaining file paths in original order when search is empty
        return availablePaths.slice(0, 100).map(path => ({
            path: path,
            score: 0
        }));
    }
    
    // Clean the search term
    const cleanedSearchTerm = cleanFileName(searchTerm);
    const keyTermsSearch = extractKeyTerms(searchTerm);
    
    const matches = availablePaths.map(filePath => {
        // Clean the file name for comparison
        const pathParts = filePath.split('/');
        const fileName = pathParts[pathParts.length - 1];
        const cleanedFileName = cleanFileName(fileName);
        
        // Calculate score using both original and cleaned versions
        const originalScore = calculateFuzzyScore(filePath, searchTerm);
        const cleanedScore = calculateFuzzyScore(cleanedFileName, cleanedSearchTerm);
        const keyTermsScore = calculateFuzzyScore(filePath, keyTermsSearch);
        
        return {
            path: filePath,
            score: Math.max(originalScore, cleanedScore, keyTermsScore)
        };
    }).filter(item => item.score > 0.05);
    
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, 20);
}

function performBulkMatch(references, filePaths, threshold, usedPaths = []) {
    const results = [];
    const usedPathsSet = new Set(usedPaths);
    const availablePaths = filePaths.filter(path => !usedPathsSet.has(path));
    
    for (const reference of references) {
        const cleanedReference = cleanFileName(reference);
        const keyTermsReference = extractKeyTerms(reference);

        const matches = availablePaths.map(path => {
            const pathParts = path.split('/');
            const fileName = pathParts[pathParts.length - 1];
            const cleanedFileName = cleanFileName(fileName);
            
            const originalScore = calculateFuzzyScore(path, reference);
            const cleanedScore = calculateFuzzyScore(cleanedFileName, cleanedReference);
            const keyTermsScore = calculateFuzzyScore(path, keyTermsReference);
            
            return {
                path,
                score: Math.max(originalScore, cleanedScore, keyTermsScore)
            };
        }).filter(m => m.score >= threshold);
        
        if (matches.length > 0) {
            matches.sort((a, b) => b.score - a.score);
            results.push({
                reference,
                bestMatch: matches[0],
                allMatches: matches.slice(0, 5) // Top 5 matches
            });
        }
    }
    
    return results;
}