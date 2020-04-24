const K8sApi = require("./k8s_api.js")
const NamespaceApi = require("./namespace.js")

module.exports = {

create: function(req,res){

	var diccionario = new Array
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
		return new Promise((resolv,reject) => {
			console.log("Generamos el diccionario")
			if(typeof req.body.deployName == 'undefined' ||
			   typeof req.body.containerName == 'undefined' ||
			   typeof req.body.resources.cpu == 'undefined' ||
			   typeof req.body.resources.mem == 'undefined' ||
			   typeof req.body.image == 'undefined' ||
			   typeof req.body.replicas == 'undefined')
					reject("ACA1")
			diccionario.push({'regex':'_deploy_name_','value':req.body.deployName})
			diccionario.push({'regex':'_container_name_','value':req.body.containerName})
			diccionario.push({'regex':'_cpu_request_','value':req.body.resources.cpu})
			diccionario.push({'regex':'_mem_request_','value':req.body.resources.mem})
			diccionario.push({'regex':'_replicas_','value':req.body.replicas})
			diccionario.push({'regex':'_image_name_','value':req.body.image})
			/* Args */
			if(typeof(req.body.ports) != 'undefined'){
				data = "args:\n"
				for(i=0;i<req.body.args.length;i++){
					data = data + "           - " + req.body.args[i] + "\n"
				}
			} else {
				data = ''
			}
			diccionario.push({'regex':'_args_','value':data})
		
			/* Env */
			if(typeof(req.body.ports) != 'undefined'){
				data = 'env:\n'
				for(i=0;i<req.body.envs.length;i++){
				    if(typeof req.body.envs[i].name == 'undefined'||
				       typeof req.body.envs[i].value == 'undefined')
							reject("ACA2")
					data = data + '           - name: ' + req.body.envs[i].name + '\n'
					data = data + '             value: "' + req.body.envs[i].value + '"\n'
				}
			} else {
				data = ''
			}
			diccionario.push({'regex':'_envs_','value':data})
		
			/* Ports */
			if(typeof(req.body.ports) != 'undefined'){
				data = 'ports:\n'
				for(i=0;i<req.body.ports.length;i++){
				    if(typeof req.body.ports[i].port == 'undefined'||
				       typeof req.body.ports[i].name == 'undefined'||
				       typeof req.body.ports[i].protocol == 'undefined')
							reject("ACA3")
					data = data + '           - containerPort: ' + req.body.ports[i].port + '\n'
					data = data + '             name: ' + req.body.ports[i].name + '\n'
					data = data + '             protocol: ' + req.body.ports[i].protocol + '\n'
				}
			} else {
				data = ''
			}
			diccionario.push({'regex':'_ports_','value':data})
		
			/* volumneMount */
			if(typeof(req.body.mounts) != 'undefined'){
				data = 'volumeMounts:\n'
				for(i=0;i<req.body.mounts.length;i++){
				    if(typeof req.body.mounts[i].vol == 'undefined'||
				       typeof req.body.mounts[i].path == 'undefined')
							reject("ACA4")
					data = data + '           - name: ' + req.body.mounts[i].vol + '\n'
					data = data + '             mountPath: ' + req.body.mounts[i].path + '\n'
				}
			} else {
				data = ''
			}
			diccionario.push({'regex':'_volume_mounts_','value':data})
	
			/* volumneDef */
			if(typeof(req.body.volumes) != 'undefined'){
				data = 'volumes:\n'
				for(i=0;i<req.body.volumes.length;i++){
				    if(typeof req.body.volumes[i].name == 'undefined'||
				       typeof req.body.volumes[i].volClaim == 'undefined')
							reject("ACA5")
					data = data + '        - name: ' + req.body.volumes[i].name + '\n'
					data = data + '          persistentVolumeClaim:: ' + req.body.mounts[i].volClaim + '\n'
				}
			} else {
				data = ''
			}
			diccionario.push({'regex':'_volume_mounts_','value':data})

			resolv(name)
		})
	})
	.then(name=>{
			console.log(diccionario)
			const k8s_api = new K8sApi('10.120.78.86','6443')
			const url = '/apis/apps/v1/namespaces/' + name + '/deployments'
			return k8s_api.call(url,'POST','alta_deploy.yaml',diccionario)
	},err=>{
		console.log(err)
		return new Promise((resolv,reject)=>{
			res.status(500).send("Json del Body incorrecto")
		})
	})
	.then(name=>{
		console.log("Deploy dado de alta!!")
		res.status(200).send("Deploy generado")
	},err=>{
		console.log("Fallo alta Deploy en K8s")
		console.log(err)
		res.status(err.status).send(err.message)
	})
},

list: function(req,res){
	/* Lista los deploy de un namespace */

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
		return k8s_api.call('/apis/apps/v1/namespaces/' + name + '/deployments','GET','none.yaml',{})
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
	/* Retorna informacion sobre un deployment en particular */

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
		return k8s_api.call('/apis/apps/v1/namespaces/' + namespaceName +
							'/deployments/' + req.params.deploymentName,'GET','none.yaml',{})
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
