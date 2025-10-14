/**
 * Mock module for @aztec/foundation/testing
 *
 * This module provides no-op implementations of testing utilities
 * that Aztec.js may try to import in browser environments.
 *
 * These functions are only used in test/development modes by Aztec
 * and should not affect production functionality.
 */

// No-op function for pushTestData
export function pushTestData() {
  // In browser, we don't need to track test data
  // This is a no-op to prevent import errors
}

// No-op function for getTestData
export function getTestData() {
  return [];
}

// No-op function for clearTestData
export function clearTestData() {
  // No-op
}

// Default export for compatibility
export default {
  pushTestData,
  getTestData,
  clearTestData,
};
