`OpusStreamDecoder` is an Emscripten JavaScript WebAssembly (Wasm) library for immediately decoding Ogg Opus audio streams (URLs or files) in chunks without waiting for the complete file to download, copy, or read. [`libopusfile`](https://opus-codec.org/docs/opusfile_api-0.7/index.html) is the underlying C library used for decoding.  `OpusStreamDecoder` provides a lightweight JavaScript API for decoding Opus audio streams at near-native speeds.

_Note: This repository was forked from [AnthumChris/fetch-stream-audio](https://github.com/AnthumChris/fetch-stream-audio) to decouple `OpusStreamDecoder` as a standalone Wasm decoder.  It will be integrated back into demo as a git submodule for [fetch-stream-audio #4](https://github.com/AnthumChris/fetch-stream-audio/issues/4)._

# Usage

Pre-compiled binaries and full examples are included in the `dist/` folder.  The `OpusStreamDecoder` API was designed to be simple and the pseudocode below explains its complete usage:

If using a front-end build system, you can obtain `OpusStreamDecoder` via `require` or `import` syntaxes:

```js
const { OpusStreamDecoder } = require('opus-stream-decoder');
import { OpusStreamDecoder } from 'opus-stream-decoder';
```

Otherwise, include the script before you instantiate `OpusStreamDecoder`.

```javascript
<script src="opus-stream-decoder.js"></script>
<script>
  // instantiate with onDecode callback that fires when OggOpusFile data is decoded
  const decoder = new OpusStreamDecoder({onDecode});

  // Loop through your Opusdata callingdecode() multiple times. Pass a Uint8Array
  try {
    while(...) {
      decoder.ready.then(_ => decoder.decode(UINT8_DATA_TO_DECODE));
    }
  } catch (e) {
    decoder.ready.then(_ => decoder.free());
  }

  // free up the decoder's memory in WebAssembly (also resets decoder for reuse)
  decoder.ready.then(_ => decoder.free());

  // after free() is called, you could reuse the decoder for another file
  try { ... decoder.ready.then(_ => decoder.decode(UINT8_DATA_TO_DECODE) } ...

  /* Receives decoded Float32Array PCM audio in left/right arrays.
   * sampleRate is always 48000 and both channels would always contain data if
   * samplesDecoded > 0.  Mono Opus files would decoded identically into both
   * left/right channels and multichannel Opus files would be downmixed to 2 channels.
   */
  function onDecode({left, right, samplesDecoded, sampleRate}) {
    console.log(`Decoded ${samplesDecoded} samples`);
    // play back the left/right audio, write to a file, etc
  }
</script>
```

After instantiating `OpusStreamDecoder`, `decode()` should be called repeatedly until you're done reading the stream.  You __must__ start decoding from the beginning of the file.  Otherwise, a valid Ogg Opus file will not be discovered by `libopusfile` for decoding.  `decoder.ready` is a Promise that resolves once the underlying WebAssembly module is fetched from the network and instantiated, so ensure you always wait for it to resolve.  `free()` should be called when done decoding, when `decode()` throws an error, or if you wish to "reset" the decoder and begin decoding a new file with the same instance.  `free()` releases the allocated Wasm memory.

#### Performance
To achieve optimum decoding performance, `OpusStreamDecoder` should ideally be run in a Web Worker to keep CPU decoding computations on a sepearate browser thread. (_TODO: provide web worker example._)

Additionally, `onDecode` will be called thousands of times while decoding Opus files. Keep your `onDecode` callbacks lean.  The multiple calls result intentionally because of Opus' unmatched low-latency decoding advantage ([read more](https://opus-codec.org/comparison/#bitratelatency-comparison))—audio is decoded as soon as possible .  For example, a 60-second Opus file encoded with a 20ms frame/packet size would yield 3,000 `onDecode` calls (60 * 1000 / 20), because the underlying `libopusfile` C decoding function [`op_read_float_stereo()`](https://opus-codec.org/docs/opusfile_api-0.7/group__stream__decoding.html#ga9736f96563500c0978f56f0fd6bdad83) currently decodes one frame at a time during my tests.

# Building

The `dist/` folder will contain all required files, tests, and examples after building.

### Download Ogg, Opus, and Opusfile C libraries:
```
$ git submodule update --init
```

_TODO: consider moving this to Makefile_

### Install Emscripten

Emscripten is used to compile the C libraries to be compatible with WebAssembly.  This repo was tested with 1.39.5.

* [Emscripten Installation Instructions](https://kripken.github.io/emscripten-site/docs/getting_started/downloads.html#installation-instructions)

### Run the Build

```
$ make clean dist
```

The Emscripten module builds in a few seconds, but most of the work will be spent configuring the dependencies `libopus`, `libogg`, and `libopusfile`. You may see the warnings (not errors) below, which don't prevent the build from succeeding.  It is not known whether these warnings adversly affect runtime use.

- Don't have the functions lrint() and lrintf ()
- Replacing these functions with a standard C cast
- implicit conversion from 'unsigned int' to 'float'


### Build Errors

#### Error: "autoreconf: command not found"

`$ brew install automake`

#### "./autogen.sh: No such file or directory"

`$ brew install autogen`

# Tests & Examples

Two tests exist that will decode an Ogg Opus File with `OpusStreamDecoder`.  Both tests output "decoded _N_ samples." on success.

### NodeJS Test

This test writes two decoded left/right PCM audio data to files in `tmp/`. [Install NodeJS](https://nodejs.org/en/download/) and run:
```
$ make test-wasm-module
```

### HTML Browser Test

This test uses `fetch()` to decode a URL file stream in chunks.  Serve the `dist/` folder from a web server and open `test-opus-stream-decoder.html` in the browser.  HTTP/HTTPS schemes are required for Wasm to load—opening it directly with `file://` probably won't work.

You can also run `SimpleHTTPServer` and navigate to http://localhost:8000/test-opus-stream-decoder.html
```
$ cd dist
$ python -m SimpleHTTPServer 8000
```

# Developing

### Emscripten Wasm Module

See files `src/*.{js,html}` and use `$ make` and `$ make clean` to build into `dist/`

### `OpusChunkDecoder` C interface

See C files `src/opus_chunkdecoder*` and use `$ make native-decode-test`, which allows you to compile and test almost instantly.  `native-decode-test` is a fast workflow that ensures things work properly independently of  Emscripten and Wasm before you integrate it.

You'll need to install `libopusfile` binaries natively on your system (on Mac use `$ brew install opusfile`).  Then, declare environment variables with the locations of the installed `libopusfile` dependencies required by `native-decode-test` before running:
```
$ export OPUS_DIR=/usr/local/Cellar/opus/1.2.1
$ export OPUSFILE_DIR=/usr/local/Cellar/opusfile/0.10
$ make native-decode-test
```

Note: If you see error "fatal error: 'stdarg.h' file not found", try running from a new terminal window that does not have Emscripten initialized.


