#!node

const path = require('path');
const fs = require('fs');

let outPath;
let inputs = [];
let type = "";

for (let i=2; i<process.argv.length; i++) {
	if (i==2)
		outPath = path.resolve(process.argv[i]);
	else if (process.argv[i].startsWith('--type='))
		type = process.argv[i].substr(7);
	else
		inputs.push({ path:path.resolve(process.argv[i]), type });
}

if (!outPath || !inputs.length) {
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
outStream.writeUInt32(inputs.length);

// 2. for each file
for (let input of inputs) {
	console.log("Adding", input);

	// 2.1. type
	outStream.writeShortString(input.type);

	// 2.2. name
	outStream.writeShortString(path.basename(input.path, path.extname(input.path)));

	let fileBuf;
	try {
		fileBuf = fs.readFileSync(input.path);
	}
	catch(err) {
		console.warn(err);
		outStream.writeUInt32(0);
		continue;
	}

	// 2.3. file contents
	outStream.writeBuffer(fileBuf);
}

console.log("Done");
outStream.end();
