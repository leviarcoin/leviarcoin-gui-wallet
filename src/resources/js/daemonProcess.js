var remote = require('electron').remote;
var osInfo = window.require('os');
var fs = require('fs');
var binPath = __dirname + '/bin/';
const { spawn } = require('child_process');
const dialog = remote.dialog;
const chokidar = require('chokidar');
const https = require('https');
var processLock = false;

remote.getGlobal('wallet').spawnDaemon = function() {
	if(remote.getGlobal('wallet').daemonProcess != null) return;
	
	// clean LOCK file
	try{
		fs.unlinkSync(binPath + 'datadir/DB/LOCK');
	}catch(e){}
	
	console.log("Spawning Daemon...");
	remote.getGlobal('wallet').daemonProcess = spawn(binPath + 'leviarcoind', [
	  //'--db-max-open-files', '200',
	  //'--db-write-buffer-size', '512',
	  //'--db-read-cache-size', '20',
	  '--p2p-bind-ip', '127.0.0.1',
	  '--data-dir', binPath + 'datadir',
	  '--log-file', binPath + 'datadir/daemon.log',
	  '--log-level', '0',
	  '--add-priority-node', '46.101.28.201',
	  '--no-console',
	  '--gui-helpers'
	]);
	remote.getGlobal('wallet').daemonErrCount = 0;
}

remote.getGlobal('wallet').killDaemon = function() {
	if(remote.getGlobal('wallet').daemonProcess == null) return;
	
	if(osInfo.platform().substring(0, 3) == 'win') {
		spawn('taskkill', ['/F', '/PID', remote.getGlobal('wallet').daemonProcess.pid]);
	} else {
		spawn('kill', ['-9', remote.getGlobal('wallet').daemonProcess.pid]);
	}
}

console.log('Starting daemon...');
remote.getGlobal('wallet').spawnDaemon();

var watcher = chokidar.watch('file', {
  ignored: /[\/\\]\./, persistent: true
});

watcher.add(binPath + 'datadir/STATUS');
watcher.on('change', function(path, stats) {
	//console.log(stats);
	if (stats.size == 0) return;
	fs.readFile(path, 'utf8', function(err, contents) {
		var daemonData = contents.split('|');
		if (daemonData[0] !== undefined &&
			daemonData[1] !== undefined &&
			daemonData[2] !== undefined) {
			remote.getGlobal('wallet').blockCount = daemonData[1];
			remote.getGlobal('wallet').knownBlockCount = daemonData[0];
			remote.getGlobal('wallet').isSyncing = daemonData[1] < daemonData[0] - 1 || daemonData[0] == 0;
			remote.getGlobal('wallet').peerCount = daemonData[2];
			remote.getGlobal('wallet').daemonStatus = "OK";
			remote.getGlobal('wallet').walletErrCount = 0;
			statusBarUpdater();
		}
	});
});
