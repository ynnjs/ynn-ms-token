const Sequence = require( '@lvchengbin/sequence' );
const app = require( '../src' );
const request = require( 'supertest' );
const jwt = require( 'jsonwebtoken' );

describe( 'JWT', () => {
    describe( 'sign', () => {
        it( 'should have gotten a 400', done => {
            request( app.listen() ).get( '/jwt?payload={}' )
                .expect( 400 )
                .end( e => e ? done.fail( e ) : done() );
        } );

        it( 'should have gotten 400 if no playload have been provided', done => {
            request( app.listen() ).get( '/jwt?secret=secret' )
                .expect( 400 )
                .end( e => e ? done.fail( e ) : done() );
        } );

        it( 'basic JWT', done => {
            request( app.listen() ).get( '/jwt?payload={}&secret=secret' )
                .expect( 200 )
                .expect( res => {
                    const decoded = jwt.verify( res.body.token, 'secret' );
                    expect( decoded.hasOwnProperty( 'iat' ) ).toBeTruthy();
                } )
                .end( e => e ? done.fail( e ) : done() );
        } );

        it( 'JWT with specified expires time', done => {
            request( app.listen() ).get( '/jwt?payload={}&secret=secret&exp=1d' )
                .expect( 200 )
                .expect( res => {
                    const decoded = jwt.verify( res.body.token, 'secret' );
                    expect( decoded ).toBeTruthy();
                } )
                .end( e => e ? done.fail( e ) : done() );
        } );

        it( 'expired JWT', done => {
            request( app.listen() ).get( '/jwt?payload={}&secret=secret&exp=1' )
                .expect( 200 )
                .expect( res => {
                    jwt.verify( res.body.token, 'secret', err => {
                        expect( err.name ).toEqual( 'TokenExpiredError' );
                    } );
                } )
                .end( e => e ? done.fail( e ) : done() );
        } );

        it( 'set expires time in payload', done => {
            const payload = JSON.stringify( { exp : 1 } );

            request( app.listen() ).get( `/jwt?payload=${payload}&secret=secret` )
                .expect( 200 )
                .expect( res => {
                    jwt.verify( res.body.token, 'secret', err => {
                        expect( err.name ).toEqual( 'TokenExpiredError' );
                    } );
                } )
                .end( e => e ? done.fail( e ) : done() );
        } );

        it( 'payload', done => {
            const payload = JSON.stringify( {
                name : 'jwt',
                data : { x : 1 }
            } ); 

            request( app.listen() ).get( `/jwt?payload=${payload}&secret=secret` )
                .expect( 200 )
                .expect( res => {
                    const decoded = jwt.verify( res.body.token, 'secret' );
                    expect( decoded.name ).toEqual( 'jwt' );
                    expect( decoded.data ).toEqual( { x : 1 } );
                } )
                .end( e => e ? done.fail( e ) : done() );
        } );
    } );

    describe( 'verify', () => {
        it( 'should have gotten a 400 for empty token', done => {
            request( app.listen() ).get( '/jwt/verify' )
                .expect( 400 )
                .end( e => e ? done.fail( e ) : done() );
        } );

        it( 'should have gotten a 400 because of empty secret', done => {
            request( app.listen() ).get( '/jwt/verify?token=x' )
                .expect( 400 )
                .end( e => e ? done.fail( e ) : done() );
        } );

        it( 'valid token', done => {
            const listen = app.listen();

            Sequence.all( [
                () => request( listen ).get( '/jwt?payload={"a":1}&secret=secret' ),
                res => request( listen ).get( `/jwt/verify?token=${res.value.body.token}&secret=secret` ),
                res => {
                    const body = res.value.body;
                    expect( body.valid ).toEqual( 1 );
                    expect( body.decoded.a ).toEqual( 1 );
                    done();
                }
            ] );
        } );

        it( 'invalid token', done => {
            const listen = app.listen();

            Sequence.all( [
                () => request( listen ).get( '/jwt?payload={"a":1}&secret=secret' ),
                res => request( listen ).get( `/jwt/verify?token=${res.value.body.token}xx&secret=secret` ),
                res => {
                    const body = res.value.body;
                    expect( body.valid ).toEqual( 0 );
                    done();
                }
            ] );
        } );
    } );

    describe( 'revoke', () => {
        it( 'to revoke a token', done => {
            const listen = app.listen();

            Sequence.all( [
                () => request( listen ).get( '/jwt?payload={"a":1}&secret=secret&exp=1000' ),
                res => {
                    return request( listen ).post( '/jwt/revoke' )
                        .send( {
                            token : res.value.body.token,
                            secret : 'secret'
                        } ).then( () => res.value.body.token );
                },
                res => request( listen ).get( `/jwt/verify?token=${res.value}&secret=secret` ),
                res => {
                    const body = res.value.body;
                    expect( body.valid ).toEqual( 0 );
                    expect( body.error ).toEqual( 'revoked token.' );
                    done();
                }
            ] );
            
        } );

        it( 'invalid token', done => {
            const listen = app.listen();

            Sequence.all( [
                () => request( listen ).get( '/jwt?payload={"a":1}&secret=secret&exp=1000' ),
                res => {
                    return request( listen ).post( '/jwt/revoke' )
                        .send( {
                            token : res.value.body.token + 'abc',
                            secret : 'secret'
                        } );
                },
                res => {
                    const value = res.value;
                    expect( value.statusCode ).toEqual( 400 );
                    expect( value.text ).toEqual( 'invalid token.' );
                    done();
                }
            ] );
        } );
    } );
} );
