# Gather

Gather opens on a list of viewings people can attend. Each listing shows a YouTube preview, the title, the duration, the Bible verses, and whether the booking is TBD, pending, or booked.

Sign in to take seats. A church that nobody has claimed can be claimed, and that account becomes the owner. Owners add viewings and set the venue on a map of nearby cinemas. A cinema already pending or booked in Gather for that date is marked unavailable. The host church still books the theatre with the cinema. Seat counts are who is coming. Invites are Gather links (`/e/…`), not cinema links. An open viewing is on the list. A private viewing is for the host church, and anyone with the link can still take seats.

## Run locally

```bash
cd /Users/joel/gather
npm install
cp .env.example .env.local
npm run dev
```

Open http://127.0.0.1:3857

Bible verses are read from the YouVersion Platform API. Put the app key from platform.youversion.com in `YVP_APP_KEY`. NIV, ESV, and the other translations show up after those licenses are accepted for that key. The wording on a listing is the text YouVersion returns, with that translation’s copyright.

Sign-in is Google, the same button Waymark uses. `GOOGLE_CLIENT_ID` is the web client. Its JavaScript origins must include `http://localhost:3857`, `http://127.0.0.1:3857`, and `https://macmini.tail70bcc0.ts.net:3857`. Creating a church makes that account the owner. Owners share a join code so people can associate with the church, and a separate owner invite so another Google account can own it too. `GATHER_DEV_AUTH=1` is only a local fallback when no Google client is set.

Without `FIRESTORE_EMULATOR_HOST`, data is stored in `~/.local/share/gather/store.json`. Gather will not open Firestore against a live Google Cloud project, and it refuses the Waymark project id.

The Firestore emulator needs a Java runtime:

```bash
firebase emulators:start --only firestore
```

Then set `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`.

## Maps and sign-in

Create these on Google Cloud project `project-60413c08-2fb7-476d-803` (the same billing project as Waymark, a separate key):

- A browser key with Maps JavaScript, Places API (New), and Routes. HTTP referrers: `http://localhost:3857/*` and `http://127.0.0.1:3857/*`. Put it in `.env.local` as `GOOGLE_MAPS_API_KEY`.
- An OAuth web client. JavaScript origin `http://localhost:3857`. Put the client id in `GOOGLE_CLIENT_ID`.

Do not reuse the Waymark key, and do not commit either value.

With a Maps key, church search and the venue map use Places. Drive times come from the Routes API. Convenience is the longest drive from the church pin and up to four catchment pins. A cinema already pending or booked in Gather for that date is marked unavailable.

## Checks

```bash
npm test
npm run typecheck
```
