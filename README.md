Under active development, not ready for use.

Inspired by [PgAdmin](https://ww.pgadmin.org) and [psql](https://www.postgresql.org/docs/9.6/static/app-psql.html)

<img src="https://raw.githubusercontent.com/jingerso/pgchamp/master/browser.png" />

## Developer Install

Install the latest [node](https://nodejs.org/en/). Then:

````sh
$ git clone git@github.com:jingerso/pgchamp.git
$ cd pgchamp
````

Install Dependancies
````sh
$ npm i && cd client && npm i
````

Start the API Service
````sh
$ export PORT=9000
$ ./node_modules/babel-cli/bin/babel-node.js src/server.js
````

Start the client
````sh
$ cd client && npm start
````

Open [http://localhost:3000](http://localhost:3000) in your browser. The client app will automatically reload when you save code edits.

The client is based on [React Create App](https://github.com/facebookincubator/create-react-app). It has extensive documentation and support [here](https://github.com/facebookincubator/create-react-app).

Help with linting: [Displaying Lint Output in the Editor](https://github.com/facebookincubator/create-react-app/blob/master/packages/react-scripts/template/README.md#displaying-lint-output-in-the-editor)

## Configuring Server Connections

````sh
$ cd pgchamp
$ touch servers.json
````

servers.json has the following format:

````json
[
  {
    "name": "Server #1",
    "host": "localhost",
    "port": "5432",
    "username": "postgres",
    "password": ""
  },
  {
    "name": "Server #1",
    "host": "localhost",
    "port": "5432",
    "username": "postgres",
    "password": ""
  }
]
````

The API server will require a restart after modifying servers.json:
````sh
$ ./node_modules/babel-cli/bin/babel-node.js src/server.js
````

## Prior Art

PG Champ has been inspired by and borrows from:

- [PGAdmin](https://www.pgadmin.org/)
- [psql](https://www.postgresql.org/docs/9.6/static/app-psql.html)
