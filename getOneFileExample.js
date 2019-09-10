const Promise = require('bluebird');
const ciscoSoap = require('./main')
const fse = require('fs-extra');
var servers = [
    {
        'ipaddress':'localhost',
        'username':'administrator',
        'password':'changeMe',
        'filename':'/var/log/active/platform/cli/packets.cap'
    }
]

if (servers){
    // Using Promise.map:
    Promise.map(servers, function(server) {
        return ciscoSoap.getOneFile(server.ipaddress,server.username,server.password,server.filename);
    }).then(function(results) {
        Promise.map(results, function(result) {
            // Change output file name to whatever you'd like
            fse.outputFile("packets.pcap", result, err => {
                if (err) {
                    console.log(err);
                } else {
                    console.log('Successfully retrieved file');
                }
            })
        })
    });

}