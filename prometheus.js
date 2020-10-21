class metricsApi {
	constructor(host,port){
		this.host = host
		this.port = port
	}
	call(query,start,end,step){
		return new Promise((resolve,reject) => {
			var host = this.host
			var port = this.port
			var datos = ''
			var path = '/api/v1/query_range?query=' + query + '&start=' + start + '&end=' + end + '&step=' + step
			console.log(" URL:" + host + ':' + port + path)
			console.log("Pasamos por aca")
			const options = {
				hostname: host,
				port: port,
				path: path,
				method: "GET",
				rejectUnauthorized: false,
				requestCert: true,
				agent: false,
				headers: {
					'Content-Type': 'application/json'
				}
			}
			//console.log(options)
			console.log("Llegamos ahsta aca")
			const https = require("http")
			console.log("Enviamos la consulta a Prometheus")
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
						console.log("Es un Error")
						console.log(datos)
						reject({status:res.statusCode,message:datos})
					}
				})
			})
			req.on('error', error => {
				console.log("ERRRROOOOOR:")
				console.log(error)
				reject({status:500,message:'{"error":"Error interno"}'})
			})
			req.on('end',() => {
				console.log("Terminamos de recibir datos")
			})
			req.end()
		})
	}
}

module.exports = metricsApi
