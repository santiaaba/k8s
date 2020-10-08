const token = 'Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6ImJUNVZXQ0NmTUwtRnV6Q1RSSkRHNDRKejFHdmF0MF9lY3NVMjlkcXNvYTAifQ.eyJpc3MiOiJrdWJlcm5ldGVzL3NlcnZpY2VhY2NvdW50Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9uYW1lc3BhY2UiOiJrdWJlcm5ldGVzLWRhc2hib2FyZCIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VjcmV0Lm5hbWUiOiJhZG1pbi11c2VyLXRva2VuLTg0eHQyIiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9zZXJ2aWNlLWFjY291bnQubmFtZSI6ImFkbWluLXVzZXIiLCJrdWJlcm5ldGVzLmlvL3NlcnZpY2VhY2NvdW50L3NlcnZpY2UtYWNjb3VudC51aWQiOiIzMGQwYWYzYy1jNDY5LTRiODItODBlZS0wYTQ4NjkyZTM4NWQiLCJzdWIiOiJzeXN0ZW06c2VydmljZWFjY291bnQ6a3ViZXJuZXRlcy1kYXNoYm9hcmQ6YWRtaW4tdXNlciJ9.yEakW2vcb-t_vSfUqR_Tm1JdzEuaWBaNlPRzHIdUhd8J85hU_kBTcYX6dibHVeHntPshbXHPDLlkpchSg6gvvHSMPZ1LT0M1I78NWeIQyz638Q7zV7KGtXeLJcNFV41Q174AB6ZaIvVoHFtqoPS02b_Y2aHcZ6EbC3nOXWOgPCorzoWCVb9_sRJsVPvJIr_q2NuR_mDriUXbL185kuevHQUS6bwr4h-WNhnPTZUaqIWHaAg4TXC1_iD0cStxB_i4qJ-kiM7Vk5au2BnimEx35FRo6gQtdRckC8kiVSHmlarGPnY2vccGeZttAF9vh-aqiMfbI_YNNVSptJh3r_a9Lg'

class K8sApi {
	constructor(host,port){
		this.host = host
		this.port = port
	}
	call(path,method,data){
		var host = this.host
		var port = this.port
		var datos = ''
		console.log(method + " URL:" + host + ' ' + port + ' ' + path)
		return new Promise((resolve,reject) => {
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
					'Content-Type': 'application/json',
					//'Content-Length': data.length,
					'Authorization': token
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
					datos = datos + d
				})
				res.on('end',function(){
					//console.log("Datos recibidos: " + datos)
					if(res.statusCode >= 200 && res.statusCode <= 299){
						console.log("Es un OK")
						resolve({status:res.statusCode,message:JSON.parse(datos)})
					} else {
						console.log("Es un ROLLBACK")
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
				console.log("Enviando: \n" + JSON.stringify(data))
				req.write(JSON.stringify(data))
			}
			req.on('end',() => {
				console.log("Terminamos de recibir datos")
			})
			req.end()
		})
	}
}

module.exports = K8sApi
