var express = require('express')
var Database = require('./db.js')
var api_namespace = require('./namespace.js')
var api_pod = require('./pod.js')
var api_deployment = require('./deployment.js')
var api_service = require('./service.js')
var bodyParser = require("body-parser")
var cors = require('cors')

var app = express()
var pool
const port = 1234

/*****************************
 *		Main		
 *****************************/

db = new Database

app.use(bodyParser.json())

/* Namespase */
app.get("/v1/user/:userid/namespace/:namespaceid", function(req,res){api_namespace.show(req,res)})
app.get("/v1/user/:userid/namespace", function(req,res){api_namespace.list(req,res)})
app.post("/v1/user/:userid/namespace", function(req,res){api_namespace.nuevo(req,res)})
app.delete("/v1/user/:userid/namespace/:namespaceid", function(req,res){api_namespace.drop(req,res)})

/* Pods */
app.get("/v1/user/:userid/namespace/:namespaceid/pod/:podName", function(req,res){api_pod.show(req,res)})
app.get("/v1/user/:userid/namespace/:namespaceid/pod", function(req,res){api_pod.list(req,res)})

/* Services */
app.get("/v1/user/:userid/namespace/:namespaceid/service/:serviceName", function(req,res){api_service.show(req,res)})
app.get("/v1/user/:userid/namespace/:namespaceid/service", function(req,res){api_service.list(req,res)})

/* Deployments */
app.get("/v1/user/:userid/namespace/:namespaceid/deployment/:deploymentName", function(req,res){api_deployment.show(req,res)})
app.get("/v1/user/:userid/namespace/:namespaceid/deployment", function(req,res){api_deployment.list(req,res)})
app.post("/v1/user/:userid/namespace/:namespaceid/deployment", function(req,res){api_deployment.create(req,res)})

app.listen(port,function(){
        console.log("Nose server running on http://10.120.78.86:" + port)
        console.log('CORS-enabled')
})

