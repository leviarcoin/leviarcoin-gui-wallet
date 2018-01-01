const Store = require('electron-store');
const store = new Store();

self.addEventListener("message", function(e) {
    var settingsObj = e.data;
    
    
    
    console.log("Settings saved");
}, false);
