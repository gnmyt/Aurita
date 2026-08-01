# Installation

There are two ways to run Aurita, and they are not exclusive. You can host it as a container and serve it to any device
with a browser, or you can install the Android TV app on the TV itself.

Before you start, make sure **Quick Connect is enabled** on your Jellyfin server. It is the only way to sign in.
You will find the setting under *Dashboard, General, Quick Connect* in Jellyfin.

## Docker Compose

The recommended way. Create a `docker-compose.yml`:

```yaml
services:
  aurita:
    image: ghcr.io/gnmyt/aurita:latest
    container_name: aurita
    restart: unless-stopped
    environment:
      JELLYFIN_SERVER: https://jellyfin.example.com
    ports:
      - "8080:80"
```

Then start it:

```bash
docker compose up -d
```

Aurita is now available at `http://localhost:8080`. The root path redirects to `/tv/`, which is where the app actually
lives.

`JELLYFIN_SERVER` is optional. If you set it, the app skips the server prompt and connects straight to that address. If
you leave it out, everyone who opens Aurita gets asked for a server address on first start. See
[Configuration](/configuration) for the details.

## Docker

The same thing without a compose file:

```bash
docker run -d \
  --name aurita \
  --restart unless-stopped \
  -p 8080:80 \
  -e JELLYFIN_SERVER=https://jellyfin.example.com \
  ghcr.io/gnmyt/aurita:latest
```

Images are published for `linux/amd64` and `linux/arm64`. Use the `latest` tag for releases, or `dev` if you want the
current state of the main branch.

## Android TV

Grab the `aurita-tv.apk` from the [latest release](https://github.com/gnmyt/Aurita/releases/latest) and sideload it onto
your TV. Most people do this with a sideloading app from the Play Store, or over ADB:

```bash
adb connect 192.168.1.50:5555
adb install aurita-tv.apk
```

The app needs Android 5.1 or newer and shows up in the Android TV launcher. It is a shell around the same web app, so
everything below about servers and sign-in applies here too.

If you want the app to point at a fixed server, you have to build it yourself. See
[Configuration](/configuration#pinning-a-server-in-the-android-app).

## From source

You need Node.js 22 or newer.

```bash
git clone https://github.com/gnmyt/Aurita.git
cd Aurita
npm install
npm run dev
```

The dev server runs on `http://localhost:5173`. Arrow keys work as a D-pad in the browser, so you can use it without a
TV attached.

For a production build:

```bash
npm run build
```

The output lands in `dist/` and is a set of static files. Serve them with any web server. Note that the build defaults
to the `/tv/` base path, which is what the container image uses. If you want to serve it from the root of a domain,
build with `VITE_BASE=/` instead.

To build the Android app yourself:

```bash
npm run android:apk
```

That produces `aurita-tv.apk` in the project root. It needs a JDK 17 and the Android SDK. There is also
`npm run android:aab` for a Play Store bundle, and `npm run dev:tv`, which boots an Android TV emulator and hot-reloads
into it.

## First start

1. Open Aurita on the TV.
2. If no server was pinned, enter the address of your Jellyfin server. For an installation in a subfolder, enter the
   full path, for example `jellyfin.example.com/jellyfin`.
3. A six character Quick Connect code appears. Open Jellyfin on your phone or computer, go to *User settings, Quick
   Connect*, and enter the code. There is a QR code on screen that takes you straight there.
4. Once the code is confirmed, you are signed in and the profile is stored on that device.

You can add more profiles later from the profile picker, and lock any of them with a PIN. The PIN is a sequence of four
directions on the D-pad rather than digits, because entering numbers with a remote is miserable.
