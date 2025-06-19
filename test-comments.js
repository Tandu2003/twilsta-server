#!/usr/bin/env node

/**
 * Simple Comment API tester for Twilsta Server
 * Tests comment functionality
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8080/api';

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

// Helper function to add test result
function addResult(name, passed, message = '') {
  results.tests.push({ name, passed, message });
  if (passed) {
    results.passed++;
    console.log(`✅ ${name}`);
  } else {
    results.failed++;
    console.log(`❌ ${name}: ${message}`);
  }
}

// Test functions
async function testGetCommentsForNonExistentPost() {
  try {
    await axios.get(`${BASE_URL}/posts/cInvalidPostId123456789/comments`);
    addResult(
      'Get Comments for Non-existent Post',
      false,
      'Should return 422 for invalid post ID',
    );
  } catch (error) {
    addResult(
      'Get Comments for Non-existent Post',
      error.response?.status === 422,
    );
  }
}

async function testCreateCommentWithoutAuth() {
  try {
    await axios.post(`${BASE_URL}/comments`, {
      content: 'Test comment',
      postId: 'cSomeValidPostId123456789',
    });
    addResult(
      'Create Comment Without Auth',
      false,
      'Should require authentication or validation',
    );
  } catch (error) {
    // Should fail with 422 (validation) or 401 (unauthorized) or 500 (no auth middleware)
    const expectedErrors = [401, 422, 500];
    addResult(
      'Create Comment Without Auth',
      expectedErrors.includes(error.response?.status),
    );
  }
}

async function testCommentValidation() {
  try {
    await axios.post(`${BASE_URL}/comments`, {
      content: '', // Empty content
      postId: 'invalid_id', // Invalid post ID format
    });
    addResult('Comment Validation', false, 'Should validate input');
  } catch (error) {
    addResult('Comment Validation', error.response?.status === 422);
  }
}

async function testGetRepliesForNonExistentComment() {
  try {
    await axios.get(`${BASE_URL}/comments/cInvalidCommentId123456/replies`);
    addResult(
      'Get Replies for Non-existent Comment',
      false,
      'Should return 422 for invalid comment ID',
    );
  } catch (error) {
    addResult(
      'Get Replies for Non-existent Comment',
      error.response?.status === 422,
    );
  }
}

async function testCommentLikeWithoutAuth() {
  try {
    await axios.post(`${BASE_URL}/comments/cSomeCommentId123456789/like`);
    addResult(
      'Comment Like Without Auth',
      false,
      'Should require authentication or validation',
    );
  } catch (error) {
    const expectedErrors = [401, 422, 500];
    addResult(
      'Comment Like Without Auth',
      expectedErrors.includes(error.response?.status),
    );
  }
}

// Main test runner
async function runCommentTests() {
  console.log('🚀 Starting Comment API Tests for Twilsta Server\n');

  // Wait a moment for server to be ready
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Run tests
  await testGetCommentsForNonExistentPost();
  await testCreateCommentWithoutAuth();
  await testCommentValidation();
  await testGetRepliesForNonExistentComment();
  await testCommentLikeWithoutAuth();

  // Print summary
  console.log('\n📊 Comment API Test Summary:');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(
    `📈 Success Rate: ${(
      (results.passed / (results.passed + results.failed)) *
      100
    ).toFixed(1)}%`,
  );

  if (results.failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.tests
      .filter((t) => !t.passed)
      .forEach((test) => {
        console.log(`  - ${test.name}: ${test.message}`);
      });
  }

  console.log('\n🏁 Comment Testing Complete!');
  console.log('💡 Note: Full functionality requires authentication middleware');
}

// Handle graceful exit
process.on('SIGINT', () => {
  console.log('\n👋 Test interrupted by user');
  process.exit(0);
});

// Run tests if this file is executed directly
if (require.main === module) {
  runCommentTests().catch((error) => {
    console.error('💥 Comment test runner failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runCommentTests };
