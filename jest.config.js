// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

module.exports = {
  testEnvironment: 'node',
  roots: [path.join(__dirname, 'test')],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': path.join(__dirname, '/$1'),
  },
  snapshotResolver: path.join(__dirname, 'snapshotResolver.js'),
};
