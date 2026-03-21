(async () => {
    const url = 'https://datalab.naver.com/shoppingInsight/getCategoryKeywordRank.naver';
    const params = new URLSearchParams({
        cid: '50000000',
        timeUnit: 'date',
        startDate: '2026-03-19',
        endDate: '2026-03-20',
        age: '', gender: '', device: '',
        page: 1, count: 100
    });
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: params.toString(),
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://datalab.naver.com/shoppingInsight/sCategory.naver',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const text = await response.text();
        console.log("Count 100 Response:", text.substring(0, 300));
    } catch(e) { console.error(e); }
})();
