export default {
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  moduleNameMapper: {
    '^bun:test$': '<rootDir>/src/__tests__/jest-bun-mock.js',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jose|@panva|uuid)/)',
  ],
  testEnvironment: 'node',
};
