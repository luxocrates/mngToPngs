#!/usr/bin/env node

// mngToPngs: a command-line tool to convert an .MNG file generated by MAME
// (using -mngwrite) to a sequence of .PNG files.
//
// It's a quicky-and-dirty script, and is only intended for the simple .MNG
// profile that MAME emits.
//
// PNG spec: http://www.libpng.org/pub/png/spec/
// MNG spec: http://www.libpng.org/pub/mng/spec/
//
// Note: generation on the MAME side is done in lib/util/png.cpp

import { existsSync, mkdirSync, openSync, readSync, writeFileSync } from "fs";
import { basename } from "path";

/** Magic header for PNG files */
const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** Image tags that should be copied verbatim to the .PNG */
const tagsToCopy = new Set(["IHDR", "IDAT", "IEND"]);

/** Stream out the tagged chunks from the .MNG file*/
async function* getChunks(fd) {
  let offset = 0;

  // Skip past the .MNG magic header. Ideally we'd verify it.  
  {
    const fileHeaderSize = 8;
    const fileHeader = new Buffer.alloc(fileHeaderSize)
    readSync(fd, fileHeader, 0, fileHeaderSize, 0); // TODO: test
    offset += fileHeaderSize;
  }

  while (true) {
    // Read the chunk header (tag and size)
    const chunkHeaderSize = 8;
    const chunkHeader = new Buffer.alloc(chunkHeaderSize)
    readSync(fd, chunkHeader, 0, chunkHeaderSize, offset); // TODO: test
    offset += chunkHeaderSize;

    const size = chunkHeader.readUInt32BE(0);

    const tag =
      String.fromCharCode(chunkHeader.readUInt8(4)) +
      String.fromCharCode(chunkHeader.readUInt8(5)) +
      String.fromCharCode(chunkHeader.readUInt8(6)) +
      String.fromCharCode(chunkHeader.readUInt8(7));
    
    const payloadAndCrcSize = size + 4;
    const payloadAndCrc = new Buffer.alloc(payloadAndCrcSize);
    readSync(fd, payloadAndCrc, 0, payloadAndCrcSize, offset); // TODO: test
    offset += payloadAndCrcSize;

    const chunk = Buffer.concat([chunkHeader, payloadAndCrc]);

    yield [tag, chunk];
  }
}

function getCliArgs() {
  if (process.argv.length < 4) {
    console.error(`Usage: (command) (input.mng) (output directory)`);
    process.exit(1);
  }

  const [,,filename, dirname] = process.argv;
  
  try {
    if (!existsSync(dirname)) {
      mkdirSync(dirname);
    }
  } catch (_) {
    console.error(`Error: can't create output directory '${dirname}'`);
    process.exit(1);
  }

  let fh;
  try {
    fh = openSync(filename);
  } catch (_) {
    console.error(`Error: can't open input file '${filename}'`);
    process.exit(1);
  }

  return [filename, fh, dirname];
}

const [filename, fd, dirname] = getCliArgs();


// Pass 1: count frames, just so we can make the frame counter have a
// consistent number of digits
// 
// Although it's tempting to use the nominal frame count in the file header,
// MAME currently seems to be undercounting

let frames = 0;
for await (const [tag] of getChunks(fd)) {
  if (tag === "IHDR") frames++;
  if (tag === "MEND") break;
}
const numDigits = Math.ceil(Math.log10(frames));


// Pass 2: emit the copied frames

let frame = 0;
const [filestem] = basename(filename).split(".");

/** Staged chunks for whichever frame is current */
let chunksToOutput = [];

for await (const [tag, payload] of getChunks(fd)) {
  if (tagsToCopy.has(tag)) chunksToOutput.push(payload);

  // End-of-image tag: close up the staged file
  if (tag === "IEND") {
    const filename = `${dirname}/${filestem}_${String(frame).padStart(numDigits, "0")}.png`;
    console.log("Writing", filename);
    // TODO: catch errors
    writeFileSync(filename, Buffer.concat([pngHeader, ...chunksToOutput]));

    // Open up the chunks for the next frame
    chunksToOutput = [];
    frame++;
  }

  // End-of-movie tag: done
  if (tag === "MEND") break;
}
