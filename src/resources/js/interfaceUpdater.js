var remote = window.require('electron').remote;
var osInfo = window.require('os');
const modal = window.require('electron-modal');
const {clipboard} = require('electron');
const cryptography = require('crypto');
var algorithm = 'aes-256-ctr';

// Tooltips
const tt = require('electron-tooltip')
tt({ position: 'bottom', style: {borderRadius: '5px'} })

var balanceUpdater = function() {
  var $locked = $("#topbar-locked"),
      lockedAmount = remote.getGlobal('wallet').locked / 100000000,
      balance = remote.getGlobal('wallet').balance / 100000000;

  $("#topbar-balance").html(balance);

  $locked.hide(0);
  if(lockedAmount > 0){
    $locked.html(" - Locked amount: <b>" + lockedAmount + " XLC</b>").show(0);
  }else{
    $locked.empty();
  }

  //config.data.datasets[0].data[0] = balance;
  //config.data.datasets[0].data[1] = lockedAmount;
  // Update chart
  //window.myPie.update();

  var addr = remote.getGlobal('wallet').address,
      $addr = $("#pane-network-receive-address");
  if(addr!='' && $addr.html() != addr) $addr.html(addr);
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
    if(remote.getGlobal('wallet').peerCount >= 5){
      networkQuality = 'high';
      networkQt = 3
    }else if(remote.getGlobal('wallet').peerCount >= 2) {
      networkQuality = 'mid';
      networkQt = 2
    }

    // TODO: optimize here
    $networkStatus.removeClass('low').removeClass('mid').removeClass('high')
                  .removeClass('icon-progress-1').removeClass('icon-progress-2').removeClass('icon-progress-3')
                  .addClass('icon-progress-' + networkQt).addClass(networkQuality)
                  .removeAttr('data-tooltip')
                  .attr('data-tooltip', remote.getGlobal('wallet').peerCount + ' connection' + (remote.getGlobal('wallet').peerCount == 1 ? '': 's'));

    if(remote.getGlobal('wallet').blockCount > 0 && remote.getGlobal('wallet').knownBlockCount > 0){
      $heightStatus.show(0);
      var height = remote.getGlobal('wallet').blockCount;
      if(sync){
        height += ' / ' + remote.getGlobal('wallet').knownBlockCount;
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
			height: 300,
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
	var reversed = remote.getGlobal('wallet').transactionsArray,
		lastTxs = [];

	// limited to 500 now
	reversed = reversed.slice(0,500);

	// Transactions
	var status = '<span class="green icon icon-check"></span>',
		htmlTbody = '';
	for (var txId in reversed) {
		var tx = reversed[txId];
		if(lastTxs.length <= 5) lastTxs.push(tx);
		//var status = '<span class="orange icon icon-clock" data-tooltip="Unlocks in ' + tx.unlockTime + ' blocks"></span>';
		/*if(tx.unlockTime <= 0) */
		htmlTbody += '<tr onclick="showTxDetails(\'' + tx.transactionHash + '\')"><td>' + status + '</td><td>' + tx.fDate + '</td><td>' + tx.transactionHash.substring(0, 48).toUpperCase() + '...</td><td>' + tx.amount + '</td></tr>';
	}
	$("#txs-table-body").html(htmlTbody);

	// Last 6 tranasctions
	//$("#lastTxs-table-body").empty();
	htmlTbody = '';
	for (var lastTxId in lastTxs) {
		var tx = lastTxs[lastTxId];
		htmlTbody += '<tr onclick="showTxDetails(\'' + tx.transactionHash + '\')"><td>' + tx.fDate + '</td><td>' + tx.transactionHash.substring(0, 24).toUpperCase() + '...</td><td>' + tx.amount + '</td></tr>';
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
		if (remote.getGlobal('wallet').applicationInit) {
			$("#init-new-wallet").show(0);
			$("#init-preparing").fadeOut(500);

			if(remote.getGlobal('wallet').askPassword) {
				$("#ask-pwd-wallet").show(0);
			}
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
	$('#form-s-5').val(6);
}

var fnGuiSendQuickTransaction = function() {
	var address = $("#form-qs-1").val();
	var paymentId = $("#form-qs-2").val();
	var amount = $("#form-qs-3").val();

	remote.getGlobal('wallet').sendTransaction(address, paymentId, amount, 0);
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
	if(!confirm("Are you sure you want to reset wallet?")) return false;

	$("#info-wallet-title").html('Reset in progress. Please Wait.');
	$("#info-wallet-subtitle").html('The operation may take some time...');
	$("#info-wallet").fadeIn(500, function() {
		remote.getGlobal('wallet').resetWallet();
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

				// kill wallet if is running
				remote.getGlobal('wallet').killWallet();
				remote.getGlobal('wallet').walletProcess = null;

				setTimeout(function(){
					// spawn wallet
					remote.getGlobal('wallet').spawnWallet();

					setTimeout(function(){
						var resetLoop = true;
						var retry = 5;
						while (resetLoop) {
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
								async: false,
								success: function(data){
									resetLoop = false;
									$("#import-step-2").fadeIn(200, function(){
										// store wallet data sync
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
												remote.getGlobal('wallet').address = data.result.address;

												$("#import-step-2").fadeIn(200, function(){
													// get address
													var address = remote.getGlobal('wallet').address;
													console.log("Public address imported: " + address);

													var savePassword = $("#save-password-import")[0].checked;

                          var encPwd = remote.getGlobal('wallet').encrypt(pwd);
                          console.log(encPwd);

													// save address.dat
													if(savePassword)
														var walletObj = {
															walletName: remote.getGlobal('wallet').walletName,
															walletPassword: encPwd,
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

													// save walletName.address
													fs.writeFile(binPath + remote.getGlobal('wallet').walletName + ".address", remote.getGlobal('wallet').address, (err) => {
														if (err) {
															console.log("Error saving wallet address.");
															console.log(err);
															return;
														}
														console.log("Wallet .address saved.");
													});

													remote.getGlobal('wallet').storeWalletDataSync();

													// done
													$("#import-step-3").fadeIn(200, function(){
														setTimeout(function(){
															$("#load-import-wallet").fadeOut(500, function(){
																remote.getGlobal('wallet').applicationInit = false;
																remote.getGlobal('wallet').applicationLoad = false;
															});
														}, 3000);
													});
												});
											},
											error: function(a,b,c){
												retry--;
												if(retry <= 0) {
													resetLoop = false;
													fs.unlinkSync(destinationWallet);
													remote.getGlobal('wallet').applicationInit = true;
													remote.getGlobal('wallet').applicationLoad = true;
													remote.getGlobal('wallet').walletName = 'wallet';
													remote.getGlobal('wallet').walletPassword = null;
													remote.getGlobal('wallet').address = '';
													$("#init-wallet").show(0);
													$("#import-step-1, #import-step-2, #import-step-3").hide(0);
													$("#load-import-wallet").hide(0);
													$("#form-init-new-1, #form-init-import-1").val('');
													retry = 5;

													var win = remote.getCurrentWindow();
													dialog.showMessageBox(win, {
														type: 'error',
														title: "Import Wallet",
														message: "Something went wrong, please retry! Check password and wallet.",
														buttons: ["OK"]
													});
													return false;
												}
											}
										});
									});
								},
								error: function(a,b,c){
									retry--;
									if(retry <= 0) {
										resetLoop = false;
										fs.unlinkSync(destinationWallet);
										remote.getGlobal('wallet').applicationInit = true;
										remote.getGlobal('wallet').applicationLoad = true;
										remote.getGlobal('wallet').walletName = 'wallet';
										remote.getGlobal('wallet').walletPassword = null;
										remote.getGlobal('wallet').address = '';
										$("#init-wallet").show(0);
										$("#import-step-1, #import-step-2, #import-step-3").hide(0);
										$("#load-import-wallet").hide(0);
										$("#form-init-new-1, #form-init-import-1").val('');
										retry = 5;

										var win = remote.getCurrentWindow();
										dialog.showMessageBox(win, {
											type: 'error',
											title: "Import Wallet",
											message: "Something went wrong, please retry! Check password and wallet.",
											buttons: ["OK"]
										});
										return false;
									}
								}
							});
						}
					}, 10000);
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
		var walletCreatorProcess = spawn(binPath + 'simplewallet', [
			'--generate-new-wallet', binPath + remote.getGlobal('wallet').walletName,
			'--password', (pwd != '' ? pwd : '')
			//(pwd != '' ? '--password' : ''), (pwd != '' ? pwd : '')
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

remote.getGlobal('wallet').backFromNewWallet = function() {
	if(remote.getGlobal('wallet').newWalletBackup != {}){
		remote.getGlobal('wallet').walletName = remote.getGlobal('wallet').newWalletBackup.walletName;
		remote.getGlobal('wallet').walletPassword = remote.getGlobal('wallet').newWalletBackup.walletPassword;
		remote.getGlobal('wallet').address = remote.getGlobal('wallet').newWalletBackup.address;
	}
	remote.getGlobal('wallet').applicationInit = false;
	remote.getGlobal('wallet').applicationLoad = false;
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
		remote.getGlobal('wallet').storeWalletDataSync();

		setTimeout(function(){
			remote.getGlobal('wallet').killWallet();

			setTimeout(function(){
				remote.getGlobal('wallet').killDaemon();

				setTimeout(function(){
					remote.willQuitApp = true;
					remote.app.quit();
				}, 3000);
			}, 6000);
		}, 3000);
	}, 1000);
}

var getKey = function () {
  //console.log(osInfo.userInfo().username);
	return osInfo.userInfo().username.toString()+"wallet^bwXvv8g5O%e!ntN2z^aN9Ev";
}

remote.getGlobal('wallet').encrypt = function(text){
  if(text==null)return null;
	var cipher = cryptography.createCipher(algorithm,getKey())
	var crypted = cipher.update(text,'utf8','hex')
	crypted += cipher.final('hex');
	return crypted;
}

remote.getGlobal('wallet').decrypt = function(text){
  if(text==null)return null;
	var decipher = cryptography.createDecipher(algorithm,getKey())
	var dec = decipher.update(text,'hex','utf8')
	dec += decipher.final('utf8');
	return dec;
}

setInterval(updateInterface, 5000);

console.log('Interface updater started.');
