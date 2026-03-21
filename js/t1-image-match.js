/**
 * T1 이미지 매칭 — Gemini Flash 멀티모달
 * 파일: js/t1-image-match.js
 * 의존성: fetch-gas.js
 *
 * 도매 상품과 시중 상품이 동일 제품인지 Gemini Flash에게 판단시킨다.
 * 무료 티어: 분당 15회 제한 → 배치 처리 시 딜레이 4초
 */

const ImageMatcher = {
    cache: {},          // 캐시: key = wholesaleImg + retailImg → result
    queue: [],          // 배치 큐
    processing: false,

    /**
     * 단건 매칭
     * @returns {Promise<{match:'high'|'medium'|'low', reason:string}>}
     */
    async matchSingle(wholesaleItem, retailItem) {
        const cacheKey = (wholesaleItem.image || '') + '|' + (retailItem.image || '');
        if (this.cache[cacheKey]) return this.cache[cacheKey];

        try {
            const result = await fetchGas('geminiImageMatch', {
                wholesaleImg: wholesaleItem.image || '',
                retailImg: retailItem.image || '',
                wholesaleName: wholesaleItem.name || '',
                retailName: retailItem.name || '',
                wholesalePrice: wholesaleItem.price || 0,
                retailPrice: retailItem.price || 0,
            });

            if (result?.match) {
                this.cache[cacheKey] = result;
                return result;
            }

            return { match: 'medium', reason: '판단 불가 — 추정값 사용' };
        } catch (e) {
            console.warn('[ImageMatcher] 매칭 실패:', e);
            return { match: 'medium', reason: '매칭 오류 — 추정값 사용' };
        }
    },

    /**
     * 배치 매칭 (피드 상품 배열 전체)
     * 분당 15회 제한 → 4초 간격
     * @param {Array} feedItems — 각 item에 wholesaleImg, retailImg 등 포함
     * @returns {Promise<Array>} — 각 item에 matchLevel 추가된 배열
     */
    async matchBatch(feedItems) {
        if (this.processing) return feedItems;
        this.processing = true;

        const DELAY = 4200; // 4.2초 (분당 14회로 안전마진)
        const results = [...feedItems];

        for (let i = 0; i < results.length; i++) {
            const item = results[i];

            // 이미지 없으면 스킵
            if (!item.image || !item.retailImage) {
                item.matchLevel = 'medium';
                continue;
            }

            // 캐시 확인
            const cacheKey = (item.image || '') + '|' + (item.retailImage || '');
            if (this.cache[cacheKey]) {
                item.matchLevel = this.cache[cacheKey].match;
                continue;
            }

            try {
                const result = await this.matchSingle(
                    { image: item.image, name: item.name, price: item.wholesalePrice },
                    { image: item.retailImage, name: item.retailName || item.name, price: item.retailPrice }
                );
                item.matchLevel = result.match;
            } catch (e) {
                item.matchLevel = 'medium';
            }

            // API 제한 딜레이 (마지막 아이템은 딜레이 불필요)
            if (i < results.length - 1) {
                await new Promise(r => setTimeout(r, DELAY));
            }
        }

        this.processing = false;
        return results;
    },

    /**
     * 비동기 매칭 (UI 블로킹 없이 백그라운드에서 실행)
     * 카드를 먼저 렌더링하고, 매칭 결과가 오면 카드 업데이트
     */
    async matchInBackground(feedItems, updateCallback) {
        if (this.processing) return;
        this.processing = true;

        const DELAY = 4200;

        for (let i = 0; i < feedItems.length; i++) {
            const item = feedItems[i];

            if (!item.image || !item.retailImage) {
                item.matchLevel = 'medium';
                if (updateCallback) updateCallback(i, item);
                continue;
            }

            const cacheKey = (item.image || '') + '|' + (item.retailImage || '');
            if (this.cache[cacheKey]) {
                item.matchLevel = this.cache[cacheKey].match;
                if (updateCallback) updateCallback(i, item);
                continue;
            }

            try {
                const result = await this.matchSingle(
                    { image: item.image, name: item.name, price: item.wholesalePrice },
                    { image: item.retailImage, name: item.retailName, price: item.retailPrice }
                );
                item.matchLevel = result.match;
            } catch (e) {
                item.matchLevel = 'medium';
            }

            if (updateCallback) updateCallback(i, item);

            if (i < feedItems.length - 1) {
                await new Promise(r => setTimeout(r, DELAY));
            }
        }

        this.processing = false;
    },

    clearCache() {
        this.cache = {};
    },
};

window.ImageMatcher = ImageMatcher;
