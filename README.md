# nif-entity-linking-webservice

This project is a NIF webservice intended to work with [GERBIL](/AKSW/gerbil).

It is *not* a full implementation of a NIF webservice, pretty much the opposite: it's the bare minimum to communicate with GERBIL.

### How does it work / What does it do

It runs a webservice which acts as middleware between GERBIL and your own entity-linking annotator.

`GERBIL --NIF--> webservice --JSON--> annotator`
...annotator annotates...
`GERBIL <--NIF-- webservice <--JSON-- annotator`

### JSON API for your entity-linking annotator

Your annotator will receive a JSON like this one:

```json
{
  "mentions": [
    {
      "name": "Robinson College",
      "start": "2898",
      "end": "2914",
      "context": "char=0,5253"
    },
    {
      "name": "Home Depot",
      "start": "791",
      "end": "801",
      "context": "char=0,5253"
    },
    ...
  ],
  "text": "This string contains\nthe full text."
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
      "uri": "The_New_York_Times"
    },
    {
      "name": "Home Depot",
      "start": "791",
      "end": "801",
      "context": "char=0,5253",
      "uri": "Home_Depot"
    },
    ...
  ]
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
