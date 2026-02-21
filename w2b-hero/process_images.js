import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const inputDir = '/Users/ivanpanto/Downloads/ezgif-362d57c3d60281a7-png-split';
const outputDir = path.join(process.cwd(), 'public', 'sequence', 'mobile');

async function processFrames() {
    console.log('Starting frame processing with tiny black rectangle over Veo...');

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const files = fs.readdirSync(inputDir)
        .filter(f => f.endsWith('.png'))
        .sort((a, b) => {
            const numA = parseInt(a.replace(/[^0-9]/g, ''));
            const numB = parseInt(b.replace(/[^0-9]/g, ''));
            return numA - numB;
        });

    console.log(`Found ${files.length} frames to process.`);

    // Precise coordinates for the Veo watermark only
    const wmLeft = 945;
    const wmTop = 1825;
    const wmWidth = 115;
    const wmHeight = 70;

    const blackBox = Buffer.from(
        `<svg width="${wmWidth}" height="${wmHeight}"><rect x="0" y="0" width="${wmWidth}" height="${wmHeight}" fill="black"/></svg>`
    );

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const inputPath = path.join(inputDir, file);
        const outputPath = path.join(outputDir, `frame_${i}.webp`);

        await sharp(inputPath)
            .composite([{ input: blackBox, top: wmTop, left: wmLeft }])
            .resize({ width: 1080 })
            .webp({ quality: 75 })
            .toFile(outputPath);

        if (i % 20 === 0) console.log(`Processed frame ${i}/${files.length - 1}`);
    }

    console.log('✅ All frames processed!');
}

processFrames().catch(console.error);
