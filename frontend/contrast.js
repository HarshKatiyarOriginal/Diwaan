function luminance(r, g, b) {
    const a = [r, g, b].map(function (v) {
        v /= 255;
        return v <= 0.03928
            ? v / 12.92
            : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function contrast(rgb1, rgb2) {
    const lum1 = luminance(rgb1[0], rgb1[1], rgb1[2]);
    const lum2 = luminance(rgb2[0], rgb2[1], rgb2[2]);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
}

function mix(fg, bg, alpha) {
    return [
        Math.round(fg[0] * alpha + bg[0] * (1 - alpha)),
        Math.round(fg[1] * alpha + bg[1] * (1 - alpha)),
        Math.round(fg[2] * alpha + bg[2] * (1 - alpha))
    ];
}

// Worst case background image: Pure White (255, 255, 255)
const bgWhite = [255, 255, 255];
const scrimAlpha = 0.55; // Avg between 0.35 and 0.75
const bgWithScrim = mix([0, 0, 0], bgWhite, scrimAlpha);

const surfaceColor = [10, 22, 40]; // Default surface for Paper/Tiles
const glassAlpha = 0.55; // 55% surface color
const finalBg = mix(surfaceColor, bgWithScrim, glassAlpha);

const textPrimary = [241, 245, 249]; // #F1F5F9
const textMuted = [148, 163, 184];   // #94A3B8

console.log('Worst-case (Pure White background) Text Primary Contrast:', contrast(textPrimary, finalBg).toFixed(2));
console.log('Worst-case (Pure White background) Text Muted Contrast:', contrast(textMuted, finalBg).toFixed(2));
