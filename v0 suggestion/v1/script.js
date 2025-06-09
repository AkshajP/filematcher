// Sample data
const fileDescriptions = [
  "User authentication module documentation",
  "Database schema migration scripts",
  "Frontend component library styles",
  "API endpoint configuration file",
  "Unit test cases for payment processing",
  "Email template for user registration",
  "Logging configuration settings",
  "Security policy documentation",
  "Performance monitoring setup",
  "Deployment automation scripts",
]

const filePaths = [
  { path: "/src/auth/", name: "auth-module.md" },
  { path: "/database/migrations/", name: "001_initial_schema.sql" },
  { path: "/frontend/styles/", name: "components.css" },
  { path: "/config/api/", name: "endpoints.json" },
  { path: "/tests/unit/", name: "payment_test.js" },
  { path: "/templates/email/", name: "registration.html" },
  { path: "/config/logging/", name: "logger.config.js" },
  { path: "/docs/security/", name: "security-policy.pdf" },
  { path: "/monitoring/", name: "performance.yml" },
  { path: "/scripts/deploy/", name: "deploy.sh" },
  { path: "/src/utils/", name: "helpers.js" },
  { path: "/assets/images/", name: "logo.png" },
]

let completedMappings = []
let currentSuggestions = []

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
    item.className = "list-item"
    item.textContent = description
    item.onclick = () => selectDescription(index)
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
    item.onclick = () => selectFile(index)

    const pathDiv = document.createElement("div")
    pathDiv.className = "file-path"
    pathDiv.textContent = file.path

    const nameDiv = document.createElement("div")
    nameDiv.className = "file-name"
    nameDiv.textContent = file.name

    item.appendChild(pathDiv)
    item.appendChild(nameDiv)
    container.appendChild(item)
  })
}

// Render completed mappings
function renderMappings() {
  const container = document.getElementById("mappings-list")
  container.innerHTML = ""

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
    removeBtn.className = "btn btn-reject"
    removeBtn.textContent = "Remove"
    removeBtn.onclick = () => removeMapping(index)

    actionsDiv.appendChild(removeBtn)
    item.appendChild(descDiv)
    item.appendChild(fileDiv)
    item.appendChild(actionsDiv)
    container.appendChild(item)
  })
}

// Select description (for manual mapping)
function selectDescription(index) {
  // Remove previous selections
  document.querySelectorAll(".list-item").forEach((item) => {
    item.classList.remove("selected")
  })

  // Select current item
  document.querySelectorAll("#descriptions-list .list-item")[index].classList.add("selected")
}

// Select file (for manual mapping)
function selectFile(index) {
  // Check if there's a selected description
  const selectedDesc = document.querySelector("#descriptions-list .list-item.selected")
  if (!selectedDesc) {
    alert("Please select a file description first.")
    return
  }

  const descIndex = Array.from(document.querySelectorAll("#descriptions-list .list-item")).indexOf(selectedDesc)
  createMapping(descIndex, index)
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

  // Re-render all panels
  renderDescriptions()
  renderFiles()
  renderMappings()
  updateCounts()
  updateProgress()
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

  // Simple matching algorithm (in real app, this would be more sophisticated)
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
        confidence: Math.min(bestMatch.score * 20, 95), // Convert to percentage
      })
    }
  })

  if (currentSuggestions.length === 0) {
    alert("No suitable matches found for auto-population.")
    return
  }

  showSuggestionModal()
}

// Show suggestion modal
function showSuggestionModal() {
  const modal = document.getElementById("suggestion-modal")
  const container = document.getElementById("suggestions-list")
  container.innerHTML = ""

  currentSuggestions.forEach((suggestion, index) => {
    const item = document.createElement("div")
    item.className = "suggestion-item"

    const header = document.createElement("div")
    header.className = "suggestion-header"

    const desc = document.createElement("div")
    desc.className = "suggestion-description"
    desc.textContent = suggestion.description

    const actions = document.createElement("div")
    actions.className = "suggestion-actions"

    const acceptBtn = document.createElement("button")
    acceptBtn.className = "btn btn-accept"
    acceptBtn.textContent = "Accept"
    acceptBtn.onclick = () => acceptSuggestion(index)

    const rejectBtn = document.createElement("button")
    rejectBtn.className = "btn btn-reject"
    rejectBtn.textContent = "Reject"
    rejectBtn.onclick = () => rejectSuggestion(index)

    const file = document.createElement("div")
    file.className = "suggestion-file"
    file.textContent = `${suggestion.file.path}${suggestion.file.name} (${suggestion.confidence}% match)`

    actions.appendChild(acceptBtn)
    actions.appendChild(rejectBtn)
    header.appendChild(desc)
    header.appendChild(actions)
    item.appendChild(header)
    item.appendChild(file)
    container.appendChild(item)
  })

  modal.style.display = "block"
}

// Accept a suggestion
function acceptSuggestion(index) {
  const suggestion = currentSuggestions[index]

  // Create mapping
  const mapping = {
    description: suggestion.description,
    file: suggestion.file,
  }

  completedMappings.push(mapping)

  // Remove from original arrays
  const descIndex = fileDescriptions.indexOf(suggestion.description)
  const fileIndex = filePaths.indexOf(suggestion.file)

  if (descIndex > -1) fileDescriptions.splice(descIndex, 1)
  if (fileIndex > -1) filePaths.splice(fileIndex, 1)

  // Remove from suggestions
  currentSuggestions.splice(index, 1)

  // Re-render
  renderDescriptions()
  renderFiles()
  renderMappings()
  updateCounts()
  updateProgress()

  // Update modal
  if (currentSuggestions.length === 0) {
    closeSuggestionModal()
  } else {
    showSuggestionModal()
  }
}

// Reject a suggestion
function rejectSuggestion(index) {
  currentSuggestions.splice(index, 1)

  if (currentSuggestions.length === 0) {
    closeSuggestionModal()
  } else {
    showSuggestionModal()
  }
}

// Accept all suggestions
function acceptAllSuggestions() {
  currentSuggestions.forEach((suggestion) => {
    const mapping = {
      description: suggestion.description,
      file: suggestion.file,
    }

    completedMappings.push(mapping)

    const descIndex = fileDescriptions.indexOf(suggestion.description)
    const fileIndex = filePaths.indexOf(suggestion.file)

    if (descIndex > -1) fileDescriptions.splice(descIndex, 1)
    if (fileIndex > -1) filePaths.splice(fileIndex, 1)
  })

  currentSuggestions = []
  closeSuggestionModal()

  renderDescriptions()
  renderFiles()
  renderMappings()
  updateCounts()
  updateProgress()
}

// Reject all suggestions
function rejectAllSuggestions() {
  currentSuggestions = []
  closeSuggestionModal()
}

// Close suggestion modal
function closeSuggestionModal() {
  document.getElementById("suggestion-modal").style.display = "none"
}

// Update counts
function updateCounts() {
  document.getElementById("descriptions-count").textContent = fileDescriptions.length
  document.getElementById("files-count").textContent = filePaths.length
  document.getElementById("mappings-count").textContent = completedMappings.length
  document.getElementById("mapped-count").textContent = completedMappings.length
  document.getElementById("unmatched-count").textContent = fileDescriptions.length
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
  const data = {
    mappings: completedMappings,
    timestamp: new Date().toISOString(),
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `file-mappings-${new Date().toISOString().split("T")[0]}.json`
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
  const suggestionModal = document.getElementById("suggestion-modal")
  const importModal = document.getElementById("import-modal")

  if (event.target === suggestionModal) {
    closeSuggestionModal()
  }
  if (event.target === importModal) {
    closeImportModal()
  }
}
