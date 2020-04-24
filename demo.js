const Database = require('./db.js')

/*****************************
 *  *      Main
 *   *****************************/

db = new Database

db.query('select * from user')
.then( rows => {console.log("Datos obtenidos")} )
.then( rows => db.close() )
.catch( (err) => {console.log("Errores")} )
