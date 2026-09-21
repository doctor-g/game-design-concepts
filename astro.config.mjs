// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from "@astrojs/markdown-remark";
import rehypeExternalLinks from 'rehype-external-links';

// https://astro.build/config
export default defineConfig({
  site: 'https://doctor-g.github.io',
  base: '/game-design-concepts',
  markdown: {
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
