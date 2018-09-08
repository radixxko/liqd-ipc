'use strict';

module.exports = class Request
{
	constructor( ipc, request )
	{
		this._ipc = ipc;
		this._id = request.id;
		this._sent = process.hrtime();
		this._timeout = request.timeout || Infinity;

		this.data = request.request;
	}

	reply( value )
	{
		this._ipc._ipc_send({ reply: this._id, value });

		return true;
	}

	reject( error )
	{
		this._ipc._ipc_send({ reply: this._id, error });

		return true;
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
