import Foundation
import UIKit
import Capacitor
import AuthenticationServices

@objc(PetCareAppleSignInPlugin)
public class PetCareAppleSignInPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "PetCareAppleSignInPlugin"
    public let jsName = "PetCareAppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCall: CAPPluginCall?
    private var authController: ASAuthorizationController?

    private func runOnMain(_ work: @escaping () -> Void) {
        if Thread.isMainThread {
            work()
        } else {
            DispatchQueue.main.async(execute: work)
        }
    }

    private func finishPendingCall(_ call: CAPPluginCall) {
        call.keepAlive = false
        pendingCall = nil
        authController = nil
    }

    private func presentationWindow() -> ASPresentationAnchor {
        if let window = bridge?.viewController?.view.window {
            return window
        }
        if let window = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows })
            .first(where: { $0.isKeyWindow }) {
            return window
        }
        return UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows })
            .first ?? ASPresentationAnchor()
    }

    @objc func signIn(_ call: CAPPluginCall) {
        call.keepAlive = true
        pendingCall = call

        runOnMain { [weak self] in
            guard let self = self else {
                call.reject("Plugin unavailable", "PLUGIN_UNAVAILABLE")
                call.keepAlive = false
                return
            }

            let provider = ASAuthorizationAppleIDProvider()
            let request = provider.createRequest()
            request.requestedScopes = [.fullName, .email]

            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            self.authController = controller
            controller.performRequests()
        }
    }
}

extension PetCareAppleSignInPlugin: ASAuthorizationControllerDelegate {

    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard let call = pendingCall else { return }

        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            call.reject("Invalid Apple credential", "INVALID_CREDENTIAL")
            finishPendingCall(call)
            return
        }

        guard let tokenData = credential.identityToken,
              let identityToken = String(data: tokenData, encoding: .utf8) else {
            call.reject("Missing identity token", "NO_TOKEN")
            finishPendingCall(call)
            return
        }

        var payload: [String: Any] = ["identityToken": identityToken]
        payload["user"] = credential.user
        if let email = credential.email {
            payload["email"] = email
        }
        if let given = credential.fullName?.givenName {
            payload["givenName"] = given
        }
        if let family = credential.fullName?.familyName {
            payload["familyName"] = family
        }

        call.resolve(payload)
        finishPendingCall(call)
    }

    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        guard let call = pendingCall else { return }

        let ns = error as NSError
        if ns.domain == ASAuthorizationError.errorDomain,
           ns.code == ASAuthorizationError.canceled.rawValue {
            call.reject("User canceled", "CANCELED")
            finishPendingCall(call)
            return
        }

        call.reject(error.localizedDescription, "APPLE_SIGN_IN_ERROR", error)
        finishPendingCall(call)
    }
}

extension PetCareAppleSignInPlugin: ASAuthorizationControllerPresentationContextProviding {

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        presentationWindow()
    }
}
