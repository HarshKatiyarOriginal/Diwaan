const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

// Simple delay function since page.waitForTimeout is deprecated
const delay = ms => new Promise(res => setTimeout(res, ms));

// Try to find Edge since it's commonly installed on Windows
const edgePaths = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];
const executablePath = edgePaths.find(p => fs.existsSync(p));

if (!executablePath) {
  console.error("Could not find Microsoft Edge executable. Please install Edge or Chrome.");
  process.exit(1);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath,
    headless: "new",
    defaultViewport: { width: 1280, height: 900 }
  });
  
  const page = await browser.newPage();
  
  console.log("Navigating to local Diwaan...");
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await delay(1000);
  
  // Navigate to Diwaan landing
  await page.click('#launch-diwaan-btn');
  await delay(2000);
  
  // Click View Sample Dashboards
  console.log("Entering Sample Mode...");
  await page.click('.view-samples-btn');
  await delay(1000); // Wait for render
  
  // 1. Screenshot Kirana Shop (default tab)
  await page.screenshot({ path: '01_Sample_KiranaShop.png' });
  console.log('Saved 01_Sample_KiranaShop.png');
  
  // 2. Switch to Farm
  const tabs = await page.$$('.sample-tabs button');
  await tabs[1].click(); // Second tab is 'Farm'
  await delay(1000); // Wait for transition
  await page.screenshot({ path: '02_Sample_Farm.png' });
  console.log('Saved 02_Sample_Farm.png');
  
  // 3. Switch to Paper Factory
  await tabs[2].click(); // Third tab is 'Paper Factory'
  await delay(1000);
  await page.screenshot({ path: '03_Sample_PaperFactory.png' });
  console.log('Saved 03_Sample_PaperFactory.png');

  await browser.close();
  console.log("Done.");
})();
