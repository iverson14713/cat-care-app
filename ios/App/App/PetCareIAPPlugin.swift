import Foundation
import Capacitor
import StoreKit

@objc(PetCareIAPPlugin)
public class PetCareIAPPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "PetCareIAPPlugin"
    public let jsName = "PetCareIAP"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getEntitlements", returnType: CAPPluginReturnPromise),
    ]

    private static let monthlyId = "com.wayne.petcare.pro.monthly"
    private static let yearlyId = "com.wayne.petcare.pro.yearly"
    private static let productIds: Set<String> = [monthlyId, yearlyId]

    private var cachedProducts: [String: Product] = [:]

    private func period(for productId: String) -> String {
        productId == Self.yearlyId ? "yearly" : "monthly"
    }

    private func subscriptionPeriodString(_ unit: Product.SubscriptionPeriod) -> String {
        switch unit.unit {
        case .day:
            return "P\(unit.value)D"
        case .week:
            return "P\(unit.value)W"
        case .month:
            return "P\(unit.value)M"
        case .year:
            return "P\(unit.value)Y"
        @unknown default:
            return "P\(unit.value)U"
        }
    }

    private func currencyCode(for product: Product) -> String {
        if #available(iOS 16.0, *) {
            return product.priceFormatStyle.currencyCode
        }
        // iOS 15: Locale.current.currency requires iOS 16+
        if let code = (Locale.current as NSLocale).currencyCode, !code.isEmpty {
            return code
        }
        return "unknown"
    }

    private func productDictionary(_ product: Product) -> [String: Any] {
        let priceNumber = NSDecimalNumber(decimal: product.price).doubleValue
        let currency = currencyCode(for: product)
        var dict: [String: Any] = [
            "productId": product.id,
            "displayName": product.displayName,
            "displayPrice": product.displayPrice,
            "price": priceNumber,
            "currencyCode": currency,
            "period": period(for: product.id),
            "storefrontLocale": Locale.current.identifier,
        ]
        if let sub = product.subscription {
            dict["subscriptionPeriod"] = subscriptionPeriodString(sub.subscriptionPeriod)
        }
        NSLog(
            "[PetCareIAP] product id=%@ name=%@ displayPrice=%@ price=%.4f currency=%@ period=%@ locale=%@",
            product.id,
            product.displayName,
            product.displayPrice,
            priceNumber,
            currency,
            period(for: product.id),
            Locale.current.identifier
        )
        return dict
    }

    private func entitlementPayload(from transaction: Transaction) -> [String: Any] {
        var payload: [String: Any] = [
            "productId": transaction.productID,
            "period": period(for: transaction.productID),
            "isActive": true,
            "originalTransactionId": String(transaction.originalID),
            "transactionId": String(transaction.id),
        ]
        if let expiration = transaction.expirationDate {
            payload["expiresAt"] = ISO8601DateFormatter().string(from: expiration)
        } else {
            payload["expiresAt"] = NSNull()
        }
        return payload
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified(_, let error):
            throw error
        case .verified(let safe):
            return safe
        }
    }

    private func loadProducts() async throws -> [Product] {
        let products = try await Product.products(for: Self.productIds)
        cachedProducts = Dictionary(uniqueKeysWithValues: products.map { ($0.id, $0) })
        return products
    }

    private func product(for productId: String) async throws -> Product {
        if let cached = cachedProducts[productId] {
            return cached
        }
        _ = try await loadProducts()
        guard let product = cachedProducts[productId] else {
            throw NSError(
                domain: "PetCareIAP",
                code: 404,
                userInfo: [NSLocalizedDescriptionKey: "Product not found: \(productId)"]
            )
        }
        return product
    }

    private func activeEntitlement() async -> [String: Any]? {
        var best: (Transaction, Date?)?
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result else { continue }
            guard Self.productIds.contains(transaction.productID) else { continue }
            if transaction.revocationDate != nil { continue }
            let exp = transaction.expirationDate
            if let exp = exp, exp < Date() { continue }
            if let current = best {
                let currentExp = current.1 ?? .distantFuture
                let newExp = exp ?? .distantFuture
                if newExp > currentExp {
                    best = (transaction, exp)
                }
            } else {
                best = (transaction, exp)
            }
        }
        guard let transaction = best?.0 else { return nil }
        return entitlementPayload(from: transaction)
    }

    @objc func getProducts(_ call: CAPPluginCall) {
        Task {
            do {
                let products = try await self.loadProducts()
                let foundIds = Set(products.map(\.id))
                if !foundIds.contains(Self.monthlyId) {
                    NSLog("[PetCareIAP] WARNING missing monthly product id=%@", Self.monthlyId)
                }
                if !foundIds.contains(Self.yearlyId) {
                    NSLog("[PetCareIAP] WARNING missing yearly product id=%@", Self.yearlyId)
                }
                let list: [[String: Any]] = products.map { self.productDictionary($0) }
                call.resolve(["products": list])
            } catch {
                call.reject(error.localizedDescription, "PRODUCTS_FAILED", error)
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("Missing productId", "INVALID_ARGS")
            return
        }
        call.keepAlive = true

        Task {
            defer { call.keepAlive = false }
            do {
                let product = try await self.product(for: productId)
                let purchaseResult = try await product.purchase()

                switch purchaseResult {
                case .success(let verification):
                    let transaction = try self.checkVerified(verification)
                    await transaction.finish()
                    if let entitlement = await self.activeEntitlement() {
                        call.resolve(entitlement)
                    } else {
                        call.resolve(self.entitlementPayload(from: transaction))
                    }
                case .userCancelled:
                    call.reject("User canceled", "CANCELED")
                case .pending:
                    call.reject("Purchase pending approval", "PENDING")
                @unknown default:
                    call.reject("Unknown purchase result", "UNKNOWN")
                }
            } catch {
                call.reject(error.localizedDescription, "PURCHASE_FAILED", error)
            }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        call.keepAlive = true
        Task {
            defer { call.keepAlive = false }
            do {
                try await AppStore.sync()
                if let entitlement = await self.activeEntitlement() {
                    call.resolve(entitlement)
                } else {
                    call.reject("No active subscription found", "NO_PURCHASES")
                }
            } catch {
                call.reject(error.localizedDescription, "RESTORE_FAILED", error)
            }
        }
    }

    @objc func getEntitlements(_ call: CAPPluginCall) {
        Task {
            if let entitlement = await self.activeEntitlement() {
                call.resolve(entitlement)
            } else {
                call.resolve(["isActive": false])
            }
        }
    }
}
