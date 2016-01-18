// https://github.com/NLP2RDF/software/blob/master/php/nif-ws.php
// http://persistence.uni-leipzig.org/nlp2rdf/specification/api.html
// https://github.com/dragoon/kilogram/blob/master/extra/data/msnbc/msnbc_truth.txt
const express = require('express');
const app = express();
const fs = require('fs');

const N3 = require('n3');
const N3Util = N3.Util;
const accepts = require('accepts');
const llog = require('log-anything');

const debug = false;

const log = (...args) => (debug ? llog.log(...args) : null);

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
  return fs.readFileSync(path, 'utf8');
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
  console.log('Got POST request!');
  // set content-type header
  const accept = acceptContentType(accepts(req));
  res.setHeader('Content-Type', accept.contentType);

  // prepare the things
  const parser = N3.Parser({ format: 'Turtle' });
  const triples = [];
  let dummyRequest = false;

  // get ready for heavy lifting
  const mentions = []; // { name: '', start: 0, end: 10, misc }, ...
  let text = '';

  parser.parse(req.rawBody, (error, triple, prefixes) => {
    if (triple) {
      triples.push(triple);
    } else if (prefixes) {
      log('Received:');
      log(triples);
      const writer = N3.Writer({ prefixes: { c: ns(prefixes, 'nif').p } });
      for (const atriple of triples) {
        if (N3Util.isLiteral(atriple.object) &&
            N3Util.getLiteralType(atriple.object) === 'http://www.w3.org/2001/XMLSchema#string' &&
            N3Util.getLiteralValue(atriple.object) === 'This simple text is for testing the communication between the given web service and the GERBIL web service.') {
          dummyRequest = true;
        }

        const uid = atriple.subject.split('#')[1];
        if (!mentions.hasOwnProperty(uid)) {
          mentions[uid] = {};
        }

        switch (atriple.predicate) {
          case 'http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#isString':
            log('text found');
            text = N3Util.getLiteralValue(atriple.object);
            break;
          case 'http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#RFC5147String':
            log('new entity');
            break;
          case 'http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#anchorOf':
            log('entity found');
            mentions[uid].name = N3Util.getLiteralValue(atriple.object);
            mentions[uid].type = N3Util.getLiteralType(atriple.object).split('#')[1];
            break;
          case 'http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#beginIndex':
            log('start found');
            mentions[uid].start = N3Util.getLiteralValue(atriple.object);
            break;
          case 'http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#endIndex':
            log('end found');
            mentions[uid].end = N3Util.getLiteralValue(atriple.object);
            break;
          case 'http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#referenceContext':
            log('context found');
            mentions[uid].context = atriple.object.split('#')[1];
            break;
          default:
            log('thing not found', atriple.predicate);
            break;
        }

        writer.addTriple(atriple);
      }

      if (dummyRequest) {
        log('Answering to the dummy request!');
        writer.end((error, result) => {
          res.end(result);
        });
      } else {
        log('mentions');
        log(mentions);
        log('text');
        log(text);
        res.end(getTruth('Babelfy-MSNBC-s-D2KB.txt'));
      }
    }
  });
});

const server = app.listen(3333, 'localhost', () => {
  const host = server.address().address;
  const port = server.address().port;

  log('Example app listening at http://%s:%s', host, port);
});
