// PushNotificationBridge.m
// Objective-C hook to call PushNotificationSetup.configure() automatically
// when the app launches, without modifying Capacitor's AppDelegate.

#import <UIKit/UIKit.h>

// Forward-declare the Swift class (avoids importing App-Swift.h which
// causes a duplicate AppDelegate interface definition).
@interface PushNotificationSetup : NSObject
+ (PushNotificationSetup * _Nonnull)shared;
- (void)configureWithApplication:(UIApplication * _Nonnull)application;
@end

// Use a category on UIApplication to hook into didFinishLaunching
@interface UIApplication (PushNotificationAutoSetup)
@end

@implementation UIApplication (PushNotificationAutoSetup)

+ (void)load {
    [[NSNotificationCenter defaultCenter]
        addObserverForName:UIApplicationDidFinishLaunchingNotification
        object:nil
        queue:[NSOperationQueue mainQueue]
        usingBlock:^(NSNotification * _Nonnull note) {
            UIApplication *app = [UIApplication sharedApplication];
            [[PushNotificationSetup shared] configureWithApplication:app];
        }];
}

@end
