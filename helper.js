module.exports = {

	makeid: function(length) {
		var result           = '';
		var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		//var characters       = 'abcdefghijklmnopqrstuvwxyz0123456789';
		var charactersLength = characters.length;
		for ( var i = 0; i < length; i++ ) {
			result += characters.charAt(Math.floor(Math.random() * charactersLength));
		}
		return result;
	},

	enviarError: function(res,err){
		console.log(err)
		return new Promise((resolv,reject) => {
       	    res.status(err.status).send(err.message)
		})
	},

	compare: function(k1,k2){
		return JSON.stringify(k1) === JSON.stringify(k2)
	}
}
