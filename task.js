/* Modulo para la conexion a la base de datos */
module.exports = {

task: function(){
	/* Conecta con la base de datos */
	return mysql.createPool({
		connectionLimit: 10,
		host: db_host,
		user: db_user,
		database: db_db,
		password: db_passs
	});
}

} /*  Fin del modulo */
