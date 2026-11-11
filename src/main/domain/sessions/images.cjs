const IMAGE_PATTERN = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGES = 4,
  MAX_IMAGE_BYTES = 8_000_000,
  MAX_TOTAL_BYTES = 24_000_000;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
// JPEG start-of-frame markers that carry the image size (every SOFn except DHT, JPG and DAC).
const JPEG_FRAMES = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function pngSize(bytes) {
  if (
    bytes.length < 45 ||
    !bytes.subarray(0, 8).equals(PNG_SIGNATURE) ||
    bytes.toString('ascii', 12, 16) !== 'IHDR' ||
    bytes.toString('ascii', bytes.length - 8, bytes.length - 4) !== 'IEND'
  )
    throw new Error('Invalid PNG screenshot.');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

// Walks the JPEG marker segments up to the first frame header, which holds the height and width.
function jpegSize(bytes) {
  const invalid = () => new Error('Invalid JPEG screenshot.');
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9)
    throw invalid();
  for (let offset = 2; offset + 9 < bytes.length;) {
    if (bytes[offset] !== 0xff) throw invalid();
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      offset++;
      continue;
    }
    if (JPEG_FRAMES.has(marker))
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    if (marker === 0xd9 || marker === 0xda) break;
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  throw invalid();
}

function requestImages(input) {
  if (input.images !== undefined && input.image !== undefined)
    throw new Error('Send either images or a legacy image, not both.');
  const images = input.images !== undefined ? input.images : input.image === undefined ? [] : [input.image];
  if (!Array.isArray(images) || images.length > MAX_IMAGES)
    throw new Error(`Attach at most ${MAX_IMAGES} screenshots.`);
  let total = 0;
  for (const value of images) {
    if (typeof value !== 'string' || value.length > 10_666_700 || !IMAGE_PATTERN.test(value))
      throw new Error('Invalid screen image.');
    const bytes = Buffer.from(value.slice(value.indexOf(',') + 1), 'base64');
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error('A screenshot exceeds the 8 MB limit.');
    const { width, height } = value.startsWith('data:image/png') ? pngSize(bytes) : jpegSize(bytes);
    if (!width || !height || width > 16384 || height > 16384 || width * height > 100_000_000)
      throw new Error('Screenshot dimensions are too large.');
    total += bytes.length;
  }
  if (total > MAX_TOTAL_BYTES) throw new Error('The attached screenshots are too large.');
  return images.slice();
}

module.exports = { requestImages, MAX_IMAGES, MAX_IMAGE_BYTES, MAX_TOTAL_BYTES };
