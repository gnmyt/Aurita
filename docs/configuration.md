# Configuration

Aurita has very little to configure. It is a static web app, and everything about your library lives in Jellyfin.

## Pinning a server

By default every device asks for a Jellyfin address on first start. If you only have one server, that is a pointless
step for your family to go through.

Set `JELLYFIN_SERVER` on the container and the prompt disappears:

```yaml
environment:
  JELLYFIN_SERVER: https://jellyfin.example.com
```

The entrypoint writes the address into the app before nginx starts, so it applies to everyone who opens that instance.
There is no way for users to override it from inside the app.

Leave the variable unset if you want people to enter their own address, for example if you share the instance with
friends who run their own servers.

## Pinning a server in the Android app

The app has no environment variables, so the address has to be baked in at build time:

```bash
JELLYFIN_SERVER=https://jellyfin.example.com npm run android:apk
```

The APK that comes out of the GitHub releases has no server pinned and will ask on first start.

## How Aurita reaches Jellyfin

The browser talks to Jellyfin directly. Aurita never proxies anything, so the address you enter has to be reachable
from the device you are watching on, not from the machine running the container.

Two things follow from that:

- If you serve Aurita over HTTPS, your Jellyfin server needs HTTPS as well. Browsers block plain HTTP requests coming
  from an HTTPS page.
- A Jellyfin instance that is only reachable inside your network stays that way. Putting Aurita on a public domain does
  not expose your server, and it also does not make it reachable from outside.

## Base path

The container serves the app under `/tv/` and redirects `/` to it. That works without any setup and you can ignore it.

If you build the image yourself and want a different path, pass the build argument:

```bash
docker build --build-arg VITE_BASE=/aurita/ -t aurita:local .
```

For a plain static build served from the root of a domain, use `VITE_BASE=/` and copy `dist/` wherever you want it. The
app is a single page application, so the web server has to fall back to `index.html` for unknown paths.

## Behind a reverse proxy

Nothing special is needed. Point the proxy at port 80 of the container and pass the request through. There are no
websockets and no long-lived connections between the browser and Aurita itself.

A minimal nginx block:

```nginx
location / {
    proxy_pass http://aurita:80;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Per-profile settings

The rest is in the app itself, under *Profile and settings*, and applies to the profile on that device only:

| Setting | What it does |
| --- | --- |
| Profile lock | Asks for a four direction PIN before the profile can be used |
| Autoplay next episode | Continues to the next episode when one ends |
| Auto-skip intro & credits | Skips sections your server has marked, without asking |
| Autoplay previews | Plays trailers in the background on the home screen |
| Default quality | The bitrate Aurita requests when it starts playback |
| Subtitle size and background | Subtitle appearance during playback |

None of this is synced back to Jellyfin. Set it up once per device.
