import fs from 'fs';
import { PNG } from 'pngjs';

const removeWhiteBackground = (inputPath, outputPath) => {
  fs.createReadStream(inputPath)
    .pipe(new PNG({ filterType: 4 }))
    .on('parsed', function() {
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          let idx = (this.width * y + x) << 2;
          
          let r = this.data[idx];
          let g = this.data[idx+1];
          let b = this.data[idx+2];
          
          // Se il pixel è molto chiaro/bianco, rendilo trasparente
          if (r > 240 && g > 240 && b > 240) {
            this.data[idx+3] = 0; // Alpha channel
          }
        }
      }
      
      this.pack().pipe(fs.createWriteStream(outputPath));
      console.log(`Saved transparent image to ${outputPath}`);
    });
};

removeWhiteBackground('Onda - 1.PNG', 'w2b-hero/public/images/onda/onda-transparent.png');
