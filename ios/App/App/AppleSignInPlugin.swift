import Foundation
import Capacitor
import AuthenticationServices

// Apple's App Review has flagged that "Sign in with Apple" fails when driven
// through the web OAuth redirect inside the app's embedded WKWebView (Apple's
// identity servers increasingly refuse to complete sign-in in an untrusted
// embedded browser context). This plugin does native Sign in with Apple
// instead - no webview, no redirect, no cookies - via Apple's own
// AuthenticationServices framework, exactly as Apple expects hybrid/native
// apps to do it. The resulting identityToken is verified server-side in
// lib/auth.ts's "apple-native" credentials provider.
@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding
{
    public let identifier = "AppleSignInPlugin"
    public let jsName = "AppleSignInNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCall: CAPPluginCall?

    @objc func signIn(_ call: CAPPluginCall) {
        pendingCall = call

        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.fullName, .email]

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return self.bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }

    public func authorizationController(
        controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard let call = pendingCall else { return }
        pendingCall = nil

        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
            let identityTokenData = credential.identityToken,
            let identityToken = String(data: identityTokenData, encoding: .utf8)
        else {
            call.reject("Failed to read Apple identity token")
            return
        }

        var result: [String: Any] = [
            "identityToken": identityToken,
            "user": credential.user,
        ]
        if let codeData = credential.authorizationCode,
            let authorizationCode = String(data: codeData, encoding: .utf8)
        {
            result["authorizationCode"] = authorizationCode
        }
        // Apple only includes email/name on the FIRST authorization for a given
        // app - later sign-ins omit them, which is fine since the server looks
        // the user up by the email claim already inside the identityToken.
        if let email = credential.email {
            result["email"] = email
        }
        if let givenName = credential.fullName?.givenName {
            result["givenName"] = givenName
        }
        if let familyName = credential.fullName?.familyName {
            result["familyName"] = familyName
        }

        call.resolve(result)
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let call = pendingCall else { return }
        pendingCall = nil

        let nsError = error as NSError
        if nsError.code == ASAuthorizationError.canceled.rawValue {
            call.reject("cancelled")
        } else {
            call.reject("Apple sign-in failed", nil, error)
        }
    }
}
