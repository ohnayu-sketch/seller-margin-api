const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 900 });

        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('BROWSER ERROR:', msg.text());
            }
        });

        page.on('pageerror', err => {
            console.log('PAGE EXCEPTION:', err.toString());
        });

        console.log("Navigating to dashboard...");
        await page.goto('http://localhost:5500/seller-dashboard-v6.html', { waitUntil: 'networkidle2' });
        
        console.log("Waiting for data load...");
        await new Promise(r => setTimeout(r, 6000));
        
        const screenshotPath = 'C:\\Users\\ohnay\\.gemini\\antigravity\\brain\\2b667a90-9335-495a-ab0d-23ba82a6b7d1\\predictive_board_preview.webp';
        await page.screenshot({ path: screenshotPath, type: 'webp', fullPage: true });
        console.log("Screenshot saved at:", screenshotPath);
        
        await browser.close();
    } catch(e) {
        console.error("Puppeteer Script Error", e);
    }
})();
