// Sample data
const fileDescriptions = [
  "Claimant's Request for Arbitration",
  "Claimant's Reply to Respondent's Answer to the Request for Arbitration",
  "Claimant's Statement of Claim",
  "Appendix 1 to Claimant's Statement of Claim – The Sub-Contract Agreement",
  "Appendix 2 to Claimant's Statement of Claim – Amendment #1 to The Sub-Contract Agreement",
  "Appendix 3 to Claimant's Statement of Claim – Key Qatar Law Provisions",
  "Appendix 4 to Claimant's Statement of Claim – Summary of Final Account",
  "Appendix 7 to Claimant's Statement of Claim – Other Delay Events",
  "Appendix 11 to Claimant's Statement of Claim – Index of Supporting Documents/Evidence",
]

const filePaths = [
  {
    path: "[A] Claimant Submissions/Appendices to Statement of Claim/",
    name: "Appendix 1 - The Sub-Contract Agreement.pdf",
  },
  {
    path: "[A] Claimant Submissions/Appendices to Statement of Claim/",
    name: "Appendix 3 - Key Qatar Law Provisions.pdf",
  },
  {
    path: "[A] Claimant Submissions/Appendices to Statement of Claim/",
    name: "Appendix 4 - Summary of Final Account.pdf",
  },
  { path: "[A] Claimant Submissions/Appendices to Statement of Claim/", name: "Appendix 7 - Other Delay Events.pdf" },
  {
    path: "[A] Claimant Submissions/Appendices to Statement of Claim/",
    name: "Appendix 11 - Index of Supporting Documents/Evidence/",
  },
  { path: "[A] Claimant Submissions/", name: "Request for Arbitration.pdf" },
  { path: "[A] Claimant Submissions/", name: "Reply to Answer.pdf" },
  { path: "[A] Claimant Submissions/", name: "Statement of Claim.pdf" },
  { path: "[A] Claimant Submissions/", name: "Amendment 1 Sub-Contract.pdf" },
]

let completedMappings = []
let currentSuggestions = []
let selectedDescriptions = []
let currentMatchSuggestion = null

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  renderDescriptions()
  renderFiles()
  updateCounts()
  updateProgress()
})

// Render file descriptions
function renderDescriptions() {
  const container = document.getElementById("descriptions-list")
  container.innerHTML = ""

  fileDescriptions.forEach((description, index) => {
    const item = document.createElement("div")
    item.className = "list-item description-item"
    if (selectedDescriptions.includes(index)) {
      item.classList.add("selected")
    }
    item.textContent = description
    item.onclick = () => toggleDescriptionSelection(index)

    // Add completion tag if needed
    if (completedMappings.some((m) => m.description === description)) {
      item.classList.add("completed")
      const tag = document.createElement("span")
      tag.className = "description-tag"
      tag.textContent = "ORIG"
      item.appendChild(tag)
    }

    container.appendChild(item)
  })
}

// Render file paths
function renderFiles() {
  const container = document.getElementById("files-list")
  container.innerHTML = ""

  filePaths.forEach((file, index) => {
    const item = document.createElement("div")
    item.className = "list-item file-item"

    const pathDiv = document.createElement("div")
    pathDiv.className = "file-path"
    pathDiv.textContent = file.path

    const nameDiv = document.createElement("div")
    nameDiv.className = "file-name"
    nameDiv.textContent = file.name

    // Add confidence badge for suggestions
    if (currentSuggestions.length > 0) {
      const suggestion = currentSuggestions.find((s) => s.fileIndex === index)
      if (suggestion) {
        const badge = document.createElement("div")
        badge.className = "confidence-badge"
        badge.textContent = `${suggestion.confidence}%`
        item.appendChild(badge)

        // Add hover actions
        const hoverActions = document.createElement("div")
        hoverActions.className = "hover-actions"

        const acceptBtn = document.createElement("button")
        acceptBtn.className = "hover-btn hover-btn-accept"
        acceptBtn.innerHTML = "✓"
        acceptBtn.onclick = (e) => {
          e.stopPropagation()
          acceptSuggestion(currentSuggestions.indexOf(suggestion))
        }

        const rejectBtn = document.createElement("button")
        rejectBtn.className = "hover-btn hover-btn-reject"
        rejectBtn.innerHTML = "✕"
        rejectBtn.onclick = (e) => {
          e.stopPropagation()
          rejectSuggestion(currentSuggestions.indexOf(suggestion))
        }

        hoverActions.appendChild(acceptBtn)
        hoverActions.appendChild(rejectBtn)
        item.appendChild(hoverActions)
      }
    }

    item.appendChild(pathDiv)
    item.appendChild(nameDiv)
    container.appendChild(item)
  })
}

// Render completed mappings
function renderMappings() {
  const container = document.getElementById("mappings-list")
  container.innerHTML = ""

  if (completedMappings.length === 0) {
    const emptyState = document.createElement("div")
    emptyState.className = "empty-state"
    emptyState.innerHTML = "<p>No matches confirmed yet</p>"
    container.appendChild(emptyState)
    return
  }

  completedMappings.forEach((mapping, index) => {
    const item = document.createElement("div")
    item.className = "list-item mapping-item"

    const descDiv = document.createElement("div")
    descDiv.className = "mapping-description"
    descDiv.textContent = mapping.description

    const fileDiv = document.createElement("div")
    fileDiv.className = "mapping-file"
    fileDiv.textContent = `${mapping.file.path}${mapping.file.name}`

    const actionsDiv = document.createElement("div")
    actionsDiv.className = "mapping-actions"

    const removeBtn = document.createElement("button")
    removeBtn.className = "hover-btn hover-btn-reject"
    removeBtn.innerHTML = "✕"
    removeBtn.onclick = () => removeMapping(index)

    actionsDiv.appendChild(removeBtn)
    item.appendChild(descDiv)
    item.appendChild(fileDiv)
    item.appendChild(actionsDiv)
    container.appendChild(item)
  })
}

// Toggle description selection
function toggleDescriptionSelection(index) {
  const selectedIndex = selectedDescriptions.indexOf(index)
  if (selectedIndex > -1) {
    selectedDescriptions.splice(selectedIndex, 1)
  } else {
    selectedDescriptions.push(index)
  }
  renderDescriptions()
  updateSelectedCount()
}

// Update selected count
function updateSelectedCount() {
  document.getElementById("selected-count").textContent = `${selectedDescriptions.length} selected`
}

// Skip selected descriptions
function skipSelected() {
  selectedDescriptions = []
  renderDescriptions()
  updateSelectedCount()
}

// Deselect all
function deselectAll() {
  selectedDescriptions = []
  renderDescriptions()
  updateSelectedCount()
}

// Detect remaining files
function detectFiles() {
  alert("File detection feature would scan for new files in the directory.")
}

// Create a mapping
function createMapping(descIndex, fileIndex) {
  const mapping = {
    description: fileDescriptions[descIndex],
    file: filePaths[fileIndex],
  }

  completedMappings.push(mapping)

  // Remove from original arrays
  fileDescriptions.splice(descIndex, 1)
  filePaths.splice(fileIndex, 1)

  // Clear selections and suggestions
  selectedDescriptions = []
  currentSuggestions = []
  currentMatchSuggestion = null

  // Re-render all panels
  renderDescriptions()
  renderFiles()
  renderMappings()
  updateCounts()
  updateProgress()
  hideSuggestionActions()
}

// Remove a mapping
function removeMapping(index) {
  const mapping = completedMappings[index]

  // Add back to original arrays
  fileDescriptions.push(mapping.description)
  filePaths.push(mapping.file)

  // Remove from mappings
  completedMappings.splice(index, 1)

  // Re-render all panels
  renderDescriptions()
  renderFiles()
  renderMappings()
  updateCounts()
  updateProgress()
}

// Auto-populate suggestions
function autoPopulate() {
  if (fileDescriptions.length === 0 || filePaths.length === 0) {
    alert("No items available for auto-population.")
    return
  }

  currentSuggestions = []

  // Simple matching algorithm
  fileDescriptions.forEach((desc, descIndex) => {
    const keywords = desc.toLowerCase().split(" ")
    let bestMatch = null
    let bestScore = 0

    filePaths.forEach((file, fileIndex) => {
      const fileName = file.name.toLowerCase()
      const filePath = file.path.toLowerCase()
      let score = 0

      keywords.forEach((keyword) => {
        if (fileName.includes(keyword) || filePath.includes(keyword)) {
          score++
        }
      })

      if (score > bestScore) {
        bestScore = score
        bestMatch = { descIndex, fileIndex, score }
      }
    })

    if (bestMatch && bestMatch.score > 0) {
      currentSuggestions.push({
        description: desc,
        file: filePaths[bestMatch.fileIndex],
        descIndex: bestMatch.descIndex,
        fileIndex: bestMatch.fileIndex,
        confidence: Math.min(bestMatch.score * 20, 95),
      })
    }
  })

  if (currentSuggestions.length === 0) {
    alert("No suitable matches found for auto-population.")
    return
  }

  renderFiles()
  showSuggestionActions()
}

// Show suggestion actions
function showSuggestionActions() {
  document.getElementById("suggestion-actions").style.display = "flex"
}

// Hide suggestion actions
function hideSuggestionActions() {
  document.getElementById("suggestion-actions").style.display = "none"
}

// Accept a suggestion
function acceptSuggestion(index) {
  const suggestion = currentSuggestions[index]
  createMapping(suggestion.descIndex, suggestion.fileIndex)
}

// Reject a suggestion
function rejectSuggestion(index) {
  currentSuggestions.splice(index, 1)
  if (currentSuggestions.length === 0) {
    hideSuggestionActions()
  }
  renderFiles()
}

// Confirm current match
function confirmCurrentMatch() {
  if (currentSuggestions.length > 0) {
    acceptSuggestion(0)
  }
}

// Skip current match
function skipCurrentMatch() {
  if (currentSuggestions.length > 0) {
    rejectSuggestion(0)
  }
}

// Update counts
function updateCounts() {
  document.getElementById("mappings-count").textContent = completedMappings.length
  document.getElementById("mapped-count").textContent = completedMappings.length
  document.getElementById("unmatched-count").textContent = fileDescriptions.length
  updateSelectedCount()
}

// Update progress
function updateProgress() {
  const total = completedMappings.length + fileDescriptions.length
  const progress = total > 0 ? Math.round((completedMappings.length / total) * 100) : 0

  document.getElementById("progress-percentage").textContent = `${progress}%`
  document.getElementById("progress-fill").style.width = `${progress}%`
}

// Export mappings
function exportMappings() {
  const format = document.querySelector(".export-format").value
  const data = {
    mappings: completedMappings,
    timestamp: new Date().toISOString(),
  }

  let content, filename, type

  if (format === "csv") {
    content = "Description,File Path,File Name\n"
    completedMappings.forEach((mapping) => {
      content += `"${mapping.description}","${mapping.file.path}","${mapping.file.name}"\n`
    })
    filename = `file-mappings-${new Date().toISOString().split("T")[0]}.csv`
    type = "text/csv"
  } else {
    content = JSON.stringify(data, null, 2)
    filename = `file-mappings-${new Date().toISOString().split("T")[0]}.json`
    type = "application/json"
  }

  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Show import modal
function showImportModal() {
  document.getElementById("import-modal").style.display = "block"
}

// Close import modal
function closeImportModal() {
  document.getElementById("import-modal").style.display = "none"
  document.getElementById("import-textarea").value = ""
}

// Import mappings
function importMappings() {
  const textarea = document.getElementById("import-textarea")
  const jsonText = textarea.value.trim()

  if (!jsonText) {
    alert("Please paste JSON data to import.")
    return
  }

  try {
    const data = JSON.parse(jsonText)

    if (data.mappings && Array.isArray(data.mappings)) {
      completedMappings = data.mappings
      renderMappings()
      updateCounts()
      updateProgress()
      closeImportModal()
      alert("Mappings imported successfully!")
    } else {
      alert('Invalid JSON format. Expected an object with a "mappings" array.')
    }
  } catch (error) {
    alert("Invalid JSON format. Please check your data and try again.")
  }
}

// Close modals when clicking outside
window.onclick = (event) => {
  const importModal = document.getElementById("import-modal")
  if (event.target === importModal) {
    closeImportModal()
  }
}
