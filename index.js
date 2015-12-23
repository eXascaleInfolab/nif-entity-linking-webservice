// https://github.com/NLP2RDF/software/blob/master/php/nif-ws.php
// http://persistence.uni-leipzig.org/nlp2rdf/specification/api.html
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

const _ = require('lodash');
const N3 = require('n3');
const accepts = require('accepts');

const NIF = 'http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#';
const RLOG = 'http://persistence.uni-leipzig.org/nlp2rdf/ontologies/rlog#';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';

const args = [
  {
    long: 'informat',
    short: 'f',
    defaultValue: 'turtle',
  },
  {
    long: 'input',
    short: 'i',
    defaultValue: () => { throw new Error('No input supplied'); },
  },
  {
    long: 'intype',
    short: 't',
    defaultValue: 'direct',
  },
  {
    long: 'outformat',
    short: 'o',
    defaultValue: 'turtle',
  },
  {
    long: 'urischeme',
    short: 'u',
    defaultValue: 'RFC5147String',
  },
  {
    long: 'prefix',
    short: 'p',
    defaultValue: (server) => `http://${server.address}:${server.port}`,
  },
];

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

const incomingContentType = (req) => {
  if (req.is('text')) {
    return { contentType: 'text/plain', informat: 'text' };
  }
  if (req.is('html')) {
    return { contentType: 'text/html', informat: 'html' };
  }
  if (req.is('rdfxml')) {
    return { contentType: 'application/rdf+xml', informat: 'rdfxml' };
  }
  if (req.is('ld+json')) {
    throw new Error('not implemented');
  }
  if (req.is('ntriples')) {
    return { contentType: 'application/n-triples', informat: 'ntriples' };
  }
  return null;
};

const buildNIF = (text, prefix) => {
  const length = text.length;
  return `@prefix nif: <http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#>.
  @prefix: <${prefix}#>.
  <${prefix}#char=0,${length}>
    a nif:RFC5147String , nif:Context ;
    nif:beginIndex "0";
    nif:endIndex "${length}";
    nif:isString "${text}". `;
};

const dummyAnswer = `@prefix nif: <http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#>.
  @prefix dbo: <http://dbpedia.org/ontology/>.
  @prefix owl: <http://www.w3.org/2002/07/owl#>.
  @prefix itsrdf: <http://www.w3.org/2005/11/its/rdf#>.
  @prefix prefix: <http://gerbil.exascale.info#> .
  <http://gerbil.exascale.info#char=0,39>
    a nif:RFC5147String , nif:Context ;
    nif:beginIndex "0";
    nif:endIndex "39";
    nif:isString "My favorite actress is Natalie Portman." .

  <http://gerbil.exascale.info#char=23,39>
    a nif:RFC5147String , nif:NamedEntity ;
    nif:beginIndex "23";
    nif:endIndex "38";
    nif:referenceContext <http://gerbil.exascale.info#char=0,39>  ;
    itsrdf:taIdentRef <http://dbpedia.org/resource/Natalie_Portman> ;
    itsrdf:taClassRef <http://nerd.eurecom.fr/ontology#Person> , dbo:Actor, dbo:Artist, dbo:Person, dbo:Agent, owl:Thing ;
    nif:taMsClassRef dbo:Actor .

  <http://dbpedia.org/resource/Natalie_Portman> a <http://nerd.eurecom.fr/ontology#Person> , dbo:Actor, dbo:Artist, dbo:Person, dbo:Agent, owl:Thing .
  <http://nerd.eurecom.fr/ontology#Person>  <http://nerd.eurecom.fr/ontology#isCoreClass> "1" .`;

const ns = function(prefxs) {
  return {
    'p': prefxs[''].trim(),
    'nif': NIF,
    'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
    'owl': 'http://www.w3.org/2002/07/owl#',
    'rlog': 'http://persistence.uni-leipzig.org/nlp2rdf/ontologies/rlog#',
    'dc': 'http://purl.org/dc/elements/1.1/',
  };
};

app.use(bodyParser.urlencoded({ extended: false }));

app.post('/', (req, res) => {
  // GERBIL undocumented subtlety: let them know we speak NIF
  if (_.isEqual(req.body, {})) {
    console.log('dummy');
    res.end(dummyAnswer);
    return;
  }
  try {
    // parse received arguments
    const argsReceived = {};
    _.map(args, (arg) => {
      let value;
      if (req.body[arg.long] || req.body[arg.short]) {
        value = req.body[arg.long] || req.body[arg.short];
      } else {
        value = typeof arg.defaultValue === 'function' ? arg.defaultValue(server.address()) : arg.defaultValue;
      }
      argsReceived[arg.long] = value;
    });
  } catch (e) {
    console.log('error while parsing request');
    console.log(req.body);
    console.log(e);
    return;
  }

  // set content-type header
  const accept = acceptContentType(accepts(req));
  res.setHeader('Content-Type', accept.contentType);

  argsReceived.outformat = accept.outformat;

  if (argsReceived.urischeme !== 'RFC5147String') {
    throw new Error('uri scheme not supported');
  }
  if (argsReceived.intype === 'url' && argsReceived.informat === 'text') {
    throw new Error('url / text not supported');
  }

  argsReceived.outformat = accept.outformat;
  argsReceived.informat = incomingContentType(req) ? incomingContentType(req).informat : argsReceived.informat;

  if (argsReceived.intype === 'direct' && argsReceived.informat === 'text') {
    argsReceived.input = buildNIF(argsReceived.input, argsReceived.prefix);
    argsReceived.informat = 'turtle';
  }
  console.log(argsReceived);

  const parser = N3.Parser();
  const triples = [];
  let prefixes;
  parser.parse((error, triple, prefxs) => {
    if (triple) {
      triples.push(triple);
    }
    if (prefxs) {
      prefixes = prefxs;
    }
  });

  if (argsReceived.intype === 'direct') {
    parser.addChunk(argsReceived.input);
    console.log('added chunk', argsReceived.input);
    parser.end();
  } else if (argsReceived.intype === 'url') {
    parser.addChunk(argsReceived.input);
    console.log('added chunk', argsReceived.input);
    parser.end();
  }

  if (!triples.length) {
    throw new Error('Could not create any triple');
  } else {
    console.log('triples:');
    console.log(triples);
    console.log('prefixes:');
    console.log(prefixes);
  }

  let writer;
  switch (argsReceived.outformat) {
    default:
    case 'turtle':
      writer = N3.Writer({ prefixes: { c: ns(prefixes).p } });
      break;
  }

  for (let triple of triples) {
    writer.addTriple(triple);
  }

  writer.end((error, result) => {
    console.log('Answering:');
    console.log(result);
    res.end(result);
  });
  // res.end(JSON.stringify(argsReceived, null, 2));
});

const server = app.listen(3333, 'localhost', () => {
  const host = server.address().address;
  const port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});
