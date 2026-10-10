const { gzipSync, gunzipSync } = require('node:zlib');

function blob(value) {
  const bytes = Buffer.from(value, typeof value === 'string' ? 'utf8' : undefined);
  return {
    getBytes: () => [...bytes].map(byte => byte > 127 ? byte - 256 : byte),
    getDataAsString: encoding => {
      if (encoding !== 'UTF-8') throw new Error('Expected explicit UTF-8 encoding');
      return bytes.toString('utf8');
    }
  };
}

// Model the Apps Script Blob/Utilities boundary with real gzip and UTF-8 bytes.
function createUtilities() {
  return {
    newBlob: value => blob(value),
    gzip: value => blob(gzipSync(Buffer.from(value.getBytes()))),
    ungzip: value => blob(gunzipSync(Buffer.from(value.getBytes()))),
    base64Encode: bytes => Buffer.from(bytes).toString('base64'),
    base64Decode: value => blob(Buffer.from(value, 'base64')).getBytes()
  };
}

module.exports = { createUtilities };
