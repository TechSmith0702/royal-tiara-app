/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package za.co.royaltiara.trade;

import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.util.Log;
import androidx.core.content.FileProvider;
import java.io.File;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;



public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    

    

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        allowChromeToReadSplash();
        super.onCreate(savedInstanceState);
        // Setting an orientation crashes the app due to the transparent background on Android 8.0
        // Oreo and below. We only set the orientation on Oreo and above. This only affects the
        // splash screen and Chrome will still respect the orientation.
        // See https://github.com/GoogleChromeLabs/bubblewrap/issues/496 for details.
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
    }

    /**
     * Royal Tiara: workaround for a Chrome 152+ bug. Chrome now refuses the
     * splash image unless this app itself holds read permission on it, which an
     * app cannot normally hold on its own file. Without the splash, Chrome shows
     * its address bar over a black screen while the app starts. Granting the
     * permission to ourselves (persistable, or Android skips it) fixes it. See
     * https://github.com/GoogleChrome/android-browser-helper/issues/623
     * NOTE: "bubblewrap update" regenerates this file - put this back after it.
     */
    private void allowChromeToReadSplash() {
        try {
            File splash = new File(new File(getFilesDir(), "twa_splash"), "splash_image.png");
            Uri uri = FileProvider.getUriForFile(this, getString(R.string.providerAuthority), splash);
            grantUriPermission(getPackageName(), uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        } catch (RuntimeException e) {
            Log.w("RoyalTiara", "Could not prepare the splash screen", e);
        }
    }

    @Override
    protected Uri getLaunchingUrl() {
        // Get the original launch Url.
        Uri uri = super.getLaunchingUrl();

        

        return uri;
    }
}
