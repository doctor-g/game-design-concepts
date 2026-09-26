// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from "@astrojs/markdown-remark";
import rehypeExternalLinks from 'rehype-external-links';

// https://astro.build/config
export default defineConfig({
  site: 'https://doctor-g.github.io',
  base: '/game-design-concepts',
  markdown: {
    shikiConfig: {
      // This theme is used only for laying out data in a grid.
      // The actual theme contains underlines that violate the WCAG requirements
      // and so showing source code would require a hack in the main CSS file.
      theme: 'github-light-high-contrast',
    },
    processor: unified({
      rehypePlugins: [
        // For markdown links, make them safer.
        [
          rehypeExternalLinks,
          {
            target: "_blank",
            rel: ["noopener", "noreferrer"],
          },
        ],
      ],
    }),
  }
});
