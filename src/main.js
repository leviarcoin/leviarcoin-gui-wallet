const electron = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const {app, BrowserWindow} = electron;
const Menu = electron.Menu;
const Tray = electron.Tray;
const remote = electron.remote;
const modal = require('electron-modal');
const dialog = electron.dialog;
var osInfo = require('os');
const cryptography = require('crypto');
const crypto_key = osInfo.userInfo().username+"wallet^bwXvv8g5O%e!ntN2z^aN9Ev";
const crypto_algorithm = 'aes-256-ctr';
var resPath = __dirname + '/resources/';

global.wallet = {
	guiPlatform: 'mac',
	guiVersion: 14,
	clientVersion: 212,
	logLevel: '2',
	versionAbout: "GUI Wallet v0.1.4 - leviarcoind v2.1.2-r2 - simplewallet v2.1.2-r2",
	versionCopy: "Copyright Leviar Dev Team. © 2018",
	aboutMenu: null,
	applicationLoad: true,
	applicationInit: true,
	closingApp: false,
	walletName: "wallet",
	walletPassword: null,
	askPassword: false,
	walletProcessTryStart: null,
	walletProcessStarted: false,
	encrypt: null,
	decrypt: null,
	changeWallet: false,
	initSpawned: null,
	spawnDaemon: null,
	spawnWallet: null,
	closeWallet: null,
	walletProcess: null,
	daemonProcess: null,
	storeWalletData: null,
	storeWalletDataSync: null,
	getWalletAddressSync: null,
	updateWalletData: null,
	updateDaemonStatus: null,
	updateTxs: null,
	sendTransaction: null,
	resetWallet: null,
	importFromKeys: null,
	backFromNewWallet: null,
	newWalletBackup: {},
	newWallet: null,
	backupWallet: null,
	restoreWallet: null,
	killDaemon: null,
	killWallet: null,
	walletErrCount: 0,
	daemonErrCount: 0,
	blockCount: 0,
	daemonStatus: 'OK',
	knownBlockCount: 0,
	isSyncing: false,
	peerCount: 0,
	balance: 0,
	locked: 0,
	address: '',
	transactionsSyncBusy: 0,
	transactionsBlockStart: 1,
	transactions: {},
	transactionsArray: [],
	lastTransactions: {},
	addressBook: {},
	priceUsdValue: 0
};
let win;
let tray;
let willQuitApp = false;

// Settings
var appSettings = new function () {
  this.getArch = function() {
    return process.arch;
  }
}
function createWindow () {
	modal.setup();

	var iconPath = resPath + 'images/icon.ico';
	if (process.platform !== 'win') iconPath = resPath + 'images/icon.png'; // macOS + Linux
	var trayMenu = Menu.buildFromTemplate([
			{
				label: "Show Wallet",
				click: (item, window, event) => { win.show(); }
			},
			{ type: "separator" },
			{ role: "quit" }
		]);

	tray = new Tray(iconPath)
    tray.setToolTip("LeviarCoin Wallet");
    tray.setTitle("LeviarCoin Wallet"); // macOS
    tray.setContextMenu(trayMenu);

	win = new BrowserWindow({
		title: 'LeviarCoin Wallet',
		width: 800,
		height: 600,
		icon: iconPath,
		resizable: false,
		show: false,
		webPreferences: {
			nodeIntegrationInWorker: true
		}
	});

	win.once('ready-to-show', () => {
		win.show()
	});

	var menuTemplate = [
    {
      label: 'LeviarCoin',
      submenu: [
            {
                label: 'About...',
                click: () => {
					global.wallet.aboutMenu();
                }
            },
            {type: 'separator'},
            {role: 'quit'}
        ]
    },
    {
      label: 'Wallet',
      submenu: [
        {
          label: 'Create / Restore Wallet',
          click: () => {
            global.wallet.newWallet();
          }
        },
        {
          label: 'Backup Wallet',
          click: () => {
			global.wallet.backupWallet();
          }
        }
      ]
    },
    {
      label: "Edit",
      submenu: [
          { label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
          { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
          { type: "separator" },
          { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
          { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
          { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
          { label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
      ]
    }
  ];
	const menu = Menu.buildFromTemplate(menuTemplate);
	Menu.setApplicationMenu(menu);

	win.loadURL(url.format({
		pathname: path.join(__dirname, 'index.html'),
		protocol: 'file:',
		slashes: true
	}))

	// Open the DevTools.
	//win.webContents.openDevTools({detach:true})
	win.on('closed', () => { win = null });
	win.on('close', (e) => {
		if (willQuitApp) {
			win = null;
		} else {
			e.preventDefault();
			global.wallet.closeWallet();
		}
	});
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') { app.quit() }
})

app.on('activate', () => {
	if (win === null) { createWindow() }
})

app.on('before-quit', (event) => {
	global.wallet.killWallet();
	global.wallet.killDaemon();

	willQuitApp = true;
	console.log('Closing wallet...');
})

var cleanExit = function() {process.exit()};
process.on('SIGINT', cleanExit);
process.on('SIGTERM', cleanExit);
process.on('exit', function() {
	console.log("Wallet closed.");
});

global.wallet.encrypt = function(text) {
	var cipher = cryptography.createCipher(crypto_algorithm, crypto_key);
    var crypted = cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
    return crypted;
}

global.wallet.decrypt = function(text) {
	var decipher = cryptography.createDecipher(crypto_algorithm, crypto_key);
	return decipher.update(text, 'hex', 'utf8') + decipher.final('utf8');
}
