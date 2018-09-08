'use strict';

const cluster = require('cluster');
const assert = require('assert');

const IPC = require('../lib/ipc');

const checks = [ 'ipc_created', 'empty_event', 'reply_topic_skip', 'message_topic_skip', 'ipc_reply', 'ipc_reply_timeouted', 'ipc_reply_topic', 'ipc_reply_unhandled', 'send', 'send_topic', 'send_topic_unhandled', 'rejected_message' ];

function registerIPCListeners( pid, ipc, data )
{
	let ipc_created_listener, empty_event_listener, ipc_reply_listener, ipc_reply_topic_listener, ipc_message_listener, ipc_message_topic_listener;

	ipc.on( 'ipc_created', ipc_created_listener = ( event ) =>
	{
		data.ipc_created = ( event === 'ipc_created:'+pid );

		ipc.off( 'ipc_created2', ipc_created_listener );
		ipc.off( 'ipc_created', ipc_created_listener );
		ipc.off( 'ipc_created', ipc_created_listener );
		ipc.off( 'ipc_created2', ipc_created_listener );
	});

	ipc.on( 'empty_event', empty_event_listener = ( event ) =>
	{
		data.empty_event = !Boolean( event );

		ipc.off( 'empty_event', empty_event_listener );
	});

	ipc.reply( ipc_reply_listener = ( request ) =>
	{
		if( request.data !== 'ipc_reply_timeouted' )
		{
			assert.equal( request.remaining(), Infinity );

			request.reply( 'ipc_replied:'+pid );
			request.reply( 'ipc_replied:'+pid );
		}
		else if( request.data !== 'ipc_reply' )
		{
			assert.ok( request.remaining() <= 1000 );

			ipc.noreply( ipc_reply_listener );
			ipc.noreply( ipc_reply_listener );
		}
	});

	ipc.reply( 'ipc_reply_topic', ipc_reply_topic_listener = ( request ) =>
	{
		assert.ok( request.remaining() <= 2000 );

		request.reply( 'ipc_replied_topic:'+pid );
		request.reply( 'ipc_replied_topic:'+pid );

		ipc.noreply( 'ipc_reply_topic', ipc_reply_topic_listener );
		ipc.noreply( 'ipc_reply_topic', ipc_reply_topic_listener );
	});

	ipc.reply( 'ipc_reply_topic_skip', ( request ) => false );
	ipc.reply( 'ipc_reply_topic_skip', ( request ) =>
	{
		data.reply_topic_skip = true;
		request.reply( 'ipc_reply_topic_skipped:'+pid );
	});
	ipc.reply( 'ipc_reply_topic_skip', ( request ) => ( data.reply_topic_skip = false ));

	ipc.listen( ipc_message_listener = async( message ) =>
	{
		assert.equal( message.remaining(), Infinity );

		while( message.data < 1000 )
		{
			assert.ok( message.data % 2 === 0 );

			message = await message.reply( message.data + 1 ).timeout(2000);

			assert.ok( message.remaining() <= 2000 );
		}

		assert.ok( message.reply( message.data + 1, true ) === true );

		ipc.ignore( ipc_message_listener );
		ipc.ignore( ipc_message_listener );
	});

	ipc.listen( 'message_topic', ipc_message_topic_listener = async( message ) =>
	{
		assert.ok( message.remaining() <= 2000 );

		while( message.data < 1000 )
		{
			assert.ok( message.data % 2 === 1 );

			message = await message.reply( message.data + 1 ).timeout(2000);

			assert.equal( message.remaining(), Infinity );
		}

		assert.ok( message.reply( message.data + 1, true ) === true );

		ipc.ignore( ipc_message_topic_listener );
		ipc.ignore( ipc_message_topic_listener );
	});

	ipc.listen( 'message_topic_skip', ( message ) => false );
	ipc.listen( 'message_topic_skip', ( message ) =>
	{
		data.message_topic_skip = true;
		message.reply( 'ipc_message_topic_skipped:'+pid, true );
		message.reject( 'rejected' );
	});
	ipc.listen( 'message_topic_skip', ( message ) => ( data.message_topic_skip = false ));

	ipc.listen( 'rejected_message', ( message ) => message.reject( 'REJECTED' ));
}

if( cluster.isMaster )
{
	const workers = [], data = new Map(); let worker, worker_data;

	for( let i = 0; i < 3; ++i )
	{
		workers.push( worker = cluster.fork() );
		worker.ipc = new IPC( worker );

		data.set( worker, worker_data = {});

		registerIPCListeners( worker.process.pid, worker.ipc, worker_data );

		worker.send( 'unknown_message' );
	}

	describe( 'Cluster Master', ( done ) =>
	{
		it('should emit events', () =>
		{
			for( let worker of workers )
			{
				worker.ipc.emit( 'ipc_created', 'ipc_created:'+worker.process.pid );
				worker.ipc.emit( 'ipc_created2', 'ipc_created2:'+worker.process.pid );
				worker.ipc.emit( 'empty_event' );
			}
		});

		it('should call listeners', () =>
		{
			for( let worker of workers )
			{
				worker.ipc.call( 'ipc_reply' ).then( r => data.get(worker).ipc_reply = ( 'ipc_replied:'+worker.process.pid ));
				worker.ipc.call( 'ipc_reply_timeouted' ).timeout(1000, 'IPC_TIMEOUTED').catch( e => data.get(worker).ipc_reply_timeouted = ( e === 'IPC_TIMEOUTED' ));
				worker.ipc.call( 'ipc_reply_topic', 'ipc_reply_topic_data' ).timeout(2000).then( r => data.get(worker).ipc_reply_topic = ( r === 'ipc_replied_topic:'+worker.process.pid ));
				worker.ipc.call( 'ipc_reply_unhandled', null ).catch( e => data.get(worker).ipc_reply_unhandled = ( e === 'IPC_UNHANDELED_CALL' ));
				worker.ipc.call( 'ipc_reply_topic_skip', null ).then( r => data.get(worker).ipc_reply = ( r === 'ipc_reply_topic_skipped:'+worker.process.pid ));
			}
		});

		it('should send messages', () =>
		{
			for( let worker of workers )
			{
				worker.ipc.send( 0 ).then( async reply =>
				{
					while( reply.data < 1000 )
					{
						assert.ok( reply.remaining() <= 2000 );
						assert.ok( reply.data % 2 === 1 );

						reply = await reply.reply( reply.data + 1 ).timeout(2000);
					}

					assert.ok( reply.reply( reply.data + 1, true ) === true );

					data.get(worker).send = ( reply.data >= 1000 );
				});

				worker.ipc.send( 'message_topic', 1 ).timeout(2000).then( async reply =>
				{
					while( reply.data < 1000 )
					{
						assert.ok( reply.remaining() <= 2000 );
						assert.ok( reply.data % 2 === 0 );

						reply = await reply.reply( reply.data + 1 );
					}

					assert.ok( reply.reply( reply.data + 1, true ) === true );

					data.get(worker).send_topic = ( reply.data >= 1000 );
				});

				worker.ipc.send( 'message_topic__unhandled', 1 ).catch( e => data.get(worker).send_topic_unhandled = ( e === 'IPC_UNHANDELED_MESSAGE' ) );

				worker.ipc.send( 'message_topic_skip', 1 ).timeout(2000).then( reply =>
				{
					assert.ok( reply.data === 'ipc_message_topic_skipped:'+worker.process.pid );
				});

				worker.ipc.send( 'rejected_message', null ).catch( e => data.get(worker).rejected_message = ( e === 'REJECTED' ));
			}
		});

		it('should be ok', ( done ) =>
		{
			setTimeout(() =>
			{
				for( let worker of workers )
				{
					const worker_data = data.get(worker);

					for( let check of checks )
					{
						assert.ok( worker_data[check] );
					}
				}

				done();

				setTimeout( process.exit, 1000 );
			},
			15000 );
		})
		.timeout(30000);
	});
}
else
{
	let ipc = new IPC( process ), data = {};

	registerIPCListeners( process.pid, ipc, data );

	process.send( 'unknown_message' );

	describe( 'Cluster Child', ( done ) =>
	{
		it('should emit events', () =>
		{
			ipc.emit( 'ipc_created', 'ipc_created:'+process.pid );
			ipc.emit( 'ipc_created2', 'ipc_created2:'+process.pid );
			ipc.emit( 'empty_event' );
		});

		it('should call listeners', () =>
		{
			ipc.call( 'ipc_reply' ).then( r => data.ipc_reply = ( 'ipc_replied:'+process.pid ));
			ipc.call( 'ipc_reply_timeouted' ).timeout(1000, 'IPC_TIMEOUTED').catch( e => data.ipc_reply_timeouted = ( e === 'IPC_TIMEOUTED' ));
			ipc.call( 'ipc_reply_topic', 'ipc_reply_topic_data' ).timeout(2000).then( r => data.ipc_reply_topic = ( r === 'ipc_replied_topic:'+process.pid ));
			ipc.call( 'ipc_reply_unhandled', null ).catch( e => data.ipc_reply_unhandled = ( e === 'IPC_UNHANDELED_CALL' ));
			ipc.call( 'ipc_reply_topic_skip', null ).then( r => data.ipc_reply = ( r === 'ipc_reply_topic_skipped:'+process.pid ));
		});

		it('should send messages', () =>
		{
			ipc.send( 0 ).then( async reply =>
			{
				while( reply.data < 1000 )
				{
					assert.ok( reply.remaining() <= 2000 );
					assert.ok( reply.data % 2 === 1 );

					reply = await reply.reply( reply.data + 1 ).timeout(2000);
				}

				assert.ok( reply.reply( reply.data + 1, true ) === true );

				data.send = ( reply.data >= 1000 );
			});

			ipc.send( 'message_topic', 1 ).timeout(2000).then( async reply =>
			{
				while( reply.data < 1000 )
				{
					assert.ok( reply.remaining() <= 2000 );
					assert.ok( reply.data % 2 === 0 );

					reply = await reply.reply( reply.data + 1 );
				}

				assert.ok( reply.reply( reply.data + 1, true ) === true );

				data.send_topic= ( reply.data >= 1000 );
			});

			ipc.send( 'message_topic__unhandled', 1 ).catch( e => data.send_topic_unhandled = ( e === 'IPC_UNHANDELED_MESSAGE' ) );

			ipc.send( 'message_topic_skip', 1 ).timeout(2000).then( reply =>
			{
				assert.ok( reply.data === 'ipc_message_topic_skipped:'+process.pid );
			});

			ipc.send( 'rejected_message', null ).catch( e => data.rejected_message = ( e === 'REJECTED' ));
		});

		it('should be ok', ( done ) =>
		{
			setTimeout(() =>
			{
				for( let check of checks )
				{
					assert.ok( data[check] );
				}

				done();
			},
			10000 );
		})
		.timeout(30000);
	});
}
