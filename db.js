/* Modulo para la conexion a la base de datos */
const mysql = require('mysql')
//const mysql = require('@mysql/xdevapi')

const db_host = "localhost"
const db_user = "k8s"
const db_pass = "sAn474226"
const db_db = "k8s"

class Database {
	constructor(config){
		this.connection = mysql.createPool({
			connectionLimit: 10,
			host: db_host,
			user: db_user,
			database: db_db,
			password: db_pass
		})
	}
	query(sql){
		return new Promise((resolve,reject) => {
			this.connection.query(sql,(err,rows) => {
				if(err)
					return reject(err)
				resolve(rows)
			})
		})
	}
	close(){
		return new Promise((resolve,reject) => {
			this.connection.end(err => {
				if(err)
					return reject(err)
				resolve()
			})
		})
	}
}

module.exports = Database
