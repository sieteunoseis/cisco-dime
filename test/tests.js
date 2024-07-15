/*jshint esversion: 11 */
const blueBirdPromise = require("bluebird");
const ciscoDime = require("../main");
const fse = require("fs-extra");
const { cleanEnv, str, host } = require("envalid");
const path = require("path");

// Set up vanilla date time variables
let date_ob = new Date();
let date_ob_5 = new Date(date_ob);
date_ob_5.setMinutes(date_ob.getMinutes() - 160);
let currentCalendar = date_ob.toLocaleString().split(',')[0]
let currentTime = date_ob.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })
let futureTime = date_ob_5.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })
let currentDateTime = currentCalendar.concat(" ", currentTime)
let pastDateTime = currentCalendar.concat(" ",futureTime)

// If not production load the local env file
if (process.env.NODE_ENV === "development") {
  require("dotenv").config({
    path: path.join(__dirname, "..", "env", "development.env"),
  });
} else if (process.env.NODE_ENV === "test") {
  require("dotenv").config({
    path: path.join(__dirname, "..", "env", "test.env"),
  });
} else if (process.env.NODE_ENV === "staging") {
  require("dotenv").config({
    path: path.join(__dirname, "..", "env", "staging.env"),
  });
}

const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "test", "production", "staging"],
    desc: "Node environment",
  }),
  CUCM_HOSTNAME: host({ desc: "Cisco CUCM Hostname or IP Address." }),
  CUCM_USERNAME: str({ desc: "Cisco CUCM AXL Username." }),
  CUCM_PASSWORD: str({ desc: "Cisco CUCM AXL Password." }),
});

var servers = [
  {
    hostname: env.CUCM_HOSTNAME,
    username: env.CUCM_USERNAME,
    password: env.CUCM_PASSWORD,
    filename: "/var/log/active/platform/cli/testcapture.cap01",
  },
  {
    hostname: env.CUCM_HOSTNAME,
    username: env.CUCM_USERNAME,
    password: env.CUCM_PASSWORD,
    filename: "/var/log/active/platform/cli/testcapture.cap02",
  },
];

if (servers) {
  console.log("Running test.....");

  (async () => {
    let serviceLogsNames = await ciscoDime
      .listNodeServiceLogs(
        env.CUCM_HOSTNAME,
        env.CUCM_USERNAME,
        env.CUCM_PASSWORD
      )
      .catch((err) => {
        console.log(err);
      });
    console.log(
      "The listNodeServiceLogs method returns the node names in the cluster and the lists of associated service names."
    );
    console.log(serviceLogsNames);
  })();

  (async () => {
    await blueBirdPromise
      .map(servers, async function (server) {
        let output = await ciscoDime
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
        let output = await ciscoDime
          .selectLogFiles(
            server.hostname,
            server.username,
            server.password,
            "Cisco CallManager",
            pastDateTime, // From Date
            currentDateTime, // To Date
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

  // TODO: Add test to download files

  // (async () => {
  //   await blueBirdPromise
  //     .map(servers, function (server) {
  //       return ciscoDime
  //         .getOneFile(
  //           server.hostname,
  //           server.username,
  //           server.password,
  //           server.filename
  //         )
  //         .catch((err) => {
  //           console.log(err);
  //           return false;
  //         });
  //     })
  //     .then(function (results) {
  //       blueBirdPromise.map(results, function (result) {
  //         if (result) {
  //           // Change output file name to whatever you'd like
  //           var filename = result.filename.substring(
  //             result.filename.lastIndexOf("/") + 1
  //           ); // Let's get the file name from the full path

  //           // path.join(__dirname,results.server, filename);
  //           var filePath = path.join(__dirname,result.server, filename);

  //           fse.outputFile(filePath, result.data, (err) => {
  //             if (err) {
  //               console.log(err);
  //             } else {
  //               console.log("Successfully retrieved file:", filename);
  //             }
  //           });
  //         } else {
  //           console.log("Error retrieving file");
  //         }
  //       });
  //     });
  // })();
}
