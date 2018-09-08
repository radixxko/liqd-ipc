'use strict';

const Request = require('./request');

const Message = module.exports = class Message extends Request
{
	constructor( ipc, message )
	{
		super( ipc, message );

		this.data = message.message;
	}

	reply( message, last = false )
	{
		if( last )
		{
			this._ipc._ipc_send({ reply: this._id, message });

			return true;
		}
		else
		{
			return this._ipc._ipc_call({ reply: this._id, message }).then( r => new Message( this._ipc, r ));
		}
	}

	remaining()
	{
		if( this._timeout !== Infinity )
		{
			const elapsed = process.hrtime( this._sent );

			return Math.max( 0, this._timeout - Math.ceil( elapsed[0]*1e3 + elapsed[1]/1e6 ));
		}
		else{ return Infinity; }
	}
}
