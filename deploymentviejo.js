const K8sApi = require("./k8s_api.js")
const NamespaceApi = require("./namespace.js")
const helper = require("./helper.js")

module.exports = {

apply_chech_data: function(req,res){
	/* evisa que los datos sean correctos */
	return true
},

apply: function(req,res){
/* Se utiliza tanto para un alta como una modificacion.
 * La diferencia recide en que si se especifica o no el fibercorpID.
 * Si se lo especifica es una modificacion. Sino es un alta.
 */

	var diccionario = new Array
	var fibercorpID
	var namespaceName
	var errorPrevio
	var alta = true
	const k8s_api = new K8sApi('10.120.78.86','6443')

	//console.log("BODY: " + JSON.stringify(req.body))

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
 			   que se repita. Pero habria que mejorarlo */
			if(typeof req.body.fibercorpID != 'undefined'){
				fibercorpID = req.body.fibercorpID
				alta = false
			} else {
				fibercorpID = helper.makeid(32)
			}
			diccionario.push({'regex':'_fibercorpID_','value':fibercorpID})

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
				container += '               cpu: ' + v.resources.cpu + '\n'
				container += '               memory: ' + v.resources.mem + '\n'
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
			
				/* Servicios */
				if(typeof(v.services) != 'undefined'){
					v.services.forEach(function(w,j){
					    if(typeof w.name == 'undefined'||
					       typeof w.type == 'undefined'){
								reject("ACA3")
						}
					    if((w.type == 'out' || w.type == 'in') && typeof(w.ports) == 'undefined'){
								reject("Falta definir puertos")
						}
						if(w.type == 'out' && typeof(w.ip) == 'undefined'){
								reject("Falta IP")
						}
						if(w.type == 'url' && typeof(w.urls) == 'undefined'){
								reject("Falta la URL")
						}
						if(w.type != 'url' && typeof(w.ports) == 'undefined'){
								reject("Falta definir puertos")
						}
						container += '           ports:\n'
						if(w.type != 'url'){
							/* Revisamos los puertos */
							w.ports.forEach(function(x,k){
								if(typeof x.protocol == 'undefined'||
			                       typeof x.port == 'undefined')
										reject("Puerto mal cargado")
								container += '             - containerPort: ' + x.port + '\n'
								container += '               name: ' + x.name + '\n'
								container += '               port: ' + x.port + '\n'
							})
						} else {
							/* Revisamos los URL */
							protocols = new Set
							w.urls.forEach(function(x,k){
								if(typeof x.path == 'undefined'|| typeof x.protocol == 'undefined')
										reject("URL mal declarada.")
								protocols.add(x.protocol)
							})
							protocols.forEach(function(v,i){
								container += '             - containerPort: ' + v + '\n'
								container += '               name: ingress' + v + '\n'
								container += '               port: ' + v.protocol + '\n'
							})
						}
					})
					//console.log('PORTS: ' + data)
				}
				diccionario.push({'regex':'_replicas_','value':req.body.replicas})
		
				/* volumes Mount */
				if(typeof(v.mounts) != 'undefined'){
					container += '      volumeMounts:\n'
					v.mounts.forEach(function(w,j){
					    if(typeof w.name == 'undefined'|| typeof w.path == 'undefined')
								reject("Volumen mal declarado")
						container += '           - name: ' + w.name + '\n'
						container += '             mountPath: ' + w.path + '\n'
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
		/* Necesitamos obtener los servicios del deployment.
		 * Esto solo si es una modificacion ya que deberemos
		 * eliminar los servicios y generarlos nuevamente con
		 * los cambios.*/
		if(!alta){
			return k8s_api.call('/api/v1/namespaces/' + namespaceName +
					  		    '/services?labelSelector=fibercorpService%3D' + fibercorpID
								,'GET','none.yaml',{})
		} else {
			console.log("NO boramos NAAAADA")
			/* no hago nada */
            return new Promise((resolv,reject) => { resolv()})
		}
	},err=>{
		console.log(err)
		return new Promise((resolv,reject)=>{
			res.status(500).send("Json del Body incorrecto: " + err)
		})
	})
	.then(ok =>{
		/* Para la actualizacion, necesitamos obtener de K8S dos valores
	 	 * y agregarlos al yaml a ser enviado. Estos valores son:
 		 * metadata.resourceVersion y spec.clusterIP (aun cuando es type NodePort)
 		 * obtener los valores es mas costoso. Hay que llamar a la api de K8s para
 		 * averiguar estos valores. Es mejor simplemente eliminar y crear
 		 * nuevamente los servicios
 		 */
		if(!alta){
			/* ok son los datos de la consulta que obtuvo los servicios */
			var services = new Array
			ok.message.items.forEach(function(v,i){
				console.log("Eliminamos " + JSON.stringify(v))
				services.push(k8s_api.call('/api/v1/namespaces/' + namespaceName +
					'/services/' + v.metadata.name
					,'DELETE','none.yaml',{}))
			})
			return Promise.all(services)
		} else {
			/* No hago nada. Ya que al ser un alta no hay nada que borrar */
            return new Promise((resolv,reject) => { resolv()})
		}
	},err => {
			return new Promise((resolv,reject)=>{
				console.log("Error al querer borrar los servicios")
	            res.status(err.status).send(err.message)
			})
	})
	.then(ok =>{
		/* Sea un alta o modificacion, agregamos los servicios. */
		if(typeof(req.body.services) != 'undefined'){
			req.body.services.forEach(function(v,i){
				diccionario = []
				services = new Array
				diccionario.push({'regex':'_name_','value':v.name})
				diccionario.push({'regex':'_fibercorpID_','value':fibercorpID})
				var type
				switch(v.type){
					case "in":
						type = "ClusterIP"
						break
					case "out":
					case "url":
						type = "NodePort"
				}
				diccionario.push({'regex':'_type_','value':type})
				diccionario.push({'regex':'_labeltype_','value':v.type})
				var ports= "ports:\n"
				if(v.type == "in" || v.type == "out"){
					v.ports.forEach(function(v,i){
						ports += '       - name: ' + v.name + '\n'
						ports += '         port: ' + v.port + '\n'
						ports += '         protocol: ' + v.protocol + '\n'
						ports += '         targetPort: ' + v.port + '\n'
					})
				} else {
					/* Tenemos que generar los puertos de htt y https
 					   si el tipo es url (Ingress) */
					portSet = new Set
					v.urls.forEach(function(v,i){
						portSet.add(v.port)
					})
					portSet.forEach(function(v,i){
						ports += '       - name: ingress' + v + '\n'
						ports += '         port: ' + v + '\n'
						ports += '         protocol: TCP' +  '\n'
						ports += '         targetPort: ' + v + '\n'
					})
				}
				diccionario.push({'regex':'_ports_','value':ports})
				const url = '/api/v1/namespaces/' + namespaceName + '/services'
				services.push(k8s_api.call(url,'POST','alta_service.yaml',diccionario))
			})
			return Promise.all(services)
		} else {
			console.log("No hay servicios")
            return new Promise((resolv,reject) => { resolv()})
		}
	},err=>{
		console.log("Fallo alta Deploy en K8s")
		console.log(err)
		return new Promise((resolv,reject)=>{
			res.status(err.status).send(err.message)
		})
	})
	.then(ok=>{
		/* Necesitamos obtener los Ingress del deployment.
		 * Esto solo si es una modificacion ya que deberemos
		 * eliminar los Ingress y generarlos nuevamente con
		 * los cambios si correspondiese.*/
		if(!alta){
			return k8s_api.call('/apis/networking.k8s.io/v1beta1/namespaces/' + namespaceName +
					  		    '/ingresses?labelSelector=fibercorpIngress%3D' + fibercorpID
								,'GET','none.yaml',{})
		} else {
			console.log("NO boramos NAAAADA")
			/* no hago nada ya que es un alta */
            return new Promise((resolv,reject) => { resolv()})
		}
	},err=>{
		console.log(err)
		return new Promise((resolv,reject)=>{
			res.status(500).send("Json del Body incorrecto: " + err)
		})
	})
	.then(ok=>{
		/* Borramos los posibles Ingress existentes para este
		 * deploy. Es el mismo procedimiento que para los services
		 * Si corresponde, los crearemos nuevamente luego */
		if(!alta){
			/* ok son los datos de la consulta que obtuvo los servicios */
			ok.message.items.forEach(function(v,i){
				console.log("Eliminamos " + JSON.stringify(v))
				services.push(k8s_api.call('/apis/networking.k8s.io/v1beta1/namespaces/' +
					namespaceName + '/ingresses/' + v.metadata.name
					,'DELETE','none.yaml',{}))
			})
			return Promise.all(services)
		} else {
			/* No hago nada. Ya que al ser un alta no hay nada que borrar */
            return new Promise((resolv,reject) => { resolv()})
		}
	},err=>{
		console.log("Fallo alta o update Servicio en K8s")
		console.log(err)
		errorPrevio = err
		if(alta){
			/* Boramos el deployment */
			const url = '/apis/apps/v1/namespaces/' + namespaceName +
						'/deployments/' + req.body.deployName
			k8s_api.call(url,'DELETE','none.yaml',[])
			.then(ok=>{
				res.status(500).send(errorPrevio.message)
			},err=>{
				console.log("Fallo borrado deployment en K8s")
				console.log(err)
				res.status(err.status).send(err.message)
			})
		} else {
			res.status(500).send(errorPrevio.message)
		}
	})
	.then(ok =>{
		/* Sea un alta o modificacion, agregamos los Ingress. Solo
		 * de aquellos servicios que sean del tipo url.  */
		diccionario = []
		diccionario.push({'regex':'_fibercorpID_','value':fibercorpID})
		diccionario.push({'regex':'_name_','value':'ingress-' + req.body.deployName})
		var ingress = ''
		if(typeof(req.body.services) != 'undefined'){
			req.body.services.forEach(function(v,i){
				if(v.type == 'url'){
					var serviceName = v.name
					v.urls.forEach(function(v,i){
						ingress += '    - host: ' + v.url + '\n'
						ingress += '      http:\n'
						ingress += '        paths:\n'
						ingress += '        - path: ' + v.path + '\n'
						ingress += '          backend:\n'
						ingress += '            serviceName: ' + serviceName + '\n'
						ingress += '            servicePort: ' + v.port + '\n'
					})
				}
			})
			diccionario.push({'regex':'_hostRule_','value':ingress})
			if(ingress != ''){
				const url = '/apis/extensions/v1beta1/namespaces/' +
							namespaceName + '/ingresses'
				return k8s_api.call(url,'POST','alta_ingress.yaml',diccionario)
			} else {
				/* No cargo ningun ingress */
				return new Promise((resolv,reject)=>{ resolv() })
			}
		}
	},err=>{
		console.log("Fallo alta Deploy en K8s")
		console.log(err)
		return new Promise((resolv,reject)=>{
			res.status(err.status).send(err.message)
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
	/* Retorna informacion sobre un deployment en particular
	 * con el formato que hemos establecido */

	var deployment
	var services
	var fibercorpID
	var namespaceName
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
		/* Guardamos los datos en una variable */
		deployment = ok.message
		fibercorpID = deployment.metadata.labels.fibercorpDeploy
		/* Obtenemos los service  del deployment buscando con el label 
 		 * fibercorpID. Con ello nos limitamos a los servicios del deployment */
		console.log("Enviando consulta a api K8S")
		return k8s_api.call('/api/v1/namespaces/' + namespaceName +
							'/services?labelSelector=fibercorpService%3D' + fibercorpID
							,'GET','none.yaml',{})
	},err => {
		console.log(err)
		res.status(err.status).send(err.message)
	})
	.then(ok => {
		//console.log(ok)
		services = ok.message.items
		/* Obtenemos los Ingress  del deployment buscando con el label 
 		 * fibercorpID. Con ello nos limitamos a los servicios del deployment */
		console.log("Enviando consulta a api K8S")
		return k8s_api.call('/apis/networking.k8s.io/v1beta1/namespaces/' + namespaceName +
				  		    '/ingresses?labelSelector=fibercorpIngress%3D' + fibercorpID
							,'GET','none.yaml',{})
	},err => {
		console.log(err)
		res.status(err.status).send(err.message)
	})
	.then(ok => {
		ingress = ok.message
		/* Generamos el Json en base al deployment obtenido de K8S */
		/* De momento es un solo tipo de container */
		var container = deployment.spec.template.spec.containers[0]
		data = {deployName:deployment.metadata.name,
				fibercorpID: fibercorpID,
				replicas:deployment.spec.replicas,
				containerName:container.name,
				image:container.image,
				resources:{
					cpu:container.resources.requests.cpu,
					mem:container.resources.requests.memory
				},
				args:[],
				envs:[],
				services:[],
				volumes:[]
				}
		//console.log(data)
		if(typeof(container.args) != 'undefined'){
			container.args.forEach(function(v,i){
				data.args.push(v)
			})
		}
		if(typeof(container.env) != 'undefined'){
			container.env.forEach(function(v,i){
				if(typeof(v.valueFrom) != 'undefined'){
					var env = {name:v.name,type:'secret',
							   secret:v.valueFrom.secretKeyRef.name,
							   key:v.valueFrom.secretKeyRef.key}
				} else {
					var env = {name:v.name,type:'text',value:v.value}
				}
				data.envs.push(env)
			})
		}
		if(typeof(services) != 'undefined'){
			services.forEach(function(v,i){
				service = '{"name":"' + v.metadata.name + '",'
				service += '"type":"' + v.metadata.labels.type + '",'
				if(v.metadata.labels.type != 'url'){
					service += '"ports":[]}'
					service = JSON.parse(service)
					v.spec.ports.forEach(function(w,j){
						service.ports.push({name:w.name,protocol:w.protocol,port:w.targetPort})
					})
				} else {
					service += '"urls":[]}'
					service = JSON.parse(service)
					ingress.items.forEach(function(w,j){
						w.spec.rules.forEach(function(x,k){
							console.log("COMPARAMOS " + x.http.paths[0].backend.serviceName + " == " + v.metadata.name)
							if(x.http.paths[0].backend.serviceName == v.metadata.name){
								/* Es una regla del servicio en cuestion */
								service.urls.push( {url:x.host,
													path:x.http.paths[0].path,
													port:x.http.paths[0].backend.servicePort})
							}
						})
					})
				}
				data.services.push(service)
			})
		}
		if(typeof(container.volumeMounts) != 'undefined'){
			container.volumeMounts.forEach(function(v,i){
				/* Recorrer los volumenes declarados en el deploy y buscar por nombre */
				var i = 0
				var volumes = deployment.spec.template.spec.volumes
				var encontre = false
				while (i < volumes.length && !encontre){
					if(volumes[i].name == v.name){
						encontre=true
						if(typeof(volumes[i].persistentVolumeClaim) != 'undefined'){
							/* Es un PVC */
							data.volumes.push({
								name:v.name,
								path:v.mountPath,
								type:'pvc',
								pvc:volumes[i].persistentVolumeClaim.claimName})
						} else { if(typeof(volumes[i].secret) != 'undefined'){
							/* Es un secret */
							data.volumes.push({
							name:v.name,path:v.mountPath,type:'secret',secret:"secret"})
							} else {
								/* Si no es nada de lo anterior entonces es un emptydir */
								data.volumes.push({
								name:v.name,path:v.mountPath,type:'emptydir'})
							}
						}
					}
					i++
				}
			})
		}
		res.status(ok.status).send(data)
	},err => {
		console.log(err)
		res.status(err.status).send(err.message)
	})

},

status: function(req,res){
	var deployment
	var services
	var fibercorpID
	var namespaceName
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
	 * del deployment */
	var deployment
	var services
	var pods
	var fibercorpID
	var namespaceName
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
		/* Debemos obtener los datos del deploy y de ellos sacar el selector
		 * a utilizar para buscar sus pods */
		namespaceName = ok
		console.log("Enviando consulta a api K8S")
		console.log("namespaceName:" + namespaceName + " deployment:" + req.params.deploymentName)
		return k8s_api.call('/apis/apps/v1/namespaces/' + namespaceName +
							'/deployments/' + req.params.deploymentName
							,'GET','none.yaml',{})
	}, err => {
		console.log(err)
		return new Promise((resolv,reject) => {
			res.status(err.code).send(err.message)
		})
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
	},err=>{
		return new Promise((resolv,reject)=>{
			res.status(err.code).send(err.message)
		})
	})
	.then(ok=>{
		/* Buscamos los Eventos de los pods */
		pods = ok.message
		return k8s_api.call('/apis/events.k8s.io/v1beta1/namespaces/' + namespaceName +
                            '/events','GET','none.yaml',{})
	},err=>{
		return new Promise((resolv,reject)=>{
			res.status(err.code).send(err.message)
		})
	})
	.then(events=>{
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
	},err=>{
		res.status(err.code).send(err.message)
	})

},

drop: function(req,res){
},

}
