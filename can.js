/* API que se encarga de generar los
 * productos enlatados. Nos valemos
 * de Helm para realizar esto */

const K8sApi = require("./k8s_api.js")

module.exports = {

catalogo: function(req,res){
	/* Informa el catalogo de los productos
	   disponibles. A futuro se podría
	   mostrar distintos catalogos dependiendo
	   del tipo o categoría del usuario */
},

list: function(req,res){
	/* Lista las implementaciones de un usuario */
},

show: function(req,res){
	/* Muestra el estado de la implementacion de un usuario */
},

install: function(req,res){
	/* Permite realizar una instalacion */
},

uninstall: function(req,res){
	/* Permite realizar una des-instalacion */
}

} // Fin del modulo
