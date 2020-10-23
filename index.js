const fetch = require("node-fetch");
const xmlParser = require('xml2json');
const csvParser = require('csv-parser');
const cliProgress = require('cli-progress');
const fs = require('fs');

if (process.argv.length < 3) {
  console.log('use "node index.js <filename>"');
  return;
}

let separator = ',';

if (process.argv.length > 3) {
  separator = process.argv.pop();
}

const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

const filename = process.argv.pop();
const writeStream = fs.createWriteStream(`convert-${filename}`);
const COLUMNS = ['Ulice', 'Město'];

const writeLine = text => {
  return writeStream.write(`${text}\n`);
}

const writeCSVLine = row => {
  writeLine(`"${Object.keys(row).map(key => row[key]).join(`"${separator}"`)}"`);
}

let total = 0;

const geocode = async row => {
  const address = COLUMNS.map(column => row[column]).join(', ')
  const url = `https://api.mapy.cz/geocode?query=${encodeURIComponent(address)}`;
  jsonString = '{}';
  try {
    const response = await fetch(url);
    const xmlData = await response.text();
    jsonString = xmlParser.toJson(xmlData);
  } catch(e) {
    console.error('Cannot fetch', e)
  }
  let jsonData = {};
  try {
    jsonData = JSON.parse(jsonString);
  } catch(e) {
    console.error('Cannot parse JSON', e)
  }
  const { result } = jsonData || {};
  const { point } = result || {};

  if (point.status === '200') {
    let { item } = point || {};
    if (Array.isArray(item)) {
      item = item[0];
    }
    if (item) {
      row.lat = item.y;
      row.lng = item.x;
    }
  }

  progressBar.increment(1);
  return writeCSVLine(row);
}

const promises = [];

const readFile = filename => {
  fs.createReadStream(filename)
  .pipe(csvParser({
    separator,
    mapHeaders: ({ header }) => header.trim()
  }))
  .on('data', row => {
    if (row['lat'] || row['lng']) return writeCSVLine(row);
    total++;
    promises.push(geocode(row));
  }).on('headers', headers => {
    if (!headers.includes('lat')) headers.push('lat');
    if (!headers.includes('lng')) headers.push('lng')
    writeLine(headers.join(separator))
  })
  .on('end', () => {
    progressBar.start(total, 0);
    Promise.all(promises).then(() => {
      writeStream.end();
      progressBar.stop();
    })
  });
}

if (filename) {
  readFile(filename);
}