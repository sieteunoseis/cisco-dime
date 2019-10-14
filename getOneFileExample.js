const Promise = require('bluebird');
const ciscoSoap = require('./main')
const fse = require('fs-extra');
var servers = [
    {
        'ipaddress':'localhost',
        'username':'username',
        'password':'password',
        'filename':'cm/trace/dirsync/log4j/dirsync_err00074.log'
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
                fse.outputFile("dirsync_err00074.log", result, err => {
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
