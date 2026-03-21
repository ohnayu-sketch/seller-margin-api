const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    // Use the actual backend url via fetch since localStorage might not be set in this fresh page immediately
    await page.goto('http://localhost:5500/seller-dashboard-v6.html', { waitUntil: 'networkidle2' });
    
    // Evaluate to fetch from GAS
    const trends = await page.evaluate(async () => {
        try {
            return await window.fetchGas('getPredictiveTrends', {});
        } catch (e) {
            return { error: e.toString() };
        }
    });
    console.log(JSON.stringify(trends));
    await browser.close();
})();
