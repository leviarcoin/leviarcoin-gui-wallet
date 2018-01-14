var remote = require('electron').remote;
var fs = require('fs');
var osInfo = window.require('os');
var binPath = __dirname + '/bin/';
var filepath = "address.dat";
var cryptography = require('crypto');

fs.readFile(filepath, 'utf8', function (err, data) {
	if (err) {
		console.log("Error loading wallet. Create new one?");
		
		// Reset vars
		remote.getGlobal('wallet').applicationLoad = true;
		remote.getGlobal('wallet').applicationInit = true;
		remote.getGlobal('wallet').address = '';
		remote.getGlobal('wallet').walletName = 'wallet';
		remote.getGlobal('wallet').walletPassword = null;
		remote.getGlobal('wallet').balance = 0;
		remote.getGlobal('wallet').locked = 0;
		remote.getGlobal('wallet').transactions = {};
		return;
	}
	var walletObj = JSON.parse(data);
	try {
		if (walletObj.walletName != null && walletObj.walletName != '') {
			remote.getGlobal('wallet').walletName = walletObj.walletName;
			
			// clean files
			try{
				fs.unlinkSync(binPath + walletObj.walletName + '.txcast');
				fs.unlinkSync(binPath + walletObj.walletName + '.txresult');
				fs.unlinkSync(binPath + walletObj.walletName + '.reset');
				fs.unlinkSync(binPath + walletObj.walletName + '.reset_');
				fs.unlinkSync(binPath + walletObj.walletName + '.save');
				fs.unlinkSync(binPath + walletObj.walletName + '.save_');
			}catch(e) {}
		}
		if (walletObj.walletHasPassword && walletObj.walletPasswordSaved){
			remote.getGlobal('wallet').walletPassword =  remote.getGlobal('wallet').decrypt(walletObj.walletPassword);
			console.log(remote.getGlobal('wallet').walletPassword);
			remote.getGlobal('wallet').applicationLoad = false;
			remote.getGlobal('wallet').applicationInit = false;
		}else if(!walletObj.walletHasPassword){
			remote.getGlobal('wallet').walletPassword = null;
			
			remote.getGlobal('wallet').applicationLoad = false;
			remote.getGlobal('wallet').applicationInit = false;
		}else{
			remote.getGlobal('wallet').askPassword = true;
		}
	} catch(e) {
		return;
	}
	console.log("Wallet settings loaded.");
});

var watcherTxResult = null;
var txResultAnswer = function(path, stats, tx) {
	if (stats.size == 0) return;
	var content = fs.readFileSync(path, "utf8");
	var win = remote.getCurrentWindow();
	var result = content.toString().toLowerCase();
	switch (result){
		case "parse error":
		case "can't send money":
		case "unknown error": {
			dialog.showMessageBox(win, {
				type: 'error',
				title: "Send",
				message: "Error! " + content,
				buttons: ["OK"]
			});
			break;
		}
		default:{
			if(content.length == 64){
				var txHash = content;
				tx.transactionHash = txHash;
				// success with hash
				var status = '<span class="green icon icon-help"></span>',
					htmlTbody = '';
				htmlTbody += '<tr><td>' + status + '</td><td>' + tx.fDate + '</td><td>' + tx.transactionHash.substring(0, 48).toUpperCase() + '...</td><td>' + tx.amount + '</td></tr>';
				$("#txs-table-body").prepend(htmlTbody);
				
				htmlTbody = '<tr><td>' + tx.fDate + '</td><td>' + tx.transactionHash.substring(0, 36).toUpperCase() + '...</td><td>' + tx.amount + '</td></tr>';
				if($("#lastTxs-table-body tr").length >= 6) $("#lastTxs-table-body tr").last().remove();
				$("#lastTxs-table-body").prepend(htmlTbody);
				
				dialog.showMessageBox(win, {
					type: 'info',
					title: 'Send',
					message: "Transaction correctly sent!",
					detail: "You sent " + tx.amount + " XLC (Incl. fee: " + tx.fee + " XLC). Transaction details will appear soon in your Transactions.",
					buttons: ["OK"]
				});
				$("#form-qs-1, #form-qs-2, #form-s-1, #form-s-2, #form-s-addressbook").val('');
				$("#form-qs-3, #form-s-3").val(0);
				$("#form-s-5").val(1);
			}else{
				// throw other error
				dialog.showMessageBox(win, {
					type: 'error',
					title: "Send",
					message: "Error! " + content,
					buttons: ["OK"]
				});
			}
			break;
		}
	}
	// remove file
	watcherTxResult.close();
	watcherTxResult = null;
	fs.unlinkSync(binPath + remote.getGlobal('wallet').walletName + '.txresult');
}

remote.getGlobal('wallet').sendTransaction = function(address, paymentId, amount, mixin, fee) {
	if(!confirm("Are you sure to send this transaction?")) return false;

	try{
		fs.unlinkSync(binPath + remote.getGlobal('wallet').walletName + '.txresult');
	}catch(e){}

	if(paymentId == null) paymentId = '';
	if(mixin == null || mixin == '') mixin = 0;
	if(fee == null) fee = 0.01;

	// now fixed at 0.01 XLC
	fee = 0.01;
	
	var win = remote.getCurrentWindow();
	
	var balance = remote.getGlobal('wallet').balance;
	if((parseFloat(amount) + parseFloat(fee)) > parseFloat(balance)) {
		dialog.showMessageBox(win, {
			type: 'error',
			title: "Send",
			message: "Not enough money",
			message: "Maximum amount allowed: " + (balance-fee) + " (Incl. fee " + fee + " XLC)",
			buttons: ["OK"]
		});
		return;
	}
	
	var txCastFile = binPath + remote.getGlobal('wallet').walletName + '.txcast';
	fee = parseFloat(fee);
	
	var txString = mixin + '|' + address + '|' + amount + '|' + paymentId + '|' + fee;
	
	fs.writeFileSync(txCastFile, txString);
	
	var date = new Date(),
		day = "0" + date.getDate(),
		month = "0" + (date.getMonth()+1),
		year = date.getFullYear(),
		hours = "0" + date.getHours(),
		minutes = "0" + date.getMinutes(),
		seconds = "0" + date.getSeconds(),
		fDate = year + '-' + month.substr(-2) + '-' + day.substr(-2) + ' ' + hours.substr(-2) + ':' + minutes.substr(-2) + ':' + seconds.substr(-2),
		tx = {
			output: true,
			fDate: fDate,
			amount: ((amount * -1)-(fee)),
			transactionHash: '',
			fee: (fee)
		};
	
	// start watcher
	watcherTxResult = chokidar.watch('file', {
	  ignored: /[\/\\]\./,
	  persistent: true,
	  ignoreInitial: false
	});
	watcherTxResult.add(binPath + remote.getGlobal('wallet').walletName + '.txresult');
	watcherTxResult.on('add', function(path, stats) {
		txResultAnswer(path, stats, tx);
	});
}

remote.getGlobal('wallet').resetWallet = function() {
	// create Reset file
	
	try{
		// Clean store file
		fs.unlinkFileSync(binPath + remote.getGlobal('wallet').walletName + '.reset_');
	}catch(e){}
	
	try{
		// Create store file
		fs.writeFileSync(binPath + remote.getGlobal('wallet').walletName + '.reset', "");
	}catch(e){}
	return;
}

remote.getGlobal('wallet').updateWalletData = function() {
	
}

remote.getGlobal('wallet').storeWalletData = function() {
	// Wait daemon and sync tx
	var knownBlockCount = remote.getGlobal('wallet').knownBlockCount;
	if(knownBlockCount <= 1) return;
	
	try{
		// Clean store file
		fs.unlinkFileSync(binPath + remote.getGlobal('wallet').walletName + '.save_');
	}catch(e){}
	
	try{
		// Create store file
		fs.writeFileSync(binPath + remote.getGlobal('wallet').walletName + '.save', "");
	}catch(e){}
}

remote.getGlobal('wallet').spawnWallet = function(isImport) {
	if(isImport == undefined || isImport == null) isImport = false;
	if(remote.getGlobal('wallet').walletProcess !== null) return;
	
	var tempFile = false,
		tempFileName = '';
	
	fs.readdirSync(binPath).forEach(file => {
		var len = remote.getGlobal('wallet').walletName.length + 11;
		if (file.substr(0, len) == remote.getGlobal('wallet').walletName + ".wallet.tmp") {
			tempFileName = file;
			tempFile = true;
		}
	});
	
	try{
		var stats = fs.statSync(binPath + remote.getGlobal('wallet').walletName + ".wallet");
		if(stats != undefined && stats != null) {
			if(tempFile && stats.size == 0) {
				// delete broken and restore temp
				fs.unlinkSync(binPath + remote.getGlobal('wallet').walletName + ".wallet");
				fs.renameSync(binPath + tempFileName, binPath + remote.getGlobal('wallet').walletName + ".wallet");
				console.log("Restored wallet from .tmp");
			}
		}
	}catch(e){}
	
	// clean log file
	try{
		fs.unlinkSync(binPath + 'simplewallet.log');
	}catch(e){}
	
	var pwd = remote.getGlobal('wallet').walletPassword;
	remote.getGlobal('wallet').walletProcess = spawn(binPath + 'simplewallet', [
		'--set_log', '4',
		(isImport==true ? '--gui-import' : ''),
		'--gui-helpers',
		'--rpc-bind-ip', '127.0.0.1',
		'--rpc-bind-port', '19003',
		'--daemon-address', '127.0.0.1:19001',
		'--wallet-file', binPath + remote.getGlobal('wallet').walletName,
		'--password', (pwd != null ? pwd : '')
	]);
	
	$("#ask-pwd-wallet").fadeOut(500, function(){
		$(".unlock-wal-pw").show(0);
		$("#unlock-loading").hide(0);
		$("#form-init-ask-1").val('');
	});
	
	setTimeout(function() {
		fs.readFile(binPath + 'simplewallet.log', 'utf8', function (err, data) {
			try{
				var result = data.toLowerCase().search('check password');
				if(result > 0) {
					remote.getGlobal('wallet').killWallet();
					remote.getGlobal('wallet').walletProcessStarted = false;
					remote.getGlobal('wallet').walletProcess = null;
					
					//password wrong / or wallet error
					var win = remote.getCurrentWindow();
					dialog.showMessageBox(win, {
						type: 'error',
						title: "Check wallet",
						message: "There was an error loading wallet. Check your password.",
						buttons: ["OK"]
					});
					
					//remote.getGlobal('wallet').newWallet(false);
					remote.getGlobal('wallet').applicationLoad = true;
					remote.getGlobal('wallet').applicationInit = true;
					remote.getGlobal('wallet').askPassword = true;
					updateInterface();
				}
			}catch(e){}
		});
	}, 5000);
}

remote.getGlobal('wallet').killWallet = function() {
	// todo clean kill
	if(remote.getGlobal('wallet').walletProcess != null) {
		if(osInfo.platform().substring(0, 3) == 'win') {
			spawn('taskkill', ['/F', '/PID', remote.getGlobal('wallet').walletProcess.pid]);
		} else {
			spawn('kill', ['-9', remote.getGlobal('wallet').walletProcess.pid]);
		}
	}
	// clean log file
	try{
		fs.unlinkSync(binPath + 'simplewallet.log');
	}catch(e){}
}

function readBalance(path) {
	fs.readFile(path, 'utf8', function(err, contents) {
		if(err) return;
		try{
			var balance = contents.split('|');
			if (balance[0] !== undefined &&
				balance[1] !== undefined) {
				remote.getGlobal('wallet').balance = parseFloat(balance[0]);
				remote.getGlobal('wallet').locked = parseFloat(balance[1]);
				balanceUpdater();
			}
		} catch (e) {
			console.log('Error balance fetching');
		}
	});
}

function txsToFile(txs) {
	var content = "";
	for(var t in txs){
		var tx = txs[t];
		var line = null;
		try{
			line =  tx.fDate+'|'+
					tx.transactionHash+'|'+
					tx.amount+'|'+
					tx.fee+'|'+
					tx.height+'|'+
					tx.unlockTime;
			if (tx.paymentId != null && tx.paymentId != '') line += '|'+tx.paymentId;
		}catch(e){}
		if (line != null) content += (line+"\n");
	}
	return content;
}

function readTxs(path) {
	if(remote.getGlobal('wallet').closingApp) return;
	var fullTxsData = [];
	// 1st live
	fs.readFile(path, 'utf8', function(err, contents) {
		if(err) return;
		try {
			var txsArr = [];
			var txs = contents.split("\n");
			if (txs.length > 0) {
				for(var t in txs) {
					var tx = txs[t];
					if(tx == '') continue;
					var txData = tx.split('|'),
						hash = txData[1];
					var txSave = {
						transactionHash: hash,
						fDate: txData[0],
						amount: parseFloat(txData[2]),
						fee: parseFloat(txData[3]),
						height: parseInt(txData[4]),
						unlockTime: parseInt(txData[5]),
						extra: '',
						paymentId: ''
					};
					if(txData.length > 6) txSave.paymentId = txData[6];
					txsArr.push(txSave);
				}
				fullTxsData = txsArr;
			}
			
			if(!fs.existsSync(path + "f") && fullTxsData.length > 0){
				var content = txsToFile(fullTxsData);
				fs.writeFileSync(path + "f", content);
				remote.getGlobal('wallet').transactionsArray = fullTxsData;
				txsTableUpdater();
			}else{
				// read full txs
				fs.readFile(path + "f", 'utf8', function(err, contents) {
					if(err) return;
					try {
						var txsArr = [];
						var txs = contents.split("\n");
						// read from full
						for(var t in txs) {
							var tx = txs[t];
							if(tx == '') continue;
							var txData = tx.split('|'),
								hash = txData[1];
							var txSave = {
								transactionHash: hash,
								fDate: txData[0],
								amount: parseFloat(txData[2]),
								fee: parseFloat(txData[3]),
								height: parseInt(txData[4]),
								unlockTime: parseInt(txData[5]),
								extra: '',
								paymentId: ''
							};
							if(txData.length > 6) txSave.paymentId = txData[6];
							
							var found = false;
							for(var idx in fullTxsData){
								if(fullTxsData[idx].transactionHash == txSave.transactionHash) {
									found = true;
									break;
								}
							}
							if(!found) fullTxsData.push(txSave);
						}
						
						//sort array
						fullTxsData.sort(function(a, b) {
							return a.fDate >= b.fDate ? 1 : -1;
						});
						
						remote.getGlobal('wallet').transactionsArray = fullTxsData;
						txsTableUpdater();
						
						// save diff
						if(fullTxsData.length > 0){
							var content = txsToFile(fullTxsData);
							fs.writeFileSync(path + "f", content);
						}
					} catch (e) {
						console.log('Error txs full update');
					}
				});
			}
		} catch (e) {
			console.log('Error txs fetching');
		}
	});
}

remote.getGlobal('wallet').initSpawned = function() {
	// clean files
	try{
		fs.unlinkSync(binPath + remote.getGlobal('wallet').walletName + '.txcast');
		fs.unlinkSync(binPath + remote.getGlobal('wallet').walletName + '.txresult');
		fs.unlinkSync(binPath + remote.getGlobal('wallet').walletName + '.reset');
		fs.unlinkSync(binPath + remote.getGlobal('wallet').walletName + '.reset_');
		fs.unlinkSync(binPath + remote.getGlobal('wallet').walletName + '.save');
		fs.unlinkSync(binPath + remote.getGlobal('wallet').walletName + '.save_');
		
		// Read values
		readBalance(binPath + remote.getGlobal('wallet').walletName + '.status');
		readTxs(binPath + remote.getGlobal('wallet').walletName + '.txs');
	}catch(e) {}
	
	setInterval(function(){readBalance(binPath + remote.getGlobal('wallet').walletName + '.status');}, 10000);
	setTimeout(function(){readTxs(binPath + remote.getGlobal('wallet').walletName + '.txs');}, 5000);
	
	var watcherBalance = chokidar.watch('file', {
	  ignored: /[\/\\]\./,
	  persistent: true,
	  ignoreInitial: false
	  
	});
	watcherBalance.add(binPath + remote.getGlobal('wallet').walletName + '.status');
	watcherBalance.on('change', function(path, stats) {
		if (stats.size == 0) return;
		readBalance(path);
	});
	
	var watcherTxs = chokidar.watch('file', {
	  ignored: /[\/\\]\./,
	  persistent: true,
	  ignoreInitial: false
	});
	watcherTxs.add(binPath + remote.getGlobal('wallet').walletName + '.txs');
	watcherTxs.on('change', function(path, stats) {
		if (stats.size == 0) return;
		readTxs(path);
	});
}

remote.getGlobal('wallet').walletProcessTryStart = function(isImport) {
	if(isImport == undefined || isImport == null) isImport = false;
	if(remote.getGlobal('wallet').applicationInit) return;
	
	remote.getGlobal('wallet').initSpawned();
	
	console.log('Starting wallet process...');
	remote.getGlobal('wallet').spawnWallet(isImport);
	
	fs.readFile(binPath + remote.getGlobal('wallet').walletName + ".address", 'utf8', function (err, data) {
		try {
			remote.getGlobal('wallet').address = data;
			statusBarUpdater();
		} catch(e) {
			return;
		}
	});
	
	balanceUpdater();
	
	setInterval(function() {
		if (remote.getGlobal('wallet').closingApp) return;
		remote.getGlobal('wallet').storeWalletData();
	}, 240000);
	
	remote.getGlobal('wallet').walletProcessStarted = true;
	$("#init-wallet").fadeOut(500);
}

setInterval(function() {
	if (remote.getGlobal('wallet').walletProcessStarted) return;
	
	remote.getGlobal('wallet').walletProcessTryStart();
}, 5000);
