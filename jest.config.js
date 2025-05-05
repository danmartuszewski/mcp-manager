module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/unit/**/*.test.js'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  testPathIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {
    '^electron$': '<rootDir>/test/mocks/electron.js',
  },
}; 