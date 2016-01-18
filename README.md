# nif-entity-linking-webservice

This project is a NIF webservice intended to work with [GERBIL](/AKSW/gerbil).

It is *not* a full implementation of a NIF webservice, pretty much the opposite: it's the bare minimum to communicate with GERBIL.

### How does it work / What does it do

It runs a webservice which acts as middleware between GERBIL and your own entity-linking annotator.

1. `GERBIL --NIF--> webservice --JSON--> annotator`
2. ...annotator annotates...
3. `GERBIL <--NIF-- webservice <--JSON-- annotator`

### JSON API for your entity-linking annotator

Your annotator will receive a JSON like this one:

```json
{
  "mentions": [
    {
      "name": "Robinson College", // mention to link
      "start": "2898", // offset
      "end": "2914", // offset
      "context": "char=0,5253", // subject anchor
      "uid": 0 // unique identifier for this mention
    },
    {
      "name": "Home Depot",
      "start": "791",
      "end": "801",
      "context": "char=0,5253",
      "uid": 1
    },
    ...
  ],
  "text": "This string contains\nthe full text.", // full text
  "uid": 0 // unique identifier for this text
}
```

and will have to answer with something like this: (note the addition of the `uri` field, which gives the dbpedia name of an entity in URL format)

```json
{
  "mentions": [
    {
      "name": "Robinson College",
      "start": "2898",
      "end": "2914",
      "context": "char=0,5253",
      "uri": "http://dbpedia.org/resource/The_New_York_Times",
      "uid": 0
    },
    {
      "name": "Home Depot",
      "start": "791",
      "end": "801",
      "context": "char=0,5253",
      "uri": "http://dbpedia.org/resource/Home_Depot",
      "uid": 1
    },
    ...
  ],
  "uid": 0
}
```

### Installation

1. Clone the project
2. `npm install`
3. Configure index.js
  1. `debug` (bool) print debug info
  2. `annotatorURL` (string) address of the entity-linking annotator
  3. `webservicePort` (int) webservice port
4. `babel-node index.js > debug.log`
