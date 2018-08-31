const rs = require( 'randomstring' );
const Yolk = require( '@lvchengbin/yolk' );

module.exports = class extends Yolk.Controller {
    /**
     * to generate a code
     * @get {string} [charset=hex] - define the character for the code. supporting: alphabetic, alphanumeric, numeric, hex
     * @get {number} [length=6] - to specify a length for the code
     * @get {string} [capitalization=lowercase] - define whether the code should be lowercase / uppercase only.
     * @get {number} [expire=600] - the lifetime of the code
     * @get {string} uniqid - the uniqid of this code
     * @get {string} [token=] - a arbitrary string that you want to bind to code, and it will be used to verify to code.
     * @get {number} [renovate=0] - to define whether to generate a new code if there is a code, also has renovate = 1, and all other options are the same.
     */
    async indexAction() {
        const ctx = this.ctx;
        const {
            length = 6,
            charset = 'hex',
            capitalization = 'lowercase',
            expire = 600,
            renovate = 0
        } = ctx.query;

        this.assert( ctx.query.uniqid, 400, 'uniqid must have a value.' );

        const key = this.key();

        const redis = this.app.redis;

        const gen = () => {
            /**
             * to generate a code and the readable would always be set to true.
             */
            const code = rs.generate( { length, charset, capitalization, readable :true } );

            redis.set( key, code, 'EX', expire );
            this.logger.info( 'generated new code', { key, code, expire } );
            return code;
        };

        if( renovate ) {
            return { code : gen() };
        } else {
            const code = await redis.get( key );
            if( code ) {
                redis.set( key, code, 'EX', expire );
                return { code };
            }
            return { code : gen() };
        }
    }

    /**
     * code verification
     *
     * @get {string} code - code for verification
     * @get {string} uniqid - the uniqid provided while generating the code
     * @get {string} [token=**] - the token if it was provided while generating the code
     * @get {number} [del=1] - defined if the code should be deleted after verifying successfully.
     */
    async verifyAction() {
        const ctx = this.ctx;
        const { code, del = 1 } = ctx.query;

        this.assert( code, 400, 'code cannot be empty' );
        this.assert( ctx.query.uniqid, 400, 'uniqid must have a value.' );

        const key = this.key();

        const c = await this.app.redis.get( key ).catch( e => {
            this.console.error( 'error while getting data from redis', e  );
            this.logger.error( `Error while getting data from redis: ${e.message}`, {
                module : this.module.moduleName,
                controller : this.controllerName,
                action : 'verifyAction',
                query : ctx.query,
                error : e
            } );
            this.throw( 500 );
        } );

        if( c !== code ) return { valid : 0 };
        if( del ) this.app.redis.del( key );

        return { valid : 1 };
    }

    /**
     * to generate the key for redis
     *
     * @return {string} - prefix + client + uniqid + token
     */
    key() {
        const ctx = this.ctx;
        const query = ctx.query;
        const prefix = this.config( 'code.prefix' );
        const client = ctx.rsc ? ctx.rsc.client : '**';
        return `${prefix}-${client}-${query.uniqid}-${query.token || '**'}`;
    }
}

