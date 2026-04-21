const fs = require('fs');
const content = process.argv[2];
fs.writeFileSync("D:/Mufeed/Sevent/Code/.tmp/prompt.txt", Buffer.from(content, 'base64').toString('utf8'));
console.log("wrote", fs.statSync("D:/Mufeed/Sevent/Code/.tmp/prompt.txt").size, "bytes");
