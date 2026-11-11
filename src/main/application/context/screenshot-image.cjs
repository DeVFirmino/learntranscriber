// A screenshot as a JPEG data URL whose longest side fits `maxDimension`, a fraction of the full-size PNG upload.
function jpegDataUrl(image, { maxDimension, quality }) {
  const { width, height } = image.getSize();
  const scaled =
    Math.max(width, height) > maxDimension
      ? image.resize(width >= height ? { width: maxDimension } : { height: maxDimension })
      : image;
  return 'data:image/jpeg;base64,' + scaled.toJPEG(quality).toString('base64');
}

// Manual captures: longest side 1600 px at JPEG quality 80.
const CAPTURE_IMAGE = Object.freeze({ maxDimension: 1600, quality: 80 });

module.exports = { jpegDataUrl, CAPTURE_IMAGE };
