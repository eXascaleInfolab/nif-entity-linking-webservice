// https://github.com/NLP2RDF/software/blob/master/php/nif-ws.php
// http://persistence.uni-leipzig.org/nlp2rdf/specification/api.html
// https://github.com/dragoon/kilogram/blob/master/extra/data/msnbc/msnbc_truth.txt
const express = require('express');
const app = express();

const N3 = require('n3');
const N3Util = N3.Util;
const accepts = require('accepts');
const l = require('log-anything');
const request = require('sync-request');

// Configuration
const debug = true;
const annotatorURL = '';
const webservicePort = 3333;

const log = (...args) => (debug ? l.log(...args) : null);

const NIF = 'http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#';
let contextCounter = 0;
let mentionCounter = 0;

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

function nifMention(mention, contextUid) {
  return [`<http://example.com/exascale/mention/${mention.uid}.txt#char=${mention.start},${mention.end}>`,
          `      a                     nif:RFC5147String , nif:String ;`,
          `      nif:anchorOf          "${mention.name}"^^xsd:string ;`,
          `      nif:beginIndex        "${mention.start}"^^xsd:nonNegativeInteger ;`,
          `      nif:endIndex          "${mention.end}"^^xsd:nonNegativeInteger ;`,
          `      nif:referenceContext  <http://example.com/exascale/context/${contextUid}.txt#${mention.context}> ;`,
          `      itsrdf:taConfidence   "1.0"^^xsd:double ;`,
          `      itsrdf:taIdentRef     <${mention.uri}> .`,
          ``, ``].join('\n');
}

function jsonToNif(json, text, contextUid) {
  const head = ['@prefix rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',
                '@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .',
                '@prefix itsrdf: <http://www.w3.org/2005/11/its/rdf#> .',
                '@prefix nif:   <http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#> .',
                '@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .',
                '', ''].join('\n');

  const context = json.mentions[0].context;
  const pos = context.split('=')[1].split(',');

  const newText = JSON.stringify(text);

  const tail = [`<http://example.com/exascale/context/${contextUid}.txt#${context}>`,
                `      a               nif:RFC5147String , nif:String , nif:Context ;`,
                `      nif:beginIndex  "${pos[0]}"^^xsd:nonNegativeInteger ;`,
                `      nif:endIndex    "${pos[1]}"^^xsd:nonNegativeInteger ;`,
                `      nif:isString    ${newText}^^xsd:string .`,
                ``, ``].join('\n');

  const body = json.mentions.map((x) => nifMention(x, contextUid)).join('');

  return head + body + tail;
}


function annotatorPipe(payload) {
  const res = request('POST', annotatorURL, {
    json: payload,
  });
  const json = res.getBody('utf8');
  log('Received JSON from annotator');
  log(json);
  return jsonToNif(JSON.parse(json), payload.text, payload.uid);
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
  log('Got POST request!');
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
      log('Received triples');
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
          mentions[uid] = { uid: mentionCounter };
          mentionCounter++;
        }

        switch (atriple.predicate) {
          case 'http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#isString':
            text = N3Util.getLiteralValue(atriple.object);
            break;
          case 'http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#RFC5147String':
            break;
          case 'http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#anchorOf':
            mentions[uid].name = N3Util.getLiteralValue(atriple.object);
            mentions[uid].type = N3Util.getLiteralType(atriple.object).split('#')[1];
            break;
          case 'http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#beginIndex':
            mentions[uid].start = parseInt(N3Util.getLiteralValue(atriple.object), 10);
            break;
          case 'http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#endIndex':
            mentions[uid].end = parseInt(N3Util.getLiteralValue(atriple.object), 10);
            break;
          case 'http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#referenceContext':
            mentions[uid].context = atriple.object.split('#')[1];
            break;
          default:
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
        const finalMentions = [];
        for (const mention in mentions) {
          if (mentions.hasOwnProperty(mention) && mentions[mention].hasOwnProperty('name')) {
            finalMentions.push(mentions[mention]);
          }
        }
        const payload = {
          mentions: finalMentions,
          text,
          uid: contextCounter,
        };
        log('Sending payload to annotator');
        log(payload);
        const nifAnswer = annotatorPipe(payload);
        log('Answering with nif');
        log(nifAnswer);
        res.end(nifAnswer);
      }
    }
  });
  contextCounter++;
});

const server = app.listen(webservicePort, 'localhost', () => {
  const host = server.address().address;
  const port = server.address().port;

  log('NIF web service listening at http://%s:%s', host, port);
});
