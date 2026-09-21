import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob  } from "astro/loaders";


const levels = defineCollection({
  loader: glob({base: "./src/levels", pattern: "**/*.md"}),
  schema: z.object({
    number: z.int(),
    name: z.string(),
  })
});

export const collections = { levels };