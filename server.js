var express = require('express')
var Database = require('./db.js')

var api_namespace = require('./namespace.js')
var api_pod = require('./pod.js')
var api_deployment = require('./deployment.js')
var api_service = require('./service.js')
var api_pvc = require('./pvc.js')

var bodyParser = require("body-parser")
var cors = require('cors')

var app = express()
const port = 3000

/*****************************
 * 		Functions
 *****************************/
function tokenGenerate(){
	/* Genera un string de longitud 50 de contenido variable */
	var text = ""
	var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	const length = 50

	for (var i = 0; i < length; i++)
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	return text;
}

function userLogin(req,res){
	/* Retorna un token para el usuario que pasa la autenticacion.
	 * Si el usuario no existe o la password es incorrecta envia
	 * un mensaje de error al cliente http */

	console.log("Autenticando:" + req.body.name + ' - ' + req.body.passwd)
	var sql = "select id from user where name='" + req.body.name +
		  "' and passwd='" + req.body.passwd + "'"
	console.log(sql)
	db.query(sql)
	.then(rows => {
		if(rows.length == 0){
			res.send("usuario incorrecto")
		} else {
			var token = tokenGenerate()
			users.push({"id": rows[0].id, "token": token, "date": Date.now()})
			console.log("---AAAA USUARIOS-----")
			console.log(users)
			console.log("---------------------")
			res.send('{"id":"' + rows[0].id + '","name":"' +
					 req.body.name + '","token":"' + token + '"}')
		}
	}, err => {
		console.log(err)
		res.status(500).send('{"Error":"Error en base de datos"}')
	})
}

function permiso(req,res,next){
	/* Determina si el usuario tiene o no
 	 * permisos para la llamada que desea
 	 * realizar a la api */
	console.log("Autorizando")
	var userid = validateToken(req.header('token'))
	if (!userid){
		console.log("Token incorrecto: '" + req.header('token') + "'")
		res.status(300).send("Token incorrecto: '" + req.header('token') + "'")
		return
	}
	next()
}



/*****************************
 *		Main		
 *****************************/

db = new Database
users = new Array

app.use(bodyParser.json())
app.use(cors())

/* Login */
app.post("/v1/user/login",function(req,res){userLogin(req,res)})

/* Namespase */
app.get("/v1/app/namespace/:namespaceid", function(req,res){api_namespace.show(req,res)})
app.get("/v1/app/namespace", function(req,res){api_namespace.list(req,res)})
app.post("/v1/app/namespace", function(req,res){api_namespace.nuevo(req,res)})
app.delete("/v1/app/namespace/:namespaceid", function(req,res){api_namespace.drop(req,res)})

/* Pods */
/*
app.get("/v1/app/namespace/:namespaceid/pod/:podName", function(req,res){api_pod.show(req,res)})
app.get("/v1/app/namespace/:namespaceid/pod", function(req,res){api_pod.list(req,res)})
*/

/* Services */
/*
app.get("/v1/app/namespace/:namespaceid/service/:serviceName", function(req,res){api_service.show(req,res)})
app.get("/v1/app/namespace/:namespaceid/service/:serviceName/pod", function(req,res){api_service.pods(req,res)})
app.get("/v1/app/namespace/:namespaceid/service", function(req,res){api_service.list(req,res)})
*/

/* Deployments */
app.get("/v1/app/namespace/:namespaceid/deployment/:deploymentName", function(req,res){api_deployment.show(req,res)})
app.get("/v1/app/namespace/:namespaceid/deployment/:deploymentName/status", function(req,res){api_deployment.status(req,res)})
app.get("/v1/app/namespace/:namespaceid/deployment/:deploymentName/pods", function(req,res){api_deployment.pods(req,res)})
app.get("/v1/app/namespace/:namespaceid/deployment", function(req,res){api_deployment.list(req,res)})
app.post("/v1/app/namespace/:namespaceid/deployment", function(req,res){api_deployment.apply(req,res)})

/* Volumenes */
app.get("/v1/app/namespace/:namespaceid/volume/:pvcName", function(req,res){api_pvc.show(req,res)})
app.get("/v1/app/namespace/:namespaceid/volume", function(req,res){api_pvc.list(req,res)})
app.post("/v1/app/namespace/:namespaceid/volume", function(req,res){api_pvc.create(req,res)})

app.listen(port,function(){
	console.log("Nose server running on http://10.120.78.86:" + port)
	console.log('CORS-enabled')
})

