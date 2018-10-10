'use strict';

//const Flow = require('liqd-flow');
const Listeners = require('./listeners');
const Replies = require('./replies');
const Request = require('./request');
const Message = require('./message');

module.exports = class IPC
{
	constructor( port )
	{
		this._port = port;
		this._listeners = new Listeners();
		this._replies = new Replies();

		port.on( 'message', msg =>
		{
			if( msg.__liqd_ipc )
			{
				if( msg.__liqd_ipc.hasOwnProperty('reply') )
				{
					/*if( msg.__liqd_ipc.flow )
					{
						const Flow = require('liqd-flow');

						Flow.start(() =>
						{
							for( let key in msg.__liqd_ipc.flow )
							{
								Flow.set( key, msg.__liqd_ipc.flow[key].value, msg.__liqd_ipc.flow[key].frozen );
							}

							this._replies.resolve( msg.__liqd_ipc.reply, msg.__liqd_ipc );
						});
					}
					else */if( msg.__liqd_ipc.hasOwnProperty('error') )
					{
						this._replies.reject( msg.__liqd_ipc.reply, msg.__liqd_ipc.error );
					}
					else
					{
						this._replies.resolve( msg.__liqd_ipc.reply, msg.__liqd_ipc );
					}
				}
				else if( msg.__liqd_ipc.hasOwnProperty('request') )
				{
					const topic = msg.__liqd_ipc.topic, request = new Request( this, msg.__liqd_ipc );

					for( let listener of this._listeners.get( 'request', topic ))
					{
						if( listener( request ) !== false ){ return; }
					}

					request.reject( 'IPC_UNHANDLED_CALL' );
				}
				else if( msg.__liqd_ipc.hasOwnProperty('message') )
				{
					const listeners = this._listeners.get( 'message', msg.__liqd_ipc.topic ), message = new Message( this, msg.__liqd_ipc );

					if( listeners )
					{
						/*if( msg.__liqd_ipc.flow )
						{
							const Flow = require('liqd-flow');

							Flow.start(() =>
							{
								for( let key in msg.__liqd_ipc.flow )
								{
									Flow.set( key, msg.__liqd_ipc.flow[key].value, msg.__liqd_ipc.flow[key].frozen );
								}

								for( let listener of listeners )
								{
									if( listener( message ) !== false ){ return; }
								}
							});
						}
						else */for( let listener of listeners )
						{
							if( listener( message ) !== false ){ return; }
						}
					}

					message.reject( 'IPC_UNHANDLED_MESSAGE' );
				}
				else if( msg.__liqd_ipc.hasOwnProperty('event') )
				{
					const { event, data } = msg.__liqd_ipc;

					for( let listener of this._listeners.get( 'event', event ))
					{
						listener( data );
					}
				}
			}
		});

		port.on( 'exit', () =>
		{
			this._listeners = null;
		});
	}

	_ipc_send( msg )
	{
		/*if( LIQD_FLOW && LIQD_FLOW.started )
		{
			msg.flow = LIQD_FLOW.scope();
		}*/

		this._port.postMessage ? this._port.postMessage({ __liqd_ipc: msg }) : this._port.send({ __liqd_ipc: msg });
	}

	_ipc_call( req )
	{
		return this._replies.create(( id, timeout ) =>
		{
			req.id = id;
			req.timeout = timeout;

			this._ipc_send( req );
		});
	}

	_register( channel, topic, listener )
	{
		if( listener === undefined ){[ topic, listener ] = [ null, topic ]}

		this._listeners.add( channel, topic, listener );
	}

	_unregister( channel, topic, listener )
	{
		if( listener === undefined ){[ topic, listener ] = [ null, topic ]}

		this._listeners.remove( channel, topic, listener );
	}

	on( event, listener )
	{
		this._register( 'event', event, listener );
	}

	off( event, listener )
	{
		this._unregister( 'event', event, listener );
	}

	emit( event, data )
	{
		this._ipc_send({ event, data });
	}

	reply( topic, listener )
	{
		this._register( 'request', topic, listener );
	}

	noreply( topic, listener )
	{
		this._unregister( 'request', topic, listener );
	}

	call( topic, request )
	{
		if( request === undefined ){[ topic, request ] = [ null, topic ]}

		return this._ipc_call({ topic, request }).then( r => r.value );
	}

	listen( topic, listener )
	{
		this._register( 'message', topic, listener );
	}

	ignore( topic, listener )
	{
		this._unregister( 'message', topic, listener );
	}

	send( topic, message )
	{
		if( message === undefined ){[ topic, message ] = [ null, topic ]}

		return this._ipc_call({ topic, message }).then( r => new Message( this, r ));
	}
}
