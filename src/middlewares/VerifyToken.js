import jwt from 'jsonwebtoken';
import config from './../../config.js';

function VerifyToken(req, res, next){
	var token = req.body.token;
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