import UIKit
import WebKit

protocol AuthWebViewDelegate: AnyObject {
    func authDidSucceed(token: String, user: [String: Any])
    func authDidCancel()
    func authDidFail(error: String)
}

class AuthWebViewController: UIViewController {
    
    weak var delegate: AuthWebViewDelegate?
    private var webView: WKWebView!
    
    // API URL from Info.plist
    private var authURL: String {
        guard let apiUrl = Bundle.main.infoDictionary?["API_URL"] as? String else {
            fatalError("API_URL must be set in Info.plist")
        }
        return "\(apiUrl)/auth/mobile"
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupWebView()
        loadAuthPage()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        navigationController?.setNavigationBarHidden(true, animated: animated)
    }
    
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        navigationController?.setNavigationBarHidden(false, animated: animated)
    }
    
    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
    }
    
    
    private func setupWebView() {
        let config = WKWebViewConfiguration()
        
        // JS Bridge 설정
        let contentController = WKUserContentController()
        contentController.add(self, name: "nativeBridge")
        contentController.add(self, name: "consoleLog") // Console log handler
        config.userContentController = contentController
        
        // Inject console logger script before page loads
        let consoleLoggerScript = """
        (function() {
            const originalLog = console.log;
            const originalError = console.error;
            const originalWarn = console.warn;
            const originalInfo = console.info;
            const originalDebug = console.debug;
            
            function sendToNative(level, args) {
                try {
                    const message = Array.from(args).map(arg => {
                        if (typeof arg === 'object') {
                            try {
                                return JSON.stringify(arg);
                            } catch (e) {
                                return String(arg);
                            }
                        }
                        return String(arg);
                    }).join(' ');
                    
                    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.consoleLog) {
                        window.webkit.messageHandlers.consoleLog.postMessage({
                            level: level,
                            message: message,
                            timestamp: new Date().toISOString()
                        });
                    }
                } catch (e) {
                    // Fallback to original if bridge not available
                }
            }
            
            console.log = function(...args) {
                originalLog.apply(console, args);
                sendToNative('log', args);
            };
            
            console.error = function(...args) {
                originalError.apply(console, args);
                sendToNative('error', args);
            };
            
            console.warn = function(...args) {
                originalWarn.apply(console, args);
                sendToNative('warn', args);
            };
            
            console.info = function(...args) {
                originalInfo.apply(console, args);
                sendToNative('info', args);
            };
            
            console.debug = function(...args) {
                originalDebug.apply(console, args);
                sendToNative('debug', args);
            };
        })();
        """
        
        let userScript = WKUserScript(
            source: consoleLoggerScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        contentController.addUserScript(userScript)
        
        // WebAuthn 지원을 위한 설정
        config.preferences.javaScriptEnabled = true
        
        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        view.addSubview(webView)
        
        // WebView를 화면 전체에 꽉 차게 설정
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }
    
    private func loadAuthPage() {
        guard let url = URL(string: authURL) else {
            let errorMsg = "Invalid URL: \(authURL)"
            delegate?.authDidFail(error: errorMsg)
            return
        }
        
        let request = URLRequest(url: url)
        webView.load(request)
    }
}

// MARK: - WKScriptMessageHandler
extension AuthWebViewController: WKScriptMessageHandler {
    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        // Handle console log messages
        if message.name == "consoleLog" {
            if let logData = message.body as? [String: Any],
               let level = logData["level"] as? String,
               let logMessage = logData["message"] as? String {
                let prefix: String
                switch level {
                case "error":
                    prefix = "❌ [JS Console]"
                case "warn":
                    prefix = "⚠️ [JS Console]"
                case "info":
                    prefix = "ℹ️ [JS Console]"
                case "debug":
                    prefix = "🔍 [JS Console]"
                default:
                    prefix = "📝 [JS Console]"
                }
                print("\(prefix) \(logMessage)")
            }
            return
        }
        
        // Handle native bridge messages
        guard message.name == "nativeBridge",
              let body = message.body as? String,
              let data = body.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String,
              let payload = json["payload"] as? [String: Any]
        else {
            return
        }
        
        DispatchQueue.main.async { [weak self] in
            switch type {
            case "AUTH_SUCCESS":
                guard let token = payload["token"] as? String,
                      let user = payload["user"] as? [String: Any]
                else {
                    print("[iOS] ❌ Invalid response format - missing token or user")
                    self?.delegate?.authDidFail(error: "Invalid response format")
                    return
                }
                
                print("[iOS] ✅ Received AUTH_SUCCESS")
                print("[iOS] Token length: \(token.count)")
                print("[iOS] Token preview: \(String(token.prefix(50)))...")
                print("[iOS] User info: \(user)")
                
                // Save token to Keychain
                KeychainHelper.save(key: "access_token", value: token)
                print("[iOS] Token saved to Keychain")
                
                // Verify token was saved
                if let savedToken = KeychainHelper.get(key: "access_token") {
                    print("[iOS] ✅ Verified: Token retrieved from Keychain, length: \(savedToken.count)")
                } else {
                    print("[iOS] ❌ Warning: Token not found in Keychain after save")
                }
                
                self?.delegate?.authDidSucceed(token: token, user: user)
                self?.dismiss(animated: true)
                
            case "AUTH_CANCELLED":
                self?.delegate?.authDidCancel()
                self?.dismiss(animated: true)
                
            case "AUTH_ERROR":
                let errorMessage = payload["message"] as? String ?? "Unknown error"
                self?.delegate?.authDidFail(error: errorMessage)
                self?.dismiss(animated: true)
                
            case "AUTH_STARTED":
                // Just log, don't do anything
                break
                
            default:
                break
            }
        }
    }
}

// MARK: - WKNavigationDelegate
extension AuthWebViewController: WKNavigationDelegate {
    func webView(
        _ webView: WKWebView,
        didStartProvisionalNavigation navigation: WKNavigation!
    ) {
    }
    
    func webView(
        _ webView: WKWebView,
        didFinish navigation: WKNavigation!
    ) {
    }
    
    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        // Don't auto-dismiss on navigation error, let user see the error
        // delegate?.authDidFail(error: error.localizedDescription)
    }
    
    func webView(
        _ webView: WKWebView,
        didFail navigation: WKNavigation!,
        withError error: Error
    ) {
    }
    
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        decisionHandler(.allow)
    }
}

