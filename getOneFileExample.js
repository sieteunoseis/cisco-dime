
const Promise = require('bluebird');
const ciscoSoap = require('./main')
const fse = require('fs-extra');
var servers = [
    {
        'ipaddress':'localhost',
        'username':'administrator',
        'password':'changeMe'
    }
]

if (servers){
    // Using Promise.map:
    Promise.map(servers, function(server) {
        // Promise.map awaits for returned promises as well.
        return ciscoSoap.getOneFile(server.ipaddress,server.username,server.password,"/var/log/active/platform/cli/packets.cap");
    }).then(function(results) {
        Promise.map(results, function(result) {
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