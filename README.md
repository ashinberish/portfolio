# Portfolio

A minimal single-page, non-scrolling 3D portfolio: a little wood-panelled wagon with a canoe on the roof road-trips down a winding dirt road through a river valley toward the mountains — forests, clouds, birds, and a day/night cycle that follows the visitor's local time (or a toggle). Built with [three.js](https://threejs.org) and [Vite](https://vite.dev).

```sh
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
npm run preview  # serve the build
```

- Name / role / links: `index.html`
- Colors (incl. night / dusk / day moods): `src/palette.js`
- Car model: `src/car.js`
- Road, river and hill shapes: `src/path.js`
- Terrain, dirt road, river, forest, lanterns: `src/terrain.js`
- Mountains, clouds, birds: `src/world.js`
- Sky, sun/moon, stars and lighting: `src/sky.js`
- Camera, day/night switch, loop: `src/main.js`
