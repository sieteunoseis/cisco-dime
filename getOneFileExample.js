const Promise = require('bluebird');
const ciscoSoap = require('./main')
const fse = require('fs-extra');
var servers = [
    {
        'ipaddress':'170.2.96.93',
        'username':'wordenj',
        'password':'Timbers2019!',
        'filename':'/var/log/active/platform/cli/packets.cap'
    }
]

if (servers){
    // Using Promise.map:
    Promise.map(servers, function(server) {
        return ciscoSoap.getOneFile(server.ipaddress,server.username,server.password,server.filename).catch(err => {
            console.log(err)
            return false
        });
    }).then(function(results) {
        Promise.map(results, function(result) {
            if (result){
                // Change output file name to whatever you'd like
                fse.outputFile("packets.pcap", result, err => {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log('Successfully retrieved file');
                    }
                })
            }else{
                console.log('Error retrieving file')
            }
        })
        
    });

}