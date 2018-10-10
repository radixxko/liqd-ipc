'use strict';

const assert = require('assert');

const IPC = require('../../lib/ipc');
const Flow = require('liqd-flow');

const ipc = new IPC( process );

ipc.listen( ( message ) =>
{
	console.log( 'child', message.data, Flow.scope() );

	Flow.set('child', true);

	message.reply('test', false);
})
