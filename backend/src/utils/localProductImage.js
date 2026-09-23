import fs from 'fs';
import path from 'path';
import config from '../config/index.js';

let index = null;

export function invalidateLocalProductImageIndex() {
  index = null;
}

export function buildLocalProductImageIndex() {
  const map = new Map();
  const dir = config.paths?.images?.products;
  if (!dir || !fs.existsSync(dir)) return map;
  for (const file of fs.readdirSync(dir)) {
    const match = String(file).match(
      /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_/i
    );
    if (match && !map.has(match[1].toLowerCase())) {
      map.set(match[1].toLowerCase(), file);
    }
  }
  return map;
}

export function preferLocalProductImage(productId, imagePath) {
  if (!index) index = buildLocalProductImageIndex();
  const file = productId ? index.get(String(productId).toLowerCase()) : null;
  if (file) return `/storage/images/products/${file}`;
  if (imagePath && !/^https?:\/\//i.test(imagePath)) {
    const name = path.basename(imagePath);
    const abs = path.join(config.paths.images.products, name);
    if (fs.existsSync(abs)) return `/storage/images/products/${name}`;
  }
  return imagePath;
}
