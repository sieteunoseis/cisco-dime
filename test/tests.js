/*jshint esversion: 11 */
const blueBirdPromise = require("bluebird");
const ciscoSoap = require("../main");
const fse = require("fs-extra");

var servers = [
  {
    hostname: "10.10.20.1",
    username: "administrator",
    password: "ciscopsdt",
    filename: "/var/log/active/platform/cli/ciscotacpub.cap",
  },
  {
    hostname: "10.10.20.2",
    username: "administrator",
    password: "ciscopsdt",
    filename: "/var/log/active/platform/cli/test.cap",
  },
];

if (servers) {
  console.log("Running test.....");

  (async () => {
    await blueBirdPromise
      .map(servers, async function (server) {
        let currentServer = server.hostname;
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
        return [currentServer, output];
      })
      .then(function (results) {
        console.log(
          "The listNodeServiceLogs method returns the node names in the cluster and the lists of associated service names."
        );
        blueBirdPromise.map(results, function (result) {
          if (result) {
            console.log("Results from:", result[0]);
            console.log("Found:", result[1].length, "services");
            console.log(result[1]);
          }
        });
      });
  })();

  (async () => {
    // host,username,password,servicelog,todate,fromdate,timezone
    await blueBirdPromise
      .map(servers, async function (server) {
        let currentServer = server.hostname;
        let output = await ciscoSoap
          .selectLogFiles(
            server.hostname,
            server.username,
            server.password,
            "Cisco CallManager",
            "10/05/22 11:05 AM",
            "10/04/22 11:00 AM",
            "Client: (GMT+0:0)Greenwich Mean Time-Europe/London"
          )
          .catch((err) => {
            console.log(err, server.hostname);
            return false;
          });
        return [currentServer, output];
      })
      .then(function (results) {
        console.log(
          "The selectLogFiles method lists available service log files, or requests 'push' delivery of service log files based on a selection criteria."
        );
        blueBirdPromise.map(results, function (result) {
          if (result[1]) {
            console.log("Results from:", result[0]);
            console.log(result[1]);
          }
        });
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
            fse.outputFile(filename, result.data, (err) => {
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
