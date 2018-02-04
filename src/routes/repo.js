import VerifyToken from '../middlewares/VerifyToken';

var repoRoutes = require('express').Router();

repoRoutes.get('/', (req, res) => {res.send('Repo root')});

repoRoutes.post('/create', VerifyToken, (req, res) => {
	
	res.json({name: req.body.name});
});

export default repoRoutes;