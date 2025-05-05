const { Tray, Menu, app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

let tray = null;
let getServers = null;
let updateServers = null;
let getConfig = null;
let changesDetected = false;
let mainWindowRef = null;

function createTray(getServersFn, updateServersFn, getConfigFn) {
  getServers = getServersFn;
  updateServers = updateServersFn;
  getConfig = getConfigFn;

  try {
    // Create tray icon - using absolute path to ensure it works
    const iconPath = path.join(__dirname, '../resources/trayIcon.png');
    
    // Check if the icon file exists and is a valid image
    if (!fs.existsSync(iconPath) || fs.statSync(iconPath).size < 1000) {
      // If it doesn't exist or is too small, create a simple minimal PNG file
      createSimpleTrayIcon();
    }
    
    // Create tray with the icon
    tray = new Tray(iconPath);
    tray.setToolTip('MCP Manager');
    
    // Initial context menu
    updateContextMenu();
    
    // Set up a better handling for right-click to keep menu open for toggles
    tray.on('right-click', () => {
      const contextMenu = buildTrayMenu();
      tray.popUpContextMenu(contextMenu);
    });
    
    tray.on('click', () => {
      const contextMenu = buildTrayMenu();
      tray.popUpContextMenu(contextMenu);
    });
    
    // Set up a timer to check for changes and update the menu
    setInterval(updateContextMenu, 3000);
    
    // Keep track of the main window
    mainWindowRef = BrowserWindow.getAllWindows()[0] || null;
    
    console.log('Tray successfully created with icon: ' + iconPath);
    return tray;
  } catch (error) {
    console.error('Error creating tray:', error);
    
    // Create a minimal icon in case the default one doesn't work
    createSimpleTrayIcon();
    
    // Try again with the newly created icon
    try {
      const iconPath = path.join(__dirname, '../resources/trayIcon.png');
      tray = new Tray(iconPath);
      tray.setToolTip('MCP Manager');
      updateContextMenu();
      
      return tray;
    } catch (innerError) {
      console.error('Failed to create tray even with fallback icon:', innerError);
      // We'll continue without a tray in this case
      return null;
    }
  }
}

function createSimpleTrayIcon() {
  try {
    // Create a simple PNG as a fallback
    const iconPath = path.join(__dirname, '../resources/trayIcon.png');
    
    // Simple 1x1 transparent PNG (base64 encoded)
    const minimalPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    
    // Write the minimal PNG to disk
    fs.writeFileSync(iconPath, minimalPng);
    console.log('Created simple tray icon at:', iconPath);
  } catch (error) {
    console.error('Failed to create simple tray icon:', error);
  }
}

function updateContextMenu() {
  try {
    const contextMenu = buildTrayMenu();
    tray.setContextMenu(contextMenu);
  } catch (error) {
    console.error('Error updating context menu:', error);
  }
}

function openMainWindow() {
  // Close any existing MCP Manager instances
  closeExistingInstances(() => {
    // After closing, focus existing window or create a new one
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      mainWindowRef = win;
      if (win.isMinimized()) win.restore();
      win.focus();
    } else {
      // Create new window by emitting activate
      app.emit('activate');
      // Update reference after window is created
      setTimeout(() => {
        mainWindowRef = BrowserWindow.getAllWindows()[0];
      }, 500);
    }
  });
}

function closeExistingInstances(callback) {
  // Find any running MCP Manager instances
  exec('pgrep -f "MCP Manager"', (error, stdout, stderr) => {
    if (error) {
      // No instances found or other error
      console.log('No existing MCP Manager instances found');
      callback();
      return;
    }

    // Get the PIDs
    const pids = stdout.trim().split('\n');
    const currentPid = process.pid;
    
    console.log('Found running instances:', pids);
    console.log('Current process ID:', currentPid);
    
    // Filter out current process
    const otherPids = pids.filter(pid => parseInt(pid) !== currentPid);
    
    if (otherPids.length === 0) {
      console.log('No other instances to close');
      callback();
      return;
    }
    
    console.log('Closing other instances:', otherPids);
    
    // Kill other instances
    exec(`kill ${otherPids.join(' ')}`, (killError) => {
      if (killError) {
        console.error('Error closing other instances:', killError);
      } else {
        console.log('Successfully closed other instances');
      }
      
      // Wait a moment before proceeding
      setTimeout(callback, 500);
    });
  });
}

// Function to restart Claude
function restartClaude() {
  // Check if Claude is running
  exec('pgrep -x Claude', (error, stdout, stderr) => {
    if (error) {
      console.log('Claude is not running. Starting Claude...');
      // Try to start Claude
      startClaude();
      return;
    }
    
    // If running, kill and restart
    const claudePid = stdout.trim();
    if (claudePid) {
      console.log(`Claude is running with PID ${claudePid}. Restarting...`);
      exec(`kill ${claudePid}`, (error) => {
        if (error) {
          console.error(`Failed to kill Claude: ${error}`);
          return;
        }
        
        // Wait a moment before restarting
        setTimeout(() => {
          startClaude();
        }, 1000);
      });
    }
  });
}

function startClaude() {
  // Using open command to start Claude
  exec('open -a Claude', (error) => {
    if (error) {
      console.error(`Failed to start Claude: ${error}`);
      // Try alternative method
      exec('open /Applications/Claude.app', (err) => {
        if (err) {
          console.error(`Failed to start Claude with alternative method: ${err}`);
        }
      });
    }
  });
}

// Helper function to build the tray menu
function buildTrayMenu() {
  const servers = getServers() || [];
  
  const serverMenuItems = servers.map(server => {
    return {
      label: server.name,
      type: 'checkbox',
      checked: server.enabled,
      click: (menuItem) => {
        console.log(`Toggling server ${server.name} to ${!server.enabled}`);
        server.enabled = !server.enabled;
        changesDetected = true;
        updateServers(servers);
        
        // Notify the main window about the server state change
        notifyMainWindow('server-state-changed', servers);
        
        // Don't close the menu - immediately show updated menu
        const updatedMenu = buildTrayMenu();
        tray.popUpContextMenu(updatedMenu);
      }
    };
  });

  return Menu.buildFromTemplate([
    { 
      label: 'MCP Manager', 
      click: () => {
        openMainWindow();
      } 
    },
    { type: 'separator' },
    ...(serverMenuItems.length > 0 ? serverMenuItems : [{ label: 'No servers configured', enabled: false }]),
    { type: 'separator' },
    { 
      label: 'Restart Claude with Changes',
      enabled: changesDetected && servers.length > 0,
      click: async () => {
        try {
          restartClaude();
          changesDetected = false;
          notifyMainWindow('claude-restarted');
        } catch (error) {
          console.error('Error restarting Claude:', error);
        }
      }
    },
    { type: 'separator' },
    { 
      label: 'Open MCP Manager', 
      click: () => {
        openMainWindow();
      } 
    },
    { 
      label: 'Quit', 
      click: () => {
        app.quit();
      } 
    }
  ]);
}

// Helper function to notify the main window about changes
function notifyMainWindow(event, data) {
  // Find the main window if not already tracked
  if (!mainWindowRef || mainWindowRef.isDestroyed()) {
    mainWindowRef = BrowserWindow.getAllWindows()[0];
  }
  
  // Send event to main window if it exists
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    console.log(`Notifying main window of event: ${event}`);
    mainWindowRef.webContents.send(event, data);
  }
}

module.exports = { createTray, restartClaude }; 