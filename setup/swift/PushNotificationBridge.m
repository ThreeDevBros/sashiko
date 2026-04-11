// PushNotificationBridge.m
// Objective-C hook to call PushNotificationSetup.configure() automatically
// when the app launches, without modifying Capacitor's AppDelegate.

#import <UIKit/UIKit.h>

// Forward-declare the Swift setup class
@interface PushNotificationSetup : NSObject
+ (PushNotificationSetup * _Nonnull)shared;
- (void)configureWithApplication:(UIApplication * _Nonnull)application;
@end

// Use a category on UIApplication to hook into didFinishLaunching
@interface UIApplication (PushNotificationAutoSetup)
@end

@implementation UIApplication (PushNotificationAutoSetup)

+ (void)load {
    // Register for the didFinishLaunching notification
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
