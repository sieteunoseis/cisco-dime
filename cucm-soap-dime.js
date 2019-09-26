var util = require("util");
var https = require("https");

var XML_ENVELOPE = '<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap/"><soapenv:Header/><soapenv:Body><soap:GetOneFile soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><FileName xsi:type="get:FileName" xmlns:get="http://cisco.com/ccm/serviceability/soap/LogCollection/GetFile/">%s</FileName></soap:GetOneFile></soapenv:Body></soapenv:Envelope>'

var SELECT_XML_ENVELOPE = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">' +
	'<soapenv:Header/>' +
	'<soapenv:Body>' +
		'<soap:selectLogFiles>' +
			'<soap:FileSelectionCriteria>' +
				'<soap:ServiceLogs>' +
					'<soap:item>%s</soap:item>' +
				'</soap:ServiceLogs>' +
				'<soap:SystemLogs>' +
					'<soap:item></soap:item>' +
				'</soap:SystemLogs>' +
				'<soap:SearchStr></soap:SearchStr>' +
				'<soap:Frequency>OnDemand</soap:Frequency>' +
				'<soap:JobType>DownloadtoClient</soap:JobType>' +
				'<soap:ToDate>%s</soap:ToDate>' +
				'<soap:FromDate>%s</soap:FromDate>' +
				'<soap:TimeZone>%s</soap:TimeZone>' +
				'<soap:RelText>None</soap:RelText>' +
				'<soap:RelTime></soap:RelTime>' +
				'<soap:Port></soap:Port>' +
				'<soap:IPAddress></soap:IPAddress>' +
				'<soap:UserName/></soap:UserName>' +
				'<soap:Password></soap:Password>' +
				'<soap:ZipInfo></soap:ZipInfo>' +
				'<soap:RemoteFolder></soap:RemoteFolder>' +
			'</soap:FileSelectionCriteria>' +
		'</soap:selectLogFiles>' +
	'</soapenv:Body>' +
'</soapenv:Envelope>'

var LIST_XML_ENVELOPE = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">' +
	'<soapenv:Header/>' +
		'<soapenv:Body>' +
			'<soap:listNodeServiceLogs>' +
				'<soap:ListRequest>' +
				'</soap:ListRequest>' +
			'</soap:listNodeServiceLogs>' +
		'</soapenv:Body>' +
	'</soapenv:Envelope>'

function CucmSoapGetSession(cucmServerUrl, cucmUser, cucmPassword) {
	this._OPTIONS =  {
		host: cucmServerUrl,  // The IP Address of the Communications Manager Server
		port: 8443,           // Port 8443 is required for this service
		path: '/logcollectionservice/services/DimeGetFileService', // This is the URL for accessing soap on the server
		method: 'POST',      // SOAP Requires POST messages
		headers: {
			'SOAPAction': 'http://schemas.cisco.com/ast/soap/action/#LogCollectionPort#GetOneFile',
			'Authorization': 'Basic ' + Buffer.from(cucmUser + ":" + cucmPassword).toString('base64'), 
			'Content-Type': 'text/xml;charset=UTF-8'
		},
		timeout: 60000, // Default: 120000 (2 minutes)
		rejectUnauthorized: false   // required to accept self-signed certificate
	}
}

function CucmSoapSelectSession(cucmServerUrl, cucmUser, cucmPassword) {
	this._OPTIONS =  {
		host: cucmServerUrl,  // The IP Address of the Communications Manager Server
		port: 8443,           // Port 8443 is required for this service
		path: '/logcollectionservice2/services/LogCollectionPortTypeService', // This is the URL for accessing soap on the server
		method: 'POST',      // SOAP Requires POST messages
		headers: {
			'SOAPAction': 'selectLogFiles',
			'Authorization': 'Basic ' + Buffer.from(cucmUser + ":" + cucmPassword).toString('base64'), 
			'Content-Type': 'text/xml;charset=UTF-8'
		},
		timeout: 60000, // Default: 120000 (2 minutes)
		rejectUnauthorized: false   // required to accept self-signed certificate
	}
}

function CucmSoapListSession(cucmServerUrl, cucmUser, cucmPassword) {
	this._OPTIONS =  {
		host: cucmServerUrl,  // The IP Address of the Communications Manager Server
		port: 8443,           // Port 8443 is required for this service
		path: '/logcollectionservice2/services/LogCollectionPortTypeService', // This is the URL for accessing soap on the server
		method: 'POST',      // SOAP Requires POST messages
		headers: {
			'SOAPAction': 'listNodeServiceLogs',
			'Authorization': 'Basic ' + Buffer.from(cucmUser + ":" + cucmPassword).toString('base64'), 
			'Content-Type': 'text/xml;charset=UTF-8'
		},
		timeout: 60000, // Default: 120000 (2 minutes)
		rejectUnauthorized: false   // required to accept self-signed certificate
	}
}
// Array to hold the Session ID's
var sessionIdArr = []

CucmSoapGetSession.prototype.getOneFileResponse = function(file, callback) {
	var XML = util.format(XML_ENVELOPE, file);
	var soapBody = Buffer.from(XML);
	var options = this._OPTIONS;

	// Get Session ID
	if (sessionIdArr.filter(item => (item.server === options.host)).length > 0){
		delete options.headers['Authorization']
		options.headers['Authorization'] = 'Basic ' + Buffer.from(settings.cucmuser).toString('base64')
		options.headers['Cookie'] = sessionIdArr.filter(item => (item.server === options.host))[0].sessionIdSSO
	}


	options.agent = new https.Agent({ keepAlive: false });

	req = https.request(options, async function(res) {

		if (res.statusCode == 200){
			var data = [];
		
			var payload = {
				header:'',
				data:''
			}
	
			payload.header = res.headers

			if (sessionIdArr.filter(item => (item.server === options.host)).length < 1){
				sessionIdArr.push({'server':options.host,'sessionId':payload.header['set-cookie'][1],'sessionIdSSO': payload.header['set-cookie'][0]})
			}
	
			res.on('data', function(chunk) {
				data.push(chunk);
			}).on('end', function() {	
				var buffer = Buffer.concat(data);
				
				payload.data = buffer
					
				callback(null, payload)
			});
		}else{
			callback('Status Code: ' + res.statusCode, null)
		}
	});

	// use its "timeout" event to abort the request
	req.on('timeout', () => {
		req.abort();
	});

	req.end(soapBody);
};

CucmSoapSelectSession.prototype.selectLogFilesResponse = function(servicelog,todate,fromdate,timezone,callback) {
	var XML = util.format(SELECT_XML_ENVELOPE,servicelog,todate,fromdate,timezone);
	var soapBody = Buffer.from(XML);
	var options = this._OPTIONS;
	options.agent = new https.Agent({ keepAlive: false });

	req = https.request(options, function(res) {
		if (res.statusCode == 200){
			var data = [];
			
			var payload = {
				header:'',
				data:''
			}

			payload.header = res.headers		

			res.on('data', function(chunk) {
				data.push(chunk);
			}).on('end', function() {
				var buffer = Buffer.concat(data);
				payload.data = buffer		
				callback(null, payload)
			});
		}else{
			callback('Status Code: ' + res.statusCode)
		}
	});

	// use its "timeout" event to abort the request
	req.on('timeout', () => {
		req.abort();
	});

	req.end(soapBody);
};

CucmSoapListSession.prototype.listNodeServiceLogsResponse = function(callback) {
	var soapBody = Buffer.from(LIST_XML_ENVELOPE);
	var options = this._OPTIONS;
	options.agent = new https.Agent({ keepAlive: false });

	req = https.request(options, function(res) {
		if (res.statusCode == 200){
			var data = [];
			
			var payload = {
				header:'',
				data:''
			}

			payload.header = res.headers		

			res.on('data', function(chunk) {
				data.push(chunk);
			}).on('end', function() {
				var buffer = Buffer.concat(data);
				payload.data = buffer
				callback(null, payload)
			});
		}else{
			callback('Status Code: ' + res.statusCode)
		}
	});

	// use its "timeout" event to abort the request
	req.on('timeout', () => {
		req.abort();
	});

	req.end(soapBody);
};

module.exports = {
	get: function(cucmServerUrl, cucmUser, cucmPassword) {
		return new CucmSoapGetSession(cucmServerUrl, cucmUser, cucmPassword);
	},
	list: function(cucmServerUrl, cucmUser, cucmPassword) {
			return new CucmSoapListSession(cucmServerUrl, cucmUser, cucmPassword);
	},
	select: function(cucmServerUrl, cucmUser, cucmPassword) {
			return new CucmSoapSelectSession(cucmServerUrl, cucmUser, cucmPassword);
	}
}
