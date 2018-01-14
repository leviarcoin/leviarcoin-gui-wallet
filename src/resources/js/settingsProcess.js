var remote = require('electron').remote;
//const Store = require('electron-store');
//const store = new Store();
var processLock = false;

let fnSaveSettings = async () => {
	/*if(remote.getGlobal('wallet').applicationLoad || remote.getGlobal('wallet').applicationInit) return;
	console.log("Start SaveSettings.");
	
	var balance = remote.getGlobal('wallet').balance;
	var locked = remote.getGlobal('wallet').locked;
	var fee = remote.getGlobal('wallet').fee;
	//var txs = remote.getGlobal('wallet').transactionsArray;
	
	//if(txs.length > 100) txs = [];
	var txs = [];
	
	var settings = {
		balance: balance,
		locked: locked,
		fee: fee,
		txs: txs
	};
	try{
		store.set("settingsData", settingsObj);
	}catch(e){}
	console.log("Settings saved");
	*/
}

var fnLoadSettings = function() {
	/*try {
		var settingsObj = store.get("settingsData");
		if(settingsObj == null){
			var settingsObj = {
				balance: 0,
				locked: 0,
				fee: 1000000,
				txs: []
			};
		}
		if (settingsObj.balance != null && settingsObj.balance != 0) remote.getGlobal('wallet').balance = settingsObj.balance;
		if (settingsObj.locked != null && settingsObj.locked != 0) remote.getGlobal('wallet').locked = settingsObj.locked;
		if ((settingsObj.balance != null && settingsObj.balance != 0) || (settingsObj.locked != null && settingsObj.locked != 0))
			balanceUpdater();
		
		if (settingsObj.fee != null && settingsObj.fee != 1000000) remote.getGlobal('wallet').balance = settingsObj.fee;
		if (settingsObj != null && settingsObj.txs != []) {
			remote.getGlobal('wallet').transactionsArray = txs;
			txsTableUpdater();
		}
	} catch(e) {
		return;
	}
	console.log("Settings loaded.");
	*/
}

console.log('Settings manager started.');
// Read settings
$(document).ready(function(){
	//fnLoadSettings();
	//setInterval(function() {
	//	fnSaveSettings();
	//}, 60000);
});
