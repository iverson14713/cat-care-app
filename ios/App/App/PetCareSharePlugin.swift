import Foundation
import Capacitor
import UIKit

@objc(PetCareSharePlugin)
public class PetCareSharePlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "PetCareSharePlugin"
    public let jsName = "PetCareShare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "shareFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shareText", returnType: CAPPluginReturnPromise),
    ]

    @objc func shareFile(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64Data"),
              let filename = call.getString("filename") else {
            call.reject("Missing base64Data or filename")
            return
        }

        guard let data = Data(base64Encoded: base64) else {
            call.reject("Invalid base64 data")
            return
        }

        let safeName = filename.replacingOccurrences(of: "/", with: "_")
        let fileURL = FileManager.default.temporaryDirectory.appendingPathComponent(safeName)

        do {
            try data.write(to: fileURL, options: .atomic)
            DispatchQueue.main.async {
                self.presentShare(items: [fileURL], call: call)
            }
        } catch {
            call.reject("Failed to write file", nil, error)
        }
    }

    @objc func shareText(_ call: CAPPluginCall) {
        guard let text = call.getString("text") else {
            call.reject("Missing text")
            return
        }
        let title = call.getString("title")
        var items: [Any] = [text]
        if let title = title, !title.isEmpty {
            items = [title, text]
        }
        DispatchQueue.main.async {
            self.presentShare(items: items, call: call)
        }
    }

    private func presentShare(items: [Any], call: CAPPluginCall) {
        guard let viewController = bridge?.viewController else {
            call.reject("No view controller")
            return
        }

        let activityVC = UIActivityViewController(activityItems: items, applicationActivities: nil)
        if let popover = activityVC.popoverPresentationController {
            popover.sourceView = viewController.view
            popover.sourceRect = CGRect(
                x: viewController.view.bounds.midX,
                y: viewController.view.bounds.midY,
                width: 0,
                height: 0
            )
            popover.permittedArrowDirections = []
        }

        activityVC.completionWithItemsHandler = { _, completed, _, error in
            if let error = error {
                call.reject("Share failed", nil, error)
                return
            }
            call.resolve([
                "shared": completed,
                "cancelled": !completed,
            ])
        }

        viewController.present(activityVC, animated: true)
    }
}
