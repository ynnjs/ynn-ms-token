const is = require( '@lvchengbin/is' );
const jwt = require( 'jsonwebtoken' );

/**
 * to create a set in Redis storage for storing blacklist of JWT token.
 */

/**
 * JWT Claims
 *
 * iss (Issuer) - the principal that issued the JWT.
 * sub (Subject) - the subject of the JWT.
 * aud (Audience) - the recipients that the JWT is intended for
 * exp (Expiration) - the expiration time on or after which the JWT MUST NOT be accepted for processing.
 * nbf (Not Before) - the time before which the JWT MUST NOT be accepted for processing.
 * iat (Issued At) - the time at which the JWT was issued.
 * jti (JWT ID) - provides a unique identifier for the JWT.
 *
 */
const contractions = {
    iss : 'issuer',
    sub : 'subject',
    aud : 'audience',
    exp : 'expiresIn',
    nbf : 'notBefore',
    jti : 'jwtid'
};

module.exports = class extends require( 'ynn' ).Controller {

    /**
     * to generate a JWT with an object as payload and options.
     *
     * @get {string} secret - the secret key for the JWT, it will be used to verify the generated JWT and to get the payload back.
     * @get {string} payload - the object that will be contained into the JWT. It should be a JSON string.
     * @get {string} * - other options for generating JWT, to see the part of JWT Claims at the top of this file.
     *
     * @response {json} - {
     *      token : {string}, // the token
     * }
     */
    async indexAction() {
        const query = this.ctx.query;

        this.assert( query.secret, 400, 'secret must have a value.' );

        let payload;

        try {
            payload = JSON.parse( query.payload );
        } catch( e ) {
            this.throw( 400, 'payload must be a string which can be parsed as a JSON object.' );
        }

        /**
         * to get all options in querystring.
         */
        const options = {};
        for( let item in contractions ) {
           if( !is.undefined( query[ item ] ) ) {
               options[ contractions[ item ] ] = query[ item ];
           }
        }

        if( !options[ contractions.exp ] && !payload.exp ) {
            options[ contractions.exp ] = '1y';
        }
        const token = jwt.sign( payload, query.secret, options );
        return { token };
    }

    /**
     * to revoke a JWT
     * @post {string} token - the JWT
     * @post {string} secret - the same secret token while generating the JWT
     * @post {string} * - other option items.
     *
     * @response {json} - {
     *      decoded : {object} // the payload
     * }
     */
    async revokeAction() {
        const body = this.ctx.request.body;

        this.assert( body.token, 400, 'token must have a value.' );
        this.assert( body.secret, 400, 'secret must have a value.' );

        const options = {};
        for( let item in contractions ) {
            if( !is.undefined( body[ item ] ) ) {
                options[ contractions[ item ] ] = body[ item ];
            }
        }

        let decoded;

        try {
            decoded = jwt.verify( body.token, body.secret, options );
        } catch( e ) {
            this.throw( 400, 'invalid token.' );
        }

        try {
            const config = this.config( 'jwt.blacklist.key' );
            this.app.redis.zadd( config, decoded.exp - new Date, body.token );
        } catch( e ) {
            this.logger.error( 'failed to add JWT to blacklist', { body, error : e } );
            this.throw( 500 );
        }

        return { decoded };
    }

    /**
     * to verify a JWT.
     * @get {string} token - the JWT
     * @get {string} secret - the secret token
     * @get {string} * - other options
     *
     * @response {json} - {
     *      valid : {boolean},
     *      decoded : {object}, // the decoded data if valid is true
     *      error : {string}, // error message if valid is false
     * }
     */
    async verifyAction() {
        const query = this.ctx.query;

        this.assert( query.token, 400, 'token must have a value.' );
        this.assert( query.secret, 400, 'secret must have a value.' );

        const options = {};
        for( let item in contractions ) {
           if( !is.undefined( query[ item ] ) ) {
               options[ contractions[ item ] ] = query[ item ];
           }
        }

        let decoded;
        try {
            decoded = jwt.verify( query.token, query.secret, options ); 
        } catch( e ) {
            return { valid : 0, error : e.message };
        }

        const config = this.config( 'jwt.blacklist.key' );

        const res = await this.app.redis.zscore( config, query.token ).catch( e => {
            this.logger.error( 'failed to get data from redis', { query, error : e } );
            this.throw( 500 );
        } );

        if( res ) {
            // the jwt is found in blacklist
            return { valid : 0, error : 'revoked token.' };
        }
        return { valid : 1, decoded };
    }
}
