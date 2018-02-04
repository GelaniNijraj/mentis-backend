import Express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';

import VerifyToken from './src/middlewares/VerifyToken';

import config from './config';
import userRoutes from './src/routes/user';
import repoRoutes from './src/routes/repo';

var app = new Express();
var router = require('express').Router();

// parsing params from body
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true }));

// loading routes
app.get('/api', (req, res) => res.send('Mentis API'));
app.use('/api/user', userRoutes);
app.use('/api/repo', repoRoutes);

//setting config vars
app.set('jsonsecret', config.secret);

// connecting to the database
mongoose.connect('mongodb://127.0.0.1/mentis');
var db = mongoose.connection;
app.locals.db = db;
db.on('error', () => console.error.bind(console, "Can not connect to the database"));
db.once('open', function() {
	console.log("Connected to the database..");
	app.listen(3000, () => console.log('app listening on port 3000!'));
});