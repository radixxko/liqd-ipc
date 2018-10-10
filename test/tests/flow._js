'use strict';

const assert = require('assert');

const IPC = require('../../lib/ipc');
const Flow = require('liqd-flow');

const child = require('child_process').fork( __dirname+'/flow_child.js', process.argv, { execArgv : process.execArgv, env: process.env, cwd: process.cwd() });

child.ipc = new IPC( child );

Flow.start(() =>
{
	child.ipc.send({ test: 'test' }).then( v =>
	{
		console.log('Reply', Flow.scope());
	});
},
{
	flow: 'test'
});
