const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        await page.goto('http://localhost:5500/seller-dashboard-v6.html', { waitUntil: 'networkidle2' });
        
        const apiUrl = await page.evaluate(() => localStorage.getItem('proxyApiUrl'));
        console.log("ACTUAL_API_URL=", apiUrl);
        
        await browser.close();
    } catch(e) {
        console.error(e);
    }
})();
