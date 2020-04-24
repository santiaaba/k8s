const K8sApi = require("./k8s_api.js")
const valid_name = /^[a-z][a-z0-9]+$/

module.exports = {

nuevo: function(req,res){

	var inserId=0
	var k8s_api = new K8sApi('10.120.78.86','6443')

	/* Verificaciones previas */
	/* validez de datos */
	console.log("Revisando: " + req.body.name)
	if(! valid_name.test(req.body.name)){
		res.status(410).send('{"error":"Parametros incorrectos"}')
		return
	}
	/* Existencia usuario */
	userInfo(req.params.userid,db)
	.then(rows => {
		sql = 'insert into namespace(user_id,name) values (' +
			  req.params.userid + ',"' + req.body.name + '")'
		console.log(sql)
		return db.query(sql)
	},err=>{
		return new Promise((resolve,reject)=>{
			res.status(410).send('{"error":"Usuario inexistente"}')
		})
	})

	sql = 'select id from user where id =' + req.params.userid
	console.log(sql)
	db.query(sql)
	.then( rows => {
		if(rows.length != 1){
			res.status(410).send('{"error":"Usuario inexistente"}')
			return
		}
		sql = 'insert into namespace(name) values ("' + req.body.name + '")'
		console.log(sql)
		return db.query(sql)
	})
	/* Creamos Namespace en K8S */
	.then( rows => {
		insertId = rows.insertId
		console.log("ID generado =" + insertId)
		var diccionario = new Array
		diccionario.push({'regex':'_namespace_name_','value':req.body.name})
		/* Creamos el namespace */
		//var k8s_api = new K8sApi('10.120.78.86','6443')
		return k8s_api.call('/api/v1/namespaces','POST','alta_namespace.yaml',diccionario)
	}, err => {
		errorDB()
	})

	.then( ok => {
		console.log("Namespace dado de ALTAAA!!")
		var url = '/apis/networking.k8s.io/v1/namespaces/' + req.body.name + '/networkpolicies'
		var diccionario = new Array
		diccionario.push({'regex':'_namespace_name_','value':req.body.name})
		return k8s_api.call(url,'POST','alta_networkpolicy.yaml',diccionario)
	}, err => {
		console.log("Fallo alta namespace en K8s")
		sql = 'delete from namespace where id = "' + insertId + '"'
		console.log(sql)
		db.query(sql)
		.then(rows => {
				res.status(500).send('{"error":"No se pudo crear el namespace en K8S"}')
		})
		.catch(err => {
				res.status(500).send('{"error":"Error fatal. Base de datos no responde"}')
		})
	})
	.then( ok => {
		console.log("NetworkPolicy dada de alta!!")
		res.send("Namespace dado de alta")
	}, err => {
		console.log("Fallo alta NetworkPolicy en K8s")
		//var k8s_api = new K8sApi('10.120.78.86','6443')
		k8s_api.call('/api/v1/namespaces/' + req.body.name,'DELETE','none.yaml',{})
		.then(ok=>{
			sql = 'delete from namespace where id = "' + insertId + '"'
			console.log(sql)
			db.query(sql)
		}, err =>{
				res.status(500).send('{"error":"Error Fatal"}')
		})
		.then(rows => {
				res.status(401).send('{"error":"No se pudo crear el namespace en K8S"}')
		})
		.catch(err => {
				res.status(500).send('{"error":"Error Fatal"}')
		})
	})
},

list: function(req,res){
	/* Listado de namespaces del usuario */
	sql = 'select id,name from namespace where user_id =' + req.params.userid
	console.log(sql)
	db.query(sql)
	.then( rows => {
		res.send(JSON.stringify(rows))
	})
	.catch( err => {
		errorDB(err)
	})
},

show: function(req,res){
	/* Retorna la información de un namespace en particular */

	var k8s_api = new K8sApi('10.120.78.86','6443')

	module.exports.checkUserNamespace(req.params.userid,req.params.namespaceid)
	.then(ok =>{
		return module.exports.namespaceNameById(req.params.namespaceid)
	}, err => {
		console.log(err)
		return new Promise((resolv,reject) => {
			res.status(err.code).send(err.message)
		})
	})
	.then(name =>{
		console.log("Consultando API de K8s")
		return k8s_api.call('/api/v1/namespaces/' + name,'GET','none.yaml',{})
	}, err => {
		console.log(err)
		return new Promise((resolv,reject) => {
			res.status(err.code).send(err.body)
		})
	})
	.then( ok => {
		res.status(ok.status).send(ok.message)
	})
	.catch( err => {
		console.log(err)
		res.status(err.status).send(err.message)
	})
},

drop: function(req,res){
	/* OJO... lo correcto sería enviar a eliminar el
	 * namespace y cuando k8s confirma su eliminacion,
	 * eliminarlo de la base de datos. */

	/* Elimina un namespace */
	var k8s_api = new K8sApi('10.120.78.86','6443')

	module.exports.checkUserNamespace(req.params.userid,req.params.namespaceid)
	.then(ok =>{
		console.log("Buscando nombre")
		return module.exports.namespaceNameById(req.params.namespaceid)
	}, err => {
		console.log("Error usernamespace")
		return new Promise((resolv,reject) => {
			res.status(err.code).send(err.message)
		})
	})
	.then(name =>{
		console.log("Enviando consulta a api K8S")
		return k8s_api.call('/api/v1/namespaces/' + name,'DELETE','none.yaml',{})
	}, err => {
		console.log(err)
		return new Promise((resolv,reject) => {
			res.status(err.code).send(err.message)
		})
	})
	.then(ok =>{
		sql="delete from namespace where id = " + req.params.namespaceid
		console.log(sql)
		return db.query(sql)
	},err=>{
		return new Promise((resolv,reject) => {
			res.status(500).send('{"error":"Base de datos no responde"}')
		})
	})
	.then(rows => {
		res.send("Namespace eliminado")
	})
	.catch(err => {
		res.status(500).send('{"error":"Namespace pudo eliminarse de kubernetes pero no de la base de datos."}')
	})
},

checkUserNamespace: function(idUser,idNamespace){
	/* Verifica que usuario y namespace existan */
	return new Promise((resolv,reject) => {
		sql = 'select id from user where id = ' + idUser
		console.log(sql)
		db.query(sql)
		.then(rows=>{
			console.log("----rows----")
			console.log(rows)
			console.log("-------------")
			if(rows.length == 1){
				sql = 'select name from namespace where id =' + idNamespace
					  ' and user_id = ' + idUser
				db.query(sql)
				.then(rows => {
					if(rows.length == 1){
						resolv()
					} else {
						reject({code:402,message:"Namespace no existe"})
					}
				}, err => {
					console.log(err)
					reject({code:500,message:"Error en base de datos"})
				})
			} else {
				reject({code:401,message:"usuario no existe"})
			}
		}, err =>{
			return new Promise((resolv,reject)=>{
				console.log(err)
				reject({code:500,message:"Error en base de datos"})
			})
		})
	})
},

namespaceNameById: function(idNamespace){
	return new Promise((resolv,reject) => {
		sql = "select name from namespace where id = " + idNamespace
		console.log(sql)
		db.query(sql)
		.then(rows =>{
			if(rows.length == 1){
				resolv(rows[0].name)
			} else {
				reject({code:402,message:"Namespace no existe"})
			}
		}, err =>{
			reject({code:500,message:"Error en abse de datos"})
		})
	})
}

} /* Fin del modulo */

function userInfo(id,db){
	sql = 'select id from user where id =' + id
	console.log(sql)
	return db.query(sql)
}

function errorDB(err){
	return new Promise((resolve,reject) => {
		console.log(err)
		switch(err.code){
			case 'ER_DUP_ENTRY':
				console.log("NAMESPACE DUPLICADO")
				res.status(401).send('{"error":"Ya existe el namespace segun la base de datos"}')
				break
			default :
				console.log("BASE NO RESPONDE")
				res.status(500).send('{"error":"Base de datos no responde"}')
		}
	})
}
