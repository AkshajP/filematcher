// import-modal.js - Simple Import Modal System

function showImportModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content" style="
            background: white;
            margin: 5% auto;
            padding: 0;
            border-radius: 8px;
            width: 80%;
            max-width: 600px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
        ">
            <div class="modal-header" style="
                background: rgb(18, 102, 79);
                color: white;
                padding: 1rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-radius: 8px 8px 0 0;
            ">
                <h3 style="margin: 0; font-size: 1.125rem; font-weight: 600;">Import Mappings</h3>
                <button class="close-btn" onclick="closeImportModal()" style="
                    background: none;
                    border: none;
                    color: white;
                    font-size: 1.5rem;
                    cursor: pointer;
                    padding: 0;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">&times;</button>
            </div>
            <div class="modal-body" style="padding: 1rem; flex: 1; overflow-y: auto;">
                <p style="margin-bottom: 1rem; color: #6b7280;">
                    Choose a file to import mappings from:
                </p>
                <input type="file" id="importFile" accept=".csv,.json,.tsv" style="
                    width: 100%;
                    padding: 0.75rem;
                    border: 1px solid #e5e7eb;
                    border-radius: 4px;
                    margin-bottom: 1rem;
                ">
                <div id="importPreview" style="
                    background: #f9fafb;
                    border: 1px solid #e5e7eb;
                    border-radius: 4px;
                    padding: 1rem;
                    min-height: 100px;
                    font-family: monospace;
                    font-size: 0.875rem;
                    white-space: pre-wrap;
                    display: none;
                "></div>
            </div>
            <div class="modal-footer" style="
                padding: 1rem;
                border-top: 1px solid #e5e7eb;
                display: flex;
                gap: 0.5rem;
                justify-content: flex-end;
            ">
                <button class="btn btn-secondary" onclick="closeImportModal()">Cancel</button>
                <button class="btn btn-primary" id="confirmImport" disabled onclick="confirmImport()">Import</button>
            </div>
        </div>
    `;

    // Add modal styles
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    document.body.appendChild(modal);

    // Add file change listener
    document.getElementById('importFile').addEventListener('change', handleFileSelect);

    // Make functions globally available
    window.closeImportModal = closeImportModal;
    window.confirmImport = confirmImport;
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('importPreview');
    const confirmBtn = document.getElementById('confirmImport');

    if (!file) {
        preview.style.display = 'none';
        confirmBtn.disabled = true;
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        preview.textContent = content.substring(0, 500) + (content.length > 500 ? '\n...' : '');
        preview.style.display = 'block';
        confirmBtn.disabled = false;
    };
    reader.readAsText(file);
}

async function confirmImport() {
    const fileInput = document.getElementById('importFile');
    const file = fileInput.files[0];

    if (!file) {
        showNotification('Please select a file to import', 'error');
        return;
    }

    try {
        if (window.importExportManager) {
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
                
                showNotification(message.replace(/\n/g, ' '), 'success');
                closeImportModal();
            }
        } else {
            showNotification('Import system not available', 'error');
        }
    } catch (error) {
        showNotification(`Import failed: ${error.message}`, 'error');
    }
}

function closeImportModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
    // Clean up global functions
    window.closeImportModal = undefined;
    window.confirmImport = undefined;
}

async function showMergeDialog(count) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 1001;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        modal.innerHTML = `
            <div class="merge-dialog" style="
                background: white;
                padding: 24px;
                border-radius: 8px;
                max-width: 400px;
                width: 90%;
            ">
                <h3 style="margin: 0 0 16px 0; color: #333;">Import ${count} Mappings</h3>
                <p style="margin-bottom: 20px; color: #666;">How should conflicts be handled?</p>
                <div class="merge-options" style="margin: 20px 0;">
                    <label style="display: block; margin: 10px 0; color: #333;">
                        <input type="radio" name="strategy" value="skip" checked style="margin-right: 8px;">
                        Skip existing mappings
                    </label>
                    <label style="display: block; margin: 10px 0; color: #333;">
                        <input type="radio" name="strategy" value="replace" style="margin-right: 8px;">
                        Replace existing mappings
                    </label>
                </div>
                <div class="actions" style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px;">
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

// Make showImportModal globally available
window.showImportModal = showImportModal;