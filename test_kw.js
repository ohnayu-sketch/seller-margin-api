(async () => {
    const url = 'https://script.google.com/macros/s/AKfycbwgGV9JNm3ddLmB8G1U2MJVtSfpzuIYXe_j8J34Z_Ue0UFav_GX1vHL2g3hQnbNAyhfmg/exec';
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({ action: 'getTrendingKeywords', limit: 3 }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            redirect: 'follow'
        });
        const text = await response.text();
        console.log(text);
    } catch(e) { console.error(e); }
})();
