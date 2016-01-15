// https://github.com/NLP2RDF/software/blob/master/php/nif-ws.php
// http://persistence.uni-leipzig.org/nlp2rdf/specification/api.html
// https://github.com/dragoon/kilogram/blob/master/extra/data/msnbc/msnbc_truth.txt
const express = require('express');
const app = express();
const fs = require('fs');

const N3 = require('n3');
const accepts = require('accepts');

const NIF = 'http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#';

const acceptContentType = (accept) => {
  switch (accept.type(['json', 'html', 'text', 'turtle', 'rdf+xml', 'ld+json', 'n-triples'])) {
    case 'text':
      return { contentType: 'text/plain', outformat: 'text' };
    case 'html':
      return { contentType: 'text/html', outformat: 'html' };
    case 'rdfxml':
      return { contentType: 'application/rdf+xml', outformat: 'rdfxml' };
    case 'ld+json':
      throw new Error('not implemented');
    case 'ntriples':
      return { contentType: 'application/n-triples', outformat: 'ntriples' };
    case 'turtle':
    default:
      return { contentType: 'text/turtle', outformat: 'turtle' };
  }
};

const ns = (prefixes, type) => {
  return {
    'p': prefixes[type].trim(),
    'nif': NIF,
    'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
    'owl': 'http://www.w3.org/2002/07/owl#',
    'rlog': 'http://persistence.uni-leipzig.org/nlp2rdf/ontologies/rlog#',
    'dc': 'http://purl.org/dc/elements/1.1/',
  };
};

function getTruth(path) {
  return fs.readFileSync(path, "utf8");
}

function parseFile() {
  const lines = fs.readFileSync('./msnbc_truth.txt', 'utf8').split('\n');
  const docs = [];
  lines.map((line) => {
    if (line[0] === '~') {
      docs.pushline.slice(5);
    }
    line = line.split('\t');
    if (line.length) {
      line;
    }
  });
}

app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  const mime = contentType.split(';')[0];

  if (mime !== 'application/x-turtle') {
    return next();
  }

  let data = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    data += chunk;
  });
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
});

app.post('/', (req, res) => {
  // set content-type header
  const accept = acceptContentType(accepts(req));
  res.setHeader('Content-Type', accept.contentType);

  const parser = N3.Parser({ format: 'Turtle' });
  const triples = [];
  parser.parse(req.rawBody, (error, triple, prefixes) => {
    if (triple) {
      triples.push(triple);
    } else if (prefixes) {
      if (true || req.rawBody.indexOf('This simple text') !== -1) {
        console.log('Received:');
        console.log(triples);
        const writer = N3.Writer({ prefixes: { c: ns(prefixes, 'nif').p } });
        for (let triple of triples) {
          writer.addTriple(triple);
        }

        writer.end((error, result) => {
          console.log('Answering:');
          console.log(result);
          console.log('---------');
          res.end(result);
        });
      } else {
        res.end(getTruth('Babelfy-MSNBC-s-D2KB.txt'));
      }
    }
  });
});

const server = app.listen(3333, 'localhost', () => {
  const host = server.address().address;
  const port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});
