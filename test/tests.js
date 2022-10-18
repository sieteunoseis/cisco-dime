/*jshint esversion: 11 */
const blueBirdPromise = require("bluebird");
const ciscoSoap = require("../main");
const fse = require("fs-extra");
const path = require('path');

var servers = [
  {
    hostname: "10.10.20.1",
    username: "administrator",
    password: "ciscopsdt",
    filename: "/var/log/active/platform/cli/testcapture.cap0",
  },
  {
    hostname: "10.10.20.2",
    username: "administrator",
    password: "ciscopsdt",
    filename: "/var/log/active/platform/cli/testcapture.cap0",
  },
];

if (servers) {
  console.log("Running test.....");

  (async () => {
    await blueBirdPromise
      .map(servers, async function (server) {
        let output = await ciscoSoap
          .listNodeServiceLogs(
            server.hostname,
            server.username,
            server.password
          )
          .catch((err) => {
            console.log(err);
            return false;
          });
        return output;
      })
      .then(function (results) {
        console.log(
          "The listNodeServiceLogs method returns the node names in the cluster and the lists of associated service names."
        );
        console.log(results);
      });
  })();

  (async () => {
    // host,username,password,servicelog,fromdate,todate,timezone
    await blueBirdPromise
      .map(servers, async function (server) {
        let output = await ciscoSoap
          .selectLogFiles(
            server.hostname,
            server.username,
            server.password,
            "Packet Capture Logs",
            "10/17/2022 11:50 AM", // From Date
            "10/17/2022 11:52 AM", // To Date
            "Client: (GMT-8:0)America/Los_Angeles" // Client: (GMT+0:0)Greenwich Mean Time-Europe/London
          )
          .catch((err) => {
            console.log(err, server.hostname);
            return false;
          });
        return output;
      })
      .then(function (results) {
        console.log(
          "The selectLogFiles method lists available service log files, or requests 'push' delivery of service log files based on a selection criteria."
        );
        var flattened = [].concat.apply([],results); // Flatten results
        console.log(flattened);
      });
  })();

  (async () => {
    await blueBirdPromise
      .map(servers, function (server) {
        return ciscoSoap
          .getOneFile(
            server.hostname,
            server.username,
            server.password,
            server.filename
          )
          .catch((err) => {
            console.log(err);
            return false;
          });
      })
      .then(function (results) {
        blueBirdPromise.map(results, function (result) {
          if (result) {
            // Change output file name to whatever you'd like
            var filename = result.filename.substring(
              result.filename.lastIndexOf("/") + 1
            ); // Let's get the file name from the full path

            // path.join(__dirname,results.server, filename);
            var filePath = path.join(__dirname,result.server, filename);

            fse.outputFile(filePath, result.data, (err) => {
              if (err) {
                console.log(err);
              } else {
                console.log("Successfully retrieved file:", filename);
              }
            });
          } else {
            console.log("Error retrieving file");
          }
        });
      });
  })();
}
