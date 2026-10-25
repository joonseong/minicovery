#import <React/RCTBridgeModule.h>

// MinicoveryIAP.swift를 React Native에 노출한다
@interface RCT_EXTERN_MODULE(MinicoveryIAP, NSObject)

RCT_EXTERN_METHOD(purchase:(NSString *)productId
                  accountToken:(NSString *)accountToken
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(currentEntitlements:(BOOL)sync
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(requestReview)

@end
