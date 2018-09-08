'use strict';

const Cache = require('liqd-cache');
const TimedPromise = require('liqd-timed-promise');

module.exports = class Replies
{
	constructor()
	{
		this._iterator = Math.floor( Math.random() * Number.MAX_SAFE_INTEGER );
		this._replies = new Cache();
	}

	create( callback )
	{
		return new TimedPromise(( resolve, reject, timeout ) =>
		{
			let id = ( this._iterator = ( this._iterator % Number.MAX_SAFE_INTEGER ) + 1 );

			this._replies.set( id, { resolve, reject }, timeout );

			callback( id, timeout );
		});
	}

	resolve( id, value )
	{
		let handler = this._replies.get( id );

		if( handler )
		{
			this._replies.delete( id );

			handler.resolve( value );
		}

		return Boolean( handler );
	}

	reject( id, err )
	{
		let handler = this._replies.get( id );

		if( handler )
		{
			this._replies.delete( id );

			handler.reject( err );
		}

		return Boolean( handler );
	}
}
