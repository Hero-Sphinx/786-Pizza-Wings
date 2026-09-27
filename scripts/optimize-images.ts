// Converts the restaurant's original photos into compressed WebP files under public/images.
// Usage: npm run images:optimize -- <folder with the original images>
// Output is committed; originals are not (some are 5 MB posters).
import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

type Job = {
  from: string;
  to: string;
  width: number;
  /** Crop (in source pixels) before resizing, e.g. to drop text baked into a banner. */
  crop?: { left: number; top: number; width: number; height: number };
  /** Square/rect cover crop after resizing. */
  height?: number;
};

const card = (from: string, to: string): Job => ({ from, to, width: 640, height: 480 });

const jobs: Job[] = [
  // Pizzas
  card("pizza-1.jpg", "pizzas/create-your-own.webp"),
  card("deluxe-pizza-1.jpg", "pizzas/deluxe.webp"),
  card("Hawaiian-Pizza-1.jpg", "pizzas/hawaiian.webp"),
  card("Meat-lovers-pizza-1.jpg", "pizzas/meat-lover.webp"),
  card("Greek-Pizza-1.jpg", "pizzas/greek.webp"),
  card("BBQ-Chicken-Pizza-1.jpg", "pizzas/bbq-chicken.webp"),
  card("Medeterranean-Pizza-1.jpg", "pizzas/mediterranean.webp"),
  card("Mexican-Pizza-1.jpg", "pizzas/mexican.webp"),
  card("Classic-Pizza.jpg", "pizzas/classic-canadian.webp"),
  // Wings, burgers, sides
  card("wings.jpg", "wings.webp"),
  card("5.png", "burger.webp"),
  card("hotdog.jpg", "hot-dog.webp"),
  card("sides1.jpg", "sides/poutine.webp"),
  card("sides2.webp", "sides/canned-pop.webp"),
  card("sides3.webp", "sides/dipping-sauce.webp"),
  card("sides4.webp", "sides/onion-rings.webp"),
  card("sides5.webp", "sides/garlic-bread-cheese.webp"),
  card("sides6.webp", "sides/garlic-bread.webp"),
  card("sides7.webp", "sides/potato-wedges.webp"),
  card("sides8.webp", "sides/french-fries.webp"),
  card("coleslaw.webp", "sides/coleslaw.webp"),
  // Deals
  card("deals1.jpg", "deals/deal-01.webp"),
  card("deals12.webp", "deals/deal-02.webp"),
  card("deals8.jpg", "deals/deal-03.webp"),
  card("deals9.jpg", "deals/deal-05.webp"),
  card("deals10.webp", "deals/deal-06.webp"),
  card("deals14.webp", "deals/deal-07.webp"),
  card("deals4.webp", "deals/deal-08.webp"),
  card("deals15.jpg", "deals/deal-09.webp"),
  card("deals3.webp", "deals/deal-10.webp"),
  card("deals2.png", "deals/deal-11.webp"),
  {
    from: "786Sliders-07.jpg",
    to: "deals/weekday-special.webp",
    crop: { left: 1130, top: 170, width: 700, height: 700 },
    width: 640,
    height: 480,
  },
  // Home carousel: food only, the words are rendered as real text.
  { from: "786Sliders-07.jpg", to: "promos/weekday.webp", crop: { left: 1140, top: 150, width: 760, height: 750 }, width: 900 },
  { from: "deals-and-combos.jpg", to: "promos/pizzas.webp", width: 900 },
  { from: "786-04.jpg", to: "promos/mega.webp", crop: { left: 1080, top: 0, width: 900, height: 1000 }, width: 900 },
  { from: "786-05.jpg", to: "promos/deliver.webp", crop: { left: 1100, top: 0, width: 880, height: 1000 }, width: 900 },
  // Section banners
  { from: "pizza-big.jpg", to: "banners/pizza.webp", width: 1200 },
  { from: "wings-big.jpg", to: "banners/wings.webp", width: 1200 },
  { from: "sides-big.jpg", to: "banners/sides.webp", width: 1200 },
  // Brand
  { from: "logo400x500.png", to: "logo.webp", width: 400 },
];

async function main() {
  const src = process.argv[2];
  if (!src) throw new Error("Pass the folder that holds the original images.");
  const out = path.resolve(import.meta.dirname, "..", "public", "images");
  let total = 0;
  for (const job of jobs) {
    const dest = path.join(out, job.to);
    mkdirSync(path.dirname(dest), { recursive: true });
    let img = sharp(path.join(src, job.from)).rotate();
    if (job.crop) img = img.extract(job.crop);
    img = img.resize({ width: job.width, height: job.height, fit: "cover", withoutEnlargement: !job.height });
    const info = await img.webp({ quality: 74, effort: 5 }).toFile(dest);
    total += info.size;
    console.log(`${job.to.padEnd(34)} ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)} KB`);
  }
  // PNG logo too, for emails and social previews.
  await sharp(path.join(src, "logo400x500.png")).resize({ width: 400 }).png({ compressionLevel: 9 }).toFile(path.join(out, "logo.png"));
  console.log(`total ${(total / 1024).toFixed(0)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
