const modal = require('electron-modal');
modal.show();
document.getElementById('closeModal').addEventListener('click', () => {
	modal.emit('status', 'close');
	modal.hide();
});

modal.getData().then((data) => {
	//alert(JSON.stringify(data, null, 4));
	var tx = data.transaction;
	
    document.getElementById('tx-datetime').innerHTML = tx.fDate;
    document.getElementById('tx-confirmations').innerHTML = /*tx.unlockTime > 0 ? tx.unlockTime+' blocks to unlock' : */'Confirmed';
    document.getElementById('tx-hash').innerHTML = tx.transactionHash;
    document.getElementById('tx-pid').innerHTML = tx.paymentId == null || tx.paymentId.trim() == "" ? "-" : tx.paymentId;
    if(tx.extra !== undefined) document.getElementById('tx-extra').innerHTML = tx.extra == null || tx.extra.trim() == "" ? "-" : tx.extra;
    document.getElementById('tx-amount').innerHTML = tx.amount + ' XLC';
	modal.show();
	modal.emit('status', 'loaded');
});
