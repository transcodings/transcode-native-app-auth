# Mobile Auth Test Project

Next.js + iOS 프로젝트로 모바일 앱에서 Transcodes WebAuthn/Passkey 인증을 테스트하는 프로젝트입니다.

## 기술 스택

- **Next.js**: 15.3.4
- **React**: 19.1.0
- **TypeScript**: 5.8.3
- **iOS**: Swift (WKWebView)
- **인증**: Transcodes SDK

## 프로젝트 구조

```
transcode-native-app-auth/
├── nextjs-app/          # Next.js 웹 앱 (WebView에서 로드)
│   ├── app/
│   │   ├── auth/
│   │   │   ├── mobile/  # 인증 페이지
│   │   │   └── refresh/ # Silent Refresh 페이지
│   │   ├── layout.tsx   # SDK 스크립트 로드
│   │   └── page.tsx      # 홈 페이지
│   └── package.json
│
└── ios-app/             # iOS 네이티브 앱
    └── MobileAuthTest/
        └── MobileAuthTest/
            ├── AuthWebViewController.swift  # WebView 컨트롤러
            ├── MainViewController.swift     # 메인 화면
            ├── KeychainHelper.swift          # Keychain 관리
            ├── AppDelegate.swift
            ├── SceneDelegate.swift
            └── Info.plist                   # 네트워크 설정 포함
```

## 아키텍처

```
┌─────────────────────────────────────────┐
│         iOS Native App                  │
│  ┌───────────────────────────────────┐  │
│  │  MainViewController               │  │
│  │  - Login/Logout Button           │  │
│  │  - Status Display                 │  │
│  │  - Token Display                  │  │
│  └──────────────┬────────────────────┘  │
│                 │                        │
│                 ▼                        │
│  ┌───────────────────────────────────┐  │
│  │  AuthWebViewController            │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  WKWebView                  │  │  │
│  │  │  ┌───────────────────────┐  │  │  │
│  │  │  │  Next.js Auth Page    │  │  │  │
│  │  │  │  /auth/mobile         │  │  │  │
│  │  │  │  /auth/refresh        │  │  │  │
│  │  │  └───────────────────────┘  │  │  │
│  │  └─────────────────────────────┘  │  │
│  │  JS Bridge (WKScriptMessageHandler)│ │
│  │  Console Logger                    │  │
│  └───────────────────────────────────┘  │
│                 │                        │
│                 ▼                        │
│  ┌───────────────────────────────────┐  │
│  │  KeychainHelper                   │  │
│  │  - Save Token                     │  │
│  │  - Get Token                      │  │
│  │  - Delete Token                   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│      Next.js Server (localhost:3001)     │
│  ┌───────────────────────────────────┐  │
│  │  app/layout.tsx                   │  │
│  │  - SDK Script Injection           │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  app/auth/mobile/page.tsx        │  │
│  │  - Auth Flow                      │  │
│  │  - Token Retrieval                │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  app/auth/refresh/page.tsx       │  │
│  │  - Silent Token Refresh          │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## 설정 방법

### 1. Next.js 앱 설정

```bash
cd nextjs-app
npm install
```

`.env.local` 파일 생성:

```bash
touch .env.local
```

`.env.local` 파일을 열어서 Transcodes Project ID를 설정:

```env
NEXT_PUBLIC_TRANSCODES_PROJECT_ID=proj_your_project_id_here
```

개발 서버 실행:

```bash
npm run dev
```

서버가 `http://localhost:3001`에서 실행됩니다.

**참고**: SDK는 `app/layout.tsx`에서 자동으로 로드됩니다. Project ID가 설정되면 `https://d2xt92e3v27lcm.cloudfront.net/{projectId}/webworker.js` 스크립트가 페이지에 주입됩니다.

### 2. iOS 앱 설정

1. Xcode에서 `ios-app/MobileAuthTest.xcodeproj` 열기
2. **Signing & Capabilities** 탭에서:
   - Team 선택 (개인 개발자 계정 또는 팀)
   - Bundle Identifier 확인: `com.transcodes.mobileauthtest`
3. `AuthWebViewController.swift` 파일에서 `authURL` 확인:
   ```swift
   private let authURL = "http://localhost:3001/auth/mobile"
   ```
   - 로컬 테스트: `http://localhost:3001/auth/mobile`
   - 프로덕션: `https://your-domain.com/auth/mobile`

### 3. 네트워크 설정 (iOS)

iOS 시뮬레이터에서 localhost 접근을 위해:

1. **Info.plist**에 이미 `NSAppTransportSecurity` 설정이 포함되어 있습니다.
2. 실제 기기에서 테스트하는 경우:
   - Mac과 같은 네트워크에 연결
   - `localhost` 대신 Mac의 IP 주소 사용 (예: `http://192.168.1.100:3001/auth/mobile`)

## 주요 기능 상세

### 인증 플로우 (`/auth/mobile`)

1. SDK 자동 로드 및 초기화
2. `openAuthLoginModal()` 자동 호출
3. Passkey 인증 진행
4. 토큰 획득 (`getAccessToken()` API 사용)
5. Native 앱으로 토큰 전달
6. Keychain에 토큰 저장

### Silent Refresh (`/auth/refresh`)

토큰 갱신을 위한 숨겨진 페이지입니다. WebView에서 이 페이지를 로드하면:
1. SDK가 이미 로드되어 있는지 확인
2. Private key 존재 여부 확인
3. `getAccessToken()` API로 새 토큰 획득
4. Native 앱으로 새 토큰 전달

**사용 예시**:
```swift
// iOS에서 토큰 갱신
let refreshURL = "http://localhost:3001/auth/refresh"
webView.load(URLRequest(url: URL(string: refreshURL)!))
```

## 사용 방법

### 1. Next.js 서버 실행

```bash
cd nextjs-app
npm run dev
```

### 2. iOS 앱 실행

1. Xcode에서 프로젝트 열기
2. 시뮬레이터 또는 실제 기기 선택
3. Run 버튼 클릭 (⌘R)

### 3. 테스트 플로우

1. 앱 실행 후 "Login with Passkey" 버튼 클릭
2. WebView가 열리고 Next.js 인증 페이지 (`/auth/mobile`) 로드
3. SDK가 자동으로 초기화되고 로그인 모달 표시
4. Passkey 인증 완료
5. 토큰이 Keychain에 저장되고 메인 화면으로 돌아감
6. 상태가 "✅ Authenticated"로 변경되고 토큰이 표시됨
7. 로그아웃하려면 "Logout" 버튼 클릭 (토큰이 Keychain에서 삭제됨)

## JS Bridge 통신 프로토콜

### WebView → Native (iOS/Android)

```typescript
// 인증 시작
sendToNative('AUTH_STARTED', {});

// 인증 성공
sendToNative('AUTH_SUCCESS', {
  token: string,
  user: {
    id: string,
    email?: string,
    name?: string
  }
});

// 인증 취소
sendToNative('AUTH_CANCELLED', {
  error?: string
});

// 인증 실패
sendToNative('AUTH_ERROR', {
  message: string
});

// Silent Refresh 성공
sendToNative('REFRESH_SUCCESS', {
  token: string
});

// Silent Refresh 실패
sendToNative('REFRESH_FAILED', {
  reason: 'SDK_NOT_LOADED' | 'NO_PRIVATE_KEY' | 'TOKEN_GENERATION_FAILED' | 'ERROR',
  message?: string
});
```

### Bridge 구현

- **iOS**: `window.webkit.messageHandlers.nativeBridge.postMessage()`
- **Android**: `window.AndroidBridge.postMessage()` (준비됨, 미구현)

### Console Logging

iOS WebView에서 JavaScript 콘솔 로그를 자동으로 캡처하여 Xcode 콘솔에 출력합니다:
- `console.log` → `📝 [JS Console]`
- `console.error` → `❌ [JS Console]`
- `console.warn` → `⚠️ [JS Console]`
- `console.info` → `ℹ️ [JS Console]`
- `console.debug` → `🔍 [JS Console]`

## 디버깅

### Next.js 콘솔

브라우저 개발자 도구에서 확인:
- SDK 로드 상태 (`window.transcodes` 확인)
- 인증 플로우 (`[Page]` 접두사 로그)
- 에러 메시지

### iOS 콘솔

Xcode 콘솔에서 확인:
- `[iOS]` 접두사가 붙은 네이티브 로그
- `📝 [JS Console]` 접두사가 붙은 JavaScript 콘솔 로그
- 토큰 저장/조회 상태
- WebView 네비게이션 에러

### WebView 디버깅

iOS 시뮬레이터에서:
1. Safari → Develop → Simulator → [Your App]
2. WebView 콘솔 확인 가능
3. JavaScript 디버거 사용 가능

### SDK 초기화 확인

인증 페이지에서 SDK 초기화 상태를 실시간으로 확인할 수 있습니다:
- SDK 로드 상태
- Project ID 확인
- Script URL 확인

## 문제 해결

### 1. "Native bridge not found" 에러

- WebView가 제대로 로드되지 않았을 수 있습니다
- `AuthWebViewController.swift`의 `setupWebView()` 확인
- JS Bridge 이름이 `nativeBridge`인지 확인

### 2. localhost 접근 불가

- 실제 기기에서 테스트하는 경우 Mac의 IP 주소 사용
- `Info.plist`의 `NSAppTransportSecurity` 설정 확인

### 3. SDK 로드 실패

- `.env.local`의 Project ID 확인
- 네트워크 연결 확인
- Transcodes Dashboard에서 Project ID 확인

### 4. Keychain 저장 실패

- iOS 시뮬레이터 재시작
- Keychain 접근 권한 확인
- `KeychainHelper.swift`의 에러 로그 확인
- Xcode 콘솔에서 `[iOS] ✅ Verified: Token retrieved from Keychain` 메시지 확인

### 5. SDK 초기화 실패

- `.env.local`의 Project ID 확인
- 브라우저 콘솔에서 `window.transcodes` 객체 확인
- `layout.tsx`에서 스크립트 URL이 올바르게 생성되는지 확인
- 네트워크 연결 확인 (CloudFront CDN 접근 가능 여부)

### 6. 토큰이 비어있음

- 인증 성공 후 `getAccessToken()` API가 준비될 때까지 대기 (최대 5초)
- Private key가 준비되었는지 확인 (`hasPrivateKey()`)
- Xcode 콘솔에서 토큰 길이 확인

## 주요 기능

### ✅ 구현 완료

1. **인증 플로우**: Passkey 기반 인증 완전 구현
2. **토큰 관리**: Keychain을 통한 안전한 토큰 저장
3. **Silent Refresh**: `/auth/refresh` 페이지를 통한 토큰 갱신 지원
4. **Console Logging**: JavaScript 콘솔 로그를 iOS 콘솔로 전달
5. **Logout**: 토큰 삭제 및 인증 상태 초기화
6. **에러 핸들링**: 상세한 에러 메시지 및 상태 표시
7. **Android Bridge 준비**: Android WebView 지원을 위한 인터페이스 준비됨

### 🔄 다음 단계

1. **Android 구현**: Android WebView 버전 추가
2. **토큰 검증**: 백엔드 API와 통합하여 토큰 검증
3. **자동 토큰 갱신**: 토큰 만료 전 자동 갱신 로직
4. **에러 재시도**: 네트워크 에러 시 자동 재시도 로직

## 참고 자료

- [Transcodes Documentation](https://transcodes.dev/docs)
- [WKWebView Guide](https://developer.apple.com/documentation/webkit/wkwebview)
- [Keychain Services](https://developer.apple.com/documentation/security/keychain_services)

