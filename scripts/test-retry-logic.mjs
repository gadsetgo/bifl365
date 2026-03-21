import axios from 'axios';

// We will recreate the retry logic from the main file for testing,
// but stub the axios post call to simulate 429 errors.

const delay = ms => new Promise(res => setTimeout(res, ms));

const RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000; // 2 seconds for faster testing

let mockApiFailuresRemaining = 2; // Simulate failing twice

async function callGemini(prompt, attempt = 1) {
  try {
    if (mockApiFailuresRemaining > 0) {
      mockApiFailuresRemaining--;
      const error = new Error('Request failed with status code 429');
      error.response = { status: 429, data: { error: { message: "Quota exceeded" } } };
      throw error;
    }

    // Success response
    return "Mock success content";

  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      if (status === 429 && attempt <= RETRIES) {
        const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[API Limits] ⏳ Gemini API Rate limited (429). Retrying attempt ${attempt}/${RETRIES} in ${delayMs / 1000}s...`);
        await delay(delayMs);
        return callGemini(prompt, attempt + 1);
      }
      throw new Error(`Gemini API Error: ${err.response.status}`);
    }
    throw err;
  }
}

async function runTest() {
  console.log("🚀 Testing Gemini API Retry Logic...");
  try {
    const result = await callGemini("Test prompt");
    console.log("✅ Final API result:", result);
    console.log("Test passed!");
  } catch (err) {
    console.error("❌ Test failed!");
    console.error(err);
    process.exit(1);
  }
}

runTest();
