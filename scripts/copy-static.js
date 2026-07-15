const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dest = path.join(root, "dist", "public");

fs.mkdirSync(dest, { recursive: true });

const files = [
  ["client/index.html", "index.html"],
  ["client/style.css", "style.css"],
];

for (const [from, to] of files) {
  fs.copyFileSync(path.join(root, from), path.join(dest, to));
}

console.log("Static client files copied to dist/public");
