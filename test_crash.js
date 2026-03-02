const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Navigate to local file
  const url = 'file://H:/내 드라이브/위탁판매/소싱프로그램/seller-dashboard-v3.html';

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('response', response => console.log('RESPONSE:', response.status(), response.url()));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.failure().errorText, request.url()));

  // Intercept and inject localStorage before load
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('auth-email', 'tester@gmail.com');
    localStorage.setItem('auth-name', '테스터');
  });

  try {
    console.log('Navigating to ' + url);
    await page.goto(url, { waitUntil: 'networkidle0' });

    // Check if the screen has an error or if login-screen is visible
    const isLoginVisible = await page.evaluate(() => {
      const el = document.getElementById('login-screen');
      return el ? !el.classList.contains('hidden') : false;
    });
    console.log('Is login screen visible:', isLoginVisible);
  } catch (err) {
    console.error('Test error:', err);
  }

  await browser.close();
})();
