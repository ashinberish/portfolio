# Portfolio

A minimal single-page, non-scrolling 3D portfolio: a toy SUV zig-zagging down an endless road toward the mountains, past a river, birds and clouds, with a day/night cycle that follows the visitor's local time (or a toggle). Built with [three.js](https://threejs.org) and [Vite](https://vite.dev).

```sh
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
npm run preview  # serve the build
```

- Name / role / links: `index.html`
- Colors (incl. night / dusk / day moods): `src/palette.js`
- Car model: `src/car.js`
- Road shape: `src/path.js`
- River, scenery, mountains, clouds, birds, lamps: `src/world.js`
- Sky, sun/moon, stars and lighting: `src/sky.js`
- Camera, day/night switch, loop: `src/main.js`
