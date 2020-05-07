module.exports = {
	code: function(text){
		text = text.replace("=","%3D")
		text = text.replace("/","%2F")
		text = text.replace("-","%2D")
		return text
	}
}
