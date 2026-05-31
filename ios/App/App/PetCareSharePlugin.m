#import <Capacitor/Capacitor.h>

CAP_PLUGIN(PetCareSharePlugin, "PetCareShare",
    CAP_PLUGIN_METHOD(shareFile, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(shareText, CAPPluginReturnPromise);
)
