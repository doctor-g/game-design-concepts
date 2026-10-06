# Game Design Concepts / Accessible on the Web

This is a work-in-progress project to port the main content 
of [Ian Schreiber's Game Design Concepts](https://gamedesignconcepts.wordpress.com/)
to a site that meets [WCAG 2.1 AA guidelines](https://www.w3.org/TR/WCAG21/).
Schreiber's work is used under the terms of the
[Creative Commons Attribution 3.0 United States License](http://creativecommons.org/licenses/by/3.0/us/).

The site is published to [https://doctor-g.github.io/game-design-concepts]().


## Astro

This project uses [Astro](https://astro.build/) as a static site generator.
All Astro commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |