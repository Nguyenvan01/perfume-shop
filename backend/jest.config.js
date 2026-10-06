'use strict';

module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
  testTimeout: 20000,
  // Chạy tuần tự: các test file dùng chung 1 DB test, song song sẽ đụng nhau.
  maxWorkers: 1,
};
