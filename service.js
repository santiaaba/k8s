const K8sApi = require("./k8s_api.js")
const NamespaceApi = require("./namespace.js")

module.exports = {

nuevo: function(req,res){
	console.log("IMPLEMENTAR")
	res.status(200).send("implementar")
},

list: function(req,res){
	/* Retorna los servicios de un namespace */

	var k8s_api = new K8sApi('10.120.78.86','6443')

	NamespaceApi.checkUserNamespace(req.params.userid,req.params.namespaceid)
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

	NamespaceApi.checkUserNamespace(req.params.userid,req.params.namespaceid)
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

drop: function(req,res){
}

}