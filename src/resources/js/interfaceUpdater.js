var remote = window.require('electron').remote;
var osInfo = window.require('os');
const modal = window.require('electron-modal');
const {clipboard} = require('electron');

// Tooltips
const tt = require('electron-tooltip')
tt({ position: 'left', style: {borderRadius: '5px'} })

let balanceUpdater = async () => {
	try {
		var $locked = $("#topbar-locked"),
			$usdVal = $("#topbar-usdVal"),
			lockedAmount = remote.getGlobal('wallet').locked,
			balance = remote.getGlobal('wallet').balance,
			usdVal = parseFloat(remote.getGlobal('wallet').priceUsdValue);

		$("#topbar-balance").html(balance);

		$locked.hide(0);
		if(lockedAmount > 0){
			$locked.html(" - Locked amount: <b>" + lockedAmount + " XLC</b>").show(0);
		}else{
			$locked.empty();
		}

		if(usdVal == 0) {
			if(remote.getGlobal('wallet').loadFromCache > 0) {
				usdVal = remote.getGlobal('wallet').loadFromCache;
			}
		}

		if(usdVal != 0) {
			var totalUsdValue = (balance + lockedAmount) * usdVal,
				unitPrice = usdVal.toFixed(2);
			if(totalUsdValue > 0) $usdVal.html(' - <b>$' + (totalUsdValue.toFixed(2)) + '</b> @ $' + unitPrice + '').show(0);
		}

		var addr = remote.getGlobal('wallet').address,
		$addr = $("#pane-network-receive-address");

		if($addr != null && $addr.length > 0) {
			var addrInp = $addr.html();
			if(addr!='' && addrInp != addr) $addr.html(addr);
		}
	}catch(e){}
}

let statusBarUpdater = async () => {
  balanceUpdater();

  var sync = remote.getGlobal('wallet').isSyncing,
      $isSyncing = $("#isSyncing"),
      $networkStatus = $("#networkStatus"),
      $heightStatus = $("#heightStatus");

  if(remote.getGlobal('wallet').walletErrCount > 10) {
    // Maybe walletd crashed
    // walletProcess will try to restart it
    $heightStatus.hide(0);
    if($isSyncing.hasClass('rotating')) $isSyncing.removeClass('rotating');
    if($isSyncing.hasClass('icon-arrows-ccw')) $isSyncing.removeClass('icon-arrows-ccw');
    if($isSyncing.hasClass('icon-check')) $isSyncing.removeClass('icon-check');
    if(!$isSyncing.hasClass('icon-cancel')) $isSyncing.addClass('icon-cancel');
    $isSyncing.attr('data-tooltip', 'Offline');
    $networkStatus.removeClass('low').removeClass('mid').removeClass('high')
                  .removeClass('icon-progress-1').removeClass('icon-progress-2').removeClass('icon-progress-3')
                  .addClass('icon-progress-1').addClass('low')
                  .attr('data-tooltip', '0 connections');
  }else{
    if($isSyncing.hasClass('icon-cancel')) $isSyncing.removeClass('icon-cancel');

	if(remote.getGlobal('wallet').knownBlockCount == 0) {
		if($isSyncing.hasClass('icon-check')) $isSyncing.removeClass('icon-check');
		if($isSyncing.hasClass('rotating')) $isSyncing.removeClass('rotating');
		if($isSyncing.hasClass('icon-arrows-ccw')) $isSyncing.removeClass('icon-arrows-ccw');
		if(!$isSyncing.hasClass('icon-cancel')) $isSyncing.addClass('icon-cancel');
		$("#pane-network-quicksend").fadeOut(0);
		$("#sync-master-overlay, #sync-master").fadeIn(0);
	} else {
		if (sync) {
			if($isSyncing.hasClass('icon-cancel')) $isSyncing.addClass('icon-cancel');
			if(!$isSyncing.hasClass('rotating')) $isSyncing.addClass('rotating');
			if(!$isSyncing.hasClass('icon-arrows-ccw')) $isSyncing.addClass('icon-arrows-ccw');
			if($isSyncing.hasClass('icon-check')) $isSyncing.removeClass('icon-check');
			$isSyncing.attr('data-tooltip', 'Sync in progress...');

			// avoid tx while syncing
			$("#pane-network-quicksend").fadeOut(0);
			$("#sync-master-overlay, #sync-master").fadeIn(0);
		}else{
			if($isSyncing.hasClass('icon-cancel')) $isSyncing.addClass('icon-cancel');
			if($isSyncing.hasClass('rotating')) $isSyncing.removeClass('rotating');
			if($isSyncing.hasClass('icon-arrows-ccw')) $isSyncing.removeClass('icon-arrows-ccw');
			if(!$isSyncing.hasClass('icon-check')) $isSyncing.addClass('icon-check');
			$isSyncing.attr('data-tooltip', 'Synchronized!');

			// enable tx when sync
			$("#pane-network-quicksend").fadeIn(0);
			$("#sync-master-overlay, #sync-master").fadeOut(0);
		}
	}

    var networkQuality = 'low', networkQt = 1;
    if(remote.getGlobal('wallet').peerCount >= 4){
      networkQuality = 'high';
      networkQt = 3
    }else if(remote.getGlobal('wallet').peerCount >= 1) {
      networkQuality = 'mid';
      networkQt = 2
    }

    // TODO: optimize here
    $networkStatus.removeClass('low').removeClass('mid').removeClass('high')
                  .removeClass('icon-progress-1').removeClass('icon-progress-2').removeClass('icon-progress-3')
                  .addClass('icon-progress-' + networkQt).addClass(networkQuality)
                  .attr('data-tooltip', remote.getGlobal('wallet').peerCount + ' connection' + (remote.getGlobal('wallet').peerCount == 1 ? '': 's'));

    if(remote.getGlobal('wallet').blockCount > 0 && remote.getGlobal('wallet').knownBlockCount > 0){
      $heightStatus.show(0);
      var height = remote.getGlobal('wallet').blockCount - 1;
      if(sync){
        height += ' / ' + (remote.getGlobal('wallet').knownBlockCount - 1);
      }
      $heightStatus.html(height);
    }else{
      $heightStatus.hide(0);
    }

    var remainingBlocks = remote.getGlobal('wallet').knownBlockCount - remote.getGlobal('wallet').blockCount;
    if (remainingBlocks < 0) remainingBlocks = 0;
    $("#sync-lock-blocks").html(remainingBlocks);
  }
}

var showTxDetails = function(hash) {
	// overlay + loading
	$("#main-overlay, #main-overlay-loading").show(50);
	var txs = remote.getGlobal('wallet').transactionsArray;
	var tx = null;
	for(var i in txs) if (txs[i].transactionHash == hash) tx = txs[i];

	//if(tx.transactionHash == hash) {
		modal.open(__dirname + '/tx.html', {
			width: 600,
			height: 310,
			parent: remote.win,
			modal: true,
			resizable: false,
			minimizable: false,
			maximizable: false,
			closable: false,
			alwaysOnTop: true,
			fullscreenable: false,
			skipTaskbar: true,
			frame: false,
			backgroundColor: '#f1f1f1',
			titleBarStyle: 'hidden',
			show: false
		}, {
			transaction: tx
		}).then((instance) => {
			instance.on('status', (msg) => {
				switch(msg) {
					case 'loaded': {
						// hide loader
						$("#main-overlay-loading").hide(0);
						break;
					}
					case 'close': {
						// hide overlay
						$("#main-overlay").hide(0);
						break;
					}
				}
			});
		});
		return;
	//}
}

let txsTableUpdater = async () => {
	//$("#txs-table-body").empty();
	var txs = remote.getGlobal('wallet').transactionsArray,
		reversed = txs.reverse(),
		lastTxs = [];

	// limited to 500 now
	//reversed = reversed.slice(0,500);

	// Transactions
	var status = '<span class="green icon icon-check"></span>',
		htmlTbody = '';
	for (var txId in reversed) {
		var tx = reversed[txId];
		if(lastTxs.length <= 5) lastTxs.push(tx);
		//var status = '<span class="orange icon icon-clock" data-tooltip="Unlocks in ' + tx.unlockTime + ' blocks"></span>';
		/*if(tx.unlockTime <= 0) */
		htmlTbody += '<tr ondblclick="showTxDetails(\'' + tx.transactionHash + '\')"><td>' + status + '</td><td>' + tx.fDate + '</td><td>' + tx.transactionHash.substring(0, 48).toUpperCase() + '...</td><td>' + tx.amount + '</td></tr>';
	}
	$("#txs-table-body").html(htmlTbody);

	// Last 6 tranasctions
	//$("#lastTxs-table-body").empty();
	htmlTbody = '';
	for (var lastTxId in lastTxs) {
		var tx = lastTxs[lastTxId];
		htmlTbody += '<tr ondblclick="showTxDetails(\'' + tx.transactionHash + '\')"><td>' + tx.fDate + '</td><td>' + tx.transactionHash.substring(0, 36).toUpperCase() + '...</td><td>' + tx.amount + '</td></tr>';
	}
	$("#lastTxs-table-body").html(htmlTbody);
}

// Send input value check
$(document).on("blur", "#form-s-3, #form-qs-3", function() { if($(this).val() == "") $(this).val(0); });
$(document).on("blur", "#form-s-4", function() {
	var value = $(this).val();
	if(value == "" || value < 0.01) $(this).val(0.01);
});
$(document).on("blur", "#form-s-5", function() {
	var value = $(this).val();
	if(value == "") $(this).val(6);
	if(value > 12) $(this).val(12);
});

var updateInterface = function() {
	if (!remote.getGlobal('wallet').applicationLoad) {
		$("#init-wallet").fadeOut(500);
	} else {
		if(remote.getGlobal('wallet').askPassword) {
			$("#ask-pwd-wallet").show(0);
			$("#form-init-ask-1").focus();
		}else if (remote.getGlobal('wallet').applicationInit) {
			$("#init-new-wallet").show(0);
			$("#init-preparing").fadeOut(500);
		}
	}
}

var fnGuiClearQuickSend = function() {
	$('#form-qs-1, #form-qs-2').val('');
	$('#form-qs-3').val(0);
}

var fnGuiClearSend = function() {
	$('#form-s-1, #form-s-2, #form-s-addressbook').val('');
	$('#form-s-3').val(0);
	$('#form-s-4').val(0.01);
	$('#form-s-5').val(1);
}

var fnGuiSendQuickTransaction = function() {
	var address = $("#form-qs-1").val();
	var paymentId = $("#form-qs-2").val();
	var amount = $("#form-qs-3").val();

	remote.getGlobal('wallet').sendTransaction(address, paymentId, amount, 1);
}

var fnGuiSendTransaction = function() {
	var address = $("#form-s-1").val();
	var paymentId = $("#form-s-2").val();
	var amount = $("#form-s-3").val();
	var mixin = $("#form-s-5").val();
	var name = $("#form-s-addressbook").val();

	if(name != '') fnAddressBookAdd(name, address, paymentId);

	remote.getGlobal('wallet').sendTransaction(address, paymentId, amount, mixin);
}

var fnGuiResetWallet = function() {
	if(remote.getGlobal('wallet').isSyncing) {
		var win = remote.getCurrentWindow();
		dialog.showMessageBox(win, {
			type: 'info',
			title: 'Reset',
			message: "The wallet is not synchronized yet, please retry later.",
			buttons: ["OK"]
		});
		return false;
	}

	if(!confirm("Are you sure you want to reset wallet?")) return false;

	$("#info-wallet-title").html('Reset in progress. Please Wait.');
	$("#info-wallet-subtitle").html('The operation may take some time...<br><br><div id="reset-height-status"></div>');
	$("#info-wallet").fadeIn(500, function() {
		remote.getGlobal('wallet').resetWallet();
		// when reset file is deleted the process is done
		var watcherResetHeight = chokidar.watch('file', {
		  ignored: /[\/\\]\./,
		  persistent: true,
		  ignoreInitial: false
		});
		watcherResetHeight.add(binPath + remote.getGlobal('wallet').walletName + '.reset_');
		watcherResetHeight.on('change', function(path, stats) {
			/*var content = fs.readFileSync(path, "utf8");
			try{
				var status = content.split("|");
				if(status[0] !== undefined && status[1] !== undefined){
					if(parseInt(status[0]) == parseInt(status[1])){
						fs.unlinkSync(path);
					}
				}
				$("#reset-height-status").html("Height <b>" + status[0] + "</b> of <b>" + status[1] + "</b>");
			}catch(e){}*/
		});
		watcherResetHeight.on('unlink', function(path, stats) {
			$("#info-wallet").fadeOut(500, function(){
				$("#info-wallet-title, #info-wallet-subtitle").empty();

			});
			watcherResetHeight.close();
			watcherResetHeight = null;
		});

		setTimeout(function(){
			$("#info-wallet").fadeOut(500, function(){
				$("#info-wallet-title, #info-wallet-subtitle").empty();

			});
			watcherResetHeight.close();
			watcherResetHeight = null;
		}, 5000);
	});
}

var fnGuiImportFromKeys = function() {
	remote.getGlobal('wallet').importFromKeys();
}

var fnGuiUnlockWallet = function() {
	var pwd = $("#form-init-ask-1").val();
	remote.getGlobal('wallet').walletPassword = pwd;
	remote.getGlobal('wallet').askPassword = false;
	remote.getGlobal('wallet').applicationLoad = false;
	remote.getGlobal('wallet').applicationInit = false;
	$(".unlock-wal-pw").hide(0);
	$("#unlock-loading").show(0);
}

var fnGuiInitImportWallet = function() {
	var win = remote.getCurrentWindow();
	dialog.showOpenDialog(win, {
		title: 'Choose a wallet to import...',
		filters: [{ name: 'Wallets', extensions: ['wallet'] }]},
		function (fileNames) {
			if (fileNames === undefined) return;
			var fileName = fileNames[0];

			// check extension
			if (fileName.slice(-7) != '.wallet') {
				var win = remote.getCurrentWindow();
				dialog.showMessageBox(win, {
					type: 'error',
					title: "Import Wallet",
					message: "Please select a valid .wallet file.",
					buttons: ["OK"]
				});
				return false;
			}

			// check if wallet exists
			var importedName = 'imported';
			var destinationWallet = binPath + importedName + '.wallet';
			while (fs.existsSync(destinationWallet)) {
				var rnd = '-' + Math.floor(Math.random() * 10000) + '';
				importedName = 'imported' + rnd;
				destinationWallet = binPath + importedName + '.wallet';
			}
			console.log("File imported: " + destinationWallet);

			fs.createReadStream(fileName).pipe(fs.createWriteStream(destinationWallet));
			remote.getGlobal('wallet').walletName = importedName;
			remote.getGlobal('wallet').walletPassword = null;
			var pwd = $("#form-init-import-1").val();
			if(pwd != '') remote.getGlobal('wallet').walletPassword = pwd;

			console.log('Wallet "' + remote.getGlobal('wallet').walletName + '" imported, starting...');

			// kill wallet if is running
			remote.getGlobal('wallet').applicationInit = true;
			remote.getGlobal('wallet').killWallet();
			remote.getGlobal('wallet').walletProcess = null;

			remote.getGlobal('wallet').balance = 0;
			remote.getGlobal('wallet').locked = 0;
			remote.getGlobal('wallet').transactionsArray = [];
			balanceUpdater();
			txsTableUpdater();

			// show loading imported wallet
			$("#load-import-wallet").fadeIn(500, function(){
				// hide all except import view
				$("#init-wallet").hide(0);

				// step 1
				$("#import-step-1").fadeIn(200);

				setTimeout(function(){
					// spawn wallet
					remote.getGlobal('wallet').applicationInit = false;
					remote.getGlobal('wallet').walletProcessTryStart(true);

					setTimeout(function(){
						// get wallet address
						var address = "";
						try{
							address = fs.readFileSync(binPath + remote.getGlobal('wallet').walletName + ".address");
						}catch(e){}
						remote.getGlobal('wallet').address = address;

						$("#import-step-2").fadeIn(200, function(){
							console.log("Public address imported: " + address);

							var savePassword = $("#save-password-import")[0].checked;

							// save address.dat
							if(savePassword)
								var walletObj = {
									walletName: remote.getGlobal('wallet').walletName,
									walletPassword: remote.getGlobal('wallet').encrypt(pwd),
									walletHasPassword: pwd != '',
									walletPasswordSaved: true
								};
							else
								var walletObj = {
									walletName: remote.getGlobal('wallet').walletName,
									walletPassword: null,
									walletHasPassword: pwd != '',
									walletPasswordSaved: false
								};

							try{
								fs.writeFileSync("address.dat", JSON.stringify(walletObj));
								console.log("Wallet file saved.");
							}catch(e){}

							// done
							$("#import-step-3").fadeIn(200, function(){
								setTimeout(function(){
									$("#load-import-wallet").fadeOut(500, function(){
										remote.getGlobal('wallet').applicationInit = false;
										remote.getGlobal('wallet').applicationLoad = false;

										var win = remote.getCurrentWindow();
										dialog.showMessageBox(win, {
											type: 'info',
											title: "Wallet imported",
											message: "Please wait... Do not close the wallet.",
											detail: "I will scan the blockchain to synchronize transactions. Your balance and transactions will show up in minutes.",
											buttons: ["OK"]
										});
									});
								}, 10000);
							});
						});
					}, 3000);
				}, 7000);
			});
		}
	);
}

var fnGuiInitCreateWallet = function() {
	var pwd = $("#form-init-new-1").val();
	var saveAddress = $("#save-address")[0].checked;
	var savePassword = $("#save-password")[0].checked;
	if($("#form-init-new-wallet-name").val() !== '')
		remote.getGlobal('wallet').walletName = $("#form-init-new-wallet-name").val();

	if (!confirm("Do you want to create a new wallet?" + (pwd != '' ? " Don't forget your password." : ""))) return;

	// check if name is available
	var importedName = remote.getGlobal('wallet').walletName;
	var destinationWallet = binPath + importedName + '.wallet';
	while (fs.existsSync(destinationWallet)) {
		var rnd = '-' + Math.floor(Math.random() * 10000) + '';
		importedName = remote.getGlobal('wallet').walletName + rnd;
		destinationWallet = binPath + importedName + '.wallet';
	}
	remote.getGlobal('wallet').walletName = importedName;

	remote.getGlobal('wallet').balance = 0;
	remote.getGlobal('wallet').locked = 0;
	remote.getGlobal('wallet').transactionsArray = [];
	balanceUpdater();
	txsTableUpdater();

	if (!fs.existsSync(binPath + remote.getGlobal('wallet').walletName)) {
		// clean log file
		try{
			fs.unlinkSync(binPath + 'simplewallet.log');
		}catch(e){}

		var walletCreatorProcess = spawn(binPath + 'simplewallet', [
			'--generate-new-wallet', binPath + remote.getGlobal('wallet').walletName,
			'--password', (pwd != '' ? pwd : ''),
			'--daemon-address', '127.0.0.1:19001'
		]);

		$("#init-choose").fadeOut(100, function() {
			$("#init-finishing").fadeIn(200);
			setTimeout(function() {
				if(osInfo.platform().substring(0, 3) == 'win') {
					spawn('taskkill', ['/F', '/PID', walletCreatorProcess.pid]);
				} else {
					spawn('kill', ['-9', walletCreatorProcess.pid]);
				}
				console.log('New wallet created!');
				if (pwd != '') remote.getGlobal('wallet').walletPassword = pwd;

				if(saveAddress) {
					if(savePassword)
						var walletObj = {
							walletName: remote.getGlobal('wallet').walletName,
							walletPassword: remote.getGlobal('wallet').encrypt(pwd),
							walletHasPassword: pwd != '',
							walletPasswordSaved: true
						};
					else
						var walletObj = {
							walletName: remote.getGlobal('wallet').walletName,
							walletPassword: null,
							walletHasPassword: pwd != '',
							walletPasswordSaved: false
						};

					fs.writeFile("address.dat", JSON.stringify(walletObj), (err) => {
						if (err) {
							console.log("Error saving wallet name.");
							console.log(err);
							return;
						}
						console.log("Wallet file saved.");
					});
				}

				// Wallet process start
				remote.getGlobal('wallet').applicationInit = false;

				if(remote.getGlobal('wallet').changeWallet) {
					if (confirm("Do you want to open the new wallet?"))  {
						remote.getGlobal('wallet').walletProcessTryStart();
					}
				}else{
					remote.getGlobal('wallet').askPassword = false;
					remote.getGlobal('wallet').applicationLoad = false;
				}
			}, 10000);
		});
	}else{
		var win = remote.getCurrentWindow();
		dialog.showMessageBox(win, {
			type: 'error',
			title: "Create Wallet",
			message: "Wallet already exists, please remove it before creating a new one. Remember to make a backup!",
			buttons: ["OK"]
		});
	}
}

remote.getGlobal('wallet').aboutMenu = function() {
	var win = remote.getCurrentWindow();
	dialog.showMessageBox(win, {
		type: 'info',
		title: 'LeviarCoin GUI Wallet',
		message: remote.getGlobal('wallet').versionAbout,
		detail: remote.getGlobal('wallet').versionCopy,
		buttons: ["OK"]
	});
}

var fnGuiGoBack = function() {
	remote.getGlobal('wallet').backFromNewWallet();
}

remote.getGlobal('wallet').backFromNewWallet = function() {
	if(remote.getGlobal('wallet').newWalletBackup != {}){
		remote.getGlobal('wallet').walletName = remote.getGlobal('wallet').newWalletBackup.walletName;
		remote.getGlobal('wallet').walletPassword = remote.getGlobal('wallet').newWalletBackup.walletPassword;
		remote.getGlobal('wallet').address = remote.getGlobal('wallet').newWalletBackup.address;
	}
	remote.getGlobal('wallet').applicationInit = false;
	remote.getGlobal('wallet').applicationLoad = false;
	$("#init-new-wallet").fadeOut(500);
}

remote.getGlobal('wallet').newWallet = function(force) {
	if(force == null || force == undefined) {
		remote.getGlobal('wallet').changeWallet = true;
	}else{
		remote.getGlobal('wallet').changeWallet = force;
	}

	remote.getGlobal('wallet').newWalletBackup = {
		walletName: remote.getGlobal('wallet').walletName,
		walletPassword: remote.getGlobal('wallet').walletPassword,
		address: remote.getGlobal('wallet').address
	};

	remote.getGlobal('wallet').applicationInit = true;
	remote.getGlobal('wallet').applicationLoad = true;
	remote.getGlobal('wallet').askPassword = false;
	remote.getGlobal('wallet').walletName = 'wallet';
	remote.getGlobal('wallet').walletPassword = null;
	remote.getGlobal('wallet').address = '';

	$("#init-finishing").hide(0);
	$("#init-choose").show(0);

	$("#init-wallet").show(0);
	$("#import-step-1, #import-step-2, #import-step-3").hide(0);
	$("#load-import-wallet").hide(0);
	$("#form-init-new-1, #form-init-import-1").val('');

	if(remote.getGlobal('wallet').changeWallet) {
		$("#goback-new-wallet").show(0);
	}else{
		$("#goback-new-wallet").hide(0);
	}
}

remote.getGlobal('wallet').backupWallet = function() {
	var win = remote.getCurrentWindow();
	dialog.showSaveDialog(
		win, {
			title: 'Backup your wallet...',
			buttonLabel: 'Save',
			filters: [{ name: 'Wallets', extensions: ['wallet'] }]
		},
		function (fileName) {
			if (fileName === undefined) return;

			var walletBackupFile = binPath + remote.getGlobal('wallet').walletName + '.wallet';

			fs.readdirSync(binPath).forEach(file => {
				var len = remote.getGlobal('wallet').walletName.length + 11;
				if (file.substr(0, len) == remote.getGlobal('wallet').walletName + ".wallet.tmp") {
					walletBackupFile = file;
				}
			});

			console.log("Backup " + walletBackupFile + " To: " + fileName);
			try{
				fs.createReadStream(walletBackupFile).pipe(fs.createWriteStream(fileName));
				console.log("Done.");
			}catch(e) {
				var win = remote.getCurrentWindow();
				dialog.showMessageBox(win, {
					type: 'error',
					title: "Backup Wallet",
					message: "Error creating a backup of your wallet, pleae retry.",
					buttons: ["OK"]
				});
				return false;
			}

			dialog.showMessageBox(win, {
				type: 'info',
				title: 'Backup Wallet',
				message: 'Wallet successfully saved to: ' + fileName,
				buttons: ["OK"]
			});
			return true;
		}
	);
}

var fnGuiCopyAddress = function() {
	var address = $("#pane-network-receive-address").html();
	clipboard.writeText(address);
	$("#rec-wallet-address-copied").show(0).delay(50).animate({
		marginTop:-24,
		opacity:0
	}, 250, function(){
		$(this).hide(0).css({
			marginTop:-19,
			opacity:1
		});
	});
}

remote.getGlobal('wallet').closeWallet = function() {
	remote.getGlobal('wallet').closingApp = true;
	$("#close-wallet-proc").fadeIn(500);

	setTimeout(function(){
		remote.getGlobal('wallet').storeWalletData();

		setTimeout(function(){
			remote.getGlobal('wallet').killWallet();

			setTimeout(function(){
				remote.getGlobal('wallet').killDaemon();

				setTimeout(function(){
					remote.willQuitApp = true;
					remote.app.quit();
				}, 3000);
			}, 2000);
		}, 6000);
	}, 1000);
}

var getKey = function () {
	return osInfo.userInfo().username+"wallet^bwXvv8g5O%e!ntN2z^aN9Ev";
}

var checkingUpdates = false;
var timerUpdate = null;
var checkUpdates = function() {
	if(remote.getGlobal('wallet').applicationLoad || remote.getGlobal('wallet').applicationInit) return;
	if (checkingUpdates) return;
	checkingUpdates = true;
	try{
		var url = 'https://leviarcoin.org/checkupdates.php?os=' + remote.getGlobal('wallet').guiPlatform + '&v=' + remote.getGlobal('wallet').guiVersion;
		https.get(url, res => {
			res.setEncoding("utf8");
			let body = "";
			res.on("data", data => {
				body += data;
			});
			res.on("end", () => {
				try{
					body = JSON.parse(body);
					if (body.status) {
						// show update
						$("#info-wallet-title").html('New version available. v' + body.version);
						$("#info-wallet-subtitle").html('It contains important new features that require an update. <br><br><div id="software-update-url"><a class="btn btn-positive" id="download-update" href="' + body.url + '">Download now</a></div><br><a class="btn btn-mini btn-default" id="disable-update" href="javascript:void(0);">Not now</a>');
						$("#info-wallet").fadeIn(500);
						$("#disable-update").unbind().click(function(){
							$("#info-wallet").fadeOut(500, function(){
								$("#info-wallet-title, #info-wallet-subtitle").empty();
							});
						});
						$("#download-update").unbind().click(function(){
							$("#info-wallet-subtitle").fadeOut(100, function(){
								$("#info-wallet-title").html('Downloading.');
								$("#info-wallet-subtitle").empty();
								setTimeout(function(){
									$("#info-wallet").fadeOut(500, function(){
										$("#info-wallet-title, #info-wallet-subtitle").empty();
									});
								}, 2000);
							});
						});
						clearInterval(timerUpdate);
						timerUpdate = null;
					}
				}catch(e){
					checkingUpdates = false;
				}
			});
			res.on("error", () => {
				checkingUpdates = false;
			});
		});
	}catch(e){
		checkingUpdates = false;
	}
}

var checkingPrice = false;
var priceUpdate = null;
var priceTimeUpdate = 0;
var checkPrice = function() {
	if (checkingPrice) return;
	var time = parseInt(new Date().getTime() / 1000);
	if (priceTimeUpdate + 3600 > time) return;
	checkingPrice = true;
	try{
		var url = 'https://leviarcoin.org/api/price.php';
		https.get(url, res => {
			res.setEncoding("utf8");
			let body = "";
			res.on("data", data => {
				body += data;
			});
			res.on("end", () => {
				try{
					body = JSON.parse(body);
					if (body[0].price_usd != undefined) {
						remote.getGlobal('wallet').priceUsdValue = body[0].price_usd;
						priceTimeUpdate = time;
						balanceUpdater();
						checkingPrice = false;
					}
				}catch(e) {
					checkingPrice = false;
				}
			});
			res.on("error", () => {
				checkingPrice = false;
			});
		});
	}catch(e){
		checkingPrice = false;
	}
}

setInterval(updateInterface, 7000);
timerUpdate = setInterval(checkUpdates, 120000);
priceUpdate = setInterval(checkPrice, 360000);

console.log('Interface updater started.');

$(document).on('keypress', '#form-init-ask-1', function(e){
	var code = (e.keyCode ? e.keyCode : e.which);
	if(code == 13) fnGuiUnlockWallet();
});

$(document).ready(function(){
	checkPrice();
});
