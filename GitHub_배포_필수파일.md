# GitHub Pages 배포 — 필수 파일과 경로

웹이 메뉴 이동·계산이 안 되고 "연결 중..."에서 멈출 때, **아래 파일과 경로가 맞는지** 확인하세요.

---

## 1. 저장소에서 이렇게 있어야 함

GitHub Pages를 **브랜치 main, 폴더 / (root)** 로 켜 둔 경우:

| 올려야 할 파일 | 저장소에서의 경로 (프로젝트 루트 기준) |
|----------------|----------------------------------------|
| **seller-dashboard-v3.html** | `seller-dashboard-v3.html` (루트에 바로) |
| **index.html** | `index.html` (루트에 바로) |

즉, 저장소 **최상단**에 다음 두 파일이 나란히 있어야 합니다.

```
seller-margin-api/
├── index.html                  ← 필수 (리다이렉트용)
├── seller-dashboard-v3.html    ← 필수 (실제 앱, 반드시 최신본)
├── backend/
├── apps-script/
└── ...
```

- **index.html**: `seller-dashboard-v3.html`로 바로 넘겨 주는 용도. 없으면 루트 URL 접속 시 404가 날 수 있음.
- **seller-dashboard-v3.html**: 실제 셀러 마진 계산기 화면·기능 전부 들어 있는 **단일 HTML** 파일. 이 파일이 없거나 예전 버전이면 메뉴·계산이 동작하지 않습니다.

---

## 2. GitHub Pages 설정

1. GitHub 저장소 → **Settings** → **Pages**
2. **Source**: Deploy from a branch
3. **Branch**: `main` (또는 사용 중인 기본 브랜치) / **Folder**: `/ (root)` 선택 후 **Save**

---

## 3. 접속 주소

- 루트: `https://ohnayu-sketch.github.io/seller-margin-api/`  
  → index.html이 있어야 `seller-dashboard-v3.html`로 리다이렉트됨.
- **앱 직접 주소 (권장)**:  
  `https://ohnayu-sketch.github.io/seller-margin-api/seller-dashboard-v3.html`  
  → 이 주소로 들어가서 로그인·메뉴·계산이 되는지 확인하세요.

---

## 4. 그래도 "메뉴/계산이 안 된다"면

1. **최신 seller-dashboard-v3.html 올렸는지 확인**  
   - 로컬에서 수정한 **현재 버전**을 그대로 커밋 후 push했는지 확인.
2. **브라우저 캐시 제거**  
   - 같은 주소에서 **Ctrl+Shift+R** (Windows) 또는 **Cmd+Shift+R** (Mac)으로 강력 새로고침.  
   - 또는 시크릿/프라이빗 창에서 `https://ohnayu-sketch.github.io/seller-margin-api/seller-dashboard-v3.html` 열어서 테스트.
3. **콘솔 오류 확인**  
   - 브라우저에서 **F12** → **Console** 탭.  
   - 빨간색 오류가 있으면, 그 메시지를 확인한 뒤 수정해야 합니다.
4. **파일이 정말 루트에 있는지 확인**  
   - GitHub 저장소 페이지에서 **맨 위**에 `index.html`, `seller-dashboard-v3.html`가 보여야 합니다.  
   - `docs/seller-dashboard-v3.html`처럼 **안쪽 폴더**에만 있으면, Pages 설정을 "main / docs"로 바꾸거나, 두 파일을 루트로 옮겨야 합니다.

---

## 5. 요약

- **반드시 올릴 파일**: `index.html`, `seller-dashboard-v3.html`  
- **위치**: 저장소 **루트** (최상단)  
- **동작 확인**:  
  `https://ohnayu-sketch.github.io/seller-margin-api/seller-dashboard-v3.html` 로 접속 → 로그인 → 다른 메뉴·계산 동작 확인

이렇게 되어 있으면 웹이 정상적으로 동작하는 구조입니다.
