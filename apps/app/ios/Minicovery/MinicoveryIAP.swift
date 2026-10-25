import Foundation
import React
import StoreKit
import UIKit

/// App Store 구독 결제 (StoreKit 2). 웹뷰 메시지(iapPurchase·iapRestore)를 App.tsx가 받아 여기로 넘긴다.
/// 거래는 서버(/api/iap/verify)가 App Store Server API로 다시 확인하므로, 여기서는 JWS만 돌려준다.
@objc(MinicoveryIAP)
final class MinicoveryIAP: NSObject {
  private var updates: Task<Void, Never>?

  @objc static func requiresMainQueueSetup() -> Bool { false }

  override init() {
    super.init()
    // 자동 갱신·승인 대기 후 완료된 거래는 여기로 온다. 서버는 App Store 알림과 앱 실행 시 동기화로 반영한다
    updates = Task.detached {
      for await result in Transaction.updates {
        if case .verified(let transaction) = result { await transaction.finish() }
      }
    }
  }

  deinit { updates?.cancel() }

  @objc func purchase(
    _ productId: String,
    accountToken: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task {
      do {
        guard let product = try await Product.products(for: [productId]).first else {
          resolve(["error": "not_found"])
          return
        }
        var options: Set<Product.PurchaseOption> = []
        if let uuid = UUID(uuidString: accountToken) { options.insert(.appAccountToken(uuid)) }
        switch try await product.purchase(options: options) {
        case .success(let result):
          guard case .verified(let transaction) = result else {
            resolve(["error": "failed"])
            return
          }
          await transaction.finish()
          resolve(["jws": result.jwsRepresentation])
        case .userCancelled:
          resolve(["error": "canceled"])
        case .pending:
          resolve(["error": "pending"])
        @unknown default:
          resolve(["error": "failed"])
        }
      } catch {
        resolve(["error": "failed"])
      }
    }
  }

  /// 지금 유효한 구독 거래들. sync=true면 App Store와 먼저 동기화한다 (구매 복원, Apple 로그인 창이 뜰 수 있음)
  @objc func currentEntitlements(
    _ sync: Bool,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task {
      if sync {
        do {
          try await AppStore.sync()
        } catch {
          resolve(["error": (error as? StoreKitError).map { if case .userCancelled = $0 { return "canceled" }; return "failed" } ?? "failed"])
          return
        }
      }
      var list: [String] = []
      for await result in Transaction.currentEntitlements {
        if case .verified = result { list.append(result.jwsRepresentation) }
      }
      resolve(["jws": list])
    }
  }

  /// App Store 리뷰 요청. 실제로 띄울지는 iOS가 정한다 (1년에 3번까지, TestFlight에서는 뜨지 않음)
  @objc func requestReview() {
    DispatchQueue.main.async {
      let scene = UIApplication.shared.connectedScenes.first { $0.activationState == .foregroundActive } as? UIWindowScene
      if let scene { SKStoreReviewController.requestReview(in: scene) }
    }
  }
}
