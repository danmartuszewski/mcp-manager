const { contextBridge, ipcRenderer, shell, clipboard } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Server management
  getServers: () => ipcRenderer.invoke('get-servers'),
  saveServer: (server) => ipcRenderer.invoke('save-server', server),
  deleteServer: (serverName) => ipcRenderer.invoke('delete-server', serverName),
  toggleServer: (serverName, enabled) => ipcRenderer.invoke('toggle-server', { serverName, enabled }),
  
  // Settings management
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  selectConfigPath: () => ipcRenderer.invoke('select-config-path'),
  
  // Claude config management
  saveClaudeConfig: (restart) => ipcRenderer.invoke('save-claude-config', { restart }),
  
  // External links - open in default browser
  openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url),
  
  // Clipboard functionality
  readFromClipboard: () => {
    try {
      return clipboard.readText() || '';
    } catch (error) {
      console.error('Error reading from clipboard:', error);
      return '';
    }
  },
  
  // Listeners
  onServersImported: (callback) => {
    const listener = (event, servers) => callback(servers);
    ipcRenderer.on('servers-imported', listener);
    return () => ipcRenderer.removeListener('servers-imported', listener);
  },
  
  // Listen for tray menu server state changes
  onServerStateChanged: (callback) => {
    const listener = (event, servers) => callback(servers);
    ipcRenderer.on('server-state-changed', listener);
    return () => ipcRenderer.removeListener('server-state-changed', listener);
  },
  
  // Listen for Claude restart events
  onClaudeRestarted: (callback) => {
    const listener = (event) => callback();
    ipcRenderer.on('claude-restarted', listener);
    return () => ipcRenderer.removeListener('claude-restarted', listener);
  }
}); 