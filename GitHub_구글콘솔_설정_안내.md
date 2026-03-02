# GitHub · 구글 콘솔 설정 안내

셀러 마진 계산기를 **GitHub Pages**로 열고 **구글 로그인**을 쓰려면 아래 두 가지를 설정하면 됩니다.

---

## 1. GitHub 설정

### 1-1. 저장소 준비

**저장소가 이미 있는 경우**
- 해당 저장소로 이동합니다.

**저장소가 없는 경우**
1. https://github.com 접속 후 로그인
2. 우상단 **+** → **New repository**
3. **Repository name**: 원하는 이름 (예: `seller-margin-api`)
4. **Public** 또는 **Private** 선택 후 **Create repository** 클릭

---

### 1-2. 필수 파일 올리기

**반드시 들어가야 할 파일**
- `seller-dashboard-v3.html` (메인 앱)

**올리는 방법 (웹에서)**
1. 저장소 페이지에서 **Add file** → **Upload files**
2. `seller-dashboard-v3.html` 파일을 끌어다 놓거나 **choose your files**로 선택
3. 아래쪽 **Commit changes** 클릭

**(선택)** 루트에서 바로 열고 싶다면 `index.html` 도 올립니다.  
- 내용: `<meta http-equiv="refresh" content="0;url=seller-dashboard-v3.html">` 만 넣은 한 줄 페이지  
- 그러면 `https://사용자명.github.io/저장소명/` 만 입력해도 앱으로 이동합니다.

---

### 1-3. GitHub Pages 켜기

1. 저장소 페이지에서 **Settings** 탭 클릭
2. 왼쪽 메뉴에서 **Pages** 클릭
3. **Build and deployment** 아래 **Source**를 **Deploy from a branch** 로 두기
4. **Branch**를 `main` (또는 사용 중인 기본 브랜치), **Folder**를 `/ (root)` 로 선택
5. **Save** 클릭

**확인**
- 몇 분 뒤 **Pages** 화면 상단에  
  `Your site is live at https://사용자명.github.io/저장소명/`  
  처럼 나오면 설정 완료입니다.
- 앱 주소 예: `https://사용자명.github.io/저장소명/seller-dashboard-v3.html`

---

## 2. Google Cloud Console 설정

구글 로그인을 쓰려면 **OAuth 클라이언트**에 앱 주소를 등록해야 합니다.

### 2-1. 접속 및 프로젝트

1. https://console.cloud.google.com 접속
2. 구글 계정으로 로그인
3. 상단 프로젝트 선택 → 사용할 프로젝트 선택 (없으면 **새 프로젝트** 생성)

---

### 2-2. OAuth 클라이언트로 이동

1. 왼쪽 메뉴 **☰** → **APIs & Services** → **Credentials**
2. **OAuth 2.0 Client IDs** 목록에서 사용할 클라이언트 클릭 (이름 예: 셀러 마진 계산기, 셀러마진 등)

**클라이언트가 하나도 없는 경우**
- **+ Create Credentials** → **OAuth client ID**
- **Application type**: **Web application**
- **Name**: `셀러 마진 계산기` (구분용)
- 아래 2-3, 2-4 항목 입력 후 **Create** → 생성된 **Client ID**를 `seller-dashboard-v3.html` 안의 `CLIENT_ID` 자리에 넣고 저장·재배포

---

### 2-3. 승인된 JavaScript 원본

편집 화면에서 **승인된 JavaScript 원본**에 **한 줄** 추가합니다.

- **규칙**: `https://도메인` 만 입력. **경로나 끝에 `/` 넣지 않습니다.**

**GitHub Pages 사용 시 예**
```
https://ohnayu-sketch.github.io
```
→ 본인 계정/저장소면 `https://본인깃허브아이디.github.io` 로 바꿉니다.

---

### 2-4. 승인된 리디렉션 URI

**승인된 리디렉션 URI**에 **앱이 실제로 열리는 전체 주소**를 **그대로** 한 줄 추가합니다.

**GitHub Pages 사용 시 예**
```
https://ohnayu-sketch.github.io/seller-margin-api/seller-dashboard-v3.html
```
→ 본인 주소에 맞게 `사용자명`, `저장소명`, `seller-dashboard-v3.html` 경로를 정확히 맞춥니다.

**주의**
- 끝에 **슬래시(`/`) 없음**
- **http / https** 구분 정확히
- 브라우저 주소창에 보이는 주소를 **복사해서 붙여넣기**하면 실수 없음

**디버그용 주소도 쓸 경우**  
`?oauth_debug=1` 붙인 주소로 로그인한다면, 아래도 **한 줄 더** 추가합니다.
```
https://본인도메인/경로/seller-dashboard-v3.html?oauth_debug=1
```

---

### 2-5. 저장 및 대기

1. **저장** 버튼 클릭
2. **5~10분** 정도 기다린 뒤 앱에서 구글 로그인 시도

> ⚠️ 콘솔에서 저장해도 **즉시 반영되지 않습니다.** 최대 10분까지 걸릴 수 있습니다.

---

### 2-6. OAuth 동의 화면 (처음 한 번)

**OAuth 클라이언트를 막 만든 경우** 또는 **테스트 사용자**가 필요할 때:

1. 왼쪽 **OAuth consent screen** 클릭
2. **User Type**: **External** → **Create**
3. **App name**: `셀러 마진 계산기`, **User support email**: 본인 이메일 입력 후 **Save and Continue**
4. **Scopes** → **Save and Continue**
5. **Test users**에서 로그인 허용할 구글 이메일 추가 (남편·아내 계정 등) → **Save and Continue**

---

## 3. 한 번에 정리

| 순서 | 할 일 |
|------|--------|
| 1 | GitHub에 `seller-dashboard-v3.html` 올리기 |
| 2 | 저장소 **Settings** → **Pages** → Source를 **main** 브랜치로 설정 후 저장 |
| 3 | Google Cloud Console **Credentials** → OAuth 클라이언트 선택 |
| 4 | **승인된 JavaScript 원본**에 `https://본인아이디.github.io` 추가 |
| 5 | **승인된 리디렉션 URI**에 `https://본인아이디.github.io/저장소명/seller-dashboard-v3.html` 추가 |
| 6 | **저장** 후 5~10분 대기 → 앱 주소로 접속해 구글 로그인 테스트 |

---

## 4. 참고 문서

- 자세한 설정·트러블슈팅: `서비스_설정_가이드.md`
- 실행·우회·앱에 안 들어갈 때: `실행_방법.md`
