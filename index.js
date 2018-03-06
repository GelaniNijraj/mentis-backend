import Express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import fs from 'fs';

import VerifyToken from './src/middlewares/VerifyToken';

import config from './config';
import User from './src/models/User';
import userRoutes from './src/routes/user';
import repoRoutes from './src/routes/repo';

var app = new Express();
var router = require('express').Router();

// allowing cross origin
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// parsing params from body
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true }));

// loading routes
app.get('/api', (req, res) => res.send('Mentis API'));

// authenticating remote cloning
app.get('/auth_git', (req, res) => {
	// TODO: check if repo is public. If yes, then skip auth.
	console.log("authenticating");
	console.log(req.headers);
	// console.log(req);
	// res.status(200).json({success: true});

		// res.status(401).json({success: false});
	if(req.headers.authorization != undefined){
		var authHeader = req.headers.authorization;
		authHeader = authHeader.substr(authHeader.search(' ') + 1, authHeader.length); // stripping 'Basic '
		var decoded = Buffer.from(authHeader, 'base64').toString().split(':');
		var username = decoded[0], password = decoded[1];
		User.matches(username, password, (matches) => res.status(matches ? 200 : 401).json({success: false}));
	}else{
		res.status(401).json({success: false});
	}
});
app.use('/api/user', userRoutes);
app.use('/api/repo', repoRoutes);

//setting config vars
app.set('jsonsecret', config.apisecret);
app.set('storagedir', config.storagedir);
app.set('httproot', config.httproot);

// connecting to the database
mongoose.connect('mongodb://127.0.0.1/mentis');
var db = mongoose.connection;
app.locals.db = db;
db.on('error', () => console.error.bind(console, "Can not connect to the database"));
db.once('open', function() {
	console.log("Connected to the database..");
	app.listen(3000, () => console.log('app listening on port 3000!'));
});