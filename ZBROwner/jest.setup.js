// Jest setup for the ZBROwner app.
// Keep this minimal — most units under test are pure logic + the zustand store.

// Silence the Expo winter/runtime banner noise in test output if present.
/* eslint-disable no-undef */
global.__DEV__ = true;
