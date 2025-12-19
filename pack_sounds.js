#!node

const path = require('path');
const fs = require('fs');

let outPath;
let inPaths = [];

for (let i=2; i<process.argv.length; i++) {
	if (i==2)
		outPath = path.resolve(process.argv[i]);
	else
		inPaths.push(path.resolve(process.argv[i]));
}

if (!outPath || !inPaths.length) {
	console.error("Usage: node pack_sounds.js <outputFile> <inputFile1> [inputFile2 ...]");
	return process.exit(1);
}

let outStream = fs.createWriteStream(outPath);

outStream.writeUInt32 = function(val) {
	let buf = Buffer.allocUnsafe(4);
	buf.writeUInt32LE(val);
	this.write(buf);
	return this;
}
outStream.writeShortString = function(str) {
	this.write(Buffer.from([str.length]));
	this.write(str);
	return this;
}
outStream.writeBuffer = function(buf) {
	this.writeUInt32(buf.length);
	this.write(buf);
	return this;
}

// 1. int32 number of files
outStream.writeUInt32(inPaths.length);

// 2. for each file
for (let inPath of inPaths) {
	console.log("Adding", inPath);

	// 2.1. file name (no path no extension)
	outStream.writeShortString(path.basename(inPath, path.extname(inPath)));

	let fileBuf;
	try {
		fileBuf = fs.readFileSync(inPath);
	}
	catch(err) {
		console.warn(err);
		outStream.writeUInt32(0);
		continue;
	}

	// 2.2. file contents
	outStream.writeBuffer(fileBuf);
}

console.log("Done");
outStream.end();
