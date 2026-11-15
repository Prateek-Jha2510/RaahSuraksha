# Raah Suraksha

We built Raah Suraksha around a question we can actually test on campus: if the walk back from the library takes four minutes longer, what do we know about those extra minutes? Our app lays two walks side by side and shows the mapped lighting, activity, opening hours and street feedback behind each route's score. When our data runs out, the coverage figure shows where our confidence runs out too.

## Run our build

On Windows, extract the ZIP and double-click **Start-Raah-Suraksha.cmd**. Keep the terminal open. The launcher installs the Node dependencies, compiles our C++ engine and opens the app. We use Node.js 22.12+ and a C++17 compiler. The launcher detects MSYS2 UCRT64 at `C:/msys64/ucrt64/bin/g++.exe`; otherwise put g++ on PATH or set CXX to its executable.

From a terminal in this folder:

```powershell
npm.cmd ci
npm.cmd run dev
```

For a production build, use `npm.cmd run build` and then `npm.cmd run preview`. Both dev and preview run our Node API. Serving only the dist folder omits routing, scoring and reviews.

## Our two-minute walkthrough

1. Open **Demo walks → Library walk**, choose **Alternate**, set the departure to **18:00 IST**, and leave the detour at 10 minutes. In a fresh build our scorer recommends the 12-minute library approach. The eight-minute side lane has a higher observed risk index. Tap either route to compare the evidence and read the comments for that stretch.
2. Change the limit to three minutes and run it again. The library approach drops out because it adds four minutes. Switch to **Market closing** and compare **18:00** with **23:00** to see what closing time does to the arcade's score.
3. Start a practice trip and tap **SOS**, then **Cancel SOS**. End the trip, choose a rating and leave a short street comment. Reopen the same walk and inspect the route you reviewed. Your note appears beside the index as a practice review.
4. The header has a light/dark switch and a Hindi toggle for key actions. The blue-black theme remembers the last choice on this device.

| Demo walk | What we designed it to show |
| --- | --- |
| Library walk | Whether a four-minute detour fits the walker's limit |
| Hostel return | A quiet shortcut versus a longer road past a canteen |
| Market closing | One route's activity changes after the arcade shuts |
| Sports ground exit | The quickest route can have no mapped evidence |

These are fictional demo walks with seeded observations and clearly labelled example comments. We keep practice reviews separate from live reviews. The examples work without API keys; demo routes appear over live street maps when available. Their geometry, labels and seeded observations are bundled locally for offline fallback. Live street detail uses OpenFreeMap vector maps and the MapLibre renderer, which require internet access. If the street layer is unavailable, we keep the route and endpoints visible.

## What goes into the score

Our C++ program samples each route in 40-metre stretches. It looks for lighting signals within 30 metres and activity or rating signals within 50 metres. Weights and night multipliers are in `scoring/weights.json`. We treat 20:00–05:59 IST as night. A missing lamp tag tells us nothing about whether the street is dark. We exclude unknown categories and show how much of the walk contributed to the index. The index runs from 0 to 100; it is an unvalidated prototype measure.

Alternate chooses the lowest known index inside the time limit. Ties favour the shorter walk. Faster minimises walking time. When every eligible score is unknown, we surface the fastest route and explain the lack of evidence. Our server can generate a short explanation with an optional OPENAI_API_KEY and RAAH_MODEL in .env. The C++ program owns the numbers; the app has a built-in explanation if the model is unavailable.

## Street reviews

After a live trip, we invite feedback only if a usable GPS fix passed near a flagged stretch. The demo simulates that passage. A walker can skip, rate, pick tags, or add up to 240 characters of plain text. We show up to five recent written reviews near a selected route, plus its labelled example in demo mode. Routes that share a street can share a review.

We store a rounded street location, time bucket, date, rating, tags, optional comment and a segment-specific device hash. We don't store a travelled GPS trace. Review text is visible to other people using this app instance. It never changes the score by itself. The structured rating signal requires agreement across at least three browser identities; older ratings lose weight with a 30-day half-life. Clearing cookies can bypass the daily browser limit. For this single-process prototype the store is .raah-data/ratings.json.

## Live maps and SOS

Both address fields show Indian address suggestions after three characters. Tap a match or use the arrow keys and Enter. We use Photon for suggestions (override with PHOTON_URL), Nominatim for explicit place search, OSRM's pedestrian profile for routing, and Overpass for mapped observations. Our server queues searches, caches successful area queries for 24 hours and marks missing evidence unknown. Endpoint overrides: NOMINATIM_URL, OSRM_FOOT_URL and OVERPASS_URL. [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/)

Open **Start trip → SOS settings** to see both contacts. The police field fills in automatically. On a live walk we use a recent GPS fix to find the closest station in our campus-area directory within 5 km. We currently list K.N. Katju Marg, Shahbad Dairy and Alipur. Without a nearby entry or a usable fix, the field shows **112**, India's emergency response number. The lookup runs on the device and also works offline. Practice walks use the demo start point. [Delhi Police station contacts](https://delhipolice.gov.in/RTImanualFiles/71346_Manual%201.pdf) · [K.N. Katju Marg directory entry](https://delhipolice.gov.in/images/manuals/manual1.pdf) · [Emergency Response Support System](https://www.mha.gov.in/emergency-response-support-system-erss)

The separate **Trusted contact number** is optional. Save a family member or friend's number once on this device, or clear the field and save to remove it. The SOS button and optional voice phrase start a cancellable five-second countdown. On a live trip, the app sounds an alarm when audio is available and opens an SMS draft for the trusted contact, including a recent location if available. You confirm sending in your messaging app. Police calls are a separate tap, and 112 stays available alongside any local station. Practice mode never starts calls or messages.

## What we still need to validate

We haven't measured agreement with real street conditions. Our next field test is to rate 15–20 stretches independently, record the time, and compare observations against both the index and its coverage. We also need a device check for voice and SMS on the phone used for the presentation.

