# Portfolio

A minimal single-page, non-scrolling 3D portfolio: a little red Mini Cooper road-trips down a winding dirt road through a river valley toward the mountains — forests, clouds, birds, and a day/night cycle that follows the visitor's local time (or a toggle). Built with [three.js](https://threejs.org) and [Vite](https://vite.dev).

```sh
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
npm run preview  # serve the build
```

Page views are tracked with [Vercel Web Analytics](https://vercel.com/docs/analytics) when deployed on Vercel (enable Analytics for the project in the Vercel dashboard).

- Name / role / links: `index.html`
- Colors (incl. night / dusk / day moods): `src/palette.js`
- Car model: `src/car.js`
- Road, river and hill shapes: `src/path.js`
- Terrain, dirt road, river, forest, lanterns: `src/terrain.js`
- Mountains, clouds, birds: `src/world.js`
- Boats on the river and cyclists on the road: `src/traffic.js`
- Monoplanes: `src/planes.js`
- Cartoon cursor: `src/cursor.js`
- Opening shot above the clouds that glides down to the road: `src/intro.js`
- Sky, sun/moon, stars and lighting: `src/sky.js`
- Sounds (engine, gravel, river, birds, crickets, planes, horn — synthesised, no files): `src/audio.js`. Click the car or press H to honk.
- Camera, day/night and sound toggles, loop: `src/main.js`
