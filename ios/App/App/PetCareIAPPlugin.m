#import <Capacitor/Capacitor.h>

CAP_PLUGIN(PetCareIAPPlugin, "PetCareIAP",
    CAP_PLUGIN_METHOD(getProducts, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(purchase, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(restorePurchases, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getEntitlements, CAPPluginReturnPromise);
)
