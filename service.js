const K8sApi = require("./k8s_api.js")
const NamespaceApi = require("./namespace.js")
const CodeURL = require("./codeURL.js")


module.exports = {

nuevo: function(req,res){
	var diccionario = new Array
	NamespaceApi.checkUserNamespace(req)
	.then(ok =>{
		console.log("Buscando nombre")
		return NamespaceApi.namespaceNameById(req.params.namespaceid)
	}, err => {
		console.log("Error usernamespace")
		return new Promise((resolv,reject) => {
			res.status(err.code).send(err.message)
		})
	})
	.then(name =>{
		return new Promise((resolv,reject) => {
			console.log("Generamos el diccionario")
			if(typeof req.body.name == 'undefined' ||
			   typeof req.body.selector == 'undefined' ||
			   typeof req.body.port == 'undefined')
					reject("ACA1")
			switch(req.body.type){
				case 'external':
			   		if(typeof req.body.ip == 'undefined')
						reject("Falta especificar la ip externa")
				case 'internal':
					diccionario.push({'regex':'_type_','value':req.body.type})
					break
				default:
					reject("servicio type mal especificado [internal|external]")
			}
			switch(req.body.protocol){
				case 'tcp':
				case 'udp':
					diccionario.push({'regex':'_protocol_','value':req.body.protocol})
					break
				default:
					reject("servicio protocolo mal especificado [tcp|udp]")
			}
			diccionario.push({'regex':'_name_','value':req.body.name})
			diccionario.push({'regex':'_selector_','value':req.body.selector})
			diccionario.push({'regex':'_port_','value':req.body.port})
			resolv(name)
		})
	})
	.then(name=>{
			console.log(diccionario)
			const k8s_api = new K8sApi('10.120.78.86','6443')
			const url = '/api/v1/namespaces/' + name + '/services'
			return k8s_api.call(url,'POST','alta_service.yaml',diccionario)
	},err=>{
		console.log(err)
		return new Promise((resolv,reject)=>{
			res.status(500).send("Service: Json del Body incorrecto")
		})
	})
	.then(name=>{
		console.log("servicio dado de alta!!")
		console.log("Implementar alta en equipo que realiza NAT/PAT")
		res.status(200).send("Servicio generado")
	},err=>{
		console.log("Fallo alta Servicio en K8s")
		console.log(err)
		res.status(err.status).send(err.message)
	})
},

list: function(req,res){
	/* Retorna los servicios de un namespace */

	var k8s_api = new K8sApi('10.120.78.86','6443')

	NamespaceApi.checkUserNamespace(req)
	.then(ok =>{
		console.log("Buscando nombre")
		return NamespaceApi.namespaceNameById(req.params.namespaceid)
	}, err => {
		console.log("Error usernamespace")
		return new Promise((resolv,reject) => {
			res.status(err.code).send(err.message)
		})
	})
	.then(name =>{
		console.log("Enviando consulta a api K8S")
		return k8s_api.call('/api/v1/namespaces/' + name + '/services','GET','none.yaml',{})
	}, err => {
		console.log(err)
		return new Promise((resolv,reject) => {
			res.status(err.code).send(err.message)
		})
	})
	.then(ok => {
		res.status(ok.status).send(ok.message)
	},err => {
		console.log(err)
		res.status(err.status).send(err.message)
	})
},

show: function(req,res){
	/* Retorna los servicios de un namespace */

	var k8s_api = new K8sApi('10.120.78.86','6443')

	NamespaceApi.checkUserNamespace(req)
	.then(ok =>{
		console.log("Buscando nombre")
		return NamespaceApi.namespaceNameById(req.params.namespaceid)
	}, err => {
		console.log("Error usernamespace")
		return new Promise((resolv,reject) => {
			res.status(err.code).send(err.message)
		})
	})
	.then(namespaceName =>{
		console.log("Enviando consulta a api K8S")
		return k8s_api.call('/api/v1/namespaces/' + namespaceName + '/services/' +
							req.params.serviceName,'GET','none.yaml',{})
	}, err => {
		console.log(err)
		return new Promise((resolv,reject) => {
			res.status(err.code).send(err.message)
		})
	})
	.then(ok => {
		res.status(ok.status).send(ok.message)
	},err => {
		console.log(err)
		res.status(err.status).send(err.message)
	})

},

pods: function(req,res){
	/* Retorna los pods que conforman el servicio */

	var k8s_api = new K8sApi('10.120.78.86','6443')
	var namespaceName

	NamespaceApi.checkUserNamespace(req)
	.then(ok =>{
		console.log("Buscando nombre")
		return NamespaceApi.namespaceNameById(req.params.namespaceid)
	}, err => {
		console.log("Error usernamespace")
		return new Promise((resolv,reject) => {
			res.status(err.code).send(err.message)
		})
	})
	.then(ok =>{
		namespaceName = ok
		console.log("Enviando consulta a api K8S")
		return k8s_api.call('/api/v1/namespaces/' + namespaceName + '/services/' +
							req.params.serviceName,'GET','none.yaml',{})
	}, err => {
		console.log(err)
		return new Promise((resolv,reject) => {
			res.status(err.code).send(err.message)
		})
	})
	.then(data=>{
		var labels = ''
		console.log(JSON.stringify(data.message.spec))
		var keys = Object.keys(data.message.spec.selector)
		var i = 0
		while(i < keys.length){
			labels += keys[i]
			labels += "=" + data.message.spec.selector[keys[i]] + ","
			console.log("Labels " + labels)
			i++
		}
		labels = labels.slice(0, -1)
		console.log("Labels " + labels)
		labels = CodeURL.code(labels)
		console.log("Labels " + labels)
		return k8s_api.call('/api/v1/namespaces/' + namespaceName +
							'/pods?labelSelector=' + labels,'GET','none.yaml',{})
	}, err => {
		console.log(err)
		return new Promise((resolv,reject) => {
			res.status(err.code).send(err.message)
		})
	})
	.then(ok=>{
		res.status(ok.status).send(ok.message)
	},err=>{
		console.log(err)
		return new Promise((resolv,reject) => {
			res.status(err.code).send(err.message)
		})
	})
},

drop: function(req,res){
}

}
