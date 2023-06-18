const mysql = require("mysql");
const config = require("./../config.js");
const moment = require("moment-timezone");

const mysql_connect = mysql.createPool(config.database);

const Common = {
    mysql_query: async function(query, row) {
        var res = await new Promise( async (resolve, reject)=>{
	        mysql_connect.query( query, (err, res)=>{
	            return resolve(res, true);
	        });
	    });
		return Common.response(res, row);
    },

    mysql_insert: async function(table, data) {
        var res = await new Promise( async (resolve, reject)=>{
	        mysql_connect.query( "INSERT INTO "+table+" SET ?", data,  (err, res)=>{
	            return resolve(res, true);
	        });
	    });
		return res;
    },

    mysql_update: async function(table, data){
		var res = await new Promise( async (resolve, reject)=>{
	        mysql_connect.query( "UPDATE "+table+" SET ? WHERE ?", data, (err, res)=>{
	            return resolve(res, true);
	        });
	    });
		return res;
	},

    mysql_get: async function(table, data){
		var query = "SELECT * FROM "+table+" ";
		var where = "";
		if (data.length > 0) {
			for (var i = 0; i < data.length; i++) {
				if(i == 0){
					where = where + " ?";
				}else{
					where = where + " AND ?";
				}
			}
		}
		if (where != "") {
			query = query + " WHERE " + where;
		}
		var res = await new Promise( async (resolve, reject)=> {
	        mysql_connect.query(query , data, (err, res)=>{
	            return resolve(res);
	        });
	    });
		return Common.response(res, true);
	},

    mysql_fetch: async function(table, data){
		var query = "SELECT * FROM "+table+" ";
		var where = "";
		if (data.length > 0) {
			for (var i = 0; i < data.length; i++) {
				if(i == 0){
					where = where + " ?";
				}else{
					where = where + " AND ?";
				}
			}
		}
		if (where != "") {
			query = query + " WHERE " + where;
		}
		var res = await new Promise( async (resolve, reject)=> {
	        mysql_connect.query(query , data, (err, res)=>{
	            return resolve(res);
	        });
	    });
		return Common.response(res, false);
	},

	mysql_delete: async function(table, data){
		var query = "DELETE FROM "+table+" ";
		var where = ""; 
		if (data.length > 0) {
			for (var i = 0; i < data.length; i++) {
				if(i == 0){
					where = where + " ?";
				}else{
					where = where + " AND ?";
				}
			}
		}
		if (where != "") {
			query = query + " WHERE " + where;
		}
		var res = await new Promise( async (resolve, reject)=>{
	        mysql_connect.query( query, data, (err, res)=>{
	            return resolve(res, true);
	        });
	    });
		return res;
	},
    
    phoneNumberFormatter: async function(number) {
        let formatted = number.replace(/\D/g, '');
        if (formatted.startsWith('0')) {
            formatted = '62' + formatted.substr(1);
        }
        if (!formatted.endsWith('@c.us')) {
            formatted += '@c.us';
        }
        return formatted;
    }
}

module.exports = Common;