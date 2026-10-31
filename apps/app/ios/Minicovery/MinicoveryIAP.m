#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// MinicoveryIAP.swift를 React Native에 노출한다. RCTEventEmitter라서 Transaction.updates 거래를 JS 이벤트로도 보낸다
@interface RCT_EXTERN_MODULE(MinicoveryIAP, RCTEventEmitter)

RCT_EXTERN_METHOD(purchase:(NSString *)productId
                  accountToken:(NSString *)accountToken
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(currentEntitlements:(BOOL)sync
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(trialEligible:(NSString *)productId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(requestReview)

@end
