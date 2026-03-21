const fs = require('fs');

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwgGV9JNm3ddLmB8G1U2MJVtSfpzuIYXe_j8J34Z_Ue0UFav_GX1vHL2g3hQnbNAyhfmg/exec';
const NAVER_URL = 'https://datalab.naver.com/shoppingInsight/getCategoryKeywordRank.naver';

const cats = [
  {id: '50000000', name: '패션의류'}, {id: '50000001', name: '패션잡화'},
  {id: '50000002', name: '화장품/미용'}, {id: '50000003', name: '디지털/가전'},
  {id: '50000004', name: '가구/인테리어'}, {id: '50000005', name: '출산/육아'},
  {id: '50000006', name: '식품'}, {id: '50000007', name: '스포츠/레저'},
  {id: '50000008', name: '생활/건강'}
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

function formatDate(date) {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    let year = d.getFullYear();
    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    return [year, month, day].join('-');
}

async function fetchNaverCategory(cid, startDate, endDate) {
    const params = new URLSearchParams({
        cid: cid,
        timeUnit: 'date',
        startDate: startDate,
        endDate: endDate,
        age: '', gender: '', device: '',
        page: 1, count: 100
    });
    
    for (let i=0; i<3; i++) {
        try {
            const res = await fetch(NAVER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': 'https://datalab.naver.com/shoppingInsight/sCategory.naver',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                body: params.toString()
            });
            if (res.ok) {
                const json = await res.json();
                return json.ranks || [];
            }
        } catch(e) {
            console.error(`[Retry ${i+1}] Naver API Error:`, e.toString());
        }
        await sleep(1000);
    }
    return [];
}

async function sendToGas(rows) {
    for(let i=0; i<3; i++) {
        try {
            const res = await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'appendLocalTrends', rows })
            });
            const text = await res.text();
            let json;
            try { json = JSON.parse(text); } catch(e){
                console.error("GAS Response parse failed:", text.substring(0, 100));
            }
            if (json && json.success) return true;
        } catch(e) {
             console.error(`[Retry ${i+1}] GAS Post Error:`, e.toString());
        }
        await sleep(2000);
    }
    return false;
}

(async () => {
    console.log("Local Trend Crawler Started (14 Days)....");
    
    // 14일부터 0일까지 (15번)
    // 0 is today.
    for (let offset = 14; offset >= 0; offset--) {
        const todayStr = formatDate(new Date(Date.now() - offset * 24 * 3600 * 1000));
        // Aggregate range: 3 days window (today - 3) to (today)
        const windowStartStr = formatDate(new Date(Date.now() - (offset + 3) * 24 * 3600 * 1000));
        
        console.log(`[Day ${14 - offset + 1}/15] Fetching Trends for ${todayStr} (Window: ${windowStartStr} ~ ${todayStr})`);
        
        let allRows = [];
        for (const cat of cats) {
            const ranks = await fetchNaverCategory(cat.id, windowStartStr, todayStr);
            if (ranks && ranks.length > 0) {
                for (let j = 0; j < ranks.length; j++) {
                    const kw = ranks[j].keyword || ranks[j].name || "";
                    if (kw) {
                        allRows.push([todayStr + 'T00:00:00', cat.name, cat.id, j + 1, kw]);
                    }
                }
            } else {
                console.log(`Warning: Cat ${cat.name} returned 0 results.`);
            }
            await sleep(800); // polite delay
        }
        
        if (allRows.length > 0) {
            console.log(`- Sending ${allRows.length} rows to GAS...`);
            const ok = await sendToGas(allRows);
            if(ok) console.log(`- Successfully pushed ${todayStr}!`);
            else console.log(`- Failed to push ${todayStr} after retries.`);
        } else {
            console.log(`- No rows gathered for ${todayStr}. Skipping GAS post.`);
        }
    }
    
    console.log("All 14 Days Backfill Completed! Predictive Board is now ready.");
})();
