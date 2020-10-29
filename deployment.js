const K8sApi = require("./k8s_api.js")
const NamespaceApi = require("./namespace.js")
const metricsApi = require("./prometheus.js")
const helper = require("./helper.js")

module.exports = {

apply_chech_data: function(req,res){
	/* revisa que los datos sean correctos */
	return true
},

apply: function(req,res){
	/* Crea o modifica un deploy */

	var diccionario = new Array
	var fibercorpID
	var namespaceName
	var errorPrevio
	const k8s_api = new K8sApi(config.k8s_api_url,config.k8s_api_port)

	if(req.method == 'POST')
		var alta = true
	else
		var alta = false

	NamespaceApi.checkUserNamespace(req)
	.then(ok =>{
		//console.log("Buscando nombre")
		return NamespaceApi.namespaceNameById(req.params.namespaceid)
	}, err => {
		//console.log("Error usernamespace")
		return new Promise((resolv,reject) => {
			res.status(err.code).send(err.message)
		})
	})
	.then(name =>{
		namespaceName = name
		/* Corroboramos los datos obtenidos por Body */
		return new Promise((resolv,reject) => {
			/* Generamos el fibercorpID. Hay pocas probabilidades de
 			 * que se repita. Pero habria que mejorarlo. */
			diccionario.push({'regex':'_fibercorpID_','value':helper.makeid(32)})

			//console.log("Generamos el diccionario")
			if(typeof req.body.deployName == 'undefined' ||
			   typeof req.body.replicas == 'undefined' ||
			   typeof req.body.containers == 'undefined')
					reject("Revisar los valores DeployName containers  y replicas")
			diccionario.push({'regex':'_deploy_name_','value':req.body.deployName})
			diccionario.push({'regex':'_replicas_','value':req.body.replicas})

			/* Los contenedores */
			var container = 'containers:\n'
			req.body.containers.forEach(function(v,i){
				container += '         - name: ' + v.name + '\n'
				container += '           image: ' + v.image + '\n'
				container += '           resources:\n'
				container += '             limits:\n'
			/* Los limites los fijamos a mano momentaneamente */
				container += '               cpu: 1\n'
				container += '               memory: 100Mi\n'
				/* Args */
				if(typeof(v.args) != 'undefined'){
					container += "           args:\n"
					v.args.forEach(function(w,j){
						container += "             - " + w + "\n"
					})
				}
				/* Env */
				if(typeof(v.envs) != 'undefined'){
					container += "           env:\n"
					v.envs.forEach(function(w,j){
					    if(typeof w.name == 'undefined'||
					       typeof w.type == 'undefined')
								reject("Envs falta nombre y/o tipo")
						container += '             - name: ' + w.name + '\n'
						switch(w.type){
							case 'text':
								container += '               value: "' + w.value + '"\n'
								break
							case 'secret':
								if(typeof w.secret == 'undefined'||
			                       typeof w.key == 'undefined')
										reject("Envs name o key del tipo incorrecto")
								container += '             valueFrom:\n'
								container += '                secretKeyRef:\n'
								container += '                   name: ' + w.secret + '\n'
								container += '                   key: ' + w.key + '\n'
								break
							default:
								reject("Envs tipo no permitido")
						}
					})
				}
				/* Puertos */
				if(typeof(v.ports) != 'undefined'){
					container += "           ports:\n"
					v.ports.forEach(function(w,j){
					    if(typeof w.port == 'undefined'||
					       typeof w.protocol == 'undefined')
								reject("Envs falta puerto o protocolo")
						container += '             - containerPort: ' + w.port + '\n'
						container += '               protocol: ' + w.protocol + '\n'
					})
				}
				/* volumes Mount */
				if(typeof(v.mounts) != 'undefined'){
					container += '           volumeMounts:\n'
					v.mounts.forEach(function(w,j){
					    if(typeof w.name == 'undefined'|| typeof w.path == 'undefined')
								reject("Volumen mal declarado")
						container += '             - name: ' + w.name + '\n'
						container += '               mountPath: ' + w.path + '\n'
					})
				}
			})
			console.log("DATOS del _containers_: " + container)
			diccionario.push({regex:'_containers_',value:container})
	
			/* volumneDef */
			if(typeof(req.body.volumes) != 'undefined'){
				data = 'volumes:\n'
				//claimTemplates = 'volumeClaimTemplates:\n'
				req.body.volumes.forEach(function(v,i){
				    if(typeof(v.name) == 'undefined' || typeof(v.type) == 'undefined')
							reject("ACA5")
					data += '         - name: ' + v.name + '\n'
					switch(v.type){
						case "emptydir":
							data += '           ' + v.type + ': {}\n'
							break
						case "pvc":
							/* Para un pvc ya existente */
							if(typeof v.pvc == 'undefined')
								reject("Falta especificar el volumen")
							data += '           persistentVolumeClaim:\n'
							data += '             claimName: ' +
								   v.pvc + '\n'
							break
						case "secret":
							if(typeof v.secret == 'undefined')
								reject("Falta especificar en secret")
							data += '           secret:\n'
							data += '             secretName: ' +
								   v.secret + '\n'
							break
						default:
							reject("Tipo volumen " + v.type + " no permitido")
					}
				})
			} else {
				data = ''
			}
			diccionario.push({'regex':'_volume_defs_','value':data})
			resolv(name)
		})
	})
	.then(ok=>{
		/* Generamos o actualizamos el deploy en K8S */
		//console.log(diccionario)
		if(alta){
			const url = '/apis/apps/v1/namespaces/' + namespaceName + '/deployments'
			return k8s_api.call(url,'POST','alta_deploy.yaml',diccionario)
		} else {
			const url = '/apis/apps/v1/namespaces/' + namespaceName +
						'/deployments/' + req.body.deployName
			return k8s_api.call(url,'PUT','alta_deploy.yaml',diccionario)
		}
	},err=>{
		console.log(err)
		return new Promise((resolv,reject)=>{
			res.status(500).send("Json del Body incorrecto: " + err)
		})
	})
	.then(ok=>{
		console.log("Deploy dado de alta!!")
		res.status(200).send("Deploy generado")
	},err=>{
		console.log("Fallo alta Deploy en K8s")
		console.log(err)
		return new Promise((resolv,reject)=>{
			res.status(err.status).send(err.message)
		})
	})
},

list: function(req,res){
	/* Lista los deploy de un namespace */

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
		return k8s_api.call('/apis/apps/v1/namespaces/' + name + '/deployments','GET','none.yaml',{})
	}, err => {
		console.log(err)
		return new Promise((resolv,reject) => {
			res.status(err.code).send(err.message)
		})
	})
	.then(ok => {
		ok.message.idNamespace = req.params.namespaceid
		res.status(ok.status).send(ok.message)
	},err => {
		console.log(err)
		res.status(err.status).send(err.message)
	})
},

show: function(req,res){
	/* Retorna informacion sobre un deployment en particular
	 * con el formato que hemos establecido */

	var deployment
	var services
	var ingresses
	var fibercorpID
	var namespaceName
	var k8s_api = new K8sApi(config.k8s_api_url,config.k8s_api_port)

	NamespaceApi.checkUserNamespace(req)
	.then(ok =>{
		console.log("Buscando nombre")
		return NamespaceApi.namespaceNameById(req.params.namespaceid)
	}, err => {
		return helper.enviarError(res,err)
	})
	.then(ok =>{
		namespaceName = ok
		return k8s_api.call('/apis/apps/v1/namespaces/' + namespaceName +
							'/deployments/' + req.params.deploymentName,'GET','none.yaml',{})
	}, err => {
		return helper.enviarError(res,err)
	})
	.then(ok => {
		deployment = ok.message
		// Obtenemos todos los servicios del namespace */
		return k8s_api.call('/api/v1/namespaces/' + namespaceName + '/services','GET','none.yaml',{})
	},err => {
		return helper.enviarError(res,err)
	})
	.then(ok => {
		services = ok.message
		// Obtenemos todos los ingress del namespace */
		return k8s_api.call('/apis/networking.k8s.io/v1beta1/namespaces/' +
							 namespaceName + '/ingresses','GET','none.yaml',{})
	},err => {
		return helper.enviarError(res,err)
	})
	.then(ok => {
		ingresses = ok.message
		/* Generamos el Json en base al deployment obtenido de K8S */
		data = {deployName:deployment.metadata.name,
				fibercorpID: fibercorpID,
				replicas:deployment.spec.replicas,
				containers:[], volumes:[]
				}
		//console.log(data)
		deployment.spec.template.spec.containers.forEach(function(v,i){
			var container ={
				name: v.name,
				image: v.image,
				args:[], envs:[], mounts:[], ports:[]}

			if(typeof(v.args) != 'undefined'){
				v.args.forEach(function(v,i){
					container.args.push(v)
				})
			}
			if(typeof(v.env) != 'undefined'){
				v.env.forEach(function(w,j){
					if(typeof(w.valueFrom) != 'undefined'){
						var env = {name:w.name,type:'secret',
								   secret:w.valueFrom.secretKeyRef.name,
								   key:w.valueFrom.secretKeyRef.key}
					} else {
						var env = {name:w.name,type:'text',value:w.value}
					}
					container.envs.push(env)
				})
			}
			if(typeof(v.ports) != 'undefined'){
				v.ports.forEach(function(w,j){
					container.ports.push({port:w.containerPort, protocol: w.protocol})
				})
			}
			/* Los montajes de discos del container */
			if(typeof(v.volumeMounts) != 'undefined'){
				v.volumeMounts.forEach(function(v,i){
					container.mounts.push({name:v.name,mountPath:v.mountPath})
				})
			}
			/* Agregamos el container */
			data.containers.push(container)
		})

		/* Ahora los volumenes */
		if(typeof(deployment.spec.template.spec.volumes) != 'undefined'){
			deployment.spec.template.spec.volumes.forEach(function(v,i){
				if(typeof(v.persistentVolumeClaim) != 'undefined'){
					/* Es un PVC */
					data.volumes.push({
						name: v.name,
						type: 'pvc',
						pvc: v.persistentVolumeClaim.claimName})
				} else {if(typeof(v.secret) != 'undefined'){
					/* Es un secret */
					data.volumes.push({
					name:v.name,type:'secret',secret:v.secret})
					} else {
						/* Si no es nada de lo anterior entonces es un emptydir */
						data.volumes.push({
						name:v.name,type:'emptydir'})
					}
				}
			})
		}
		res.status(ok.status).send(data)
	},err => {
		return helper.enviarError(res,err)
	})

},

status: function(req,res){
	var deployment
	var services
	var fibercorpID
	var namespaceName
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
	.then(ok =>{
		namespaceName = ok
		console.log("Enviando consulta a api K8S")
		return k8s_api.call('/apis/apps/v1/namespaces/' + namespaceName +
							'/deployments/' + req.params.deploymentName,'GET','none.yaml',{})
	}, err => {
		console.log(err)
		return new Promise((resolv,reject) => {
			res.status(err.code).send(err.message)
		})
	})
	.then(ok=>{
		res.send(ok.message)
	},err=>{
		res.status(err.code).send(err.message)
	})
},

pods: function(req,res){
	/* Retorna informacion sobre los pods
	 * del deployment y su namespaceName */
	var k8s_api = new K8sApi(config.k8s_api_url,config.k8s_api_port)
	var pods

	find_pods(req,res)
	.then(ok=>{
		/* Buscamos los Eventos de los pods */
		console.log("Buscamos los eventos")
		pods = ok.message
		console.log("Buscamos los eventos 2")
		console.log(namespaceName)
		return k8s_api.call('/apis/events.k8s.io/v1beta1/namespaces/' + ok.message.namespaceName +
                            '/events','GET','none.yaml',{})
	})
	.then(events=>{
		console.log("Obtuvimos los eventos")
		var podList = new Set
		pods.items.forEach(function(v,i){
			/* A la estructura pod retornada por K8S
			 * le agregamos eventos */
			v.events = new Array
			/* Cargamos los eventos de este pod */
			events.message.items.forEach(function(w,j){
				if(v.metadata.name == w.regarding.name)
					v.events.push(w)
			})
		})
		res.send(pods)
	})
	.catch(err=>{
		console.log(err)
		if(typeof(err.code)!='undefined' && typeof(err.message) !='undefined' )
			res.status(err.code).send(err.message)
		else
			res.status(500).send('Error fatal')
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
		return k8s_api.call('/apis/apps/v1/namespaces/' + namespaceName +
							'/deployments/' + req.params.deploymentName,'DELETE','none.yaml',{})
	}, err => {
		console.log(err)
		return new Promise((resolv,reject) => {
			res.status(err.code).send(err.message)
		})
	})
	.then(ok=>{
		res.send(ok.message)
	},err=>{
		res.status(err.code).send(err.message)
	})
},

metrics_cpu: function(req,res){
	var k8s_api = new K8sApi(config.k8s_api_url,config.k8s_api_port)
	var metrics_api = new metricsApi('10.120.78.86','30000')

	find_pods(req,res)
	.then(pods =>{
		var podNames = ''
		console.log(pods)
		pods.message.items.forEach(function(v){
			podNames += v.metadata.name + '|'
		})
		podNames = podNames.slice(0, -1)
		console.log(podNames)
		query = 'sum(rate(container_cpu_user_seconds_total{namespace="' + pods.message.namespaceName +
				'",container="POD",pod=~"' + podNames + '"}[' + req.query.step + ']))'
        return metrics_api.call(query,req.query.start,req.query.end,60)
	})
	.then(data => {
		res.send(data)
	})
	.catch(err =>{
		console.log(err)
		if(typeof(err.code)!='undefined' && typeof(err.message) !='undefined' )
			res.status(err.code).send(err.message)
		else
			res.status(500).send('Error fatal')
	})
}

}

function find_pods(req,res){
	/* Retorna una promesa que obtiene los pods
	   de un deployment */

	return new Promise((resolv,reject)=>{
		var deployment
		var services
		var pods
		var fibercorpID
		//var namespaceName
		var k8s_api = new K8sApi(config.k8s_api_url,config.k8s_api_port)
	
		NamespaceApi.checkUserNamespace(req)
		.then(ok =>{
			console.log("Buscando nombre")
			return NamespaceApi.namespaceNameById(req.params.namespaceid)
		})
		.then(ok =>{
			/* Debemos obtener los datos del deploy y de ellos sacar el selector
			 * a utilizar para buscar sus pods */
			namespaceName = ok
			console.log("Enviando consulta a api K8S")
			console.log("namespaceName:" + namespaceName + " deployment:" + req.params.deploymentName)
			return k8s_api.call('/apis/apps/v1/namespaces/' + namespaceName +
								'/deployments/' + req.params.deploymentName
								,'GET','none.yaml',{})
		})
		.then(ok=>{
			//var fibercorpID = ok.message.metadata.labels.fibercorpDeploy
			var selector=''
			var matchLabels = ok.message.spec.selector.matchLabels
			var labels = Object.keys(matchLabels)
			labels.forEach(function(v,i){
				console.log(v + " => " + matchLabels[v])
				selector += v + '%3D' + matchLabels[v] + ','
			})
			selector = selector.slice(0, -1)
			selector = selector.replace('/','%2F')
			selector = selector.replace('.','%2E')
			console.log(selector)
			/* Buscamos los pods de este deployment */
			return k8s_api.call('/api/v1/namespaces/' + namespaceName +
								'/pods?labelSelector=' + selector,'GET','none.yaml',{})
		})
		.then(pods=>{
			pods.message.namespaceName = namespaceName
			resolv(pods)
		})
		.catch(err => {
			reject(err)
		})
	})
}
