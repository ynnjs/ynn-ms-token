#!/usr/bin/env node

const argv = require( 'yargs' ).argv;
const Yolk = require( '@lvchengbin/yolk' );
const app = new Yolk( {
    root : __dirname,
    logDir : argv.logDir
} );

if( require.main === module ) {
    app.listen( argv.port );
}

module.exports = app;
