import UIKit

class MainViewController: UIViewController {
    
    private let loginButton: UIButton = {
        let button = UIButton(type: .system)
        button.setTitle("Login with Passkey", for: .normal)
        button.backgroundColor = .systemBlue
        button.setTitleColor(.white, for: .normal)
        button.layer.cornerRadius = 8
        button.titleLabel?.font = .systemFont(ofSize: 18, weight: .semibold)
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }()
    
    private let statusLabel: UILabel = {
        let label = UILabel()
        label.text = "Not authenticated"
        label.textAlignment = .center
        label.font = .systemFont(ofSize: 16)
        label.textColor = .darkGray
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private let tokenLabel: UILabel = {
        let label = UILabel()
        label.text = "Token: None"
        label.textAlignment = .left
        label.font = .systemFont(ofSize: 11)
        label.textColor = .darkGray
        label.numberOfLines = 0
        label.lineBreakMode = .byCharWrapping
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Explicitly set background color
        view.backgroundColor = .white
        
        // Ensure view is visible
        view.isHidden = false
        view.alpha = 1.0
        
        view.addSubview(loginButton)
        view.addSubview(statusLabel)
        view.addSubview(tokenLabel)
        
        NSLayoutConstraint.activate([
            loginButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            loginButton.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            loginButton.widthAnchor.constraint(equalToConstant: 200),
            loginButton.heightAnchor.constraint(equalToConstant: 50),
            
            statusLabel.topAnchor.constraint(equalTo: loginButton.bottomAnchor, constant: 30),
            statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            
            tokenLabel.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 20),
            tokenLabel.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 20),
            tokenLabel.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
            tokenLabel.bottomAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -20),
        ])
        
        // Force layout update
        view.setNeedsLayout()
        view.layoutIfNeeded()
        
        loginButton.addTarget(self, action: #selector(loginButtonTapped), for: .touchUpInside)
        
        checkAuthStatus()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        // Update auth status when view appears (e.g., after WebView dismisses)
        checkAuthStatus()
    }
    
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        
        // Force redraw
        view.setNeedsDisplay()
        view.setNeedsLayout()
        view.layoutIfNeeded()
        
        // Ensure UI elements are visible
        loginButton.isHidden = false
        loginButton.alpha = 1.0
        statusLabel.isHidden = false
        statusLabel.alpha = 1.0
        tokenLabel.isHidden = false
        tokenLabel.alpha = 1.0
    }
    
    private func checkAuthStatus() {
        if let token = KeychainHelper.get(key: "access_token") {
            print("[iOS] Token found in Keychain, length: \(token.count)")
            print("[iOS] Token preview: \(String(token.prefix(50)))...")
            
            statusLabel.text = "✅ Authenticated"
            statusLabel.textColor = .systemGreen
            statusLabel.font = .systemFont(ofSize: 16, weight: .semibold)
            
            // Show token with better formatting
            // Show full token, but limit display length for very long tokens
            let maxDisplayLength = 200
            let displayToken = token.count > maxDisplayLength ? String(token.prefix(maxDisplayLength)) + "\n...(truncated, total: \(token.count) chars)" : token
            
            let tokenText = "Token (\(token.count) chars):\n\(displayToken)"
            tokenLabel.text = tokenText
            tokenLabel.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
            tokenLabel.textColor = .black
            tokenLabel.textAlignment = .left
            tokenLabel.backgroundColor = .systemGray6
            tokenLabel.layer.cornerRadius = 8
            tokenLabel.layer.masksToBounds = true
            
            loginButton.setTitle("Logout", for: .normal)
            loginButton.backgroundColor = .systemRed
            
            // Force layout update
            view.setNeedsLayout()
            view.layoutIfNeeded()
        } else {
            print("[iOS] No token found in Keychain")
            statusLabel.text = "Not authenticated"
            statusLabel.textColor = .darkGray
            statusLabel.font = .systemFont(ofSize: 16)
            tokenLabel.text = "Token: None"
            tokenLabel.font = .systemFont(ofSize: 12)
            tokenLabel.textColor = .gray
            loginButton.setTitle("Login with Passkey", for: .normal)
            loginButton.backgroundColor = .systemBlue
        }
    }
    
    @objc private func loginButtonTapped() {
        if KeychainHelper.get(key: "access_token") != nil {
            logout()
            return
        }
        
        let authViewController = AuthWebViewController()
        authViewController.delegate = self
        let navController = UINavigationController(rootViewController: authViewController)
        
        // Full screen 모달로 표시
        navController.modalPresentationStyle = .fullScreen
        present(navController, animated: true)
    }
    
    private func logout() {
        KeychainHelper.delete(key: "access_token")
        checkAuthStatus()
    }
}

// MARK: - AuthWebViewDelegate
extension MainViewController: AuthWebViewDelegate {
    func authDidSucceed(token: String, user: [String: Any]) {
        print("[iOS] authDidSucceed called with token length: \(token.count)")
        print("[iOS] Token preview: \(String(token.prefix(50)))...")
        
        DispatchQueue.main.async { [weak self] in
            // Update UI with received token
            self?.checkAuthStatus()
            
            // Show success message with user info
            let userEmail = user["email"] as? String ?? "Unknown"
            let userName = user["name"] as? String
            let message = userName != nil ? "\(userName!)\n\(userEmail)" : userEmail
            
            let alert = UIAlertController(
                title: "✅ Login Successful",
                message: "Authenticated as:\n\(message)\n\nToken saved to Keychain",
                preferredStyle: .alert
            )
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
                // After alert is dismissed, refresh the token display
                self?.checkAuthStatus()
            })
            self?.present(alert, animated: true)
        }
    }
    
    func authDidCancel() {
        // User cancelled
    }
    
    func authDidFail(error: String) {
        DispatchQueue.main.async { [weak self] in
            let alert = UIAlertController(
                title: "Error",
                message: error,
                preferredStyle: .alert
            )
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            self?.present(alert, animated: true)
        }
    }
}

