package in.raahsuraksha.walk;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.*;
import android.widget.TextView;
import android.widget.Toast;
import java.io.*;
import java.security.SecureRandom;
import java.util.UUID;

public class WalkActivity extends Activity {
    private static final String session = UUID.randomUUID().toString();
    private static boolean started;
    private static volatile String problem;
    private static native int runNode(String[] arguments);
    private final Handler ui = new Handler(Looper.getMainLooper());
    private WebView web;
    private String origin;
    private String locationOrigin;
    private GeolocationPermissions.Callback locationCallback;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        TextView status = new TextView(this);
        status.setGravity(android.view.Gravity.CENTER);
        status.setText("Opening Raah Suraksha…");
        setContentView(status);
        int port = getPreferences(MODE_PRIVATE).getInt("port", 0);
        if (port == 0) {
            port = 32000 + new SecureRandom().nextInt(20000);
            getPreferences(MODE_PRIVATE).edit().putInt("port", port).commit();
        }
        origin = "http://127.0.0.1:" + port;
        File ready = new File(getCacheDir(), "ready-" + session);
        final int serverPort = port;
        if (!started) {
            started = true;
            new Thread(() -> startBackend(serverPort, ready), "raah-backend").start();
        }
        waitUntilReady(ready, status, 0);
    }

    private void startBackend(int port, File ready) {
        try {
            System.loadLibrary("node");
            System.loadLibrary("raah");
            File bundle = new File(getFilesDir(), "app");
            copyAssets("app", bundle);
            File scorer = new File(getApplicationInfo().nativeLibraryDir, "libscorer.so");
            int code = runNode(new String[]{"node", new File(bundle, "server.cjs").getPath(),
                    getFilesDir().getPath(), scorer.getPath(), Integer.toString(port), session, ready.getPath()});
            problem = "The routing engine stopped (" + code + ").";
        } catch (IOException | LinkageError e) {
            problem = "The routing engine could not start.";
            android.util.Log.e("RaahSuraksha", problem, e);
        }
    }
    private void copyAssets(String asset, File destination) throws IOException {
        String[] entries = getAssets().list(asset);
        if (entries != null && entries.length > 0) {
            if (!destination.isDirectory() && !destination.mkdirs()) throw new IOException("Cannot create app directory");
            for (String name : entries) copyAssets(asset + "/" + name, new File(destination, name));
        } else {
            try (InputStream in = getAssets().open(asset); OutputStream out = new FileOutputStream(destination)) {
                byte[] block = new byte[16384];
                int n;
                while ((n = in.read(block)) != -1) out.write(block, 0, n);
            }
        }
    }
    private void waitUntilReady(File ready, TextView status, int attempt) {
        if (isFinishing() || isDestroyed()) return;
        if (problem != null || attempt >= 300) {
            status.setText((problem == null ? "The routing engine took too long to start." : problem) + " Close and reopen the app.");
        } else if (ready.exists()) {
            showPlanner();
        } else {
            ui.postDelayed(() -> waitUntilReady(ready, status, attempt + 1), 100);
        }
    }
    private void showPlanner() {
        web = new WebView(this);
        web.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        setContentView(web);
        web.requestApplyInsets();
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (origin.equals(uri.getScheme() + "://" + uri.getEncodedAuthority())) return false;
                if (!request.isForMainFrame()) return true;
                Intent intent;
                String scheme = uri.getScheme();
                if ("tel".equals(scheme)) intent = new Intent(Intent.ACTION_DIAL, uri);
                else if ("sms".equals(scheme)) {
                    String addr = uri.toString().substring(4).split("[?]", 2)[0];
                    if (!addr.matches("[+]?[0-9]{7,15}")) return true;
                    intent = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + addr));
                    // Android SMS URIs are opaque. Decode the query separately.
                    String body = Uri.parse("https://localhost/?" + (uri.toString().contains("?") ?
                            uri.toString().split("[?]", 2)[1] : "")).getQueryParameter("body");
                    intent.putExtra("sms_body", body);
                } else if ("https".equals(scheme) && request.hasGesture()) intent = new Intent(Intent.ACTION_VIEW, uri);
                else return true;
                try { startActivity(intent); } catch (ActivityNotFoundException ignored) {
                    Toast.makeText(WalkActivity.this, "No app can open this action on this device.", Toast.LENGTH_LONG).show();
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onGeolocationPermissionsShowPrompt(String source, GeolocationPermissions.Callback callback) {
                if (!origin.equals(source) && !(origin + "/").equals(source)) {
                    callback.invoke(source, false, false);
                } else if (hasLocation()) {
                    callback.invoke(source, true, false);
                } else {
                    locationOrigin = source;
                    locationCallback = callback;
                    requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, 7);
                }
            }
        });
        CookieManager.getInstance().setCookie(origin, "raah_session=" + session + "; Path=/; HttpOnly; SameSite=Strict",
            ok -> { if (Boolean.TRUE.equals(ok) && !isDestroyed()) web.loadUrl(origin + "/"); });
    }
    private boolean hasLocation() {
        return checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
               checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }
    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == 7 && locationCallback != null) {
            locationCallback.invoke(locationOrigin, hasLocation(), false);
            locationCallback = null;
        }
    }
    @Override protected void onDestroy() {
        ui.removeCallbacksAndMessages(null);
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
