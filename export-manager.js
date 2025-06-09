// export-manager.js - Export Management Functions

// Export mappings - now uses the enhanced ImportExportManager
async function exportMappings() {
    // Use the new import-export manager if available
    if (window.importExportManager) {
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
    } else {
        // Fallback to basic CSV export
        const csvData = [
            ['File Reference', 'File Path', 'Match Score', 'Timestamp', 'Method', 'Session ID'],
            ...window.matchedPairs.map(pair => [
                pair.reference,
                pair.path,
                `${(pair.score * 100).toFixed(1)}%`,
                pair.timestamp || new Date().toISOString(),
                pair.method || 'manual',
                pair.sessionId || window.sessionId || 'default'
            ])
        ];
        
        const csvContent = csvData.map(row => 
            row.map(field => `"${field.replace(/"/g, '""')}"`).join(',')
        ).join('\n');
        
        try {
            await navigator.clipboard.writeText(csvContent);
            showNotification();
        } catch (err) {
            console.error('Failed to copy mappings:', err);
            // Fallback - create downloadable file
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const anchorElement = document.createElement('a');
            anchorElement.href = url;
            anchorElement.download = 'file_mappings.csv';
            anchorElement.click();
            window.URL.revokeObjectURL(url);
        }
    }
}