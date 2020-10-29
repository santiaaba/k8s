const K8sApi = require("./k8s_api.js")
const NamespaceApi = require("./namespace.js")
const helper = require("./helper.js")


module.exports = {

apply: function(req,res){
	/* Aplica un servicio. No hay basicamente diferencia entre alta y modificacion.
	 * Si el servicio ya existia entonces se borra y se crea nuevamente */

	function altaIngress(req,fibercorpID,serviceName){
		var diccionario = []
		var ingress = ''
		console.log("Agregando Ingress")
		diccionario.push({'regex':'_fibercorpID_','value':fibercorpID})
		diccionario.push({'regex':'_serviceName_','value':serviceName})
		if(typeof(req.body.urls) != 'undefined'){
			req.body.urls.forEach(function(v,i){
				ingress += '    - host: ' + v.url + '\n'
				ingress += '      http:\n'
				ingress += '        paths:\n'
				ingress += '         - path: ' + v.path + '\n'
				ingress += '           backend:\n'
				ingress += '             serviceName: ' + serviceName + '\n'
				ingress += '             servicePort: ' + v.port + '\n'
			})
		}
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

	var diccionario = new Array
	var serviceName
	var namespaceName
	var deploy
	var labels = []
	var alta = true
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
		/* Obtuvimos el nombre del Namespace */
		namespaceName = name
		console.log("Generamos el diccionario")
		if(typeof req.body.fibercorpID != 'undefined'){
			console.log("Poseemos en el JSON del Body un fibercorpID por lo tanto es una modificacion")
			fibercorpID = req.body.fibercorpID
		//	alta = false
		} else {
			fibercorpID = helper.makeid(32)
		}
		diccionario.push({'regex':'_fibercorpID_','value':fibercorpID})

		if(	typeof req.body.name == 'undefined' ||
			typeof req.body.type == 'undefined' ||
			typeof req.body.target == 'undefined')
				return new Promise((resolv,reject) => {
					reject({status:303,message:"Faltan parametros name, type,target"})
				})
		switch(req.body.type){
			case "in":
				diccionario.push({regex:'_type_',value:'ClusterIP'})
				break
			case "out":
			case "url":
				diccionario.push({regex:'_type_',value:'NodePort'})
		}
		serviceName = req.body.name
		diccionario.push({regex:'_labeltype_',value:req.body.type})
		diccionario.push({regex:'_deployName_',value:req.body.target})
		diccionario.push({regex:'_name_',value:serviceName})
		console.log("Averiguamos el deploy en k8s")
		/* Determinamos los labels y puertos en base al nombre del deploy */
		const url = '/apis/apps/v1/namespaces/' + namespaceName + '/deployments/' +
					req.body.target
		return k8s_api.call(url,'GET','none.yaml',{})
	}, err=>{
		/* No pudimos obtener el nombre del Namespace */
		return new Promise((resolv,reject) => {
			res.status(err.code).send(err.message)
		})
	})
	.then(ok=>{
		/* Ya obtenidos los datos del deployment buscamos sus puertos y labels */
		deploy = ok.message
		console.log("Obtenemos los labels y puertos")
		labels = ok.message.metadata.labels
		var ports = []
		ok.message.spec.template.spec.containers.forEach(function(v,i){
			if(typeof(v.ports) != 'undefined'){
				v.ports.forEach(function(w,j){
					ports.push(w)
				})
			}
		})

		/* Generamos el selector del service en base a los labels obtenidos */
		var data = ''
		Object.keys(labels).forEach(function(v,i){
			data += "      " + v + ": " + labels[v] + "\n"
		})
		diccionario.push({regex:'_selectors_',value:data})
		/* chequeamos que los puertos solicitados existan
 		 *	en el array ports del Deploy */

		var ports_string = ''
		if(req.body.type == "in" || req.body.type == "out"){
			/* Si es IN o OUT el tipo, entonces hay que declarar
			 * puertos que deberian estar entre los declarados en
			 * el deployment */
			var todoOK = true
			req.body.ports.forEach(function(v,i){
				var existePuerto = false
				ports.forEach(function(w,j){
					console.log("Comaprando: " + w.containerPort + " == " +
								v.port + " && " + w.protocol + " == " + v.protocol)
					if(w.containerPort == v.port && w.protocol == v.protocol)
						existePuerto = true
				})
				if(existePuerto){
					ports_string += '      - port: ' + v.port + '\n'
					ports_string += '        protocol: ' + v.protocol + '\n'
					ports_string += '        name: ' + v.name + '\n'
					ports_string += '        targetPort: ' + v.port + '\n'
				} else {
					todoOK = false
				}
			})
			if(!todoOK){
				console.log("Hay puertos en el service que no existen en el Deploy")
				return new Promise((resolv,reject) => {
					reject({status:303,message:"Puertos no existen en el deploy"})
				})
			}
		} else {
			/* El tipo es una "url" y generamos nosotros los puertos */
			portSet = new Set
			req.body.urls.forEach(function(v,i){
				portSet.add(v.port)
			})
			portSet.forEach(function(v,i){
				ports_string += '     - name: ingress' + v + '\n'
				ports_string += '       port: ' + v + '\n'
				ports_string += '       protocol: TCP' +  '\n'
				ports_string += '       targetPort: ' + v + '\n'
			})
		}
		diccionario.push({regex:'_ports_',value:ports_string})

		/* Eliminamos el service actual si existiese*/
		console.log("Borramos el servicio actual ya que es una modificacion")
		return k8s_api.call('/api/v1/namespaces/' + namespaceName +
			  '/services/' + serviceName,'DELETE','none.yaml',{})
	},err => {
		return new Promise((resolv,reject)=>{
			console.log(err)
			res.status(err.status).send(err.message)
		})
	})
	.then(ok=>{
		/* Damos de alta el servicio */
		console.log("Existia pero ya no. Damos de alta el servicio")
		const url = '/api/v1/namespaces/' + namespaceName + '/services'
		return k8s_api.call(url,'POST','alta_service.yaml',diccionario)
	},err=>{
		/* El borrado del servicio retorna codigo 404 si no existe */
		if(err.status == 404){
			console.log("Servicio no existia. Damos de alta el servicio")
			const url = '/api/v1/namespaces/' + namespaceName + '/services'
			return k8s_api.call(url,'POST','alta_service.yaml',diccionario)
		}
		console.log(err)
		return new Promise((resolv,reject)=>{
			res.status(err.status).send(err.message)
		})
	})
	.then(ok=>{
		/* Borramos el posibles Ingress existentes para este deploy. El
 		 * nombre del Ingress es "Ingress_" + nombre servicio*/
		console.log("Borramos posibles Ingress")
		return k8s_api.call('/apis/networking.k8s.io/v1beta1/namespaces/' +
							   namespaceName + '/ingresses/' +
								"ingress-" + serviceName
							   ,'DELETE','none.yaml',{})
	},err=>{
		console.log(err)
		return new Promise((resolv,reject)=>{
			res.status(500).send("Json del Body incorrecto: " + err)
		})
	})
	.then(ok =>{
	/* Sea un alta o modificacion, agregamos los Ingress. Solo
	 * de aquellos servicios que sean del tipo url.  */
		return altaIngress(req,fibercorpID,serviceName)
	},err=>{
		console.log("Fallo alta Deploy en K8s o Ingress no existia")
		if(err.status == 404){
			return altaIngress(req,fibercorpID,serviceName)
		}
		console.log(err)
		return new Promise((resolv,reject)=>{
			res.status(err.status).send(err.message)
		})
	})
	.then(name=>{
		console.log("servicio dado de alta!!")
		console.log("Implementar alta en equipo que realiza NAT/PAT")
		return new Promise((resolv,reject)=>{
			res.send("Servicio generado")
		})
	},err=>{
		/* Fallo el alta del Ingress. Debemos borrar el servicio */
		console.log(err)
		console.log("Fallo alta Servicio en K8s")
		const url = '/api/v1/namespaces/' + namespaceName +
					'/services/' + serviceName
		return k8s_api.call(url,'DELETE','none.yaml',{})
	})
	.then(name=>{
		console.log("servicio eliminado por no poder dar de alta el Ingress!!")
		res.status(500).send("Error al querer generar el Ingress")
	},err=>{
		console.log("servicio eliminado por no poder dar de alta el Ingress!!")
		res.status(500).send("Error FATAL. Quedo servicio sin ingress")
	})

},

list: function(req,res){
	/* Retorna los servicios de un namespace */

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

	var k8s_api = new K8sApi(config.k8s_api_url,config.k8s_api_port)
	var k8sService
	var servicio
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
	.then(ok => {
		/* Tenemos el servicio */
		k8sService = ok.message
		if(	typeof(ok.message.metadata.labels.type) == 'undefined' ||
			typeof(ok.message.metadata.labels.deploy) == 'undefined'){
				return new Promise((resolv,reject)=>{
					reject({code:303,message:'Al servicio le falta el label deploy o type'})
				})
		}
		servicio = {name:ok.message.metadata.name,
					type:ok.message.metadata.labels.type,
					namespace:namespaceName,
					fibercorpID:ok.message.metadata.labels.fibercorpID,
					target:ok.message.metadata.labels.deploy}
		/* Es target es el nombre del deploy. Debemos buscar el deploy
		/* En base a los labels que tenemos en el selector del service */
		if(servicio.type == 'url'){
			/* Si es del tipo url debemos buscar los Ingress */
			return k8s_api.call('/apis/networking.k8s.io/v1beta1/namespaces/' + namespaceName +
                                '/ingresses/ingress-' + servicio.name
                                ,'GET','none.yaml',{})
		
		} else {
			/* Debemos cargar los puertos del service */
			servicio.ports = []
			k8sService.spec.ports.forEach(function(v,i){
				servicio.ports.push({name:v.name,port:v.port,protocol:v.protocol})
			})
			return new Promise((resolv,reject)=>{
				resolv()
			})
		}
		
	},err => {
		console.log(err)
		return new Promise((resolv,reject) => {
			res.status(err.status).send(err.message)
		})
	})
	.then(ok => {
		console.log(JSON.stringify(ok))
		if(servicio.type == 'url'){
			/* Obtuvimos el ingress y debemos obtener sus datos */
			servicio.urls=[]
			ok.message.spec.rules.forEach(function(v,i){
				servicio.urls.push({
						url:v.host,
						path:v.http.paths[0].path,
						port:v.http.paths[0].backend.servicePort
				})
			})
		} else {
			/* Venimos de cargar los puertos. No hay nada mas que hacer */
  		}
		res.send(servicio)
	})
	.catch(err => {
		console.log(err)
		res.status(err.code).send(err.message)
	})
},

delete: function(req,res){
	var k8s_api = new K8sApi(config.k8s_api_url,config.k8s_api_port)
	var servicio
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
		/* buscamos el servicio */
		return k8s_api.call('/api/v1/namespaces/' + namespaceName +
               		     '/services/' + req.params.serviceName ,'GET','none.yaml',{})
	},err=>{
		console.log(err)
		return new Promise((resolv,reject) => {
			res.status(err.code).send(err.message)
        })
	})
	.then(ok=>{
		/* Obtuvimos el servicio */
		servicio = ok.message
		if(servicio.metadata.labels.type == 'url'){
			/* Debemos borrar el Ingress asociado */
			return k8s_api.call('/apis/networking.k8s.io/v1beta1/namespaces/' +
								namespaceName + '/ingresses/ingress-' +
								req.params.serviceName,'DELETE','none.yaml',{})
		} else {
			/* Pasamos al siguiente paso */
			return new Promise((resolv,reject)=>{
				resolv()
			})
		}
	},err=>{
		console.log(err)
		return new Promise((resolv,reject) => {
			res.status(err.status).send(err.message)
        })
	})
	.then(ok=>{
		/* Ya hemos borrado el ingress si es que correspondía */
		/* Podemos borrar el servicio */
		return k8s_api.call('/api/v1/namespaces/' + namespaceName +
                  '/services/' + req.params.serviceName,'DELETE','none.yaml',{})
	},err=>{
		console.log(err)
		return new Promise((resolv,reject) => {
			res.status(err.code).send(err.message)
        })
	})
	.then(ok=>{
		res.send('Servicio eliminado')
	},err=>{
		console.log(err)
		res.status(err.code).send(err.message)
	})
}

}
