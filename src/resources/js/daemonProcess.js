var remote = require('electron').remote;
var osInfo = window.require('os');
var fs = require('fs');
var binPath = __dirname + '/bin/';
const { spawn } = require('child_process');
const dialog = remote.dialog;
var processLock = false;

remote.getGlobal('wallet').updateDaemonStatus = function() {
	if(processLock) return;
	
	processLock = true;
	$.ajax({
	url: 'http://127.0.0.1:19001/getinfo',
	method: "GET",
	dataType: 'json',
	timeout: 3000,
	success: function(data){
		remote.getGlobal('wallet').blockCount = data.height;
		remote.getGlobal('wallet').knownBlockCount = data.last_known_block_index;
		remote.getGlobal('wallet').isSyncing = data.height < data.last_known_block_index - 1 || data.last_known_block_index == 0;
		remote.getGlobal('wallet').peerCount = data.incoming_connections_count;
		remote.getGlobal('wallet').daemonStatus = data.status;
		remote.getGlobal('wallet').walletErrCount = 0;
		processLock = false;
		statusBarUpdater();
	},
    error: function(a,b,c){
		processLock = false;
		remote.getGlobal('wallet').daemonErrCount++;
		
		// We wait 12/15 secs before trying to respawn process
		if(remote.getGlobal('wallet').daemonErrCount > 30){
			// If daemon is crashed, we try to respawn it
			try{
				remote.getGlobal('wallet').killDaemon();
				
				remote.getGlobal('wallet').daemonProcess = null;
				setTimeout(function(){
					remote.getGlobal('wallet').spawnDaemon();
				}, 2000);
			}catch(e){
				console.log(e);
			}
		}
	}
  });
}

remote.getGlobal('wallet').spawnDaemon = function() {
	if(remote.getGlobal('wallet').daemonProcess != null) return;
	
	// clean LOCK file
	try{
		fs.unlinkSync(binPath + 'datadir/DB/LOCK');
	}catch(e){}
	
	console.log("Spawning Daemon...");
	remote.getGlobal('wallet').daemonProcess = spawn(binPath + 'leviarcoind', [
	  //'--db-threads', '1',
	  '--db-max-open-files', '200',
	  '--db-write-buffer-size', '512',
	  '--db-read-cache-size', '20',
	  '--data-dir', binPath + 'datadir',
	  '--log-file', binPath + 'daemon.log',
	  '--log-level', remote.getGlobal('wallet').logLevel,
	  '--no-console'
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

setInterval(function() {
  remote.getGlobal('wallet').updateDaemonStatus();
}, 10000);
