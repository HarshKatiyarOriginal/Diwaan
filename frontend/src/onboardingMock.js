import { FACTORY_OWNER_BLUEPRINT } from './fixtures';

const MOCK_QUESTIONS = [
  "Hello! What does your business do?",
  "A bicycle factory, excellent. How many employees do you have on the floor?",
  "Fifty employees. Do you operate out of a single facility, or multiple?",
  "Single facility in Kanpur. Finally, what's your primary manufacturing bottleneck?"
];

export async function mockStartSession() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        session_id: "mock-session-123",
        question: MOCK_QUESTIONS[0]
      });
    }, 1000);
  });
}

export async function mockRespond(sessionId, answer, currentTurnCount) {
  return new Promise((resolve) => {
    setTimeout(() => {
      // +1 because currentTurnCount includes the initial question
      if (currentTurnCount < MOCK_QUESTIONS.length) {
        resolve({
          session_id: sessionId,
          status: "in_progress",
          question: MOCK_QUESTIONS[currentTurnCount]
        });
      } else {
        // Ready to generate
        resolve({
          session_id: sessionId,
          status: "complete",
          blueprint: FACTORY_OWNER_BLUEPRINT
        });
      }
    }, 1500);
  });
}
