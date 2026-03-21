/**
 * T3 이미지 자동 수집 + 수동 첨부
 * 파일: js/t5-image-auto.js
 * 의존성: fetch-gas.js, ui-helpers.js, t5-studio.js
 *
 * 기능:
 *  1. 도매처 상품 URL에서 이미지 자동 추출 (GAS 프록시)
 *  2. 실패 시 수동 파일 업로드 → 구글 드라이브 저장 → URL 반환
 *  3. T2에서 전달된 데이터로 자동 채움
 */

const T5ImageAuto = {
    fetching: false,
    uploadedUrls: [],
};

/**
 * 도매처 URL에서 이미지 자동 수집
 * @param {string} productUrl — 도매처 상품 페이지 URL
 * @param {string} siteId — 도매사이트 ID (domeggook, domemae 등)
 */
async function t5AutoFetchImages(productUrl, siteId) {
    if (!productUrl) {
        t5ShowImageFallback('도매처 URL이 없습니다. 이미지를 직접 첨부해주세요.');
        return;
    }

    T5ImageAuto.fetching = true;
    const statusEl = document.getElementById('t5-image-status');
    if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.innerHTML = '<span style="color:#f59e0b">이미지 자동 수집 중...</span>';
    }

    try {
        const result = await fetchGas('scrapeProductImages', {
            url: productUrl,
            siteId: siteId || '',
        });

        if (result?.success && result.images?.length) {
            // 이미지 URL을 textarea에 채움
            const imageInput = document.getElementById('t5-image-urls');
            if (imageInput) {
                imageInput.value = result.images.join('\n');
            }

            if (statusEl) {
                statusEl.innerHTML = `<span style="color:#10b981">${result.images.length}장 이미지 자동 수집 완료</span>`;
            }

            // 미리보기 갱신
            if (typeof t5UpdatePreview === 'function') t5UpdatePreview();

            showToast(`이미지 ${result.images.length}장 자동 수집 완료`);
        } else {
            t5ShowImageFallback(result?.error || '이미지를 가져오지 못했습니다.');
        }
    } catch (e) {
        console.error('[T5ImageAuto] 이미지 수집 오류:', e);
        t5ShowImageFallback('이미지 수집 중 오류 발생: ' + e.message);
    }

    T5ImageAuto.fetching = false;
}

/**
 * 자동 수집 실패 시 수동 첨부 UI 표시
 */
function t5ShowImageFallback(message) {
    const statusEl = document.getElementById('t5-image-status');
    if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.innerHTML = `
            <div style="padding:10px;border-radius:8px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);">
                <div style="font-size:11px;color:#fbbf24;margin-bottom:8px">${escapeHtml(message)}</div>
                <div style="font-size:10px;color:#94a3b8;margin-bottom:8px">이미지를 직접 첨부해주세요 (여러 장 가능)</div>
                <input type="file" id="t5-manual-image-upload" accept="image/*" multiple
                       onchange="t5HandleManualUpload(this.files)"
                       style="font-size:10px;color:#94a3b8;">
                <div id="t5-upload-progress" style="display:none;margin-top:6px;font-size:10px;color:#94a3b8"></div>
            </div>`;
    }
}

/**
 * 수동 이미지 업로드 처리
 * @param {FileList} files
 */
async function t5HandleManualUpload(files) {
    if (!files || !files.length) return;

    const progressEl = document.getElementById('t5-upload-progress');
    const imageInput = document.getElementById('t5-image-urls');
    const existingUrls = (imageInput?.value || '').split('\n').filter(u => u.trim());

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (progressEl) {
            progressEl.style.display = 'block';
            progressEl.textContent = `업로드 중... (${i + 1}/${files.length}) ${file.name}`;
        }

        try {
            // 파일 → base64
            const base64 = await fileToBase64(file);

            // GAS → 구글 드라이브 업로드
            const result = await fetchGas('uploadImageToDrive', {
                base64Data: base64,
                fileName: file.name,
                mimeType: file.type || 'image/jpeg',
            });

            if (result?.success && result.url) {
                existingUrls.push(result.url);
                T5ImageAuto.uploadedUrls.push(result.url);
            } else {
                showToast(`"${file.name}" 업로드 실패: ${result?.error || ''}`, false);
            }
        } catch (e) {
            showToast(`"${file.name}" 업로드 오류: ${e.message}`, false);
        }
    }

    // textarea 갱신
    if (imageInput) {
        imageInput.value = existingUrls.join('\n');
    }

    if (progressEl) {
        progressEl.textContent = `${files.length}장 업로드 완료`;
    }

    // 미리보기 갱신
    if (typeof t5UpdatePreview === 'function') t5UpdatePreview();
    showToast(`이미지 ${files.length}장 업로드 완료`);
}

/**
 * File → Base64 변환
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // data:image/jpeg;base64,... 에서 base64 부분만 추출
            const result = reader.result;
            const base64 = result.split(',')[1] || result;
            resolve(base64);
        };
        reader.onerror = () => reject(new Error('파일 읽기 실패'));
        reader.readAsDataURL(file);
    });
}

/**
 * T2에서 "상세페이지 만들기"로 전달받았을 때 자동 처리
 * 기존 t5ReceiveProduct를 확장
 */
function t5ReceiveFromT2(data) {
    // 기존 필드 채움
    const nameEl = document.getElementById('t5-product-name');
    const priceEl = document.getElementById('t5-price');
    const imageEl = document.getElementById('t5-image-urls');

    if (nameEl) nameEl.value = data.name || '';
    if (priceEl) priceEl.value = data.price || '';

    // 이미지: 이미 URL이 있으면 채우고, 도매처 URL이 있으면 자동 수집 시도
    if (data.image) {
        if (imageEl) imageEl.value = data.image;
    }

    if (data.wholesaleUrl) {
        // 도매처 URL에서 이미지 자동 수집
        t5AutoFetchImages(data.wholesaleUrl, data.wholesaleSiteId || '');
    } else if (!data.image) {
        // URL도 이미지도 없으면 수동 첨부 안내
        t5ShowImageFallback('도매처 URL과 이미지가 없습니다.');
    }

    // 마진 정보 표시
    if (data.wholesalePrice && data.price) {
        const margin = Math.round((1 - data.wholesalePrice / data.price) * 100);
        showToast(`도매가 ${fmt(data.wholesalePrice)}원 / 마진 ${margin}%`);
    }

    // 미리보기 갱신
    if (typeof t5UpdatePreview === 'function') t5UpdatePreview();

    // AI 카피 자동 트리거
    if (data.name && typeof t5GenerateAICopy === 'function') {
        setTimeout(() => t5GenerateAICopy(), 500);
    }
}

// T2 확정 상품 수신 이벤트 연결
if (typeof AppEventBus !== 'undefined') {
    AppEventBus.on('PRODUCT_TO_STUDIO', t5ReceiveFromT2);
}

// 전역 노출
window.T5ImageAuto = T5ImageAuto;
window.t5AutoFetchImages = t5AutoFetchImages;
window.t5HandleManualUpload = t5HandleManualUpload;
window.t5ShowImageFallback = t5ShowImageFallback;
window.t5ReceiveFromT2 = t5ReceiveFromT2;
