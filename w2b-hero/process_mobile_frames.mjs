import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const inputDir = '/Users/ivanpanto/Downloads/W2B_Hero_FrameMobile';
const outputDir = path.join(process.cwd(), 'public', 'sequence', 'mobile');

async function processFrames() {
    console.log('Starting frame processing...');

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Read all png files
    const files = fs.readdirSync(inputDir)
        .filter(f => f.endsWith('.png'))
        // Sort specifically to handle the numbering correctly
        .sort((a, b) => {
            const numA = parseInt(a.replace(/[^0-9]/g, ''));
            const numB = parseInt(b.replace(/[^0-9]/g, ''));
            return numA - numB;
        });

    console.log(`Found ${files.length} frames to process.`);

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const inputPath = path.join(inputDir, file);
        // Rename exactly as expected by the React component logic: frame_0.webp, frame_1.webp...
        const outputPath = path.join(outputDir, `frame_${i}.webp`);

        await sharp(inputPath)
            .resize({ width: 1080 }) // Optimize width for mobile to save hundreds of MBs
            .webp({ quality: 75 })
            .toFile(outputPath);

        if (i % 20 === 0) console.log(`Processed frame ${i}/${files.length - 1}`);
    }

    console.log('✅ All frames processed successfully!');
}

processFrames().catch(console.error);
