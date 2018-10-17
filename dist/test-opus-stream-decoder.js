/*
 *  NodeJS test that reads and decodes an Opus file in streams. Invoke as:

 *    $ node test-opus-stream-decoder OPUS_IN_FILE DECODED_OUT_FOLDER
 *
 *  You can play the decoded audio files with SoX (http://sox.sourceforge.net/):
 *
 *    $ play --type raw --rate 48000 --endian little --encoding floating-point --bits 32 --channels 1 PCM_FILE_NAME
 */

const args = process.argv;
const currentFolder = process.cwd()+'/';
const thisScriptFolder = args[1].match(/^.*\//)[0];
process.chdir(thisScriptFolder);

const fs = require('fs');
const decoderModule = require(thisScriptFolder+'opus-stream-decoder.js');
const decoder = new decoderModule.OpusStreamDecoder({onDecode});

const opusInFile = args[2].startsWith('/')? args[2] : currentFolder+args[2];
const outFolder = args[3].startsWith('/')? args[3] : currentFolder+args[3];

const inFileStream = fs.createReadStream(opusInFile, {highWaterMark: 16*1024});

const pcmOutLeftFile = outFolder+'/decoded-left.pcm';
const pcmOutRightFile = outFolder+'/decoded-right.pcm';

const outLeftFileStream = fs.createWriteStream(pcmOutLeftFile);
const outRightFileStream = fs.createWriteStream(pcmOutRightFile);

// read file in 16k chunks and send to Opus decoder
let totalSamplesDecoded = 0;
inFileStream
.on('data', async data => {
  try {
    await decoder.ready;
    decoder.decode(data);
  } catch (err) {
    decoder.free();
    showError(err);
    inFileStram.destroy(err);
  }
})
.on('end', _ => {
  decoder.free();
  if (!totalSamplesDecoded) {
    console.error('File could not be decoded.')
  } else {
    console.log(
      'Decoded '+totalSamplesDecoded+' samples.',
      'Listen to decoded files: ',
      pcmOutLeftFile.replace(currentFolder,''),
      pcmOutRightFile.replace(currentFolder,'')
    )
  }
}).on('error', err => {
  decoder.free();
  showError(err)
});


function onDecode(decodedPcm) {
  totalSamplesDecoded+= decodedPcm.samplesDecoded;
  outLeftFileStream.write(Buffer.from(decodedPcm.left.buffer));
  outRightFileStream.write(Buffer.from(decodedPcm.right.buffer));
}

function showError(err) {
  console.error(err);
}
