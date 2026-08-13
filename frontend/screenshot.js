import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import path from 'path';

const ARTIFACT_DIR = "C:\\Users\\Lenovo\\.gemini\\antigravity\\brain\\052b537e-fc06-4cb6-9207-d587af86ad7c\\.user_uploaded";

async function run() {
    console.log("Launching browser...");
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    try {
        console.log("Navigating to Spec Shield...");
        await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
        
        // 1. Spec Shield (Stamp mismatch)
        console.log("Capturing Spec Shield...");
        await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_SpecShield.png') });

        // 2. Click "Launch DIWAAN"
        console.log("Navigating to Diwaan...");
        await page.click('#launch-diwaan-btn');
        await new Promise(resolve => setTimeout(resolve, 1500)); // wait for transition
        
        console.log("Capturing Diwaan Landing...");
        await page.screenshot({ path: path.join(ARTIFACT_DIR, '02_DiwaanLanding.png') });

        // 3. Generating State (Seal)
        console.log("Triggering generation (Factory)...");
        await page.click('.chip'); // clicks first chip "Cycle factory, Kanpur"
        await page.click('#generate-btn');
        await new Promise(resolve => setTimeout(resolve, 200)); // wait for generating state to appear
        console.log("Capturing Generating state...");
        await page.screenshot({ path: path.join(ARTIFACT_DIR, '03_GeneratingState.png') });

        // 4. Factory Owner Dashboard
        await new Promise(resolve => setTimeout(resolve, 2000)); // wait for generation to finish
        console.log("Capturing Factory Dashboard...");
        await page.screenshot({ path: path.join(ARTIFACT_DIR, '04_FactoryDashboard.png') });

        // 5. Malformed Fallback
        console.log("Triggering generation (Malformed)...");
        await page.evaluate(() => {
            document.getElementById('business-prompt').value = "Malformed fallback test";
        });
        await page.type('#business-prompt', ' '); // trigger change event visually
        const chips = await page.$$('.chip');
        await chips[2].click(); // click the malformed chip
        await page.click('#generate-btn');
        await new Promise(resolve => setTimeout(resolve, 2500)); // wait for generation
        
        console.log("Capturing Malformed Dashboard...");
        await page.screenshot({ path: path.join(ARTIFACT_DIR, '05_MalformedFallback.png') });

    } catch (e) {
        console.error("Error during screenshot process:", e);
    } finally {
        console.log("Closing browser and server...");
        await browser.close();
        process.exit(0);
    }
}

run();
