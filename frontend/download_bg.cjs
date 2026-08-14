const https = require('https');
const fs = require('fs');

const images = {
    "kirana-shop": {
        id: "1596647000492-c4e976dbf145", // Spices
        desc: "Warm spices and powders in bowls"
    },
    "farm": {
        id: "1473215286461-91a5db701d0a", // Wheat field
        desc: "Golden hour sunlight over wheat field"
    },
    "paper-factory": {
        id: "1580982548858-a55d78a8731d", // Machinery/Paper
        desc: "Industrial manufacturing machinery"
    },
    "ice-cream-factory": {
        id: "1483321568285-b93080c35471", // Frost/Ice
        desc: "Cold frost and ice texture"
    },
    "tiles-factory": {
        id: "1507330777556-9a2cfb9409b6", // Fire/Ceramic
        desc: "Glowing fire texture"
    }
};

const credits = [];
fs.mkdirSync('public/theme-backgrounds', { recursive: true });

async function download() {
    for (const [archetype, data] of Object.entries(images)) {
        const url = `https://images.unsplash.com/photo-${data.id}?w=1920&q=75&fm=webp`;
        
        await new Promise((resolve, reject) => {
            https.get(url, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    https.get(res.headers.location, (redirectRes) => {
                        const file = fs.createWriteStream(`public/theme-backgrounds/${archetype}.webp`);
                        redirectRes.pipe(file);
                        file.on('finish', () => { file.close(); resolve(); });
                    });
                } else {
                    const file = fs.createWriteStream(`public/theme-backgrounds/${archetype}.webp`);
                    res.pipe(file);
                    file.on('finish', () => { file.close(); resolve(); });
                }
            }).on('error', reject);
        });
        
        console.log(`Downloaded ${archetype}.webp`);
        credits.push(`## ${archetype.replace('-', ' ').toUpperCase()}\n- **Description**: ${data.desc}\n- **Source URL**: https://unsplash.com/photos/${data.id}\n- **License**: Unsplash License (Free for commercial use)\n\n`);
    }
    
    fs.writeFileSync('public/theme-backgrounds/CREDITS.md', credits.join(''));
    console.log("Created CREDITS.md");
}

download().catch(console.error);
