package dev.gnm.aurita;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.res.AssetManager;
import android.net.Uri;
import android.os.Bundle;
import android.graphics.Color;
import android.view.KeyEvent;
import android.view.SurfaceView;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.ServiceWorkerClientCompat;
import androidx.webkit.ServiceWorkerControllerCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewAssetLoader.PathHandler;
import androidx.webkit.WebViewFeature;

import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.TimeUnit;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

public class MainActivity extends Activity {
    private static final String DOMAIN = "appassets.androidplatform.net";

    private WebView webView;
    private SurfaceView videoSurface;
    private NativeVideo nativeVideo;

    private String devServer;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        String dev = getString(R.string.dev_server_url).trim();
        devServer = dev.isEmpty() ? null : dev.replaceAll("/+$", "");

        getWindow().setFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .setDomain(DOMAIN)
                .addPathHandler("/", new WwwPathHandler(getAssets()))
                .build();

        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)) {
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(
                    new ServiceWorkerClientCompat() {
                        @Override
                        public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                            return assetLoader.shouldInterceptRequest(request.getUrl());
                        }
                    });
        }

        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);

        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new NativeBridge(), "AuritaNative");

        WebView.setWebContentsDebuggingEnabled(true);
        webView.setWebChromeClient(new android.webkit.WebChromeClient() {
            @Override
            public boolean onConsoleMessage(android.webkit.ConsoleMessage m) {
                android.util.Log.i("AuritaWeb", m.message() + " @" + m.sourceId() + ":" + m.lineNumber());
                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }
        });

        videoSurface = new SurfaceView(this);
        videoSurface.setVisibility(View.GONE);

        webView.setBackgroundColor(Color.TRANSPARENT);

        FrameLayout root = new FrameLayout(this);
        root.addView(videoSurface, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        nativeVideo = new NativeVideo(this, videoSurface, webView);

        hideSystemUi();

        webView.loadUrl(startUrlFor(getIntent()));

        scheduleTvSync();
    }

    private boolean enterPip() {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.O) return false;
        try {
            android.app.PictureInPictureParams.Builder b = new android.app.PictureInPictureParams.Builder();
            b.setAspectRatio(new android.util.Rational(16, 9));
            return enterPictureInPictureMode(b.build());
        } catch (Throwable t) {
            android.util.Log.w("Aurita", "PiP unavailable", t);
            return false;
        }
    }

    @Override
    public void onPictureInPictureModeChanged(boolean inPip, android.content.res.Configuration cfg) {
        super.onPictureInPictureModeChanged(inPip, cfg);
        if (webView == null) return;
        webView.evaluateJavascript(
                "window.__auritaPipChanged && window.__auritaPipChanged(" + inPip + ")", null);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView != null) {
            final String js =
                "(function(){"
              + "var t=document.activeElement||document.body;"
              + "var e=new KeyboardEvent('keydown',{key:'GoBack',keyCode:461,"
              + "bubbles:true,cancelable:true});"
              + "return !t.dispatchEvent(e);})()";
            webView.evaluateJavascript(js, consumed -> {
                if (webView == null) return;
                if (!"true".equals(consumed)) {
                    if (webView.canGoBack()) webView.goBack();
                    else finish();
                }
            });

            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    private String baseUrl() {
        return (devServer != null) ? devServer : "https://" + DOMAIN;
    }

    private String startUrlFor(Intent intent) {
        String route = routeFromIntent(intent);
        return baseUrl() + ((route != null) ? route : "/");
    }

    private String routeFromIntent(Intent intent) {
        if (intent == null) return null;
        Uri data = intent.getData();
        if (data != null && "aurita".equals(data.getScheme())) {
            String path = data.getPath();
            if (path != null && path.length() > 1) return path;
        }
        return null;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String route = routeFromIntent(intent);
        if (route != null && webView != null) webView.loadUrl(baseUrl() + route);
    }

    private void scheduleTvSync() {
        Constraints net = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED).build();
        PeriodicWorkRequest periodic = new PeriodicWorkRequest.Builder(
                SyncWorker.class, 6, TimeUnit.HOURS).setConstraints(net).build();
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                "jt-tv-sync", ExistingPeriodicWorkPolicy.KEEP, periodic);

        triggerTvSyncNow();
    }

    private void triggerTvSyncNow() {
        Constraints net = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED).build();
        WorkManager.getInstance(this).enqueue(
                new OneTimeWorkRequest.Builder(SyncWorker.class).setConstraints(net).build());
    }

    @Override
    protected void onStop() {
        super.onStop();

        triggerTvSyncNow();
    }

    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    protected void onDestroy() {
        if (nativeVideo != null) {
            nativeVideo.release();
            nativeVideo = null;
        }
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private final class NativeBridge {
        @JavascriptInterface
        public void setAuth(String server, String userId, String token) {
            JellyfinClient.INSTANCE.saveAuth(getApplicationContext(), server, userId, token);
            triggerTvSyncNow();
        }

        @JavascriptInterface
        public String getPlayerCapabilities() {
            try {
                return PlayerCapabilities.INSTANCE.toJson(MainActivity.this);
            } catch (Throwable t) {
                android.util.Log.w("Aurita", "capability probe failed", t);
                return null;
            }
        }

        @JavascriptInterface
        public void videoLoad(String url, double positionSeconds, boolean isHls, String token) {
            nativeVideo.load(url, positionSeconds, isHls, token);
        }

        @JavascriptInterface
        public void videoPlay() {
            nativeVideo.play();
        }

        @JavascriptInterface
        public void videoPause() {
            nativeVideo.pause();
        }

        @JavascriptInterface
        public void videoSeek(double seconds) {
            nativeVideo.seek(seconds);
        }

        @JavascriptInterface
        public void videoRate(double rate) {
            nativeVideo.setPlaybackRate((float) rate);
        }

        @JavascriptInterface
        public void videoVolume(double volume) {
            nativeVideo.setVolume((float) volume);
        }

        @JavascriptInterface
        public void videoRelease() {
            nativeVideo.release();
        }

        @JavascriptInterface
        public void videoAspectFill(boolean fill) {
            nativeVideo.setAspectFill(fill);
        }

        @JavascriptInterface
        public boolean enterPictureInPicture() {
            return MainActivity.this.enterPip();
        }
    }

    private static final class WwwPathHandler implements PathHandler {
        private final AssetManager assets;

        WwwPathHandler(AssetManager assets) {
            this.assets = assets;
        }

        @Override
        public WebResourceResponse handle(String path) {
            if (path.startsWith("/")) path = path.substring(1);
            if (path.isEmpty()) path = "index.html";
            try {
                InputStream in = assets.open("www/" + path);
                return new WebResourceResponse(mimeOf(path), null, in);
            } catch (IOException notAFile) {
                try {
                    InputStream in = assets.open("www/index.html");
                    return new WebResourceResponse("text/html", "utf-8", in);
                } catch (IOException e) {
                    return new WebResourceResponse("text/plain", "utf-8", null);
                }
            }
        }

        private static String mimeOf(String path) {
            if (path.endsWith(".html")) return "text/html";
            if (path.endsWith(".js") || path.endsWith(".mjs")) return "text/javascript";
            if (path.endsWith(".css")) return "text/css";
            if (path.endsWith(".json") || path.endsWith(".webmanifest")) return "application/json";
            if (path.endsWith(".svg")) return "image/svg+xml";
            if (path.endsWith(".png")) return "image/png";
            if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
            if (path.endsWith(".webp")) return "image/webp";
            if (path.endsWith(".ico")) return "image/x-icon";
            if (path.endsWith(".mp4")) return "video/mp4";
            if (path.endsWith(".woff2")) return "font/woff2";
            if (path.endsWith(".woff")) return "font/woff";
            if (path.endsWith(".wasm")) return "application/wasm";
            return "application/octet-stream";
        }
    }
}
