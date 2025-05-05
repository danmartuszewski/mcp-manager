const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { createTray } = require('../tray/tray');
const Store = require('electron-store');

// Initialize store for app settings and server configurations
const store = new Store({
  name: 'mcp-manager',
  defaults: {
    servers: [],
    settings: {
      claudeConfigPath: path.join(app.getPath('home'), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
      backupsEnabled: true
    }
  }
});

let mainWindow;
let tray;

// Skip actual initialization if in test environment
if (process.env.NODE_ENV !== 'test') {
  // Load config before app is ready
  console.log('Checking for existing Claude config before app initialization...');
  console.log('Home directory:', app.getPath('home'));
  console.log('Default config path should be:', path.join(app.getPath('home'), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'));

  // Reset the config path in case it was previously set to an incorrect value
  store.set('settings.claudeConfigPath', path.join(app.getPath('home'), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'));
  console.log('Set config path to:', store.get('settings.claudeConfigPath'));

  const initialServers = checkForExistingClaudeConfig();
  console.log(`Initial MCP server count: ${initialServers.length}`);

  app.whenReady().then(() => {
    console.log('App is ready, creating window and tray...');
    
    // Set app icon for macOS
    if (process.platform === 'darwin') {
      app.dock.setIcon(path.join(__dirname, '../resources/mcp-manager-logo.png'));
    }
    
    createWindow();
    
    // Request clipboard permission
    requestClipboardPermission();
    
    // Create tray after app is ready
    tray = createTray(() => {
      return store.get('servers');
    }, (updatedServers) => {
      store.set('servers', updatedServers);
    }, () => generateClaudeConfig());
    
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

// Request permission for clipboard access on macOS
function requestClipboardPermission() {
  // Skip clipboard permission request in test environment
  if (process.env.NODE_ENV === 'test') {
    console.log('Skipping clipboard permission request in test environment');
    return;
  }
  
  if (process.platform === 'darwin') {
    // We'll try to read from clipboard which will trigger the permission dialogue
    try {
      // On macOS, trying to read clipboard will prompt for permission if needed
      const { clipboard } = require('electron');
      clipboard.readText();
      console.log('Clipboard permission requested');
    } catch (error) {
      console.error('Error requesting clipboard permission:', error);
    }
  }
}

// Check if Claude config exists and import servers
function checkForExistingClaudeConfig() {
  const configPath = store.get('settings.claudeConfigPath');
  
  try {
    console.log(`Checking Claude config at: ${configPath}`);
    
    if (fs.existsSync(configPath)) {
      console.log(`Found Claude config at: ${configPath}`);
      const fileContent = fs.readFileSync(configPath, 'utf8');
      
      try {
        const configData = JSON.parse(fileContent);
        
        if (configData && configData.mcpServers) {
          console.log('MCP servers found in config:', Object.keys(configData.mcpServers));
          
          // Get the existing servers from store
          const existingServers = store.get('servers') || [];
          
          // Create a map for quick lookup of existing servers
          const existingServerMap = {};
          existingServers.forEach(server => {
            existingServerMap[server.name] = server;
          });
          
          // Import servers from Claude config
          const importedServers = Object.entries(configData.mcpServers).map(([id, definition]) => {
            // Check if this server already exists in our store
            if (existingServerMap[id]) {
              // Update definition but preserve enabled state and other properties
              return {
                ...existingServerMap[id],
                definition: definition
              };
            }
            
            // New server, so mark as enabled
            return {
              name: id,
              enabled: true,
              definition
            };
          });
          
          // We need to also include servers that are in our store but not in the Claude config
          // (these are likely disabled servers)
          const configServerNames = Object.keys(configData.mcpServers);
          const disabledServers = existingServers.filter(server => 
            !configServerNames.includes(server.name) && 
            !server.enabled
          );
          
          // Combine the imported (enabled) servers with disabled ones
          const mergedServers = [...importedServers, ...disabledServers];
          
          console.log(`Imported ${importedServers.length} MCP servers, preserved ${disabledServers.length} disabled servers`);
          store.set('servers', mergedServers);
          store.set('initialized', true);
          
          // Notify renderer process about imported servers if window exists
          if (mainWindow) {
            mainWindow.webContents.send('servers-imported', mergedServers);
          }
          
          return mergedServers;
        } else {
          console.log('No mcpServers found in config file or empty mcpServers object');
          
          // Return existing servers rather than an empty array
          // to preserve disabled servers even if Claude config is empty
          return store.get('servers') || [];
        }
      } catch (parseError) {
        console.error('Error parsing Claude config:', parseError);
        console.log('File content:', fileContent.substring(0, 100) + '...');
        
        // Return existing servers on parse error
        return store.get('servers') || [];
      }
    } else {
      console.log(`Claude config not found at: ${configPath}`);
      
      // Return existing servers if config file doesn't exist
      return store.get('servers') || [];
    }
  } catch (error) {
    console.error('Error importing Claude config:', error);
    
    // Return existing servers on any error
    return store.get('servers') || [];
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    icon: path.join(__dirname, '../resources/mcp-manager-logo.png'),
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  
  // Only show when content is loaded to avoid blank screen
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Generate Claude config with only enabled servers
function generateClaudeConfig() {
  const servers = store.get('servers') || [];
  const enabledServers = servers.filter(server => server.enabled);
  
  const mcpServers = {};
  enabledServers.forEach(server => {
    mcpServers[server.name] = server.definition;
  });
  
  return { mcpServers };
}

// Save Claude config and optionally restart Claude
async function saveClaudeConfig(restartClaude = true) {
  const configPath = store.get('settings.claudeConfigPath');
  const config = generateClaudeConfig();
  
  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Backup existing config if enabled
    if (store.get('settings.backupsEnabled') && fs.existsSync(configPath)) {
      const backupDate = new Date().toISOString().slice(0, 10);
      const backupPath = path.join(
        path.dirname(configPath), 
        `config.backup.${backupDate}.json`
      );
      fs.copyFileSync(configPath, backupPath);
    }
    
    // Write new config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('Config saved to:', configPath);
    
    if (restartClaude) {
      console.log('Restarting Claude...');
      // Implement Claude restart logic
      const { restartClaude } = require('../tray/tray');
      restartClaude();
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error saving Claude config:', error);
    return { success: false, error: error.message };
  }
}

// IPC Handlers
function handleGetServers() {
  return store.get('servers');
}

function handleSaveServer(server) {
  const servers = store.get('servers');
  const existingIndex = servers.findIndex(s => s.name === server.name);
  
  if (existingIndex >= 0) {
    servers[existingIndex] = server;
  } else {
    servers.push(server);
  }
  
  store.set('servers', servers);
  return server;
}

function handleDeleteServer(serverName) {
  const servers = store.get('servers');
  const updatedServers = servers.filter(server => server.name !== serverName);
  store.set('servers', updatedServers);
  return { success: true };
}

function handleToggleServer(serverName, enabled) {
  const servers = store.get('servers') || [];
  const serverIndex = servers.findIndex(s => s.name === serverName);
  
  if (serverIndex >= 0) {
    servers[serverIndex].enabled = enabled;
    store.set('servers', servers);
    return { success: true };
  }
  
  return { success: false, error: 'Server not found' };
}

function handleGetSettings() {
  return store.get('settings');
}

function handleSaveSettings(settings) {
  store.set('settings', settings);
  return { success: true };
}

function handleSaveClaudeConfig({ restart }) {
  return saveClaudeConfig(restart);
}

// Wire up the IPC handlers
ipcMain.handle('get-servers', () => handleGetServers());
ipcMain.handle('save-server', (event, server) => handleSaveServer(server));
ipcMain.handle('delete-server', (event, serverName) => handleDeleteServer(serverName));
ipcMain.handle('toggle-server', (event, { serverName, enabled }) => handleToggleServer(serverName, enabled));
ipcMain.handle('get-settings', () => handleGetSettings());
ipcMain.handle('save-settings', (event, settings) => handleSaveSettings(settings));
ipcMain.handle('save-claude-config', (event, { restart }) => handleSaveClaudeConfig({ restart }));

ipcMain.handle('select-config-path', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const newPath = result.filePaths[0];
    const settings = store.get('settings');
    settings.claudeConfigPath = newPath;
    store.set('settings', settings);
    
    // Re-import config from the new path
    checkForExistingClaudeConfig();
    
    return newPath;
  }
  
  return null;
});

// IPC handler for opening external links in default browser
ipcMain.handle('open-external-link', async (event, url) => {
  console.log(`Opening external URL: ${url}`);
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Error opening external link:', error);
    return { success: false, error: error.message };
  }
});

// Export functions for testing
if (process.env.NODE_ENV === 'test') {
  module.exports = {
    generateClaudeConfig,
    saveClaudeConfig,
    handleGetServers,
    handleSaveServer,
    handleDeleteServer,
    handleToggleServer,
    handleGetSettings,
    handleSaveSettings,
    handleSaveClaudeConfig
  };
} 