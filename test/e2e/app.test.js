const { Application } = require('spectron');
const { expect } = require('chai');
const path = require('path');
const electronPath = require('electron');

describe('MCP Manager Application', function() {
  this.timeout(10000);
  
  let app;
  
  beforeEach(async function() {
    app = new Application({
      path: electronPath,
      args: [path.join(__dirname, '../../main/index.js')],
      env: {
        NODE_ENV: 'test'
      }
    });
    
    return app.start();
  });
  
  afterEach(function() {
    if (app && app.isRunning()) {
      return app.stop();
    }
  });
  
  it('should show the main window', async function() {
    const windowCount = await app.client.getWindowCount();
    expect(windowCount).to.equal(1);
  });
  
  it('should have the correct title', async function() {
    const title = await app.client.getTitle();
    expect(title).to.equal('MCP Manager');
  });
  
  it('should have the correct elements', async function() {
    // Check for app title
    const appTitle = await app.client.$('.app-title h1');
    const titleText = await appTitle.getText();
    expect(titleText).to.equal('MCP Manager');
    
    // Check for tabs
    const localTab = await app.client.$('.tab-btn[data-tab="local"]');
    const localTabText = await localTab.getText();
    expect(localTabText).to.equal('Local Servers');
    
    const remoteTab = await app.client.$('.tab-btn[data-tab="remote"]');
    const remoteTabText = await remoteTab.getText();
    expect(remoteTabText).to.equal('Remote Directories');
    
    // Check for buttons
    const addServerBtn = await app.client.$('#add-server-btn');
    const addServerBtnText = await addServerBtn.getText();
    expect(addServerBtnText).to.include('Add Server');
    
    const parseJsonBtn = await app.client.$('#parse-json-btn');
    const parseJsonBtnText = await parseJsonBtn.getText();
    expect(parseJsonBtnText).to.include('Parse JSON Config');
  });
  
  it('should open the add server modal', async function() {
    // Click the Add Server button
    const addServerBtn = await app.client.$('#add-server-btn');
    await addServerBtn.click();
    
    // Check that the modal is visible
    const serverModal = await app.client.$('#server-modal');
    const isVisible = await serverModal.isDisplayed();
    expect(isVisible).to.be.true;
    
    // Check the modal title
    const modalTitle = await app.client.$('#modal-title');
    const titleText = await modalTitle.getText();
    expect(titleText).to.equal('Add MCP Server');
  });
}); 