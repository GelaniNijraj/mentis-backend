import jwt from 'jsonwebtoken';
import config from './../../config.js';

function VerifyToken(req, res, next){
	let token = req.body.token;
	if(token == undefined)
		token = req.query.token;
	if(token){
		jwt.verify(token, req.app.get('jsonsecret'), (err, decoded) => {
			if(err){
				res.json({
					success: false,
					message: "invalid token provided"
				});
			}else{
				req.decoded = decoded;
				next();
			}
		});
	}else{
		res.status(403).send({
			success: false,
			message: "invalid token provided"
		});
	}
}

export default VerifyToken;