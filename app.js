// Native packages
var https = require('https');
var formData = require('form-data');

// NPM packages
var axios = require('axios');
var async = require('async');
var jsdom = require('jsdom').JSDOM;

// Local packages
var Config = require('./config');
console.log(Config);

if(Config.domain.startsWith('.'))
	Config.domain = Config.domain.substr(1);

axios.defaults.withCredentials = true;
var pihole = axios.create({
	baseURL: `${Config.pihole_protocol}://${Config.pihole_address}:${Config.pihole_port}`,
	withCredentials: true,
	httpsAgent: new https.Agent({
		rejectUnauthorized: false
	})
});


var pihole_token, pihole_cookie;
var pihole_mapping = {};
var pfsense_mapping = {};
var actions = [];

async.series([
	get_dhcp_reservations,
	get_pihole_token,
	get_pihole_dns,
	compare_domains,
	process_actions
], function(error) {
	console.error(error);
});


function process_actions(callback) {
	if(actions.length==0) {
		return callback('no actions to perform');
	}

	async.eachLimit(actions, 2, function(action, each_callback) {
		if(action.action=='add')
			pihole_add_dns(action, each_callback);
		else if(action.action=='update')
			pihole_update_dns(action, each_callback);
		else
			each_callback();
	}, callback);
}


function pihole_add_dns(data, callback) {
	var form = new formData();
	form.append('action', 'add');
	form.append('ip', data.ip);
	form.append('domain', data.domain);
	form.append('token', pihole_token);

	var opts = {
		headers: {
			Cookie: pihole_cookie.join(';'),
			...form.getHeaders()
		}
	};

	pihole.post('/admin/scripts/pi-hole/php/customdns.php', form, opts)
	.then(function(response) {
		console.log(`+ ${data.ip} -> ${data.domain} => ${response.status}`);
		callback(null, response.status);
	})
	.catch(function(error) {
		console.error('ERROR', error);
		callback(error);
	});
}


function pihole_update_dns(data, callback) {
	async.series([
		function(series_callback) {
			pihole_delete_dns(data, callback);
		},
		function(series_callback) {
			pihole_add_dns(data, callback);
		},
	], callback);
}


function pihole_delete_dns(data, callback) {
	var form = new formData();
	form.append('action', 'delete');
	form.append('ip', action.ip);
	form.append('domain', action.domain);
	form.append('token', pihole_token);

	var opts = {
		headers: {
			Cookie: pihole_cookie.join(';'),
			...form.getHeaders()
		}
	};

	pihole.post('/admin/scripts/pi-hole/php/customdns.php', form, opts)
	.then(function(response) {
		console.log(`- ${data.ip} -> ${data.domain} => ${response.status}`);
		callback(null, response.status);
	})
	.catch(function(error) {
		console.error('ERROR', error);
		callback(error);
	});
}



function compare_domains(callback) {
	Object.keys(pfsense_mapping).forEach(function(pf_domain) {
		var pf_ip = pfsense_mapping[pf_domain];

		// If the DNS is NOT in pi-hole, add it
		if(typeof pihole_mapping[pf_domain]=='undefined') {
			actions.push({
				action: 'add',
				domain: pf_domain,
				ip: pf_ip
			});

		// If it is in pi-hole, make sure the IP addresses match
		// If they don't match, update the record
		} else {
			if(pihole_mapping[pf_domain]!=pf_ip)
				actions.push({
					action: 'update',
					domain: pf_domain,
					ip: pf_ip
				});
		}
	});

	callback();
}


function get_pihole_dns(callback) {
	var form = new formData();
	form.append('action', 'get');
	form.append('token', pihole_token);

	var opts = {
		headers: {
			Cookie: pihole_cookie.join(';'),
			...form.getHeaders()
		}
	};

	pihole.post('/admin/scripts/pi-hole/php/customdns.php', form, opts)
	.then(function(response) {
		if(response.status==200)
			process_pihole_dns(response.data, callback);
	})
	.catch(function(error) {
		console.error('ERROR', error);
		callback(error);
	});
}


function process_pihole_dns(data, callback) {
	if(typeof data.data!='undefined')
		data = data.data;

	data.forEach(function(item) {
		pihole_mapping[item[0]] = item[1];
	});

	callback();
}


function get_pihole_token(callback) {
	var form = new formData();
	form.append('pw', Config.pihole_password);

	var opts = {
		params: 'login',
		headers: form.getHeaders()
	};

	pihole.post('/admin/index.php', form, opts)
	.then(function(response) {
		if(response.status==200)
			process_login_data(response, callback);
	})
	.catch(function(error) {
		console.log('ERROR', error);
		callback(error);
	});
}


function process_login_data(response, callback) {
	pihole_cookie = response.headers['set-cookie'];

	var html = response.data;
	var doc = new jsdom(html).window;
	var $ = require('jquery')(doc);

	pihole_token = $('#token').text();

	callback();
}


function get_dhcp_reservations(callback) {
	// Get list of DHCP static reservations from pfSense
	axios.request({
		method: 'get',
		baseURL: `${Config.pfsense_protocol}://${Config.pfsense_address}:${Config.pfsense_port}`,
		url: `/api/v1/services/dhcpd/static_mapping`,
		params: {
			interface: 'lan'
		},
		headers: {
			'Authorization': `${Config.pfsense_client_id} ${Config.pfsense_client_token}`
		},
		httpsAgent: new https.Agent({
			rejectUnauthorized: false
		})
	}).then(function(response) {
		if(response.status==200)
			process_dhcp_mappings(response.data, callback);
	}).catch(function(error) {
		console.error('ERROR', error);
		callback(error);
	});
}


function process_dhcp_mappings(data, callback) {
	if(typeof data.data!='undefined')
		data = data.data;

	for(var i=0; i<data.length; i++) {
		var item = data[i];

		pfsense_mapping[`${item.hostname}.${Config.domain}`] = item.ipaddr;
	}

	callback();
}
