import fs from 'fs';

const themes = ["kirana-shop", "farm", "paper-factory", "ice-cream-factory", "tiles-factory"];

async function download() {
    for (const name of themes) {
        console.log(`Downloading ${name}...`);
        const url = `https://picsum.photos/seed/${name}/1920/1080.webp`;
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`Failed ${name}: ${res.status}`);
            continue;
        }
        const buffer = await res.arrayBuffer();
        fs.writeFileSync(`public/theme-backgrounds/${name}.webp`, Buffer.from(buffer));
        console.log(`Saved ${name}.webp - size: ${buffer.byteLength}`);
    }
}
download();
