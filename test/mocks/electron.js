// Mock for Electron API
module.exports = {
  app: {
    getPath: jest.fn((path) => {
      if (path === 'home') return '/mock/home';
      return '/mock/path';
    }),
    whenReady: jest.fn().mockResolvedValue({}),
    on: jest.fn(),
    dock: {
      setIcon: jest.fn()
    },
    quit: jest.fn()
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    webContents: {
      send: jest.fn()
    },
    show: jest.fn(),
    close: jest.fn(),
    isMinimized: jest.fn().mockReturnValue(false),
    restore: jest.fn(),
    focus: jest.fn()
  })),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  },
  dialog: {
    showOpenDialog: jest.fn().mockResolvedValue({ canceled: false, filePaths: ['/mock/file.json'] })
  },
  shell: {
    openExternal: jest.fn().mockResolvedValue(true)
  },
  clipboard: {
    readText: jest.fn().mockReturnValue('{"mcpServers": {}}')
  },
  Menu: {
    buildFromTemplate: jest.fn().mockReturnValue({})
  },
  Tray: jest.fn().mockImplementation(() => ({
    setToolTip: jest.fn(),
    setContextMenu: jest.fn(),
    on: jest.fn(),
    popUpContextMenu: jest.fn()
  }))
}; 