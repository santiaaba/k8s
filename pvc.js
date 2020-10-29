const K8sApi = require("./k8s_api.js")
const NamespaceApi = require("./namespace.js")

module.exports = {

create: function(req,res){

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
			   typeof req.body.size == 'undefined' ||
			   typeof req.body.class == 'undefined')
					reject("ACA1")
			diccionario.push({'regex':'_pvc_name_','value':req.body.name})
			diccionario.push({'regex':'_pvc_size_','value':req.body.size})
			diccionario.push({'regex':'_pvc_class_','value':req.body.class})
			resolv(name)
		})
	})
	.then(name=>{
			console.log(diccionario)
			const k8s_api = new K8sApi(config.k8s_api_url,config.k8s_api_port)
			const url = '/api/v1/namespaces/' + name + '/persistentvolumeclaims'
			return k8s_api.call(url,'POST','alta_pvc.yaml',diccionario)
	},err=>{
		console.log(err)
		return new Promise((resolv,reject)=>{
			res.status(500).send("PVC: Json del Body incorrecto")
		})
	})
	.then(name=>{
		console.log("PVC dado de alta!!")
		res.status(200).send("PVC generado")
	},err=>{
		console.log("Fallo alta PVC en K8s")
		console.log(err)
		res.status(err.status).send(err.message)
	})
},

list: function(req,res){
	/* Lista los pvc de un namespace */

	var k8s_api = new K8sApi(config.k8s_api_url,config.k8s_api_port)

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
		return k8s_api.call('/api/v1/namespaces/' + name +
							'/persistentvolumeclaims','GET','none.yaml',{})
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
	/* Retorna informacion sobre un pvc en particular */

	var k8s_api = new K8sApi(config.k8s_api_url,config.k8s_api_port)

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
		return k8s_api.call('/api/v1/namespaces/' + namespaceName +
							'/persistentvolumeclaims/' + req.params.pvcName,'GET','none.yaml',{})
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

delete: function(req,res){

	var k8s_api = new K8sApi(config.k8s_api_url,config.k8s_api_port)

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
		return k8s_api.call('/api/v1/namespaces/' + namespaceName +
							'/persistentvolumeclaims/' + req.params.pvcName,'DELETE','none.yaml',{})
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

}
