/**
 * Basic test file to demonstrate testing in Electron
 */

describe('Basic Functionality', () => {
  // Simple test to check if Jest is working
  test('adds two numbers correctly', () => {
    expect(1 + 1).toBe(2);
  });
  
  // Test loading JSON
  test('parses JSON correctly', () => {
    const json = '{"name": "test", "enabled": true, "definition": {"command": "echo", "args": ["hello"]}}';
    const parsed = JSON.parse(json);
    
    expect(parsed).toEqual({
      name: 'test',
      enabled: true,
      definition: {
        command: 'echo',
        args: ['hello']
      }
    });
  });
  
  // Test filtering functionality similar to what the app does
  test('filters enabled servers correctly', () => {
    const servers = [
      { name: 'server1', enabled: true, definition: { command: 'test1', args: [] } },
      { name: 'server2', enabled: false, definition: { command: 'test2', args: [] } },
      { name: 'server3', enabled: true, definition: { command: 'test3', args: [] } }
    ];
    
    const enabledServers = servers.filter(server => server.enabled);
    
    expect(enabledServers.length).toBe(2);
    expect(enabledServers[0].name).toBe('server1');
    expect(enabledServers[1].name).toBe('server3');
  });
  
  // Test generating a config object similar to the app
  test('generates MCP server config correctly', () => {
    const servers = [
      { name: 'server1', enabled: true, definition: { command: 'test1', args: ['a'] } },
      { name: 'server2', enabled: false, definition: { command: 'test2', args: ['b'] } },
      { name: 'server3', enabled: true, definition: { command: 'test3', args: ['c'] } }
    ];
    
    const enabledServers = servers.filter(server => server.enabled);
    
    const mcpServers = {};
    enabledServers.forEach(server => {
      mcpServers[server.name] = server.definition;
    });
    
    const config = { mcpServers };
    
    expect(config).toEqual({
      mcpServers: {
        server1: { command: 'test1', args: ['a'] },
        server3: { command: 'test3', args: ['c'] }
      }
    });
    
    // Make sure disabled servers are excluded
    expect(config.mcpServers.server2).toBeUndefined();
  });
}); 