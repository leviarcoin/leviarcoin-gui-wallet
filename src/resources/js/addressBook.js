var imgPath = __dirname + '/resources/images/';

var fnAddressBookAddBtn = function() {
	var address = $("#form-s-1").val(),
		paymentId = $("#form-s-2").val(),
		name = $("#form-s-addressbook").val();
		
	if(name.trim() == "") return;
	fnAddressBookAdd(name, address, paymentId);
}

var fnAddressBookAdd = function(name, address, paymentId) {
	var ab = remote.getGlobal('wallet').addressBook;
	
	if(ab[name] != null) {
		return;
	}
	
	ab[name] = {
		address: address,
		paymentId: paymentId
	};
	
	remote.getGlobal('wallet').addressBook = ab;
	fnSaveAddressBook();
	fnRefreshAddressBook();
}

var fnAddressBookDelete = function(delName) {
	var ab = remote.getGlobal('wallet').addressBook,
		newAb = {};
	
	if(ab[delName] == null) return;
	
	for (var name in ab) {
		if(delName != name) newAb[name] = ab[name];
	}
	
	remote.getGlobal('wallet').addressBook = newAb;
	fnSaveAddressBook();
	fnRefreshAddressBook();
}

var fnSaveAddressBook = function() {
	var fs = require('fs');
	var ab = remote.getGlobal('wallet').addressBook;
	var filepath = "addressbook.dat";
	
	fs.writeFile(filepath, JSON.stringify(ab), (err) => {
		if (err) {
			console.log("Error updating address book.");
			console.log(err);
			return;
		}
		console.log("Address book updated.");
	});
}

var fnLoadAddressBook = function() {
	var fs = require('fs');
	var filepath = "addressbook.dat";
	var ab = {};
	
	fs.readFile(filepath, 'utf8', function (err, data) {
		if (err) {
			console.log("Error loading address book.");
			console.log(err);
			return;
		}
		
		try {
			ab = JSON.parse(data);
		} catch(e) {
			fnRefreshAddressBook();
			return;
		}
		console.log("Address book loaded.");
		
		remote.getGlobal('wallet').addressBook = ab;
		fnRefreshAddressBook();
		return;
	});
}

var menu = [{
	name: 'Delete',
	img: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAS0lEQVQ4T2NkwAT/sYghCzHi5EAlQAagKELSgCGHTSFZLiCkCZevGGEuoNgAmA3IfiSGjRFYxGhCCUj0QBw1gIFhNAwgYUAMgKcfACfmLxF2nK5wAAAAAElFTkSuQmCC',
	disable: false,
	fun: function (data, event) {
		try{
			var abDel = data.trigger[0].dataset.name;
		}catch(e){
			console.log
			return;
		}
		
		fnAddressBookDelete(abDel);
	}
}];

var fnRefreshAddressBook = function() {
	var ab = remote.getGlobal('wallet').addressBook,
		$abc = $("#addressbook-container");
	
	$abc.empty();
	
	if(ab.length == 0) $abc.html('<div class="addressbook-empty"><i>Address Book is empty!</i></div>');
	
	for (var name in ab) {
		var address = ab[name].address,
			paymentId = ab[name].paymentId;
		var template = '<div data-address="' + address + '" data-pid="' + paymentId + '" data-name="' + name + '" class="addressbook-entry"><div class="addressbook-name">' + name + '</div><div class="addressbook-address">' + address + '</div><div class="addressbook-payment-id">' + paymentId + '</div></div>';
		$abc.append(template);
	}
	$(".addressbook-entry").contextMenu(menu, {triggerOn: 'contextmenu'});
}

$(document).on("click", ".addressbook-entry", function() {
	$(".addressbook-entry").removeClass("selected");
	
	var $t = $(this),
		address = $t.attr("data-address"),
		paymentId = $t.attr("data-pid"),
		name = $t.attr("data-name");
	
	$t.addClass("selected");
		
	$("#form-s-1").val(address);
	$("#form-s-2").val(paymentId);
	$("#form-s-addressbook").val(name);
}).on("contextmenu", ".addressbook-entry", function() {
	$(".addressbook-entry").removeClass("selected");
	$(this).addClass("selected");
});

fnLoadAddressBook();
