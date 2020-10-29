class K8sApi {
	constructor(host,port){
		this.host = host
		this.port = port
	}
	call(path,method,yaml_file,diccionario){
		var host = this.host
		var port = this.port
		console.log(method + " URL:" + host + ' ' + port + ' ' + path)
		return new Promise((resolve,reject) => {
			var datos=''
			var fs = require('fs')
			var read = fs.readFile("yaml/" + yaml_file, (err,data) => {
				if(err){
					console.log("Fallo lectura del archivo yaml/" + yaml_file)
					reject({status:500,message:"Imposible leer archivo " + yaml_file})
					return
				}
				//console.log("Contenido Antes: " + data)
				data = reemplazo(data.toString(),diccionario)
				console.log("---------- YAML ---------")
				console.log(data)
				console.log("-------------------------")
				const options = {
					hostname: host,
					port: port,
					path: path,
					method: method,
					rejectUnauthorized: false,
					requestCert: true,
					agent: false,
					headers: {
						'Content-Type': 'application/yaml',
						'Content-Length': data.length,
						'Authorization': config.k8s_token
					}
				}
				//console.log(options)
				const https = require("https")
				console.log("Enviamos la consulta a K8s")
				console.log(method + ':' + path)
				const req = https.request(options)
				req.on('response',function(res){
					console.log("statusCode: " + res.statusCode)
					res.on('data', d => {
						//console.log("OBTENIENDO DATOS:" + d)
						datos = datos + d
					})
					res.on('end',function(){
						//console.log("Datos recibidos: " + datos)
						if(res.statusCode >= 200 && res.statusCode <= 299){
							console.log("Es un OK")
							resolve({status:res.statusCode,message:JSON.parse(datos)})
						} else {
							console.log("Es un ROLLBACK")
							console.log(datos)
							reject({status:res.statusCode,message:JSON.parse(datos)})
						}
					})
				})
				req.on('error', error => {
					console.log("ERRRROOOOOR:")
					console.log(error)
					reject({status:500,message:'{"error":"Error interno"}'})
				})
				if(method == 'POST' || method == 'PUT'){
					//console.log("Enviando: \n" + data)
					req.write(data)
				}
				req.on('end',() => {
					console.log("Terminamos de recibir datos")
				})
				req.end()
			})
		})
	}
}

module.exports = K8sApi

function reemplazo(string,d){
	if(typeof(d) != 'undefined'){
		for(i=0;i<d.length;i++){
			//console.log("Reemplazando: --" + d[i].regex + '-- por --' + d[i].value + '--')
			regex = new RegExp(d[i].regex,'g')
			string = string.replace(regex,d[i].value)
		}
	}
	return string
}
