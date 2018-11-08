#!/usr/bin/env node

const Ynn = require( 'ynn' );
const app = new Ynn( {
    root : __dirname
} );

module.parent || app.listen( Ynn.cargs.port );
module.exports = app;
