// lib/fuzzy-matcher.ts - Core Matching Algorithm

import { FileMatch, SearchResult } from './types';

/**
 * Calculates a similarity score between two strings based on word and character overlap.
 */
export function calculateSimilarity(string1: string, string2: string): number {
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

/**
 * Calculates a fuzzy match score, intelligently weighting file name vs. folder path.
 */
export function calculateFuzzyScore(filePath: string, searchTerm: string): number {
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
    
    return (fileScore * 0.7) + (pathScore * 0.5);
  }
  
  const fileNameScore = calculateSimilarity(fileName, searchTerm);
  
  let bestFolderScore = 0;
  for (const folderName of folderNames) {
    const folderScore = calculateSimilarity(folderName, searchTerm);
    bestFolderScore = Math.max(bestFolderScore, folderScore);
  }
  
  return Math.max(fileNameScore * 0.8 + bestFolderScore * 0.3, bestFolderScore * 0.8);
}

/**
 * Cleans and normalizes strings by removing extensions, prefixes, dates, etc.
 */
export function cleanFileName(text: string): string {
  if (!text) return "";
  
  return text
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
 */
export function extractKeyTerms(text: string): string {
  if (!text) return "";
  const keyTermRegex = /([A-Z]+-?\d+-\d+)|([A-Z]+-?\d+)|(\d{3,})/g;
  const matches = text.match(keyTermRegex);
  return matches ? matches.join(' ') : cleanFileName(text);
}

/**
 * The application's core search function.
 */
export function searchMatches(searchTerm: string, filePaths: string[], usedFilePaths: Set<string>): SearchResult[] {
  const cleanedSearchTerm = cleanFileName(searchTerm);
  const keyTermsSearch = extractKeyTerms(searchTerm);
  const availableFilePaths = filePaths.filter(path => !usedFilePaths.has(path));
  
  if (!searchTerm.trim()) {
    return availableFilePaths.map(path => ({ path, score: 0 }));
  }
  
  const matches = availableFilePaths.map(filePath => {
    const pathParts = filePath.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const cleanedFileName = cleanFileName(fileName);
    
    const originalScore = calculateFuzzyScore(filePath, searchTerm);
    const cleanedScore = calculateFuzzyScore(cleanedFileName, cleanedSearchTerm);
    const keyTermsScore = calculateFuzzyScore(filePath, keyTermsSearch);
    
    return {
      path: filePath,
      score: Math.max(originalScore, cleanedScore, keyTermsScore)
    };
  }).filter(item => item.score > 0.05);
  
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, 50); // Return top 50 for performance
}