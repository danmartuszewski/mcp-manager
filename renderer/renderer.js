// DOM Elements
const serverListBody = document.getElementById('server-list-body');
const emptyState = document.getElementById('empty-state');
const addServerBtn = document.getElementById('add-server-btn');
const parseJsonBtn = document.getElementById('parse-json-btn');
const restartClaudeBtn = document.getElementById('restart-claude-btn');
const settingsBtn = document.getElementById('settings-btn');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Modals
const serverModal = document.getElementById('server-modal');
const settingsModal = document.getElementById('settings-modal');
const confirmationModal = document.getElementById('confirmation-modal');
const importJsonModal = document.getElementById('import-json-modal');
const serverForm = document.getElementById('server-form');
const settingsForm = document.getElementById('settings-form');
const browseConfigPathBtn = document.getElementById('browse-config-path');
const confirmYesBtn = document.getElementById('confirm-yes');
const confirmNoBtn = document.getElementById('confirm-no');
const confirmationMessage = document.getElementById('confirmation-message');
const importJsonBtn = document.getElementById('import-json-btn');
const processJsonBtn = document.getElementById('process-json-btn');
const pasteClipboardBtn = document.getElementById('paste-clipboard-btn');

// Form Fields
const serverNameField = document.getElementById('server-name');
const serverDefinitionField = document.getElementById('server-definition');
const definitionValidation = document.getElementById('definition-validation');
const claudeConfigPathField = document.getElementById('claude-config-path');
const backupsEnabledField = document.getElementById('backups-enabled');
const jsonInputField = document.getElementById('json-input');
const jsonValidation = document.getElementById('json-validation');

// Global Variables
let servers = [];
let settings = {};
let currentAction = null;
let editingServerName = null;
let deleteServerName = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadServers();
  await loadSettings();
  
  // Setup listeners for server import from main process
  window.electronAPI.onServersImported((importedServers) => {
    servers = importedServers;
    renderServerList();
    showNotification('Servers imported from existing Claude config', 'success');
  });
  
  // Listen for server state changes from the tray menu
  window.electronAPI.onServerStateChanged((updatedServers) => {
    console.log('Server state changed from tray menu:', updatedServers);
    servers = updatedServers;
    renderServerList();
  });
  
  // Listen for Claude restart events from the tray menu
  window.electronAPI.onClaudeRestarted(() => {
    console.log('Claude was restarted from tray menu');
    showNotification('Claude has been restarted with the current configuration', 'success');
  });
  
  // Setup handlers for external links to open in default browser
  setupExternalLinks();
  
  // Set up modal close handlers
  setupModalCloseHandlers();
});

// Event Listeners
addServerBtn.addEventListener('click', () => openAddServerModal());
parseJsonBtn.addEventListener('click', openImportJsonModal);
restartClaudeBtn.addEventListener('click', () => saveClaudeConfig(true));
settingsBtn.addEventListener('click', openSettingsModal);
importJsonBtn.addEventListener('click', openImportJsonModal);
processJsonBtn.addEventListener('click', processJsonInput);
pasteClipboardBtn?.addEventListener('click', pasteFromClipboard);

// Tab Navigation
tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const tabName = button.dataset.tab;
    
    // Update buttons
    tabButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    // Update content
    tabContents.forEach(content => content.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');
  });
});

// Set up Modal Close and Cancel Handlers
function setupModalCloseHandlers() {
  // Select all close buttons and assign event listeners individually
  document.querySelectorAll('.close-btn').forEach(button => {
    button.addEventListener('click', () => {
      // Find the closest parent modal
      const modal = button.closest('.modal');
      if (modal) {
        modal.classList.remove('visible');
      } else {
        // Fallback - remove visible class from all modals
        serverModal.classList.remove('visible');
        settingsModal.classList.remove('visible');
        confirmationModal.classList.remove('visible');
        importJsonModal.classList.remove('visible');
      }
    });
  });
  
  // Select all cancel buttons and assign event listeners individually
  document.querySelectorAll('.cancel-btn').forEach(button => {
    button.addEventListener('click', () => {
      // Find the closest parent modal
      const modal = button.closest('.modal');
      if (modal) {
        modal.classList.remove('visible');
      } else {
        // Fallback - remove visible class from all modals
        serverModal.classList.remove('visible');
        settingsModal.classList.remove('visible');
        confirmationModal.classList.remove('visible');
        importJsonModal.classList.remove('visible');
      }
    });
  });
}

// Server Form Submission
serverForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!validateServerForm()) return;
  
  const server = {
    name: serverNameField.value,
    enabled: true,
    definition: JSON.parse(serverDefinitionField.value)
  };
  
  await saveServer(server);
  serverModal.classList.remove('visible');
  
  showNotification(
    editingServerName ? 'Server updated successfully' : 'Server added successfully', 
    'success'
  );
  
  editingServerName = null;
});

// Settings Form Submission
settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const updatedSettings = {
    claudeConfigPath: claudeConfigPathField.value,
    backupsEnabled: backupsEnabledField.checked
  };
  
  await saveSettings(updatedSettings);
  settingsModal.classList.remove('visible');
  
  showNotification('Settings saved successfully', 'success');
});

// Browse Config Path
browseConfigPathBtn.addEventListener('click', async () => {
  const path = await window.electronAPI.selectConfigPath();
  if (path) {
    claudeConfigPathField.value = path;
  }
});

// Server Validation
serverDefinitionField.addEventListener('input', () => {
  try {
    const json = JSON.parse(serverDefinitionField.value);
    
    // Check structure
    if (!json.command || typeof json.command !== 'string') {
      definitionValidation.textContent = 'Definition must include a command string';
      return;
    }
    
    if (!json.args || !Array.isArray(json.args)) {
      definitionValidation.textContent = 'Definition must include args array';
      return;
    }
    
    // Validate all args are strings
    if (!json.args.every(arg => typeof arg === 'string')) {
      definitionValidation.textContent = 'All args must be strings';
      return;
    }
    
    definitionValidation.textContent = 'Valid';
    definitionValidation.style.color = 'var(--success-color)';
  } catch (error) {
    definitionValidation.textContent = 'Invalid JSON: ' + error.message;
    definitionValidation.style.color = 'var(--error-color)';
  }
});

// JSON Input Validation
jsonInputField.addEventListener('input', validateJsonInput);

// Help text for manual paste with keyboard
jsonInputField.addEventListener('focus', () => {
  if (jsonInputField.value.trim() === '') {
    jsonValidation.textContent = 'Press ⌘V (macOS) or Ctrl+V (Windows/Linux) to paste JSON content';
    jsonValidation.style.color = 'var(--light-text)';
  }
});

jsonInputField.addEventListener('blur', () => {
  if (jsonValidation.textContent === 'Press ⌘V (macOS) or Ctrl+V (Windows/Linux) to paste JSON content') {
    jsonValidation.textContent = '';
  }
});

// Confirmation dialog events
confirmYesBtn.addEventListener('click', async () => {
  confirmationModal.classList.remove('visible');
  
  if (currentAction === 'delete' && deleteServerName) {
    await deleteServer(deleteServerName);
    deleteServerName = null;
  }
  
  currentAction = null;
});

confirmNoBtn.addEventListener('click', () => {
  confirmationModal.classList.remove('visible');
  currentAction = null;
  deleteServerName = null;
});

// API Functions
async function loadServers() {
  try {
    servers = await window.electronAPI.getServers();
    renderServerList();
  } catch (error) {
    console.error('Error loading servers:', error);
    showNotification('Failed to load servers', 'error');
  }
}

async function loadSettings() {
  try {
    settings = await window.electronAPI.getSettings();
    claudeConfigPathField.value = settings.claudeConfigPath;
    backupsEnabledField.checked = settings.backupsEnabled;
  } catch (error) {
    console.error('Error loading settings:', error);
    showNotification('Failed to load settings', 'error');
  }
}

async function saveServer(server) {
  try {
    const savedServer = await window.electronAPI.saveServer(server);
    await loadServers(); // Refresh the list
    return savedServer;
  } catch (error) {
    console.error('Error saving server:', error);
    showNotification('Failed to save server', 'error');
  }
}

async function saveServers(serversToSave) {
  try {
    for (const server of serversToSave) {
      await window.electronAPI.saveServer(server);
    }
    await loadServers(); // Refresh the list
    return true;
  } catch (error) {
    console.error('Error saving servers:', error);
    showNotification('Failed to save servers', 'error');
    return false;
  }
}

async function toggleServer(serverName, enabled) {
  try {
    await window.electronAPI.toggleServer(serverName, enabled);
    // Update local state
    const server = servers.find(s => s.name === serverName);
    if (server) {
      server.enabled = enabled;
    }
  } catch (error) {
    console.error('Error toggling server:', error);
    showNotification('Failed to update server state', 'error');
  }
}

async function deleteServer(serverName) {
  try {
    await window.electronAPI.deleteServer(serverName);
    showNotification('Server deleted successfully', 'success');
    await loadServers(); // Refresh the list
  } catch (error) {
    console.error('Error deleting server:', error);
    showNotification('Failed to delete server', 'error');
  }
}

async function saveSettings(updatedSettings) {
  try {
    await window.electronAPI.saveSettings(updatedSettings);
    settings = updatedSettings;
  } catch (error) {
    console.error('Error saving settings:', error);
    showNotification('Failed to save settings', 'error');
  }
}

async function saveClaudeConfig(restart) {
  try {
    const result = await window.electronAPI.saveClaudeConfig({ restart });
    
    if (result.success) {
      showNotification(
        restart ? 'Config saved and Claude restarted' : 'Config saved successfully', 
        'success'
      );
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error saving Claude config:', error);
    showNotification('Failed to save config: ' + error.message, 'error');
  }
}

// UI Functions
function renderServerList() {
  serverListBody.innerHTML = '';
  
  if (servers.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  
  emptyState.style.display = 'none';
  
  servers.forEach(server => {
    const row = document.createElement('tr');
    
    // Toggle + Name cell (combined)
    const toggleNameCell = document.createElement('td');
    toggleNameCell.className = 'toggle-name-cell';
    
    // Create flex container
    const flexContainer = document.createElement('div');
    flexContainer.className = 'toggle-name-container';
    
    // Create toggle switch
    const toggleSwitch = document.createElement('label');
    toggleSwitch.className = 'toggle-switch';
    
    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.checked = server.enabled;
    toggleInput.addEventListener('change', () => toggleServer(server.name, toggleInput.checked));
    
    const toggleSlider = document.createElement('span');
    toggleSlider.className = 'toggle-slider';
    
    toggleSwitch.appendChild(toggleInput);
    toggleSwitch.appendChild(toggleSlider);
    
    // Create name element
    const nameSpan = document.createElement('span');
    nameSpan.className = 'server-name';
    nameSpan.textContent = server.name;
    
    // Combine toggle and name
    flexContainer.appendChild(toggleSwitch);
    flexContainer.appendChild(nameSpan);
    toggleNameCell.appendChild(flexContainer);
    
    // Actions cell
    const actionsCell = document.createElement('td');
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'server-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn edit-btn';
    editBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    `;
    editBtn.addEventListener('click', () => openEditServerModal(server));
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn delete-btn';
    deleteBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
    `;
    deleteBtn.addEventListener('click', () => confirmDelete(server.name));
    
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
    actionsCell.appendChild(actionsDiv);
    
    // Append all cells to row
    row.appendChild(toggleNameCell);
    row.appendChild(actionsCell);
    
    // Append row to table body
    serverListBody.appendChild(row);
  });
}

function openAddServerModal() {
  // Clear form
  serverForm.reset();
  serverNameField.value = '';
  serverNameField.disabled = false;
  serverDefinitionField.value = JSON.stringify({
    command: '',
    args: []
  }, null, 2);
  definitionValidation.textContent = '';
  
  // Update title
  document.getElementById('modal-title').textContent = 'Add MCP Server';
  
  // Show modal
  serverModal.classList.add('visible');
}

function openEditServerModal(server) {
  // Fill form with server data
  serverNameField.value = server.name;
  serverNameField.disabled = true; // Can't edit name once created
  serverDefinitionField.value = JSON.stringify(server.definition, null, 2);
  
  // Set editing state
  editingServerName = server.name;
  
  // Update title
  document.getElementById('modal-title').textContent = 'Edit MCP Server';
  
  // Show modal
  serverModal.classList.add('visible');
}

function openSettingsModal() {
  // Fill form with current settings
  claudeConfigPathField.value = settings.claudeConfigPath;
  backupsEnabledField.checked = settings.backupsEnabled;
  
  // Show modal
  settingsModal.classList.add('visible');
}

function openImportJsonModal() {
  // Clear previous input
  jsonInputField.value = '';
  jsonValidation.textContent = '';
  
  // Try to read from clipboard (but don't show error notifications)
  try {
    const clipboardText = window.electronAPI.readFromClipboard();
    if (clipboardText && clipboardText.trim() !== '' && (
        clipboardText.includes('"mcpServers"') || 
        clipboardText.trim().startsWith('{')
      )) {
      jsonInputField.value = clipboardText;
      validateJsonInput(); // Validate immediately to provide feedback
    }
  } catch (error) {
    console.error('Error reading from clipboard in openImportJsonModal:', error);
    // Don't show notification here, as this is just an auto-fill attempt
    // The user can explicitly paste later if needed
  }
  
  // Add event listener for paste via keyboard shortcut
  // This provides an alternative when the Electron clipboard API fails
  if (!jsonInputField.hasManualPasteListener) {
    jsonInputField.addEventListener('paste', (e) => {
      // Wait a moment for the paste to complete, then validate
      setTimeout(validateJsonInput, 100);
    });
    jsonInputField.hasManualPasteListener = true;
  }
  
  // Hide the server modal if it's visible
  serverModal.classList.remove('visible');
  
  // Show import modal
  importJsonModal.classList.add('visible');
}

function confirmDelete(serverName) {
  currentAction = 'delete';
  deleteServerName = serverName;
  
  const server = servers.find(s => s.name === serverName);
  confirmationMessage.textContent = `Are you sure you want to delete "${server.name}"?`;
  
  confirmationModal.classList.add('visible');
}

function validateServerForm() {
  // Validate Name
  if (!serverNameField.value) {
    showNotification('Server name is required', 'error');
    return false;
  }
  
  // Validate Definition JSON
  try {
    const definition = JSON.parse(serverDefinitionField.value);
    
    if (!definition.command || typeof definition.command !== 'string') {
      showNotification('Definition must include a command string', 'error');
      return false;
    }
    
    if (!definition.args || !Array.isArray(definition.args)) {
      showNotification('Definition must include args array', 'error');
      return false;
    }
    
    if (!definition.args.every(arg => typeof arg === 'string')) {
      showNotification('All args must be strings', 'error');
      return false;
    }
    
  } catch (error) {
    showNotification('Invalid JSON: ' + error.message, 'error');
    return false;
  }
  
  return true;
}

function validateJsonInput() {
  try {
    const jsonInput = jsonInputField.value.trim();
    
    if (!jsonInput) {
      jsonValidation.textContent = '';
      return false;
    }
    
    // Parse JSON
    const json = JSON.parse(jsonInput);
    
    // Look for mcpServers object
    if (!json.mcpServers || typeof json.mcpServers !== 'object') {
      jsonValidation.textContent = 'JSON must contain mcpServers object';
      jsonValidation.style.color = 'var(--error-color)';
      return false;
    }
    
    // Count server entries
    const serverCount = Object.keys(json.mcpServers).length;
    if (serverCount === 0) {
      jsonValidation.textContent = 'No MCP servers found in JSON';
      jsonValidation.style.color = 'var(--error-color)';
      return false;
    }
    
    // Validate format of each server
    const invalidServers = [];
    for (const [serverName, definition] of Object.entries(json.mcpServers)) {
      // Verify server definition structure
      if (!definition.command || !definition.args || !Array.isArray(definition.args)) {
        invalidServers.push(serverName);
      }
    }
    
    if (invalidServers.length > 0) {
      jsonValidation.textContent = `Found ${invalidServers.length} invalid server definitions`;
      jsonValidation.style.color = 'var(--error-color)';
      return false;
    }
    
    // Success
    jsonValidation.textContent = `Found ${serverCount} valid MCP server(s)`;
    jsonValidation.style.color = 'var(--success-color)';
    return true;
  } catch (error) {
    jsonValidation.textContent = 'Invalid JSON: ' + error.message;
    jsonValidation.style.color = 'var(--error-color)';
    return false;
  }
}

async function processJsonInput() {
  if (!validateJsonInput()) {
    return;
  }
  
  try {
    const jsonConfig = JSON.parse(jsonInputField.value);
    const serversToImport = [];
    
    // Extract server definitions
    for (const [serverName, definition] of Object.entries(jsonConfig.mcpServers)) {
      serversToImport.push({
        name: serverName,
        enabled: true,
        definition
      });
    }
    
    // Save servers
    if (await saveServers(serversToImport)) {
      importJsonModal.classList.remove('visible');
      showNotification(`Imported ${serversToImport.length} MCP server(s)`, 'success');
    }
    
  } catch (error) {
    console.error('Error processing JSON input:', error);
    showNotification('Failed to process JSON: ' + error.message, 'error');
  }
}

// Helper Functions
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  // Append to body
  document.body.appendChild(notification);
  
  // Add visible class after a small timeout to trigger animation
  setTimeout(() => {
    notification.classList.add('visible');
  }, 10);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.remove('visible');
    
    // Remove from DOM after animation completes
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

// Set up external links to open in default browser
function setupExternalLinks() {
  const externalLinks = document.querySelectorAll('.external-links a');
  externalLinks.forEach(link => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const url = link.getAttribute('href');
      // Use Electron's shell module to open links in default browser
      window.electronAPI.openExternalLink(url);
    });
  });
}

// Paste from clipboard functionality
function pasteFromClipboard() {
  try {
    const clipboardText = window.electronAPI.readFromClipboard();
    
    if (!clipboardText || clipboardText.trim() === '') {
      // Provide guidance for clipboard permission issues on macOS
      if (navigator.platform.indexOf('Mac') !== -1) {
        showNotification('Clipboard may require permission. Try using keyboard shortcut ⌘V to paste instead.', 'warning');
      } else {
        showNotification('Clipboard is empty or contains no text', 'warning');
      }
      return;
    }
    
    jsonInputField.value = clipboardText;
    const isValid = validateJsonInput();
    
    if (isValid) {
      showNotification('JSON config pasted and validated successfully', 'success');
    } else {
      // If validation already shows an error message, no need for another notification
      if (!jsonValidation.textContent) {
        showNotification('Content pasted, but not valid MCP server JSON', 'warning');
      }
    }
  } catch (error) {
    console.error('Error reading from clipboard:', error);
    
    // Provide guidance for clipboard permission issues on macOS
    if (navigator.platform.indexOf('Mac') !== -1) {
      showNotification('Clipboard permission denied. Try using keyboard shortcut ⌘V to paste instead.', 'warning');
    } else {
      showNotification('Failed to read from clipboard: ' + error.message, 'error');
    }
  }
} 