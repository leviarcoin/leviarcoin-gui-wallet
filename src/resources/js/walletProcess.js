var remote = require('electron').remote;
var fs = require('fs');
var osInfo = window.require('os');
var binPath = __dirname + '/bin/';
var filepath = "address.dat";

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
		if (walletObj.walletName != null && walletObj.walletName != '') remote.getGlobal('wallet').walletName = walletObj.walletName;
		if (walletObj.walletHasPassword && walletObj.walletPasswordSaved){
			remote.getGlobal('wallet').walletPassword =  remote.getGlobal('wallet').decrypt(walletObj.walletPassword);
			
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

remote.getGlobal('wallet').sendTransaction = function(address, paymentId, amount, mixin, fee) {
	if(!confirm("Are you sure to send this transaction?")) return false;

	if(paymentId == null) paymentId = '';
	if(mixin == null || mixin == '') mixin = 0;
	if(fee == null) fee = 1000000;

	// now fixed at 0.01 XLC
	fee = 1000000;
	
	// prepend
	var status = '<span class="green icon icon-help"></span>',
		htmlTbody = '',
		date = new Date(),
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
			amount: ((amount * -1)-(fee/100000000)),
			transactionHash: '',
			fee: (fee/100000000)
		};
	htmlTbody += '<tr><td>' + status + '</td><td>' + tx.fDate + '</td><td>' + tx.transactionHash.substring(0, 48).toUpperCase() + '...</td><td>' + tx.amount + '</td></tr>';
	$("#txs-table-body").prepend(htmlTbody);
	
	htmlTbody = '<tr><td>' + tx.fDate + '</td><td>' + tx.transactionHash.substring(0, 24).toUpperCase() + '...</td><td>' + tx.amount + '</td></tr>';
	if($("#lastTxs-table-body tr").length >= 6) $("#lastTxs-table-body tr").last().remove();
	$("#lastTxs-table-body").prepend(htmlTbody);
	
	$.ajax({
		url: 'http://127.0.0.1:19080/json_rpc',
		method: "POST",
		data: JSON.stringify({
			jsonrpc:"2.0",
			id: "test",
			method:"transfer",
			params: {
				'mixin': parseInt(mixin),
				'fee': parseInt(fee), // 0.01 XLC minimum
				'unlock_time': 0,
				'payment_id': paymentId,
				'destinations':[{
					'amount': parseInt(amount * 100000000),
					'address': address
				}]
			}
		}),
		dataType: 'json',
		success: function(data){
			if(data.error !== undefined) {
				var win = remote.getCurrentWindow();
				dialog.showMessageBox(win, {
					type: 'error',
					title: "Send",
					message: "Error! " + data.error.message,
					buttons: ["OK"]
				});
			}else{
				var divFee = (fee / 100000000);
				var win = remote.getCurrentWindow();
				dialog.showMessageBox(win, {
					type: 'info',
					title: 'Send',
					message: "Transaction correctly sent!",
					detail: "You sent " + amount + " XLC (Fee: " + divFee + " XLC). Transaction details will appear soon in your Transactions.",
					buttons: ["OK"]
				});
				$("#form-qs-1, #form-qs-2, #form-s-1, #form-s-2, #form-s-addressbook").val('');
				$("#form-qs-3, #form-s-3").val(0);
				$("#form-s-5").val(6);
				remote.getGlobal('wallet').storeWalletData();
			}
		},
		error: function(a,b,c){
			var win = remote.getCurrentWindow();
			dialog.showMessageBox(win, {
				type: 'error',
				title: "Send",
				message: "There was an error sending transaction, please retry.",
				buttons: ["OK"]
			});
		}
	});
}

remote.getGlobal('wallet').resetWallet = function() {
	$.ajax({
		url: 'http://127.0.0.1:19080/json_rpc',
		method: "POST",
		data: JSON.stringify({
			jsonrpc:"2.0",
			id: "test",
			method:"reset",
			params: { }
		}),
		dataType: 'json',
		success: function(data){
			var win = remote.getCurrentWindow();
			dialog.showMessageBox(win, {
				type: 'info',
				title: 'Reset Wallet',
				message: "Wallet reset complete! Wait for the complete synchronization.",
				buttons: ["OK"]
			});
			$("#info-wallet").fadeOut(500, function() {
				$("#info-wallet-title, #info-wallet-subtitle").empty();
			});
		},
		error: function(a,b,c){
			$("#info-wallet").fadeOut(500, function() {
				$("#info-wallet-title, #info-wallet-subtitle").empty();
				
				var win = remote.getCurrentWindow();
				dialog.showMessageBox(win, {
					type: 'error',
					title: "Reset Wallet",
					message: "Reset wallet failed, please retry.",
					buttons: ["OK"]
				});
			});
		}
	});
}

remote.getGlobal('wallet').updateWalletData = function() {
	if(remote.getGlobal('wallet').knownBlockCount == 0) return;
	
	if(remote.getGlobal('wallet').address == '') remote.getGlobal('wallet').getWalletAddressSync();
	
	$.ajax({
		url: 'http://127.0.0.1:19080/json_rpc',
		method: "POST",
		data: JSON.stringify({
			jsonrpc:"2.0",
			id: "test",
			method:"getbalance",
			params: { }
		}),
		dataType: 'json',
		success: function(data){
			remote.getGlobal('wallet').locked = data.result.locked_amount;
			remote.getGlobal('wallet').balance = data.result.available_balance;
			statusBarUpdater();
		},
		error:function(a,b,c){
			remote.getGlobal('wallet').walletErrCount++;

			// We wait 8/10secs before trying to respawn process
			if(remote.getGlobal('wallet').walletErrCount > 15){
				// If wallet is crashed, we try to respawn it
				try{
					remote.getGlobal('wallet').killWallet();
					
					remote.getGlobal('wallet').walletProcess = null;
					setTimeout(function(){
						remote.getGlobal('wallet').walletErrCount = 0;
						remote.getGlobal('wallet').spawnWallet();
					}, 2000);
				}catch(e){
					console.log(e);
				}
			}
		}
	});
}

remote.getGlobal('wallet').getWalletAddressSync = function() {
	$.ajax({
		url: 'http://127.0.0.1:19080/json_rpc',
		method: "POST",
		data: JSON.stringify({
			jsonrpc:"2.0",
			id: "test",
			method:"getaddress",
			params: { }
		}),
		dataType: 'json',
		async: false,
		success: function(data){
			try{
				remote.getGlobal('wallet').address = data.result.address;
				fs.writeFile(binPath + remote.getGlobal('wallet').walletName + ".address", remote.getGlobal('wallet').address, (data) => {});
			}catch(e){}
		},
		error:function(a,b,c){ }
	});
}

remote.getGlobal('wallet').updateTxs = function() {
	var txsData = remote.getGlobal('wallet').transactions;
	var txsDataArr = remote.getGlobal('wallet').transactionsArray;
	
	remote.getGlobal('wallet').transactionsSyncBusy = 1;
	$.ajax({
		url: 'http://127.0.0.1:19080/json_rpc',
		method: "POST",
		data: JSON.stringify({
		  jsonrpc:"2.0",
		  id: "test",
		  method:"get_transfers"
		}),
		dataType: 'json',
		timeout: 4000,
		success: function(data) {
			if(data.result == undefined) return true;
			if(data.result.transfers == undefined) return true;
			if(data.result.transfers.length == 0) return true;
			if(data.result.transfers.length == txsDataArr.length) return true;
			
			//console.log("data length: " + data.result.transfers.length + " txslen: " + txsDataArr.length);
			
			var transfers = data.result.transfers;
			for (var i in transfers) {
				var hash = transfers[i].transactionHash;
				if (txsData[hash] == undefined) {
					txsData[hash] = transfers[i];
					var date = new Date(txsData[hash].time * 1000),
						day = "0" + date.getDate(),
						month = "0" + (date.getMonth()+1),
						year = date.getFullYear(),
						hours = "0" + date.getHours(),
						minutes = "0" + date.getMinutes(),
						seconds = "0" + date.getSeconds();
					txsData[hash].fDate = year + '-' + month.substr(-2) + '-' + day.substr(-2) + ' ' + hours.substr(-2) + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);
					if(txsData[hash].output == true) txsData[hash].amount = txsData[hash].amount * -1;
					txsData[hash].amount = txsData[hash].amount / 100000000;
					txsData[hash].address = '';
				}
			}
			remote.getGlobal('wallet').transactions = txsData;
			var reversed = [];
			for (var hash in txsData) {
				reversed.push({
					transactionHash: txsData[hash].transactionHash,
					time: txsData[hash].time,
					amount: txsData[hash].amount,
					fDate: txsData[hash].fDate,
					paymentId: txsData[hash].paymentId,
					fee: txsData[hash].fee
				});
			}
			reversed.sort(function(a,b) {return a.time <= b.time ? 1 : -1;}); 
			remote.getGlobal('wallet').transactionsArray = reversed;
			txsTableUpdater();
		},
		error: function(a,b,c){
			//console.log(a);
			//console.log(b);
			//console.log(c);
		}
	});
}

remote.getGlobal('wallet').storeWalletData = function() {
	// Wait daemon and sync tx
	var knownBlockCount = remote.getGlobal('wallet').knownBlockCount;
	if(knownBlockCount <= 1) return;
	
	$.ajax({
		url: 'http://127.0.0.1:19080/json_rpc',
		method: "POST",
		data: JSON.stringify({
		  jsonrpc:"2.0",
		  id: "test",
		  method:"store",
		  params: { }
		}),
		dataType: 'json',
		success: function(data) {
			console.log("Wallet data saved.");
		}
	});
}

remote.getGlobal('wallet').storeWalletDataSync = function() {
	// Wait daemon and sync tx
	var knownBlockCount = remote.getGlobal('wallet').knownBlockCount;
	if(knownBlockCount <= 1) return;
	
	$.ajax({
		url: 'http://127.0.0.1:19080/json_rpc',
		method: "POST",
		data: JSON.stringify({
		  jsonrpc:"2.0",
		  id: "test",
		  method:"store",
		  params: { }
		}),
		dataType: 'json',
		async: false,
		success: function(data) {
			console.log("Wallet data saved.");
		}
	});
}

remote.getGlobal('wallet').spawnWallet = function() {
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
		'--set_log', remote.getGlobal('wallet').logLevel,
		'--rpc-bind-ip', '127.0.0.1',
		'--rpc-bind-port', '19080',
		'--daemon-address', '127.0.0.1:19001',
		'--wallet-file', binPath + remote.getGlobal('wallet').walletName,
		'--password', (pwd != null ? pwd : '')
	]);
	
	$("#ask-pwd-wallet").fadeOut(500, function(){
		$(".unlock-wal-pw").show(0);
		$("#unlock-loading").hide(0);
	});
	
	setTimeout(function() {
		fs.readFile(binPath + 'simplewallet.log', 'utf8', function (err, data) {
			var result = data.toLowerCase().search('check password');
			if(result >= 0) {
				remote.getGlobal('wallet').killWallet();
				remote.getGlobal('wallet').walletProcess = null;
				
				//password wrong / or wallet error
				var win = remote.getCurrentWindow();
				dialog.showMessageBox(win, {
					type: 'error',
					title: "Check wallet",
					message: "There was an error loading wallet. Check your password.",
					buttons: ["OK"]
				});
				
				remote.getGlobal('wallet').newWallet(false);
			}
		});
	}, 5000);
}

remote.getGlobal('wallet').killWallet = function() {
	$.ajax({
		url: 'http://127.0.0.1:19080/json_rpc',
		method: "POST",
		data: JSON.stringify({
		  jsonrpc:"2.0",
		  id: "test",
		  method:"shutdown",
		  params: { }
		}),
		dataType: 'json',
		timeout: 5000,
		success: function(data) {
			console.log("Simplewallet closed.");
		},
		error: function(a,b,c) {
			if(remote.getGlobal('wallet').walletProcess == null) return;
			
			if(osInfo.platform().substring(0, 3) == 'win') {
				spawn('taskkill', ['/F', '/PID', remote.getGlobal('wallet').walletProcess.pid]);
			} else {
				spawn('kill', ['-9', remote.getGlobal('wallet').walletProcess.pid]);
			}
		}
	});
}

remote.getGlobal('wallet').walletProcessTryStart = function() {
	if(remote.getGlobal('wallet').applicationInit) return;
	
	console.log('Starting wallet process...');
	remote.getGlobal('wallet').spawnWallet();
	
	fs.readFile(binPath + remote.getGlobal('wallet').walletName + ".address", 'utf8', function (err, data) {
		try {
			remote.getGlobal('wallet').address = data;
			statusBarUpdater();
		} catch(e) {
			return;
		}
	});
	
	setInterval(function() {
		if (remote.getGlobal('wallet').closingApp) return;
		remote.getGlobal('wallet').updateWalletData();
	}, 4000);

	setInterval(function() {
		if (remote.getGlobal('wallet').closingApp) return;
		remote.getGlobal('wallet').updateTxs();
	}, 15000);
	
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
}, 3000);
