const fs = require('fs');
const { Readable } = require('stream');

/**
 * Normalizes a file path or buffer into a Readable stream.
 * @param {string|Buffer} source - Absolute file path or Buffer.
 * @returns {Readable} Node.js Readable stream.
 */
function getReadableStream(source) {
  if (Buffer.isBuffer(source)) {
    const readable = new Readable();
    // No-op for read, since we push all content synchronously
    readable._read = () => {};
    readable.push(source);
    readable.push(null);
    return readable;
  }
  
  if (typeof source === 'string') {
    return fs.createReadStream(source);
  }
  
  throw new Error('Invalid parser source. Source must be an absolute file path or a Buffer.');
}

module.exports = { getReadableStream };
