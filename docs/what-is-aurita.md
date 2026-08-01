# What is Aurita?

Aurita is a frontend for [Jellyfin](https://jellyfin.org). It does not store or transcode anything itself. It is a web
app that talks to your existing Jellyfin server and puts a TV interface in front of it.

You keep running Jellyfin the way you always have. Aurita only replaces what you look at on the TV.

## Who it is for

People who already run Jellyfin, watch it in the living room and want an interface that was built for a remote control
instead of one that tolerates it.

If you mostly watch on a phone or a desktop browser, the official Jellyfin web client is probably the better fit.

## What it does

- **Home, libraries and detail pages** with continue watching, next up, a watchlist and suggestions based on what you
  finished
- **Search** with an on-screen keyboard, including people
- **Shorts**, a vertical feed of trailers from your libraries
- **Watch together**, which creates and joins Jellyfin SyncPlay groups directly from the TV
- **Multiple profiles per device**, each one optionally locked behind a PIN
- **Playback options** like autoplay of the next episode, auto-skip for intros and credits, subtitle size and default
  quality
- **A screensaver** that takes over when nothing is playing

The interface is translated and managed through Crowdin, so it is not English-only.

## What it does not do

- It does not replace Jellyfin. No server, no library scanning, no metadata.
- It has no user management of its own. Accounts, permissions and libraries stay in Jellyfin.
- It does not support password sign-in. Signing in goes through Quick Connect, which you have to enable on the server.
- It is not affiliated with Jellyfin.

## About the project

I wrote Aurita because I was not happy with the existing Jellyfin TV frontends and wanted SyncPlay, profile locks and a
UI I liked. AI was used during development, and I do not have a lot of time to maintain it. Issues and pull requests are
disabled on the repository. Forking it and making your own version out of it is very much allowed.

The name comes from *Aurelia aurita*, the moon jellyfish.

## Where to go next

Head to [Installation](/installation) to get it running, then to [Configuration](/configuration) if you want to pin it
to a specific server or host it behind a reverse proxy.
