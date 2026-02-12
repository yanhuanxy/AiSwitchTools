
const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const CACHE_DIR = path.join(process.cwd(), 'models');
const HF_MIRROR = process.env.HF_ENDPOINT || 'https://hf-mirror.com';

// Ensure cache directory exists
const modelDir = path.join(CACHE_DIR, MODEL_ID);
if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true });
}

// Files to download for a typical ONNX model (quantized)
const FILES = [
    'config.json',
    'tokenizer.json',
    'tokenizer_config.json',
    'special_tokens_map.json',
    'vocab.txt',
    'onnx/model_quantized.onnx',
    'onnx/model.onnx' // Optional: non-quantized
];

async function downloadFile(file) {
    const url = `${HF_MIRROR}/${MODEL_ID}/resolve/main/${file}`;
    const dest = path.join(modelDir, file);
    
    // Ensure subdirectories exist (e.g. onnx/)
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    if (fs.existsSync(dest)) {
        console.log(`Skipping existing file: ${file}`);
        return;
    }

    console.log(`Downloading ${file} from ${url}...`);

    return new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(dest);
        const request = https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                const redirectUrl = response.headers.location;
                console.log(`Redirecting to ${redirectUrl}...`);
                https.get(redirectUrl, (res) => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`Failed to download ${file}: Status ${res.statusCode}`));
                        return;
                    }
                    res.pipe(fileStream);
                    fileStream.on('finish', () => {
                        fileStream.close();
                        console.log(`Downloaded ${file}`);
                        resolve();
                    });
                }).on('error', (err) => {
                    fs.unlink(dest, () => {});
                    reject(err);
                });
                return;
            }

            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${file}: Status ${response.statusCode}`));
                return;
            }

            response.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                console.log(`Downloaded ${file}`);
                resolve();
            });
        });

        request.on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function main() {
    console.log(`Downloading model ${MODEL_ID} to ${modelDir} using mirror ${HF_MIRROR}`);
    
    for (const file of FILES) {
        try {
            await downloadFile(file);
        } catch (error) {
            console.error(`Error downloading ${file}:`, error.message);
            // Don't fail hard, some files might be optional or missing
        }
    }
    console.log('Download process completed.');
}

main();
