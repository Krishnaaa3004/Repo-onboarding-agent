# Demo video

The animated README demo, built with [Remotion](https://www.remotion.dev). It is a separate npm project and is
not part of the app's build or deploy.

- Colours and fonts are imported from the app itself (`frontend/src/styles/tokens.css` and the same Fontsource
  packages), so the video matches the live site.
- All content comes from real data: the saved pallets/flask plan the site ships
  (`frontend/src/examples/pallets__flask.json`), the tool trace from a live flask run, and the eval report.

```bash
cd demo-video
npm install
npx remotion studio src/index.ts                     # preview and scrub
npx remotion render src/index.ts Demo out/demo.mp4 --codec=h264 --crf=24
```

GIF (two-pass palette with Remotion's bundled ffmpeg; its build has no `fps` filter, so `-r` sets the rate):

```bash
npx remotion ffmpeg -i out/demo.mp4 -vf "scale=720:-1:flags=lanczos,palettegen=max_colors=128:stats_mode=diff" out/palette.png
npx remotion ffmpeg -i out/demo.mp4 -i out/palette.png -lavfi "[0:v]scale=720:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" -r 15 -loop 0 out/demo.gif
```
