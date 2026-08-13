const puppeteer = require('puppeteer');
const delay = ms => new Promise(res => setTimeout(res, ms));

(async () => {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none']
  });
  
  const page = await browser.newPage();
  // Standard desktop viewport
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  
  // Wait for the local dev server to be ready
  const serverUrl = 'http://localhost:5173';
  await page.goto(serverUrl, { waitUntil: 'networkidle0' });

  // 1. Landing Page state
  await delay(1000);
  
  // Navigate to Diwaan landing
  await page.click('#launch-diwaan-btn'); // "Generate a Dashboard Blueprint" button from SpecShield page
  await delay(2000); // Wait for the mock session to start (1000ms delay + buffer)
  
  // 2. Empty chat with first question
  await page.screenshot({ path: '01_Onboarding_FirstQuestion.png' });
  console.log('Saved 01_Onboarding_FirstQuestion.png');
  
  // 3. Click Continue
  await page.click('.mock-continue-btn');
  
  // Wait a bit to catch the "thinking" state
  await delay(500);
  await page.screenshot({ path: '02_Onboarding_ThinkingState.png' });
  console.log('Saved 02_Onboarding_ThinkingState.png');
  
  // Wait for mock response (1500ms delay + buffer)
  await delay(1500);
  
  // 4. Mid interview
  await page.click('.mock-continue-btn');
  await delay(2000);
  
  await page.screenshot({ path: '03_Onboarding_MidInterview.png' });
  console.log('Saved 03_Onboarding_MidInterview.png');
  
  // 5. Truncation Path / Final Dashboard reveal
  await page.click('.mock-continue-btn');
  await delay(2000);
  
  await page.click('.mock-continue-btn');
  
  // This triggers the ready_to_generate flow which takes 1500ms mock + 1500ms seal spin
  await delay(1000);
  await page.screenshot({ path: '04_Onboarding_GeneratingBlueprint.png' });
  console.log('Saved 04_Onboarding_GeneratingBlueprint.png');
  
  await delay(3000);
  
  // Final dashboard
  await page.screenshot({ path: '05_Onboarding_FinalDashboard.png' });
  console.log('Saved 05_Onboarding_FinalDashboard.png');
  
  await browser.close();
})();
