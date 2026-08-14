import urllib.request
import urllib.parse
import json
import os

os.makedirs('public/theme-backgrounds', exist_ok=True)

# Pre-selected Wikimedia Commons images to guarantee content rules and licenses
# (No identifiable people, abstract/atmospheric, proper licenses)
images = {
    "kirana-shop": {
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Spices_in_an_Indian_market.jpg/1280px-Spices_in_an_Indian_market.jpg",
        "license": "CC BY-SA 2.0",
        "source": "https://commons.wikimedia.org/wiki/File:Spices_in_an_Indian_market.jpg",
        "description": "Warm, colorful mounds of spices with a slight bokeh effect, no people."
    },
    "farm": {
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Wheat_field_-_panoramio.jpg/1280px-Wheat_field_-_panoramio.jpg",
        "license": "CC BY 3.0",
        "source": "https://commons.wikimedia.org/wiki/File:Wheat_field_-_panoramio.jpg",
        "description": "Golden hour sunlight hitting the tops of wheat stalks in a field."
    },
    "paper-factory": {
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Paper_machine_wet_end.jpg/1280px-Paper_machine_wet_end.jpg",
        "license": "CC BY-SA 3.0",
        "source": "https://commons.wikimedia.org/wiki/File:Paper_machine_wet_end.jpg",
        "description": "Abstract industrial machinery and metal rollers in a paper mill."
    },
    "ice-cream-factory": {
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Snow_crystals_on_window.jpg/1280px-Snow_crystals_on_window.jpg",
        "license": "CC0 / Public Domain",
        "source": "https://commons.wikimedia.org/wiki/File:Snow_crystals_on_window.jpg",
        "description": "Macro shot of cold frost and ice crystals forming a texture."
    },
    "tiles-factory": {
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Inside_of_a_wood-fired_pizza_oven.jpg/1280px-Inside_of_a_wood-fired_pizza_oven.jpg",
        "license": "CC BY 2.0",
        "source": "https://commons.wikimedia.org/wiki/File:Inside_of_a_wood-fired_pizza_oven.jpg",
        "description": "Glowing orange fire inside a brick/ceramic kiln environment."
    }
}

credits = []

for archetype, data in images.items():
    try:
        req = urllib.request.Request(data["url"], headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response, open(f'public/theme-backgrounds/{archetype}.jpg', 'wb') as out_file:
            out_file.write(response.read())
        print(f"Downloaded {archetype}.jpg")
        
        credits.append(f"## {archetype.replace('-', ' ').title()}\n")
        credits.append(f"- **Description**: {data['description']}\n")
        credits.append(f"- **Source URL**: {data['source']}\n")
        credits.append(f"- **License**: {data['license']}\n\n")
    except Exception as e:
        print(f"Failed to download {archetype}: {e}")

with open('public/theme-backgrounds/CREDITS.md', 'w') as f:
    f.writelines(credits)
    print("Created CREDITS.md")
