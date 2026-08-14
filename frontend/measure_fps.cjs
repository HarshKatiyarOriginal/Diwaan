const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Go to Dev Server
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  
  // Click "View Sample Dashboards"
  await page.click('.view-samples-btn');
  await new Promise(r => setTimeout(r, 1000));
  
  const themes = ['kirana-shop', 'farm', 'paper-factory', 'ice-cream-factory', 'tiles-factory'];
  
  for (const theme of themes) {
    // Click tab
    await page.evaluate((t) => {
        const tabs = document.querySelectorAll('.sample-tabs button');
        for (const tab of tabs) {
            if (tab.innerText.toLowerCase().replace(' ', '-') === t) {
                tab.click();
            }
        }
    }, theme);
    await new Promise(r => setTimeout(r, 1000));
    
    // Measure FPS
    await page.tracing.start({path: `trace-${theme}.json`, screenshots: false});
    
    // Simulate scroll
    await page.evaluate(() => {
        window.scrollBy(0, 500);
    });
    
    await new Promise(r => setTimeout(r, 1000)); // wait 1s while animating
    await page.tracing.stop();
    
    const traceData = require('fs').readFileSync(`trace-${theme}.json`, 'utf8');
    const trace = JSON.parse(traceData);
    const frames = trace.traceEvents.filter(x => x.name === 'DrawFrame' || x.name === 'CommitLoad');
    
    // Rough estimate: frames recorded over 1 second = FPS
    const fps = Math.min(60, frames.length);
    console.log(`${theme} FPS: ~${fps > 55 ? 60 : fps}`);
    require('fs').unlinkSync(`trace-${theme}.json`);
  }
  
  await browser.close();
})();
