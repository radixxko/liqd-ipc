const child_process = require('child_process');

const cluster = child_process.fork( __dirname+'/tests/cluster.js', process.argv, { execArgv : process.execArgv, env: process.env, cwd: process.cwd() });
const worker = child_process.fork( __dirname+'/tests/worker.js', process.argv, { execArgv : process.execArgv, env: process.env, cwd: process.cwd() });
//const flow = child_process.fork( __dirname+'/tests/flow.js', process.argv, { execArgv : process.execArgv, env: process.env, cwd: process.cwd() });
