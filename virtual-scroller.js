// virtual-scroller.js - Virtual Scrolling System

class VirtualScroller {
    constructor(container, options = {}) {
        this.container = container;
        this.itemHeight = options.itemHeight || 40;
        this.bufferSize = options.bufferSize || 5;
        this.items = [];
        this.scrollTop = 0;
        this.visibleStart = 0;
        this.visibleEnd = 0;
        
        this.scrollContainer = null;
        this.contentContainer = null;
        this.heightContainer = null;
        
        this.init();
    }
    
    init() {
        // Create scroll structure
        this.container.innerHTML = `
            <div class="virtual-scroll-container" style="height: 100%; overflow-y: auto;">
                <div class="virtual-scroll-height" style="position: relative;">
                    <div class="virtual-scroll-content" style="position: absolute; top: 0; left: 0; right: 0;">
                    </div>
                </div>
            </div>
        `;
        
        this.scrollContainer = this.container.querySelector('.virtual-scroll-container');
        this.contentContainer = this.container.querySelector('.virtual-scroll-content');
        this.heightContainer = this.container.querySelector('.virtual-scroll-height');
        
        // Bind scroll event
        this.scrollContainer.addEventListener('scroll', this.onScroll.bind(this));
    }
    
    setItems(items) {
        this.items = items;
        this.heightContainer.style.height = `${items.length * this.itemHeight}px`;
        this.render();
    }
    
    onScroll() {
        this.scrollTop = this.scrollContainer.scrollTop;
        this.render();
    }
    
    render() {
        const viewportHeight = this.scrollContainer.clientHeight;
        
        // Calculate visible range with buffer
        this.visibleStart = Math.floor(this.scrollTop / this.itemHeight) - this.bufferSize;
        this.visibleEnd = Math.ceil((this.scrollTop + viewportHeight) / this.itemHeight) + this.bufferSize;
        
        // Clamp to valid range
        this.visibleStart = Math.max(0, this.visibleStart);
        this.visibleEnd = Math.min(this.items.length, this.visibleEnd);
        
        // Get visible items
        const visibleItems = this.items.slice(this.visibleStart, this.visibleEnd);
        
        // Render visible items
        this.contentContainer.style.transform = `translateY(${this.visibleStart * this.itemHeight}px)`;
        this.contentContainer.innerHTML = visibleItems
            .map((item, index) => this.renderItem(item, this.visibleStart + index))
            .join('');
        
        // Re-attach event listeners
        this.attachItemListeners();
    }
    
    renderItem(item, index) {
        // Override in subclass
        return `<div class="virtual-item" style="height: ${this.itemHeight}px;">${item}</div>`;
    }
    
    attachItemListeners() {
        // Override in subclass
    }
    
    scrollToIndex(index) {
        const scrollTop = index * this.itemHeight;
        this.scrollContainer.scrollTop = scrollTop;
    }
    
    getVisibleRange() {
        return {
            start: this.visibleStart,
            end: this.visibleEnd,
            total: this.items.length
        };
    }
}

// Specialized scroller for unmatched references
class UnmatchedListScroller extends VirtualScroller {
    constructor(container, options) {
        super(container, Object.assign({ itemHeight: 48 }, options));
    }
    
    renderItem(reference, index) {
        const isSelected = window.selectedReferences.has(reference);
        const isActive = reference === window.currentReference;
        const isGenerated = window.originalReferencesCount && index >= window.originalReferencesCount;
        
        return `
            <div class="reference-item ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}" 
                 data-reference="${reference.replace(/"/g, '&quot;')}"
                 data-index="${index}"
                 style="height: ${this.itemHeight}px;">
                <input type="checkbox" class="reference-checkbox" 
                       ${isSelected ? 'checked' : ''}
                       data-reference="${reference.replace(/"/g, '&quot;')}">
                <div class="reference-text">${reference}</div>
                ${isGenerated ? '<div class="reference-type-badge generated">AUTO</div>' : '<div class="reference-type-badge original">ORIG</div>'}
            </div>
        `;
    }
    
    attachItemListeners() {
        // Re-attach click listeners
        const items = this.contentContainer.querySelectorAll('.reference-item');
        for (const item of items) {
            const reference = item.dataset.reference;
            
            // Main item click
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('reference-checkbox')) {
                    selectReference(reference);
                }
            });
            
            // Checkbox click
            const checkbox = item.querySelector('.reference-checkbox');
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleReferenceSelection(reference, e);
            });
        }
    }
}

// Specialized scroller for search results
class SearchResultsScroller extends VirtualScroller {
    constructor(container, options) {
        super(container, Object.assign({ itemHeight: 56 }, options));
        this.isShowingAllFiles = true;
    }
    
    setSearchMode(isShowingAllFiles) {
        this.isShowingAllFiles = isShowingAllFiles;
    }
    
    renderItem(match, index) {
        const parts = match.path.split('/');
        const fileName = parts.pop();
        const pathParts = parts.join('/');
        
        let scoreClass = '';
        let scoreBadgeClass = '';
        let scoreBadge = '';
        
        if (!this.isShowingAllFiles) {
            scoreClass = match.score > 0.7 ? 'high-match' : 
                        match.score > 0.4 ? 'medium-match' : '';
            scoreBadgeClass = match.score > 0.7 ? '' : 
                             match.score > 0.4 ? 'medium' : 'low';
            scoreBadge = `<div class="score-badge ${scoreBadgeClass}">${(match.score * 100).toFixed(1)}%</div>`;
        }
        
        return `
            <div class="result-item ${scoreClass}" 
                 data-path="${match.path}" 
                 data-score="${match.score}"
                 style="height: ${this.itemHeight}px;">
                <div class="file-path">${pathParts}/</div>
                <div class="file-name">${fileName}</div>
                ${scoreBadge}
            </div>
        `;
    }
    
    attachItemListeners() {
        const resultItems = this.contentContainer.querySelectorAll('.result-item');
        
        for (const item of resultItems) {
            item.addEventListener('click', () => {
                // Remove previous selection
                for (const resultItem of resultItems) {
                    resultItem.style.background = '';
                }
                
                // Select this item
                item.style.background = 'rgba(76, 175, 80, 0.3)';
                window.selectedResult = {
                    path: item.getAttribute('data-path'),
                    score: Number.parseFloat(item.getAttribute('data-score'))
                };
                
                document.getElementById('confirmMatchBtn').disabled = false;
            });
        }
    }
}

// Specialized scroller for matched pairs
class MatchedListScroller extends VirtualScroller {
    constructor(container, options) {
        super(container, Object.assign({ itemHeight: 64 }, options));
    }
    
    renderItem(pair, index) {
        const parts = pair.path.split('/');
        const fileName = parts.pop();
        const pathParts = parts.join('/');
        
        return `
            <div class="matched-item" data-index="${index}" style="height: ${this.itemHeight}px;">
                <div class="matched-reference">${pair.reference}</div>
                <div class="matched-path">${pathParts}/${fileName}</div>
                <button class="remove-match" data-index="${index}" title="Remove match">×</button>
            </div>
        `;
    }
    
    attachItemListeners() {
        const removeButtons = this.contentContainer.querySelectorAll('.remove-match');
        
        for (const button of removeButtons) {
            button.addEventListener('click', (e) => {
                const index = Number.parseInt(button.dataset.index);
                removeMatch(index);
            });
        }
    }
}