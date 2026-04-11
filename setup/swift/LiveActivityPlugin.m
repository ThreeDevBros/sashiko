#import <Capacitor/Capacitor.h>

CAP_PLUGIN(LiveActivityPlugin, "LiveActivity",
    CAP_PLUGIN_METHOD(isAvailable, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(startActivityWithPush, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(updateActivity, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(endActivity, CAPPluginReturnPromise);
)
