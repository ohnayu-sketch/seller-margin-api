(async () => {
    const url = 'https://script.google.com/macros/s/AKfycbwgGV9JNm3ddLmB8G1U2MJVtSfpzuIYXe_j8J34Z_Ue0UFav_GX1vHL2g3hQnbNAyhfmg/exec';
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({ action: 'sourcingAnalysis', keyword: '텀블러' }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            redirect: 'follow'
        });
        const text = await response.text();
        console.log("Status:", response.status);
        if (text.length > 500) {
            console.log("Response text (truncated):", text.substring(0, 500) + "...");
        } else {
            console.log("Response text:", text);
        }
    } catch(e) {
        console.error("Fetch error:", e);
    }
})();
