// export-manager.js - Export Management Functions

// Export mappings as XLSX
async function exportMappings() {
    const worksheetData = [
        ['File Reference', 'File Path', 'Match Score', 'Reference Type', 'Timestamp'],
        ...window.matchedPairs.map(pair => [
            pair.reference,
            pair.path,
            `${(pair.score * 100).toFixed(1)}%`,
            isGeneratedReference(pair.reference) ? 'AUTO-GENERATED' : 'ORIGINAL',
            pair.timestamp.toLocaleString()
        ])
    ];

    try {
        // Try to use SheetJS if available for XLSX export
        if (typeof XLSX !== 'undefined') {
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
            
            // Set column widths
            worksheet['!cols'] = [
                { width: 60 }, // File Reference
                { width: 80 }, // File Path
                { width: 12 }, // Match Score
                { width: 18 }, // Reference Type
                { width: 20 }  // Timestamp
            ];
            
            XLSX.utils.book_append_sheet(workbook, worksheet, 'File Mappings');
            XLSX.writeFile(workbook, `file_mappings_${new Date().toISOString().split('T')[0]}.xlsx`);
            showNotification('XLSX file downloaded successfully!');
            return;
        }
    } catch (error) {
        console.warn('XLSX export failed, falling back to CSV:', error);
    }

    // Fallback to CSV export
    const csvContent = worksheetData.map(row => 
        row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    try {
        await navigator.clipboard.writeText(csvContent);
        showNotification('CSV content copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy mappings:', err);
        // Final fallback - create downloadable CSV file
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const anchorElement = document.createElement('a');
        anchorElement.href = url;
        anchorElement.download = `file_mappings_${new Date().toISOString().split('T')[0]}.csv`;
        anchorElement.click();
        window.URL.revokeObjectURL(url);
        showNotification('CSV file downloaded!');
    }
}