# Mobile Auth Test Project

Next.js + iOS 프로젝트로 모바일 앱에서 Transcodes WebAuthn/Passkey 인증을 테스트하는 프로젝트입니다.

## 프로젝트 구조

```
mobile-auth-test/
├── nextjs-app/          # Next.js 웹 앱 (WebView에서 로드)
│   ├── app/
│   │   └── auth/
│   │       └── mobile/  # 인증 페이지
│   └── package.json
│
└── ios-app/             # iOS 네이티브 앱
    └── MobileAuthTest/
        └── MobileAuthTest/
            ├── AuthWebViewController.swift
            ├── MainViewController.swift
            └── KeychainHelper.swift
```

## 아키텍처

```
┌─────────────────────────────────────────┐
│         iOS Native App                  │
│  ┌───────────────────────────────────┐  │
│  │  MainViewController               │  │
│  │  - Login Button                   │  │
│  │  - Status Display                 │  │
│  └──────────────┬────────────────────┘  │
│                 │                        │
│                 ▼                        │
│  ┌───────────────────────────────────┐  │
│  │  AuthWebViewController            │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  WKWebView                  │  │  │
│  │  │  ┌───────────────────────┐  │  │  │
│  │  │  │  Next.js Auth Page    │  │  │  │
│  │  │  │  (localhost:3001)     │  │  │  │
│  │  │  └───────────────────────┘  │  │  │
│  │  └─────────────────────────────┘  │  │
│  │  JS Bridge (WKScriptMessageHandler)│ │
│  └───────────────────────────────────┘  │
│                 │                        │
│                 ▼                        │
│  ┌───────────────────────────────────┐  │
│  │  KeychainHelper                   │  │
│  │  - Save Token                     │  │
│  │  - Get Token                       │  │
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
cp .env.local.example .env.local
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
2. WebView가 열리고 Next.js 인증 페이지 로드
3. Transcodes SDK가 자동으로 로그인 모달 표시
4. Passkey 인증 완료
5. 토큰이 Keychain에 저장되고 메인 화면으로 돌아감
6. 상태가 "Authenticated"로 변경됨

## JS Bridge 통신 프로토콜

### WebView → Native (iOS)

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
```

### Native → WebView (필요시)

현재는 단방향 통신만 구현되어 있습니다. 필요시 양방향 통신도 추가 가능합니다.

## 디버깅

### Next.js 콘솔

브라우저 개발자 도구에서 확인:
- SDK 로드 상태
- 인증 플로우
- 에러 메시지

### iOS 콘솔

Xcode 콘솔에서 확인:
- `[iOS]` 접두사가 붙은 로그
- `[Keychain]` 접두사가 붙은 로그
- WebView 네비게이션 에러

### WebView 디버깅

iOS 시뮬레이터에서:
1. Safari → Develop → Simulator → [Your App]
2. WebView 콘솔 확인 가능

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

## 다음 단계

1. **Silent Refresh 구현**: 토큰 갱신 페이지 (`/auth/refresh`) 활용
2. **에러 핸들링 강화**: 더 상세한 에러 메시지 및 재시도 로직
3. **Android 구현**: Android WebView 버전 추가
4. **토큰 검증**: 백엔드 API와 통합하여 토큰 검증

## 참고 자료

- [Transcodes Documentation](https://transcodes.dev/docs)
- [WKWebView Guide](https://developer.apple.com/documentation/webkit/wkwebview)
- [Keychain Services](https://developer.apple.com/documentation/security/keychain_services)

