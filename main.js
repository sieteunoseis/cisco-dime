var cucmDime = require('./cucm-soap-dime');
var multipart = require('./multipart');
var parseString = require('xml2js').parseString;

module.exports = {
	getOneFile: function(ipaddress,file) {
		let cucm = cucmDime.get(ipaddress, settings.cucmuser, settings.cucmpass);
		
		return new Promise((resolve, reject) => {
			cucm.GetOneFileResponse(file, function(err, response) {
				if (err){
					reject(err)
				}
				var body = response.data
				var boundary = multipart.getBoundary(response.header['content-type'],'"');
				var parts = multipart.Parse(body, boundary);

				for (var i = 0; i < parts.length; i++) {
					var part = parts[i];

					var convertPart = part.data.toString('binary').trim()
					var output = Buffer.from(convertPart, 'binary')

					if (part.filetype !== 'text/xml') {
						resolve(output)
					}
				}
			})
		})
	},
	selectFiles: function(ipaddress,servicelog,todate,fromdate,timezone) {
		
		return new Promise(function(resolve, reject) {
		 	// Do async job
			let cucm = cucmDime.select(ipaddress, settings.cucmuser, settings.cucmpass);
			
			cucm.selectLogFilesResponse(servicelog,todate,fromdate,timezone, function(err, response) {
				if (err){
					reject(err)
				}
				var body = response.data
				var boundary = multipart.getBoundary(response.header['content-type'],'=');
				var parts = multipart.Parse(body, boundary);

				for (var i = 0; i < parts.length; i++) {
					var part = parts[i];

					var xmlPart = part.data.toString('binary').trim()
					
					parseString(xmlPart, { explicitArray: false, explicitRoot: false }, function (err, result) {
						resolve(result['soapenv:Body']['ns1:selectLogFilesResponse']['ns1:ResultSet']['ns1:SchemaFileSelectionResult']['ns1:Node']['ns1:ServiceList']['ns1:ServiceLogs']['ns1:SetOfFiles']['ns1:File'])
					});
				}
			})

		})			
	},
	listFiles: function(ipaddress) {
		
		return new Promise(function(resolve, reject) {
		 	// Do async job
			let cucm = cucmDime.list(ipaddress, settings.cucmuser, settings.cucmpass);
			
			cucm.listNodeServiceLogsResponse(function(err, response) {
				if (err){
					reject(err)
				}

				var body = response.data
				var boundary = multipart.getBoundary(response.header['content-type'],'=');
				var parts = multipart.Parse(body, boundary);

				for (var i = 0; i < parts.length; i++) {
					var part = parts[i];

					var xmlPart = part.data.toString('binary').trim()
					
					parseString(xmlPart, { explicitArray: false, explicitRoot: false }, function (err, result) {
						resolve(result['soapenv:Body']['ns1:listNodeServiceLogsResponse']['ns1:listNodeServiceLogsReturn'][0]['ns1:ServiceLog']['ns1:item'])
					});
				}
			})

		})			
	}
}