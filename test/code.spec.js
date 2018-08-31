const request = require( 'supertest' );
const sleep = require( '@lvchengbin/sleep' );
const Console = require( '@lvchengbin/yolk' ).Console;
const app = require( '../src' );

app.debugging = Console.WARN | Console.ERROR;

let id = +new Date;

describe( 'generating', () => {
    it( 'should have gotten a 400 error', done => {
        request( app.listen() ).get( '/code' )
            .expect( 400 )
            .end( e => e ? done.fail( e ) : done() );    
    } );

    it( 'should have gotten a numeric code', done => {
        request( app.listen() ).get( `/code?uniqid=${id++}&charset=numeric&length=6` )
            .expect( 200 )
            .expect( res => {
                expect( /^\d+$/.test( res.body.code ) ).toBeTruthy();
            } )
            .end( e => e ? done.fail( e ) : done() ); 
    } );

    it( 'should have generated two different codes', async done => {
        const i = id++;
        const listen = app.listen();
        const url = `/code?uniqid=${i}&charset=numeric&length=6&renovate=1`;

        const res1 = await request( listen ).get( url );
        const res2 = await request( listen ).get( url );

        expect( res1.body.code === res2.body.code ).toBeFalsy();
        done();
    } );

    it( 'should have generated two same codes', async done => {
        const i = id++;
        const listen = app.listen();
        const url = `/code?uniqid=${i}&charset=numeric&length=6`;

        const res1 = await request( listen ).get( url );
        const res2 = await request( listen ).get( url );

        expect( res1.body.code ).toEqual( res2.body.code );
        done();
    } );
} );

describe( 'verification', () => {
    it( 'valid code', async done => {
        const i = id++;
        const listen = app.listen();
        const url = `/code?uniqid=${i}&charset=numeric&length=6`;
        const res1 = await request( listen ).get( url );
        request( listen ).get( `/code/verify?uniqid=${i}&code=${res1.body.code}` )
            .expect( 200 )
            .expect( { valid : 1 } )
            .end( e => e ? done.fail( e ) : done() ); 
    } );

    it( 'invalid code', async done => {
        const i = id++;
        const listen = app.listen();
        const url = `/code?uniqid=${i}&charset=numeric&length=6`;
        await request( listen ).get( url );
        request( listen ).get( `/code/verify?uniqid=${i}&code=12345` )
            .expect( 200 )
            .expect( { valid : 0 } )
            .end( e => e ? done.fail( e ) : done() ); 
    } );

    it( 'expired code', async done => {
        const i = id++;
        const listen = app.listen();
        const url = `/code?uniqid=${i}&charset=numeric&length=6&expire=1`;
        const res1 = await request( listen ).get( url );

        await sleep( 1000 );

        request( listen ).get( `/code/verify?uniqid=${i}&code=${res1.body.code}` )
            .expect( 200 )
            .expect( { valid : 0 } )
            .end( e => e ? done.fail( e ) : done() ); 
    } );
} );
