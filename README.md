dhcp-to-dns
===========

Get list of DHCP static reservations from pfSense and create corresponding DNS records in pi-hole.


Prerequisites
-------------

You must install and configure the API for pfSense (see https://github.com/jaredhendrickson13/pfsense-api).


Caveats
-------

I couldn't find a documented pi-hole API for creating local DNS records, so this script relies on logging in via the pi-hole web interface using a cleartext password.  I don't like it, but "it is what it is".


Configuration
-------------

Edit `config.js` and set the options below.  Read any mention of "pi-hole" as "pi-hole web interface" and "pfsense" as "pfsense web interface".
 - `pihole_address` - The DNS or IP address of pi-hole
 - `pihole_protocol` - The protocol (HTTP or HTTPS) used to access pi-hole
 - `pihole_port` - The TCP port pi-hole is listening on
 - `pihole_password` - Cleartext password you use to log in to pi-hole
 - `pfsense_address` - The DNS or IP address of pfSense
 - `pfsense_protocol` - The procotol (HTTP or HTTPS) used to access pfSense
 - `pfsense_port` - The TCP port pfSense is listening on
 - `pfsense_client_id` - The client ID for the pfSense API
 - `pfsense_client_token` - The client token for the pfSense API
 - `domain` - The top-level domain to append to DNS records.  For example `.lan` will create records such as `example.lan` or `myserver.lan`
