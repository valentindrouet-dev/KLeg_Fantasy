import sharp from "sharp";

// Icônes de l'appli installée (iPad, écran d'accueil) : la pièce de la planche de stickers sur fond noir.
// Relancer : npx tsx scripts/make-app-icons.ts → public/apple-touch-icon.png, public/icon-192.png, public/icon-512.png

const COIN = { left: 124, top: 84, width: 208, height: 212 }; // pièce (sticker 1), data/icons/stickers-sheet.webp

async function icon(size: number, file: string): Promise<void> {
  const coin = await sharp("data/icons/stickers-sheet.webp")
    .extract(COIN)
    .resize({ width: Math.round(size * 0.72), height: Math.round(size * 0.72), fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "lanczos3" })
    .png()
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
    .composite([{ input: coin, gravity: "center" }])
    .flatten({ background: "#000000" })
    .png()
    .toFile(`public/${file}`);
}

await icon(180, "apple-touch-icon.png");
await icon(192, "icon-192.png");
await icon(512, "icon-512.png");
console.log("icônes écrites dans public/");
