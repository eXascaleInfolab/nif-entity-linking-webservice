// https://github.com/NLP2RDF/software/blob/master/php/nif-ws.php
// http://persistence.uni-leipzig.org/nlp2rdf/specification/api.html
// https://github.com/dragoon/kilogram/blob/master/extra/data/msnbc/msnbc_truth.txt
const express = require('express');
const app = express();

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
      const writer = N3.Writer({ prefixes: { c: ns(prefixes, 'nif').p } });
      for (let triple of triples) {
        writer.addTriple(triple);
      }

      writer.end((error, result) => {
        res.end(result);
      });
    }
  });
});

const server = app.listen(3333, 'localhost', () => {
  const host = server.address().address;
  const port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});
