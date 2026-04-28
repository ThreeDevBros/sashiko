package com.sashiko.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth;
import com.getcapacitor.community.stripe.StripePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register native plugins BEFORE super.onCreate so the Capacitor bridge sees them
        registerPlugin(GoogleAuth.class);
        registerPlugin(StripePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
