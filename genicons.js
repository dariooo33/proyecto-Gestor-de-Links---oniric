//este script genera los logos para PWA

const sharp = require('sharp');
const fs = require('fs');

if (!fs.existsSync('public/icons')) {
  fs.mkdirSync('public/icons', { recursive: true });
}

async function main() {
  await sharp('public/logo.png').resize(192).toFile('public/icons/icon-192x192.png');
  console.log('icon-192x192.png creado');
  await sharp('public/logo.png').resize(512).toFile('public/icons/icon-512x512.png');
  console.log('icon-512x512.png creado');
}

main().catch(console.error);