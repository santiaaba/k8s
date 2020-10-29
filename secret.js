const K8sApi = require("./k8s_api.js")
const NamespaceApi = require("./namespace.js")

module.exports = {

apply: function(req,res){

	var alta = true
	var diccionario = new Array
	var namespaceName
	const k8s_api = new K8sApi(config.k8s_api_url,config.k8s_api_port)

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
			   typeof req.body.data == 'undefined')
					reject("fata nombre o data para secret")
			diccionario.push({'regex':'_name_','value':req.body.name})
			var data = ''
			req.body.data.forEach(function(v,i){
				data += "   " + v.name + ": " + Buffer.from(v.value).toString('base64') + '\n'
				
			})
			diccionario.push({'regex':'_data_','value':data})
			namespaceName = name
			resolv(name)
		})
	})
	.then(name=>{
		/* Determinamos la existencia del secret */
		const url = '/api/v1/namespaces/' + namespaceName + '/secrets/' + req.body.name
		return k8s_api.call(url,'GET','none.yaml',{})
	},err=>{
		return new Promise((resolv,reject)=>{
			console.log(err)
			res.status(500).send("Secret: Error al querer determinar existencia de secret")
		})
	})
	.then(ok=>{
		/* Es codigo es 200. Es una modificacion */
		const url = '/api/v1/namespaces/' + namespaceName + '/secrets/' + req.body.name
		return k8s_api.call(url,'PUT','alta_secret.yaml',diccionario)
	},err=>{
		/* El codigo es distinto de 404. Puede ser un alta u otro problema */
		const url = '/api/v1/namespaces/' + namespaceName + '/secrets'
		return k8s_api.call(url,'POST','alta_secret.yaml',diccionario)
	})
	.then(name=>{
		console.log("Secret aplicado!!")
		res.status(200).send("Secret aplicado")
	},err=>{
		console.log("Fallo alta Secret en K8s")
		console.log(err)
		res.status(err.status).send(err.message)
	})
},

list: function(req,res){
	/* Lista los secret de un namespace */

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
		return k8s_api.call('/api/v1/namespaces/' + name + '/secrets','GET','none.yaml',{})
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
	/* Retorna informacion sobre un secret en particular */

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
							'/secrets/' + req.params.secretName,'GET','none.yaml',{})
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

drop: function(req,res){
},

}
