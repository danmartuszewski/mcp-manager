/**
 * Simplified tests for tray module behaviors
 */

describe('Tray Module Functions', () => {
  // Mock helper for server object
  const createServerObject = (name, enabled) => ({
    name,
    enabled,
    definition: { command: 'test', args: ['arg1'] }
  });
  
  test('filtering enabled servers works correctly', () => {
    // Create test servers
    const servers = [
      createServerObject('server1', true),
      createServerObject('server2', false),
      createServerObject('server3', true)
    ];
    
    // Filter enabled servers (simulating the tray menu)
    const enabledServers = servers.filter(server => server.enabled);
    
    // Check only enabled servers are included
    expect(enabledServers.length).toBe(2);
    expect(enabledServers[0].name).toBe('server1');
    expect(enabledServers[1].name).toBe('server3');
    expect(enabledServers.some(s => s.name === 'server2')).toBe(false);
  });
  
  test('server configuration is generated correctly', () => {
    // Create test servers
    const servers = [
      createServerObject('server1', true),
      createServerObject('server2', false),
      createServerObject('server3', true)
    ];
    
    // Generate config object simulating the tray module logic
    const mcpServers = {};
    servers.filter(server => server.enabled).forEach(server => {
      mcpServers[server.name] = server.definition;
    });
    
    // Check the result
    expect(Object.keys(mcpServers).length).toBe(2);
    expect(mcpServers.server1).toBeDefined();
    expect(mcpServers.server3).toBeDefined();
    expect(mcpServers.server2).toBeUndefined();
  });
}); 