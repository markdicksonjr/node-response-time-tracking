node-response-time-tracking
=========================
This module efficiently does pretty simplistic request/response time tracking using Node.js and express

## Install
You can use either use npm install:

    npm install git+https://github.com/markdicksonjr/node-response-time-tracking.git

Or, you can add the github repository to your project's package.json file:

    "dependencies": {
        "node-response-time-tracking": "git+https://github.com/markdicksonjr/node-response-time-tracking.git",
    }

## Usage

Add this to the part of your code that initializes express:

    app.use(require('node-response-time-tracking').middleware());