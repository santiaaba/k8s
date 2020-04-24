const Database = require('./db.js')
K8sApi = require ('./k8s_api.js')

/*****************************
 *  *      Main
 *   *****************************/

k8s_api = new K8sApi('10.120.78.86','6443')

var diccionario = new Array
diccionario.push({'regex':'_namespace_name_','value':'namespace9'})

k8s_api.call('/api/v1/namespaces','POST','alta_namespace.yaml',diccionario)
.then( (s,b) => {
	console.log("Todo bien")
})
.catch( function(b){
	console.log("Todo mal: " + b.message)
})
