const fetch = require("node-fetch");
const xmlParser = require('xml2json');
const csvParser = require('csv-parser');
const fs = require('fs');

if (process.argv.length < 3) {
  console.log('use "node index.js <filename>"');
  return;
}

const filename = process.argv.pop();
const writeStream = fs.createWriteStream(`convert-${filename}`);

// write some data with a base64 encoding
// writeStream.write('aef35ghhjdk74hja83ksnfjk888sfsf', 'base64');

// // the finish event is emitted when all data has been flushed from the stream
// writeStream.on('finish', () => {
//     console.log('wrote all data to file');
// });

// close the stream
// writeStream.end();

const SEPARATOR = ';';
const COLUMNS = ['Ulice', 'Město'];

const writeLine = text => {
  return writeStream.write(`${text}\n`);
}

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
  return writeLine(Object.keys(row).map(key => row[key]).join(SEPARATOR));
}

const promises = [];

const readFile = filename => {
  fs.createReadStream(filename)
  .pipe(csvParser({
    separator: SEPARATOR,
    mapHeaders: ({ header }) => header.trim()
  }))
  .on('data', row => {
    promises.push(geocode(row));
  }).on('headers', headers => {
    headers.push('lat');
    headers.push('lng')
    writeLine(headers.join(SEPARATOR))
  })
  .on('end', () => {
    Promise.all(promises).then(() => writeStream.end())
  });
}

if (filename) {
  readFile(filename);
}