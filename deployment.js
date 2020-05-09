const K8sApi = require("./k8s_api.js")
const NamespaceApi = require("./namespace.js")
const helper = require("./helper.js")

module.exports = {


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
			   typeof req.body.containerName == 'undefined' ||
			   typeof req.body.resources.cpu == 'undefined' ||
			   typeof req.body.resources.mem == 'undefined' ||
			   typeof req.body.image == 'undefined' ||
			   typeof req.body.replicas == 'undefined')
					reject("Revisar los valores deployName, containerName, " +
						   "resources.cpu, resources.mem, image y replicas")
			diccionario.push({'regex':'_deploy_name_','value':req.body.deployName})
			diccionario.push({'regex':'_container_name_','value':req.body.containerName})
			diccionario.push({'regex':'_cpu_request_','value':req.body.resources.cpu})
			diccionario.push({'regex':'_mem_request_','value':req.body.resources.mem})
			diccionario.push({'regex':'_replicas_','value':req.body.replicas})
			diccionario.push({'regex':'_image_name_','value':req.body.image})
			/* Args */
			if(typeof(req.body.args) != 'undefined'){
				data = "args:\n"
				for(i=0;i<req.body.args.length;i++){
					data = data + "           - " + req.body.args[i] + "\n"
				}
			} else {
				data = ''
			}
			diccionario.push({'regex':'_args_','value':data})
		
			/* Env */
			if(typeof(req.body.envs) != 'undefined'){
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
		
			/* Servicios */
			if(typeof(req.body.services) != 'undefined'){
				for(i=0;i<req.body.services.length;i++){
				    if(typeof req.body.services[i].name == 'undefined'||
				       typeof req.body.services[i].type == 'undefined'){
							reject("ACA3")
					}
				    if((req.body.services[i].type == 'out' ||
				       req.body.services[i].type == 'in') &&
					   typeof(req.body.services[i].ports) == 'undefined'){
							reject("Falta definir puertos")
					}
					if(req.body.services[i].type == 'out' &&
					   typeof(req.body.services[i].ip) == 'undefined'){
							reject("Falta IP")
					}
					if(req.body.services[i].type == 'url' &&
					   typeof(req.body.services[i].urls) == 'undefined'){
							reject("Falta la URL")
					}
					if(req.body.services[i].type != 'url' &&
					   typeof(req.body.services[i].ports) == 'undefined'){
							reject("Falta definir puertos")
					}
					data = 'ports:\n'
					if(req.body.services[i].type != 'url'){
						/* Revisamos los puertos */
						for(j=0;j<req.body.services[i].ports.length;j++){
							var port = req.body.services[i].ports[j]
							if(typeof port.protocol == 'undefined'||
		                       typeof port.port == 'undefined')
									reject("Puerto mal cargado")
							data += '           - containerPort: ' + port.port + '\n'
							data += '             name: ' + port.name + '\n'
							data += '             protocol: ' + port.protocol + '\n'
						}
					} else {
						/* Revisamos los URL */
						ports = new Set
						for(j=0;j<req.body.services[i].urls.length;j++){
							var url = req.body.services[i].urls[j]
							if(typeof url.path == 'undefined'||
		                       typeof url.port == 'undefined' ||
		                       typeof url.path == 'undefined')
									reject("URL mal declarada.")
							ports.add(url.port)
						}
						ports.forEach(function(v,i){
							data += '           - containerPort: ' + v + '\n'
							data += '             name: ingress' + v + '\n'
							data += '             protocol: TCP\n'
						})
					}
				}
				data = data.slice(0, -1)
				//console.log('PORTS: ' + data)
			} else {
				data = ''
			}
			diccionario.push({'regex':'_ports_','value':data})
		
			/* volumes Mount */
			if(typeof(req.body.volumes) != 'undefined'){
				data = 'volumeMounts:\n'
				for(i=0;i<req.body.volumes.length;i++){
				    if(typeof req.body.volumes[i].name == 'undefined'||
				       typeof req.body.volumes[i].path == 'undefined')
							reject("Volumen mal declarado")
					data = data + '           - name: ' + req.body.volumes[i].name + '\n'
					data = data + '             mountPath: ' + req.body.volumes[i].path + '\n'
				}
				data = data.slice(0, -1)
			} else {
				data = ''
			}
			diccionario.push({'regex':'_volume_mounts_','value':data})
	
			/* volumneDef */
			if(typeof(req.body.volumes) != 'undefined'){
				data = 'volumes:\n'
				//claimTemplates = 'volumeClaimTemplates:\n'
				for(i=0;i<req.body.volumes.length;i++){
				    if(typeof(req.body.volumes[i].name) == 'undefined' ||
				       typeof(req.body.volumes[i].type) == 'undefined')
							reject("ACA5")
					data += '         - name: ' + req.body.volumes[i].name + '\n'
					switch(req.body.volumes[i].type){
						case "emptydir":
							data += '           ' + req.body.volumes[i].type + ': {}\n'
							break
						case "pvc":
							/* Para un pvc ya existente */
							if(typeof req.body.volumes[i].pvc == 'undefined')
								reject("Falta especificar el volumen")
							data += '           persistentVolumeClaim:\n'
							data += '             claimName: ' +
								   req.body.volumes[i].pvc + '\n'
							break
						case "secret":
							if(typeof req.body.volumes[i].secret == 'undefined')
								reject("Falta especificar en secret")
							data += '           secret:\n'
							data += '             secretName: ' +
								   req.body.volumes[i].secret + '\n'
							break
						/*
						case "local":
							if(typeof req.body.volumes[i].size == 'undefined')
								reject("Falta especificar local")
							claimTemplates += '   - metadata:\n'
							claimTemplates += '      name: ' +
								   req.body.volumes[i].name + '\n'
							claimTemplates += '      spec:\n' 
							claimTemplates += '      	storageClassName: csi-rbd-sc\n'
							claimTemplates += '         resources:\n' 
							claimTemplates += '            requests:\n'
							claimTemplates += '               storage:' +
								   req.body.volumes[i].size + '\n'
							break
						*/
						default:
							reject("Tipo volumen " + req.body.volumes[i].type + " no permitido")
					}
				}
				data = data.slice(0, -1)
			} else {
				data = ''
			}
			/* if(claimTemplates == 'volumeClaimTemplates:\n')
				claimTemplates ==''
			diccionario.push({'regex':'_claimTemplates_','value':claimTemplates}) */
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
				data.envs.push({name:v.name,value:v.value})
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
		/* Debemos obtener los datos del deploy y de ellos sacar el
 		 * fibercorpID */
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
		var fibercorpID = ok.message.metadata.labels.fibercorpDeploy
		/* Buscamos los pods de este deployment */
		return k8s_api.call('/api/v1/namespaces/' + namespaceName +
							'/pods?labelSelector=fibercorpPod%3D' +
							 fibercorpID,'GET','none.yaml',{})
	},err=>{
		res.status(err.code).send(err.message)
	})
	.then(ok=>{
		res.send(ok.message)
	},err=>{
		res.status(err.code).send(err.message)
	})
},

drop: function(req,res){
},

}
