const K8sApi = require("./k8s_api_yaml.js")
const NamespaceApi = require("./namespace.js")
const helper = require("./helper.js")

module.exports = {

apply_chech_data: function(req,res){
	/* evisa que los datos sean correctos */
	return true
},

apply: function(req,res){
/* Se utiliza tanto para un alta como una modificacion.
 * dentro del parametro req viene el yaml ya armado. Solamente
 * se lo pasamos a K8S
 */

	var namespaceName
	var alta = true
	const k8s_api = new K8sApi('10.120.78.86','6443')

	NamespaceApi.checkUserNamespace(req)
	.then(ok =>{
		return NamespaceApi.namespaceNameById(req.params.namespaceid)
	}, err => {
		return new Promise((resolv,reject) => {
			res.status(err.code).send(err.message)
		})
	})
	.then(name=>{
		namespaceName = name
		console.log("BOOODY: " + req.body)
		/* Generamos o actualizamos el deploy en K8S */
		if(alta){
			const url = '/apis/apps/v1/namespaces/' + namespaceName + '/deployments'
			return k8s_api.call(url,'POST',req.body)
		} else {
			const url = '/apis/apps/v1/namespaces/' + namespaceName +
						'/deployments/' + req.params.deployment
			return k8s_api.call(url,'PUT',req.body)
		}
	},err=>{
		console.log(err)
		return new Promise((resolv,reject)=>{
			res.status(500).send("Json del Body incorrecto: " + err)
		})
	})
	.then(ok=>{
		res.send(ok)
	},err=>{
		console.log("Fallo alta Deploy en K8s")
		console.log(err)
		res.status(err.status).send(err.message)
	})
},

list: function(req,res){
	/* Lista los deploy de un namespace */

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
		return k8s_api.call('/apis/apps/v1/namespaces/' + name + '/deployments','GET',null)
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
	.then(ok =>{
		namespaceName = ok
		console.log("Enviando consulta a api K8S " + '/apis/apps/v1/namespaces/' + namespaceName +
                            '/deployments/' + req.params.deploymentName)
		return k8s_api.call('/apis/apps/v1/namespaces/' + namespaceName +
							'/deployments/' + req.params.deploymentName,'GET',null)
	}, err => {
		console.log(err)
		return new Promise((resolv,reject) => {
			res.status(err.code).send(err.message)
		})
	})
	.then(deployment => {
		res.send(deployment)
	},err => {
		console.log(err)
		res.status(err.code).send(err.message)
	})
}

}	//Fin del modulo
