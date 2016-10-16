# PG Champ
Modern Admin and API for Postgres

## Developer Install

Install the latest [node](https://nodejs.org/en/)
````sh
$ git clone git@github.com:jingerso/pgchamp.git
$ cd pgchamp
````

Install PG Champ
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
