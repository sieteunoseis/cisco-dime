/*jshint esversion: 8 */
const blueBirdPromise = require("bluebird");
const ciscoSoap = require("../main");
const fse = require("fs-extra");
const { resolve } = require("bluebird");
var servers = [
  {
    ipaddress: "10.10.20.1",
    username: "administrator",
    password: "ciscopsdt",
    filename: "/var/log/active/platform/cli/test.cap6",
  },
];

if (servers) {
  blueBirdPromise.map(servers, function(server) {
      return ciscoSoap.listFiles(server.ipaddress,server.username,server.password).catch(err => {
          console.log(err);
          return false;
      });
  }).then(function(results) {
      blueBirdPromise.map(results, function(result) {
          if (result){
              console.log(result);
          }
      });
  });

  // host,username,password,servicelog,todate,fromdate,timezone
//   blueBirdPromise
//     .map(servers, function (server) {
//       return ciscoSoap
//         .selectFiles(
//           servers[0].ipaddress,
//           servers[0].username,
//           servers[0].password,
//           "Cisco CallManager",
//           "10/05/22 11:05 AM",
//           "10/04/22 11:00 AM",
//           "Client: (GMT+0:0)Greenwich Mean Time-Europe/London"
//         )
//         .catch((err) => {
//           console.log(err);
//           return false;
//         });
//     })
//     .then(function (results) {
//       blueBirdPromise.map(results, function (result) {
//         if (result) {
//           console.log(result);
//         }
//       });
//     });

  // Using Promise.map:
  // blueBirdPromise.map(servers, function(server) {
  //     return ciscoSoap.getOneFile(server.ipaddress,server.username,server.password,server.filename).catch(err => {
  //         console.log(err);
  //         return false;
  //     });
  // }).then(function(results) {
  //     blueBirdPromise.map(results, function(result) {
  //         if (result){
  //             // Change output file name to whatever you'd like
  //             var filename = result.filename.substring(result.filename.lastIndexOf('/') + 1); // Let's get the file name from the full path
  //             fse.outputFile(filename, result.data, err => {
  //                 if (err) {
  //                     console.log(err);
  //                 } else {
  //                     console.log('Successfully retrieved file:', filename);
  //                 }
  //             });
  //         }else{
  //             console.log('Error retrieving file');
  //         }
  //     });
  // });
}
