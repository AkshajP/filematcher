// import-export-manager.js - Enhanced Import/Export functionality
class ImportExportManager {
    constructor() {
        this.exportFormats = {
            csv: this.exportCSV.bind(this),
            json: this.exportJSON.bind(this),
            tsv: this.exportTSV.bind(this)
        };
        
        this.importFormats = {
            csv: this.importCSV.bind(this),
            json: this.importJSON.bind(this),
            tsv: this.importTSV.bind(this)
        };
    }
    
    // Export Methods
    async exportMappings(format = 'csv') {
        const exporter = this.exportFormats[format];
        if (!exporter) {
            throw new Error(`Unsupported export format: ${format}`);
        }
        
        return exporter(window.matchedPairs);
    }
    
    exportCSV(mappings) {
        const headers = ['File Reference', 'File Path', 'Match Score', 'Timestamp', 'Method', 'Session ID'];
        const rows = mappings.map(pair => [
            pair.reference,
            pair.path,
            `${(pair.score * 100).toFixed(1)}%`,
            pair.timestamp || new Date().toISOString(),
            pair.method || 'manual',
            pair.sessionId || window.sessionId || 'default'
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => 
                row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
            )
        ].join('\n');
        
        return {
            content: csvContent,
            mimeType: 'text/csv',
            filename: `mappings_${new Date().toISOString().split('T')[0]}.csv`
        };
    }
    
    exportTSV(mappings) {
        const headers = ['File Reference', 'File Path', 'Match Score', 'Timestamp', 'Method', 'Session ID'];
        const rows = mappings.map(pair => [
            pair.reference,
            pair.path,
            `${(pair.score * 100).toFixed(1)}%`,
            pair.timestamp || new Date().toISOString(),
            pair.method || 'manual',
            pair.sessionId || window.sessionId || 'default'
        ]);
        
        const tsvContent = [
            headers.join('\t'),
            ...rows.map(row => 
                row.map(field => String(field).replace(/\t/g, ' ')).join('\t')
            )
        ].join('\n');
        
        return {
            content: tsvContent,
            mimeType: 'text/tab-separated-values',
            filename: `mappings_${new Date().toISOString().split('T')[0]}.tsv`
        };
    }
    
    exportJSON(mappings) {
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            sessionId: window.sessionId,
            statistics: {
                totalMappings: mappings.length,
                averageScore: mappings.reduce((sum, m) => sum + m.score, 0) / mappings.length,
                methods: this.groupBy(mappings, 'method')
            },
            mappings: mappings
        };
        
        return {
            content: JSON.stringify(exportData, null, 2),
            mimeType: 'application/json',
            filename: `mappings_${new Date().toISOString().split('T')[0]}.json`
        };
    }
    
    // Import Methods
    async importMappings(file, format) {
        const importer = this.importFormats[format || this.detectFormat(file.name)];
        if (!importer) {
            throw new Error(`Unsupported import format: ${format}`);
        }
        
        const content = await this.readFile(file);
        return importer(content);
    }
    
    async importCSV(content) {
        const lines = content.split('\n').filter(line => line.trim());
        const headers = this.parseCSVLine(lines[0]);
        
        const mappings = [];
        const errors = [];
        
        for (let i = 1; i < lines.length; i++) {
            try {
                const values = this.parseCSVLine(lines[i]);
                const mapping = this.createMappingFromCSV(headers, values);
                
                if (this.validateMapping(mapping)) {
                    mappings.push(mapping);
                } else {
                    errors.push({ line: i + 1, error: 'Invalid mapping data' });
                }
            } catch (error) {
                errors.push({ line: i + 1, error: error.message });
            }
        }
        
        return { mappings, errors };
    }
    
    async importTSV(content) {
        const lines = content.split('\n').filter(line => line.trim());
        const headers = lines[0].split('\t');
        
        const mappings = [];
        const errors = [];
        
        for (let i = 1; i < lines.length; i++) {
            try {
                const values = lines[i].split('\t');
                const mapping = this.createMappingFromCSV(headers, values);
                
                if (this.validateMapping(mapping)) {
                    mappings.push(mapping);
                } else {
                    errors.push({ line: i + 1, error: 'Invalid mapping data' });
                }
            } catch (error) {
                errors.push({ line: i + 1, error: error.message });
            }
        }
        
        return { mappings, errors };
    }
    
    async importJSON(content) {
        try {
            const data = JSON.parse(content);
            
            if (!data.mappings || !Array.isArray(data.mappings)) {
                throw new Error('Invalid JSON format: missing mappings array');
            }
            
            const mappings = data.mappings.filter(m => this.validateMapping(m));
            const errors = [];
            
            return { mappings, errors };
        } catch (error) {
            throw new Error(`JSON parse error: ${error.message}`);
        }
    }
    
    // Helper Methods
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++; // Skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    }
    
    createMappingFromCSV(headers, values) {
        const mapping = {};
        
        headers.forEach((header, index) => {
            const value = values[index];
            
            switch (header.toLowerCase()) {
                case 'file reference':
                case 'reference':
                    mapping.reference = value;
                    break;
                case 'file path':
                case 'path':
                    mapping.path = value;
                    break;
                case 'match score':
                case 'score':
                    mapping.score = Number.parseFloat(value.replace('%', '')) / 100;
                    break;
                case 'timestamp':
                    mapping.timestamp = value || new Date().toISOString();
                    break;
                case 'method':
                    mapping.method = value || 'imported';
                    break;
                case 'session id':
                    mapping.sessionId = value;
                    break;
            }
        });
        
        return mapping;
    }
    
    validateMapping(mapping) {
        return mapping.reference && 
               mapping.path && 
               typeof mapping.score === 'number' && 
               mapping.score >= 0 && 
               mapping.score <= 1;
    }
    
    detectFormat(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        return extension === 'csv' ? 'csv' : 
               extension === 'json' ? 'json' : 
               extension === 'tsv' ? 'tsv' : null;
    }
    
    async readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
    
    groupBy(array, key) {
        return array.reduce((result, item) => {
            const group = item[key] || 'unknown';
            result[group] = (result[group] || 0) + 1;
            return result;
        }, {});
    }
    
    // Merge imported mappings with existing
    async mergeMappings(importedMappings, strategy = 'skip') {
        const results = {
            added: 0,
            skipped: 0,
            replaced: 0,
            errors: []
        };
        
        for (const mapping of importedMappings) {
            try {
                // Check if reference already mapped
                const existingIndex = window.matchedPairs.findIndex(
                    m => m.reference === mapping.reference
                );
                
                if (existingIndex >= 0) {
                    if (strategy === 'replace') {
                        // Remove old path from used set
                        window.usedFilePaths.delete(window.matchedPairs[existingIndex].path);
                        
                        // Replace with new mapping
                        window.matchedPairs[existingIndex] = mapping;
                        window.usedFilePaths.add(mapping.path);
                        results.replaced++;
                    } else {
                        results.skipped++;
                    }
                } else if (!window.usedFilePaths.has(mapping.path)) {
                    // Add new mapping
                    window.matchedPairs.push(mapping);
                    window.usedFilePaths.add(mapping.path);
                    
                    // Remove from unmatched if present
                    const unmatchedIndex = window.unmatchedReferences.indexOf(mapping.reference);
                    if (unmatchedIndex >= 0) {
                        window.unmatchedReferences.splice(unmatchedIndex, 1);
                    }
                    
                    results.added++;
                } else {
                    results.errors.push({
                        reference: mapping.reference,
                        error: 'Path already used'
                    });
                }
            } catch (error) {
                results.errors.push({
                    reference: mapping.reference,
                    error: error.message
                });
            }
        }
        
        // Update UI
        updateUnmatchedList();
        updateMatchedList();
        updateStats();
        
        return results;
    }
}

// Initialize manager
window.importExportManager = new ImportExportManager();

// Add import UI
function initializeImportExport() {
    // Add import controls to export section
    const exportSection = document.querySelector('.export-section');
    if (exportSection && !document.getElementById('importSection')) {
        const importSection = document.createElement('div');
        importSection.id = 'importSection';
        importSection.className = 'import-section';
        importSection.innerHTML = `
            <input type="file" id="importFile" accept=".csv,.json,.tsv" style="display: none;">
            <button class="btn btn-secondary" id="importBtn">📥 Import Mappings</button>
            <select id="exportFormat" class="format-select">
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
                <option value="tsv">TSV</option>
            </select>
        `;
        
        exportSection.insertBefore(importSection, exportSection.firstChild);
        
        // Add event listeners
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('importFile').click();
        });
        
        document.getElementById('importFile').addEventListener('change', handleImport);
        
        // Update export button to use selected format
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.onclick = handleExport;
        }
    }
}

async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        const result = await window.importExportManager.importMappings(file);
        
        if (result.errors.length > 0) {
            console.warn('Import errors:', result.errors);
        }
        
        // Show merge dialog
        const strategy = await showMergeDialog(result.mappings.length);
        
        if (strategy) {
            const mergeResult = await window.importExportManager.mergeMappings(
                result.mappings,
                strategy
            );
            
            const message = `Import complete:
- Added: ${mergeResult.added}
- Skipped: ${mergeResult.skipped}
- Replaced: ${mergeResult.replaced}
- Errors: ${mergeResult.errors.length}`;
            
            alert(message);
        }
    } catch (error) {
        alert(`Import failed: ${error.message}`);
    }
    
    // Reset file input
    e.target.value = '';
}

async function handleExport() {
    try {
        const format = document.getElementById('exportFormat')?.value || 'csv';
        const exportData = await window.importExportManager.exportMappings(format);
        
        // Try clipboard first for CSV
        if (format === 'csv' && navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(exportData.content);
                showNotification('Mappings copied to clipboard!');
                return;
            } catch (err) {
                console.log('Clipboard failed, downloading file');
            }
        }
        
        // Download file
        const blob = new Blob([exportData.content], { type: exportData.mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = exportData.filename;
        a.click();
        window.URL.revokeObjectURL(url);
        
        showNotification(`Exported ${window.matchedPairs.length} mappings`);
    } catch (error) {
        alert(`Export failed: ${error.message}`);
    }
}

async function showMergeDialog(count) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="merge-dialog">
                <h3>Import ${count} Mappings</h3>
                <p>How should conflicts be handled?</p>
                <div class="merge-options">
                    <label>
                        <input type="radio" name="strategy" value="skip" checked>
                        Skip existing mappings
                    </label>
                    <label>
                        <input type="radio" name="strategy" value="replace">
                        Replace existing mappings
                    </label>
                </div>
                <div class="actions">
                    <button class="btn btn-primary" onclick="window.resolveMerge()">Import</button>
                    <button class="btn btn-secondary" onclick="window.resolveMerge(null)">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        window.resolveMerge = (result = 'skip') => {
            if (result) {
                const strategy = modal.querySelector('input[name="strategy"]:checked').value;
                resolve(strategy);
            } else {
                resolve(null);
            }
            modal.remove();
            window.resolveMerge = undefined;
        };
    });
}

// Add styles
const importExportStyles = document.createElement('style');
importExportStyles.textContent = `
.import-section {
    margin-bottom: 10px;
    display: flex;
    gap: 10px;
    align-items: center;
}

.format-select {
    padding: 6px 10px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.1);
    color: white;
}

.merge-dialog {
    background: white;
    padding: 24px;
    border-radius: 8px;
    max-width: 400px;
}

.merge-options {
    margin: 20px 0;
}

.merge-options label {
    display: block;
    margin: 10px 0;
    color: #333;
}
`;
document.head.appendChild(importExportStyles);

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeImportExport);
} else {
    initializeImportExport();
}