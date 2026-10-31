import Foundation
import React
import StoreKit
import UIKit

/// App Store 구독 결제 (StoreKit 2). 웹뷰 메시지(iapPurchase·iapRestore)를 App.tsx가 받아 여기로 넘긴다.
/// 거래는 서버(/api/iap/verify)가 App Store Server API로 다시 확인하므로, 여기서는 JWS만 돌려준다.
/// 자동 갱신·Ask to Buy 승인처럼 앱 밖에서 완료된 거래(Transaction.updates)는 finish한 뒤 이벤트로 JS(src/iap.ts)에 알린다.
@objc(MinicoveryIAP)
final class MinicoveryIAP: RCTEventEmitter {
  /// JS가 듣는 이벤트 이름 (src/iap.ts TRANSACTION_EVENT와 같아야 한다). body는 ["jws": String]
  static let transactionEvent = "minicoveryTransaction"

  // 리스너는 AppDelegate가 앱 시작 때 바로 켠다 (RN 모듈 인스턴스는 JS가 처음 쓸 때 늦게 만들어진다)
  private static var updates: Task<Void, Never>?
  private static weak var shared: MinicoveryIAP?
  // JS가 아직 듣지 않을 때 들어온 거래. 듣기 시작하면 바로 보낸다
  private static var pending: [String] = []
  private var hasListeners = false

  /// 앱 시작 때 한 번. 완료된 거래를 finish하고 JWS를 JS로 넘긴다
  static func startTransactionListener() {
    guard updates == nil else { return }
    updates = Task.detached {
      for await result in Transaction.updates {
        guard case .verified(let transaction) = result else { continue }
        await transaction.finish()
        let jws = result.jwsRepresentation
        await MainActor.run { MinicoveryIAP.deliver(jws) }
      }
    }
  }

  @MainActor private static func deliver(_ jws: String) {
    guard let shared, shared.hasListeners else {
      pending.append(jws)
      return
    }
    shared.sendEvent(withName: transactionEvent, body: ["jws": jws])
  }

  override init() {
    super.init()
    MinicoveryIAP.shared = self
  }

  @objc override static func requiresMainQueueSetup() -> Bool { false }

  override func supportedEvents() -> [String]! { [MinicoveryIAP.transactionEvent] }

  // JS가 첫 리스너를 달면 밀린 거래부터 보낸다
  override func startObserving() {
    DispatchQueue.main.async {
      self.hasListeners = true
      let queued = MinicoveryIAP.pending
      MinicoveryIAP.pending = []
      for jws in queued { self.sendEvent(withName: MinicoveryIAP.transactionEvent, body: ["jws": jws]) }
    }
  }

  override func stopObserving() {
    DispatchQueue.main.async { self.hasListeners = false }
  }

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

  /// 이 Apple 계정이 첫 구독 무료 체험(도입 혜택)을 받을 수 있는지. 혜택이 없거나 이미 구독해 봤으면 false.
  /// price는 표시용 현지 가격(예: ₩3,900)으로, 상품을 찾았으면 체험 여부와 무관하게 돌려준다
  @objc func trialEligible(
    _ productId: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task {
      guard let product = try? await Product.products(for: [productId]).first else {
        resolve(["eligible": false])
        return
      }
      let price = product.displayPrice
      guard
        let subscription = product.subscription,
        let offer = subscription.introductoryOffer,
        offer.paymentMode == .freeTrial
      else {
        resolve(["eligible": false, "price": price])
        return
      }
      let eligible = await subscription.isEligibleForIntroOffer
      resolve(["eligible": eligible, "days": offer.period.unit == .week ? offer.period.value * 7 : offer.period.value, "price": price])
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
